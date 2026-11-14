import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.23.8";

import { getCorsHeaders } from "../_shared/cors.ts";
import { clientIpFromHeaders, isIpAllowed, parseAllowlist } from "../_shared/ipAllowlist.ts";

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
    "update_status",
    "gps",
    "telemetry",
  ]),
  hostname: z.string().trim().max(120).optional(),
  os_info: z.string().trim().max(160).optional(),
  agent_version: z.string().trim().max(32).optional(),
  platform: z.string().trim().max(32).optional(),
  local_ip: IP.optional(),
  public_ip: IP.optional(),
  mac_address: z.string().trim().max(64).optional(),
  devices: z.array(DiscoveredSchema).max(500).optional(),
  records: z.array(RecordSchema).max(2000).optional(),
  command_id: z.string().uuid().optional(),
  equipment_id: z.string().uuid().optional(),
  sync_id: z.string().uuid().optional(),
  release_id: z.string().uuid().optional(),
  update_status: z
    .enum(["downloading", "installing", "installed", "verified", "failed", "rolled_back"])
    .optional(),
  from_version: z.string().trim().max(32).optional(),
  to_version: z.string().trim().max(32).optional(),
  checksum_ok: z.boolean().optional(),
  device_user_id: z.string().trim().max(64).optional(),
  templates_synced: z.boolean().optional(),
  success: z.boolean().optional(),
  result: z.record(z.unknown()).optional(),
  error_message: z.string().trim().max(1000).optional(),
  message: z.string().trim().max(1000).optional(),
  // Telemetria do robô local (CPU, memória, disco, uptime) exibida em tempo real.
  metrics: z.record(z.unknown()).optional(),
  limit: z.number().int().min(1).max(200).optional(),
  // GPS e telemetria da frota recebidos pelo robô (UDP) e repassados em lote.
  positions: z.array(z.record(z.unknown())).max(1000).optional(),
  position: z.record(z.unknown()).optional(),
  events: z.array(z.record(z.unknown())).max(500).optional(),
  event: z.record(z.unknown()).optional(),
});

