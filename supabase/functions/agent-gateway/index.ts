import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

import { getCorsHeaders } from "../_shared/cors.ts";

/**
 * Gateway do Robô de Comunicação (agente local instalado na máquina/servidor do cliente).
 *
 * Autenticação: header `x-agent-token` com o token gerado no sistema.
 * O banco guarda apenas o SHA-256 do token (`communication_agents.token_hash`).
 *
 * Ações (POST { action, ... }):
 *  - handshake        -> confirma credenciais e devolve configuração do agente
 *  - heartbeat        -> sinal de vida + IPs/versão (atualiza status online)
 *  - discovery        -> lista de relógios encontrados na rede (upsert em discovered_devices)
 *  - equipment        -> equipamentos adotados que o agente deve gerenciar
 *  - pull_commands    -> comandos pendentes para executar
 *  - command_result   -> resultado da execução de um comando
 *  - employees        -> cadastro de funcionários a enviar para o relógio
 *  - employee_result  -> confirmação de gravação do funcionário no relógio
 *  - records          -> marcações coletadas do relógio
 *  - log              -> log livre de comunicação
 */

const sha256 = async (value: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
};

const IP = z.string().trim().min(3).max(64);

const DiscoveredSchema = z.object({
  ip_address: IP,
  port: z.number().int().min(1).max(65535).optional(),
  mac_address: z.string().trim().max(64).optional(),
  manufacturer: z.string().trim().max(64).optional(),
  model: z.string().trim().max(64).optional(),
  serial_number: z.string().trim().max(64).optional(),
  firmware_version: z.string().trim().max(64).optional(),
  protocol: z.string().trim().max(32).optional(),
  device_name: z.string().trim().max(120).optional(),
  reachable: z.boolean().optional(),
  details: z.record(z.unknown()).optional(),
});

const RecordSchema = z.object({
  equipment_id: z.string().uuid().optional(),
  identifier: z.string().trim().min(1).max(64),
  recorded_at: z.string().datetime({ offset: true }).or(z.string().min(10).max(40)),
  record_type: z.string().trim().max(32).optional(),
  nsr: z.number().int().optional(),
  raw: z.record(z.unknown()).optional(),
});

const BodySchema = z.object({
  action: z.enum([
    "handshake",
    "heartbeat",
    "discovery",
    "equipment",
    "pull_commands",
    "command_result",
    "employees",
    "employee_result",
    "records",
    "log",
  ]),
  hostname: z.string().trim().max(120).optional(),
  os_info: z.string().trim().max(160).optional(),
  agent_version: z.string().trim().max(32).optional(),
  local_ip: IP.optional(),
  public_ip: IP.optional(),
  mac_address: z.string().trim().max(64).optional(),
  devices: z.array(DiscoveredSchema).max(500).optional(),
  records: z.array(RecordSchema).max(2000).optional(),
  command_id: z.string().uuid().optional(),
  equipment_id: z.string().uuid().optional(),
  sync_id: z.string().uuid().optional(),
  device_user_id: z.string().trim().max(64).optional(),
  templates_synced: z.boolean().optional(),
  success: z.boolean().optional(),
  result: z.record(z.unknown()).optional(),
  error_message: z.string().trim().max(1000).optional(),
  message: z.string().trim().max(1000).optional(),
  limit: z.number().int().min(1).max(200).optional(),
});