/** Compara versões semânticas simples ("3.1.0"). Retorna >0 se a > b. */
const compareVersions = (a: string, b: string) => {
  const pa = a.replace(/[^0-9.]/g, "").split(".").map((n) => parseInt(n, 10) || 0);
  const pb = b.replace(/[^0-9.]/g, "").split(".").map((n) => parseInt(n, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
};


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

  // Restringe o gateway ao(s) servidor(es) de comunicação quando AGENT_GATEWAY_ALLOWED_IPS estiver definido.
  const allowlist = parseAllowlist(Deno.env.get("AGENT_GATEWAY_ALLOWED_IPS"));
  const callerIp = clientIpFromHeaders(req.headers);
  if (!isIpAllowed(callerIp, allowlist)) {
    console.warn(`agent-gateway: IP não autorizado ${callerIp ?? "desconhecido"}`);
    return json({ error: "Origem não autorizada para o gateway de comunicação" }, 403);
  }

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

  // Aceita o token atual, o token pendente (janela de transição) ou o token
  // anterior (tolerância pós-rotação, até expirar).
  const { data: candidates, error: agentError } = await supabase
    .from("communication_agents")
    .select("*")
    .eq("is_active", true)
    .or(
      `token_hash.eq.${tokenHash},pending_token_hash.eq.${tokenHash},previous_token_hash.eq.${tokenHash}`,
    )
    .limit(1);

  if (agentError) {
    console.error("[agent-gateway] erro ao buscar agente", agentError.message);
    return json({ error: "Falha ao autenticar o agente" }, 500);
  }

  const agent = candidates?.[0];
  if (!agent) return json({ error: "Agente não autorizado" }, 401);

  const nowDate = new Date();
  const now = nowDate.toISOString();
  const b = parsedBody;

  const isCurrent = agent.token_hash === tokenHash;
  const isPending = !isCurrent && agent.pending_token_hash === tokenHash;
  const isPrevious = !isCurrent && !isPending && agent.previous_token_hash === tokenHash;

  if (isPending) {
    const windowExpired = agent.pending_token_expires_at &&
      new Date(agent.pending_token_expires_at).getTime() < nowDate.getTime();
    if (windowExpired) {
      return json({ error: "Janela de rotação expirada. Gere um novo token." }, 401);
    }
  }
  if (isPrevious) {
    const graceExpired = !agent.previous_token_expires_at ||
      new Date(agent.previous_token_expires_at).getTime() < nowDate.getTime();
    if (graceExpired) {
      return json({ error: "Token revogado após rotação. Atualize o robô." }, 401);
    }
  }

  // Expiração automática: o token atual tem validade máxima. Depois dela, só
  // um token novo (emitido no sistema) volta a autenticar o robô.
  const maxAgeDays = agent.token_max_age_days ?? 90;
  const renewBeforeMs = (agent.token_renew_before_days ?? 7) * 86_400_000;
  const tokenExpiresAtMs = agent.token_expires_at
    ? new Date(agent.token_expires_at).getTime()
    : null;
  const currentTokenExpired = isCurrent && tokenExpiresAtMs !== null &&
    tokenExpiresAtMs < nowDate.getTime();

  if (currentTokenExpired && !agent.pending_token_hash) {
    if (agent.token_rotation_status !== "expired") {
      await supabase
        .from("communication_agents")
        .update({
          token_rotation_status: "expired",
          token_expired_at: now,
          status: "offline",
          updated_at: now,
        })
        .eq("id", agent.id);
      await supabase.from("agent_token_rotations").insert({
        company_id: agent.company_id,
        agent_id: agent.id,
        mode: "automatic",
        status: "expired",
        notes: "Token expirado automaticamente por tempo de validade",
      });
    }
    return json({
      error: "Token expirado. Gere um novo token do robô no sistema.",
      token_expired: true,
    }, 401);
  }

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
  if (b.metrics) {
    const currentSettings = (agent.settings ?? {}) as Record<string, unknown>;
    liveness.settings = {
      ...currentSettings,
      metrics: { ...b.metrics, collected_at: now, gateway_ok: true },
    };
  }

  // Validação antes de efetivar: só troca o token quando o agente prova que
  // consegue autenticar com o token pendente.
  let rotationApplied = false;
  if (isPending) {
    const graceMinutes = 30;
    liveness.token_hash = tokenHash;
    liveness.pending_token_hash = null;
    liveness.pending_token_expires_at = null;
    liveness.previous_token_hash = agent.token_hash;
    liveness.previous_token_expires_at = new Date(
      nowDate.getTime() + graceMinutes * 60_000,
    ).toISOString();
    liveness.token_rotation_status = "validated";
    liveness.token_rotated_at = now;
    liveness.token_expired_at = null;
    liveness.token_expires_at = new Date(
      nowDate.getTime() + maxAgeDays * 86_400_000,
    ).toISOString();
    if (agent.token_auto_rotation) {
      liveness.next_token_rotation_at = new Date(
        nowDate.getTime() + (agent.token_rotation_interval_days ?? 90) * 86_400_000,
      ).toISOString();
    }
    rotationApplied = true;
  }

  await supabase.from("communication_agents").update(liveness).eq("id", agent.id);

  if (rotationApplied) {
    await supabase
      .from("agent_token_rotations")
      .update({ status: "completed", validated_at: now, finished_at: now, updated_at: now })
      .eq("agent_id", agent.id)
      .eq("status", "pending");
  }

  // Rotação automática: quando vencida, o sistema emite um token pendente e o
  // entrega uma única vez ao agente autenticado.
  let issuedToken: string | null = null;
  let issuedExpiresAt: string | null = null;
  if (
    !rotationApplied &&
    isCurrent &&
    agent.token_auto_rotation &&
    !agent.pending_token_hash &&
    (
      (agent.next_token_rotation_at &&
        new Date(agent.next_token_rotation_at).getTime() <= nowDate.getTime()) ||
      // Renovação antecipada: evita que o token chegue a expirar de fato.
      (tokenExpiresAtMs !== null &&
        tokenExpiresAtMs - nowDate.getTime() <= renewBeforeMs)
    )
  ) {
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    issuedToken = Array.from(bytes).map((x) => x.toString(16).padStart(2, "0")).join("");
    issuedExpiresAt = new Date(nowDate.getTime() + 60 * 60_000).toISOString();
    await supabase
      .from("communication_agents")
      .update({
        pending_token_hash: await sha256(issuedToken),
        pending_token_expires_at: issuedExpiresAt,
        token_rotation_status: "pending",
        token_rotation_started_at: now,
        updated_at: now,
      })
      .eq("id", agent.id);
    await supabase.from("agent_token_rotations").insert({
      company_id: agent.company_id,
      agent_id: agent.id,
      mode: "automatic",
      status: "pending",
      window_expires_at: issuedExpiresAt,
      notes: "Rotação automática emitida pelo gateway",
    });
  }


  // ---- Auto-atualização do executável do agente -------------------------------
  // O gateway indica a release ativa do canal do agente. O robô só troca o
  // executável depois de conferir o checksum, mantendo o binário anterior para
  // rollback automático caso a nova versão não consiga autenticar.
  const currentVersion = b.agent_version ?? agent.agent_version ?? "0.0.0";
  const platform = (b.platform ?? (agent.os_info?.toLowerCase().includes("linux") ? "linux" : "windows"));

  let updateInstruction: Record<string, unknown> | null = null;
  const { data: releases } = await supabase
    .from("agent_releases")
    .select("*")
    .eq("is_active", true)
    .eq("channel", agent.update_channel ?? "stable")
    .eq("platform", platform)
    .order("published_at", { ascending: false })
    .limit(20);

  const desired = agent.target_version
    ? releases?.find((r) => r.version === agent.target_version)
    : releases?.[0];

  if (desired && compareVersions(desired.version, currentVersion) > 0) {
    updateInstruction = {
      available: true,
      apply: agent.auto_update !== false,
      release_id: desired.id,
      version: desired.version,
      channel: desired.channel,
      platform: desired.platform,
      download_url: desired.download_url,
      checksum_sha256: desired.checksum_sha256,
      notes: desired.notes,
      rollback_to: currentVersion,
    };
  } else if (
    agent.rollback_version &&
    compareVersions(agent.rollback_version, currentVersion) > 0 === false &&
    agent.last_update_status === "rollback_requested"
  ) {
    updateInstruction = { available: false, rollback_requested: true, version: agent.rollback_version };
  }

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
    token_rotation: {
      applied: rotationApplied,
      using_previous_token: isPrevious,
      // Novo token entregue uma única vez; o agente deve salvá-lo e reautenticar.
      new_token: issuedToken,
      new_token_expires_at: issuedExpiresAt,
      current_token_expires_at: agent.token_expires_at ?? null,
      max_age_days: maxAgeDays,
    },
    update: updateInstruction,
  };



  // Resumo operacional (escalas do dia, motoristas e ocorrências em aberto) para
  // o robô registrar nos logs de comunicação junto com o sinal de vida.
  const operationalSnapshot = async () => {
    const day = now.slice(0, 10);
    const [schedules, drivers, occurrences] = await Promise.all([
      supabase.from("op_schedules").select("id", { count: "exact", head: true })
        .eq("company_id", agent.company_id).eq("work_date", day),
      supabase.from("profiles").select("id", { count: "exact", head: true })
        .eq("company_id", agent.company_id).eq("is_driver", true),
      supabase.from("op_occurrences").select("id", { count: "exact", head: true })
        .eq("company_id", agent.company_id).eq("resolved", false),
    ]);
    return {
      date: day,
      schedules_today: schedules.count ?? 0,
      drivers: drivers.count ?? 0,
      open_occurrences: occurrences.count ?? 0,
    };
  };

  try {
    switch (b.action) {
      case "handshake":
      case "heartbeat":
        return json({ success: true, agent: agentConfig, operational: await operationalSnapshot() });


      // Relata cada etapa da auto-atualização (download, instalação, verificação
      // ou rollback). O robô só é considerado atualizado quando reautentica com
      // a nova versão e envia "verified".
      case "update_status": {
        const status = b.update_status ?? "installed";
        const finished = ["verified", "failed", "rolled_back"].includes(status);

        const { data: openEvent } = await supabase
          .from("agent_update_events")
          .select("id")
          .eq("agent_id", agent.id)
          .is("finished_at", null)
          .order("started_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        const payload = {
          status,
          checksum_ok: b.checksum_ok ?? null,
          error_message: b.error_message ?? null,
          to_version: b.to_version ?? null,
          from_version: b.from_version ?? currentVersion,
          finished_at: finished ? now : null,
          updated_at: now,
        };

        if (openEvent) {
          await supabase.from("agent_update_events").update(payload).eq("id", openEvent.id);
        } else {
          await supabase.from("agent_update_events").insert({
            company_id: agent.company_id,
            agent_id: agent.id,
            release_id: b.release_id ?? null,
            started_at: now,
            ...payload,
          });
        }

        const agentPatch: Record<string, unknown> = {
          last_update_status: status,
          last_update_at: now,
          updated_at: now,
        };
        if (status === "installed" || status === "verified") {
          agentPatch.rollback_version = b.from_version ?? currentVersion;
        }
        if (status === "verified") {
          agentPatch.target_version = null;
          agentPatch.agent_version = b.to_version ?? b.agent_version ?? currentVersion;
        }
        if (status === "rolled_back" || status === "failed") {
          // Impede novo download automático da versão problemática.
          agentPatch.target_version = agent.rollback_version ?? currentVersion;
          agentPatch.auto_update = status === "rolled_back" ? false : agent.auto_update;
        }
        await supabase.from("communication_agents").update(agentPatch).eq("id", agent.id);

        return json({ success: true, status });
      }



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
        // Fila pausada pelo operador: o robô não recebe novos comandos.
        if (agent.queue_paused) {
          return json({ success: true, commands: [], queue_paused: true });
        }
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

      // Recepção de GPS enviada pelo robô local (rastreadores da frota).
      case "gps": {
        const items = Array.isArray(b.positions) ? b.positions : (b.position ? [b.position] : []);
        if (!items.length) return json({ success: true, saved: 0 });

        const day = now.slice(0, 10);
        const { data: vehicles } = await supabase.from("op_vehicles")
          .select("id, plate, number, tracker_id").eq("company_id", agent.company_id);
        const { data: schedules } = await supabase.from("op_schedules")
          .select("id, vehicle_id, profile_id").eq("company_id", agent.company_id).eq("work_date", day);

        const findVehicle = (p: Record<string, unknown>) => {
          const key = String(p.tracker_id ?? p.vehicle ?? p.plate ?? "").trim().toUpperCase();
          if (!key) return null;
          return (vehicles ?? []).find((v) =>
            [v.tracker_id, v.plate, v.number].some((f) => String(f ?? "").trim().toUpperCase() === key)) ?? null;
        };

        const rows = items.map((p: Record<string, unknown>) => {
          const v = findVehicle(p);
          const sch = v ? (schedules ?? []).find((s) => s.vehicle_id === v.id) : null;
          return {
            company_id: agent.company_id,
            vehicle_id: v?.id ?? null,
            profile_id: sch?.profile_id ?? null,
            schedule_id: sch?.id ?? null,
            latitude: Number(p.latitude ?? p.lat),
            longitude: Number(p.longitude ?? p.lng ?? p.lon),
            speed_kmh: p.speed_kmh != null ? Number(p.speed_kmh) : (p.speed != null ? Number(p.speed) : null),
            heading: p.heading != null ? Number(p.heading) : null,
            accuracy_m: p.accuracy_m != null ? Number(p.accuracy_m) : null,
            recorded_at: String(p.recorded_at ?? now),
            source: String(p.source ?? "agent"),
          };
        }).filter((r: { latitude: number; longitude: number }) => Number.isFinite(r.latitude) && Number.isFinite(r.longitude));

        if (rows.length) {
          const { error } = await supabase.from("op_gps_positions").insert(rows);
          if (error) return json({ error: error.message }, 400);
        }
        return json({ success: true, received: items.length, saved: rows.length });
      }

      // Recepção de eventos de telemetria (freada brusca, excesso de velocidade, etc.)
      case "telemetry": {
        const items = Array.isArray(b.events) ? b.events : (b.event ? [b.event] : []);
        if (!items.length) return json({ success: true, saved: 0 });

        const day = now.slice(0, 10);
        const { data: vehicles } = await supabase.from("op_vehicles")
          .select("id, plate, number, tracker_id").eq("company_id", agent.company_id);
        const { data: schedules } = await supabase.from("op_schedules")
          .select("id, vehicle_id, profile_id").eq("company_id", agent.company_id).eq("work_date", day);

        const rows = items.map((e: Record<string, unknown>) => {
          const key = String(e.tracker_id ?? e.vehicle ?? e.plate ?? "").trim().toUpperCase();
          const v = key ? (vehicles ?? []).find((x) =>
            [x.tracker_id, x.plate, x.number].some((f) => String(f ?? "").trim().toUpperCase() === key)) : null;
          const sch = v ? (schedules ?? []).find((s) => s.vehicle_id === v.id) : null;
          return {
            company_id: agent.company_id,
            vehicle_id: v?.id ?? null,
            profile_id: sch?.profile_id ?? null,
            schedule_id: sch?.id ?? null,
            event_type: String(e.event_type ?? e.type ?? "evento"),
            severity: String(e.severity ?? "media"),
            value: e.value != null ? Number(e.value) : null,
            description: e.description ? String(e.description).slice(0, 500) : null,
            metadata: (e.metadata as Record<string, unknown>) ?? {},
            occurred_at: String(e.occurred_at ?? now),
          };
        }).filter((r) => r.event_type);

        if (rows.length) {
          const { error } = await supabase.from("op_telemetry_events").insert(rows);
          if (error) return json({ error: error.message }, 400);
        }
        return json({ success: true, received: items.length, saved: rows.length });
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