serve(async (req) => {
  const corsHeaders = {
    ...getCorsHeaders(req),
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-agent-token",
  };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Método não permitido" }, 405);

  const token = req.headers.get("x-agent-token") ?? "";
  if (token.length < 16 || token.length > 200) {
    return json({ error: "Token do agente ausente ou inválido" }, 401);
  }

  let parsedBody: z.infer<typeof BodySchema>;
  try {
    parsedBody = BodySchema.parse(await req.json());
  } catch (e) {
    return json({ error: "Payload inválido", details: (e as Error).message }, 400);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const tokenHash = await sha256(token);
  const { data: agent, error: agentError } = await supabase
    .from("communication_agents")
    .select("*")
    .eq("token_hash", tokenHash)
    .eq("is_active", true)
    .maybeSingle();

  if (agentError) {
    console.error("[agent-gateway] erro ao buscar agente", agentError.message);
    return json({ error: "Falha ao autenticar o agente" }, 500);
  }
  if (!agent) return json({ error: "Agente não autorizado" }, 401);

  const now = new Date().toISOString();
  const b = parsedBody;

  // Toda requisição vale como sinal de vida.
  const liveness: Record<string, unknown> = {
    status: "online",
    last_heartbeat: now,
    updated_at: now,
  };
  if (b.hostname) liveness.hostname = b.hostname;
  if (b.os_info) liveness.os_info = b.os_info;
  if (b.agent_version) liveness.agent_version = b.agent_version;
  if (b.local_ip) liveness.local_ip = b.local_ip;
  if (b.public_ip) liveness.public_ip = b.public_ip;
  if (b.mac_address) liveness.mac_address = b.mac_address;
  await supabase.from("communication_agents").update(liveness).eq("id", agent.id);

  const agentConfig = {
    id: agent.id,
    name: agent.name,
    company_id: agent.company_id,
    auto_discovery: agent.auto_discovery,
    auto_adopt: agent.auto_adopt,
    discovery_ranges: agent.discovery_ranges,
    sync_interval_seconds: agent.sync_interval_seconds,
    settings: agent.settings,
    server_time: now,
  };

  try {
    switch (b.action) {
      case "handshake":
      case "heartbeat":
        return json({ success: true, agent: agentConfig });

      case "discovery": {
        const devices = b.devices ?? [];
        const adopted: string[] = [];

        for (const d of devices) {
          const { data: existing } = await supabase
            .from("discovered_devices")
            .select("id, equipment_id, status")
            .eq("company_id", agent.company_id)
            .eq("ip_address", d.ip_address)
            .maybeSingle();

          const row = {
            company_id: agent.company_id,
            agent_id: agent.id,
            ip_address: d.ip_address,
            port: d.port ?? null,
            mac_address: d.mac_address ?? null,
            manufacturer: d.manufacturer ?? null,
            model: d.model ?? null,
            serial_number: d.serial_number ?? null,
            firmware_version: d.firmware_version ?? null,
            protocol: d.protocol ?? null,
            device_name: d.device_name ?? null,
            reachable: d.reachable ?? true,
            details: d.details ?? {},
            last_seen: now,
            updated_at: now,
          };

          let deviceId = existing?.id as string | undefined;
          if (existing) {
            await supabase.from("discovered_devices").update(row).eq("id", existing.id);
          } else {
            const { data: inserted } = await supabase
              .from("discovered_devices")
              .insert(row)
              .select("id")
              .single();
            deviceId = inserted?.id;
          }

          // DHCP: se o relógio já é um equipamento cadastrado (mesmo serial/MAC) e o IP mudou,
          // atualiza automaticamente o cadastro no sistema.
          if (d.serial_number || d.mac_address) {
            const query = supabase
              .from("time_clock_equipment")
              .select("id, ip_address")
              .eq("company_id", agent.company_id);
            const { data: matches } = d.serial_number
              ? await query.eq("serial_number", d.serial_number).limit(1)
              : await query.eq("mac_address", d.mac_address!).limit(1);
            const match = matches?.[0];
            if (match) {
              if (match.ip_address !== d.ip_address) {
                await supabase
                  .from("time_clock_equipment")
                  .update({ ip_address: d.ip_address, updated_at: now })
                  .eq("id", match.id);
                await supabase.from("equipment_communication_logs").insert({
                  equipment_id: match.id,
                  company_id: agent.company_id,
                  status: "success",
                  request_type: "dhcp_ip_update",
                  message: `IP atualizado automaticamente para ${d.ip_address}`,
                });
              }
              if (deviceId) {
                await supabase
                  .from("discovered_devices")
                  .update({ equipment_id: match.id, status: "adopted" })
                  .eq("id", deviceId);
              }
              continue;
            }
          }

          // Adoção automática: cria o equipamento sem intervenção manual.
          if (agent.auto_adopt && deviceId && !existing?.equipment_id) {
            const { data: created } = await supabase
              .from("time_clock_equipment")
              .insert({
                company_id: agent.company_id,
                name: d.device_name || `${d.manufacturer ?? "REP"} ${d.ip_address}`,
                manufacturer: d.manufacturer ?? "generic",
                model: d.model ?? null,
                serial_number: d.serial_number ?? null,
                ip_address: d.ip_address,
                port: d.port ?? 3000,
                protocol: d.protocol ?? "tcp",
                is_active: true,
                is_online: true,
                last_communication: now,
              })
              .select("id")
              .single();
            if (created?.id) {
              adopted.push(created.id);
              await supabase
                .from("discovered_devices")
                .update({ equipment_id: created.id, status: "adopted" })
                .eq("id", deviceId);
            }
          }
        }

        return json({ success: true, received: devices.length, adopted });
      }

      case "equipment": {
        const { data: equipment } = await supabase
          .rpc("get_equipment_basic_info", { _company_id: agent.company_id });
        return json({ success: true, equipment: equipment ?? [] });
      }

      case "pull_commands": {
        const { data: commands } = await supabase
          .from("device_commands")
          .select("id, command, payload, equipment_id")
          .eq("company_id", agent.company_id)
          .or(`agent_id.eq.${agent.id},agent_id.is.null`)
          .eq("status", "pending")
          .order("created_at", { ascending: true })
          .limit(b.limit ?? 20);

        const ids = (commands ?? []).map((c) => c.id);
        if (ids.length) {
          await supabase
            .from("device_commands")
            .update({ status: "running", agent_id: agent.id, started_at: now, updated_at: now })
            .in("id", ids);
        }
        return json({ success: true, commands: commands ?? [] });
      }

      case "command_result": {
        if (!b.command_id) return json({ error: "command_id obrigatório" }, 400);
        const { data: cmd } = await supabase
          .from("device_commands")
          .select("id, attempts, equipment_id")
          .eq("id", b.command_id)
          .eq("company_id", agent.company_id)
          .maybeSingle();
        if (!cmd) return json({ error: "Comando não encontrado" }, 404);

        await supabase
          .from("device_commands")
          .update({
            status: b.success ? "done" : "failed",
            result: b.result ?? null,
            error_message: b.success ? null : (b.error_message ?? "Falha na execução"),
            attempts: (cmd.attempts ?? 0) + 1,
            finished_at: now,
            updated_at: now,
          })
          .eq("id", cmd.id);

        if (cmd.equipment_id) {
          await supabase.from("equipment_communication_logs").insert({
            equipment_id: cmd.equipment_id,
            company_id: agent.company_id,
            status: b.success ? "success" : "error",
            request_type: "agent_command",
            message: b.error_message ?? b.message ?? "Comando executado pelo robô",
            response_data: b.result ?? {},
          });
        }
        return json({ success: true });
      }

      case "employees": {
        const equipmentId = b.equipment_id;
        let query = supabase
          .from("employee_device_sync")
          .select("id, profile_id, equipment_id, device_user_id, operation")
          .eq("company_id", agent.company_id)
          .eq("status", "pending")
          .limit(b.limit ?? 100);
        if (equipmentId) query = query.eq("equipment_id", equipmentId);
        const { data: pending } = await query;

        const profileIds = [...new Set((pending ?? []).map((p) => p.profile_id))];
        const { data: profiles } = profileIds.length
          ? await supabase
            .from("profiles")
            .select("id, full_name, registration_number, pis, cpf, is_active")
            .in("id", profileIds)
          : { data: [] as Array<Record<string, unknown>> };

        const byId = new Map((profiles ?? []).map((p: any) => [p.id, p]));
        const employees = (pending ?? []).map((p) => {
          const profile: any = byId.get(p.profile_id) ?? {};
          return {
            sync_id: p.id,
            equipment_id: p.equipment_id,
            operation: p.operation,
            device_user_id: p.device_user_id,
            profile_id: p.profile_id,
            name: profile.full_name ?? "",
            registration_number: profile.registration_number ?? null,
            pis: profile.pis ?? null,
            cpf: profile.cpf ?? null,
            is_active: profile.is_active ?? true,
          };
        });

        if (employees.length) {
          await supabase
            .from("employee_device_sync")
            .update({ status: "sending", updated_at: now })
            .in("id", employees.map((e) => e.sync_id));
        }
        return json({ success: true, employees });
      }

      case "employee_result": {
        if (!b.sync_id) return json({ error: "sync_id obrigatório" }, 400);
        await supabase
          .from("employee_device_sync")
          .update({
            status: b.success ? "synced" : "error",
            device_user_id: b.device_user_id ?? null,
            templates_synced: b.templates_synced ?? false,
            error_message: b.success ? null : (b.error_message ?? "Falha ao gravar no relógio"),
            last_synced_at: b.success ? now : null,
            updated_at: now,
          })
          .eq("id", b.sync_id)
          .eq("company_id", agent.company_id);
        return json({ success: true });
      }

      case "records": {
        const items = b.records ?? [];
        let saved = 0;
        for (const r of items) {
          const recordedAt = new Date(r.recorded_at);
          if (Number.isNaN(recordedAt.getTime())) continue;
          const equipmentId = r.equipment_id ?? b.equipment_id ?? null;
          if (!equipmentId) continue;

          const { data: dup } = await supabase
            .from("equipment_pending_records")
            .select("id")
            .eq("equipment_id", equipmentId)
            .eq("employee_identifier", r.identifier)
            .eq("recorded_at", recordedAt.toISOString())
            .maybeSingle();
          if (dup) continue;

          const { error } = await supabase.from("equipment_pending_records").insert({
            equipment_id: equipmentId,
            company_id: agent.company_id,
            employee_identifier: r.identifier,
            recorded_at: recordedAt.toISOString(),
            record_type: r.record_type ?? null,
            raw_data: r.raw ?? {},
            is_processed: false,
          });
          if (!error) saved++;
        }

        if (b.equipment_id) {
          await supabase
            .from("time_clock_equipment")
            .update({ last_communication: now, last_sync: now, is_online: true, updated_at: now })
            .eq("id", b.equipment_id)
            .eq("company_id", agent.company_id);
          await supabase.from("equipment_communication_logs").insert({
            equipment_id: b.equipment_id,
            company_id: agent.company_id,
            status: "success",
            request_type: "agent_collect",
            message: `${saved} marcação(ões) recebida(s) do robô`,
            records_synced: saved,
          });
        }
        return json({ success: true, received: items.length, saved });
      }

      case "log": {
        if (b.equipment_id) {
          await supabase.from("equipment_communication_logs").insert({
            equipment_id: b.equipment_id,
            company_id: agent.company_id,
            status: b.success === false ? "error" : "success",
            request_type: "agent_log",
            message: (b.message ?? b.error_message ?? "").slice(0, 1000),
            response_data: b.result ?? {},
          });
        }
        return json({ success: true });
      }
    }
  } catch (e) {
    console.error("[agent-gateway] erro", (e as Error).message);
    return json({ error: "Erro interno no gateway do robô" }, 500);
  }

  return json({ error: "Ação não suportada" }, 400);
});
