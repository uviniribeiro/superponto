import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  assertPublicHost,
  DEFAULT_HENRY_COMMANDS,
  DEFAULT_HENRY_PORT,
  henryCommand,
  henryDateTime,
  parseHenryRecords,
  sendHenryCommand,
  type HenryTarget,
} from "../_shared/henry-tcp.ts";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

interface ServerRow {
  id: string;
  company_id: string | null;
  host: string;
  port: number;
  timeout_ms: number;
  allow_private_network: boolean;
  command_map: Record<string, string> | null;
  is_active: boolean;
}

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // --- AuthN / AuthZ: only admins & managers of the owning company ---
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Não autenticado" }, 401);
    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);
    const [{ data: roles }, { data: profile }] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", userId),
      admin.from("profiles").select("company_id").eq("user_id", userId).maybeSingle(),
    ]);
    const companyId = profile?.company_id ?? null;
    const roleList = (roles ?? []).map((r: { role: string }) => r.role);
    const isAdmin = roleList.includes("admin");
    if (!isAdmin && !roleList.includes("manager")) {
      return json({ error: "Permissão insuficiente" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action: string = body.action ?? "test";

    // --- Resolve the TCP target (server + optional equipment override) ---
    let server: ServerRow | null = null;
    if (body.serverId) {
      const { data } = await admin
        .from("communication_servers")
        .select("*")
        .eq("id", body.serverId)
        .maybeSingle();
      server = data as ServerRow | null;
    } else if (!body.host) {
      const { data } = await admin
        .from("communication_servers")
        .select("*")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .eq("is_default", true)
        .maybeSingle();
      server = data as ServerRow | null;
    }
    if (server && server.company_id && server.company_id !== companyId) {
      return json({ error: "Servidor não pertence à sua empresa" }, 403);
    }

    let equipment: Record<string, unknown> | null = null;
    if (body.equipmentId) {
      const { data } = await admin
        .from("time_clock_equipment")
        .select("id, name, company_id, ip_address, port, manufacturer, model, communication_server_id")
        .eq("id", body.equipmentId)
        .maybeSingle();
      if (!data || (data.company_id && data.company_id !== companyId)) {
        return json({ error: "Equipamento não encontrado" }, 404);
      }
      equipment = data;
      if (!server && data.communication_server_id) {
        const { data: srv } = await admin
          .from("communication_servers")
          .select("*")
          .eq("id", data.communication_server_id)
          .maybeSingle();
        if (srv && (!srv.company_id || srv.company_id === companyId)) server = srv as ServerRow;
      }
    }

    // Host precedence: explicit host > equipment IP > configured server host
    const host: string =
      (body.host as string) ||
      (equipment?.ip_address as string) ||
      server?.host ||
      "";
    if (!host) {
      return json({ error: "Nenhum servidor TCP/IP configurado. Cadastre o servidor de comunicação." }, 400);
    }

    const target: HenryTarget = {
      host,
      port: Number(body.port ?? equipment?.port ?? server?.port ?? DEFAULT_HENRY_PORT),
      timeoutMs: Number(body.timeoutMs ?? server?.timeout_ms ?? 8000),
      commandMap: server?.command_map ?? null,
    };

    try {
      assertPublicHost(target.host, Boolean(server?.allow_private_network || body.allowPrivate));
    } catch (e) {
      return json({ success: false, online: false, error: errMsg(e) }, 400);
    }

    const logCommunication = async (status: string, message: string, records = 0) => {
      if (!equipment?.id) return;
      await admin.from("equipment_communication_logs").insert({
        equipment_id: equipment.id,
        company_id: companyId,
        status,
        message: message.slice(0, 500),
        request_type: `henry_tcp_${action}`,
        records_synced: records,
      });
    };

    // --- Actions ---
    if (action === "test" || action === "status") {
      const result = await henryCommand(target, "status");
      const fallback = result.online ? result : await henryCommand(target, "handshake");

      if (server?.id) {
        await admin
          .from("communication_servers")
          .update({
            last_test_at: new Date().toISOString(),
            last_test_status: fallback.online ? "success" : "error",
            last_test_message: (fallback.error ?? fallback.payload ?? "").slice(0, 300),
          })
          .eq("id", server.id);
      }
      await logCommunication(fallback.online ? "success" : "error", fallback.error ?? "Teste TCP/IP");

      return json({
        success: fallback.online,
        online: fallback.online,
        host: target.host,
        port: target.port,
        latencyMs: fallback.latencyMs,
        response: fallback.payload,
        error: fallback.error,
      });
    }

    if (action === "get_time") {
      const result = await henryCommand(target, "get_time");
      return json({ success: result.online, ...result });
    }

    if (action === "set_time") {
      if (!isAdmin) return json({ error: "Apenas administradores podem ajustar o relógio" }, 403);
      const result = await henryCommand(target, "set_time", { datetime: henryDateTime(new Date()) });
      await logCommunication(result.online ? "success" : "error", "Ajuste de relógio");
      return json({ success: result.online, ...result });
    }

    if (action === "read_records" || action === "read_afd") {
      const start = String(body.start ?? "1");
      const end = String(body.end ?? "999999999");
      const result = await henryCommand(target, action, { start, end });
      const records = result.online ? parseHenryRecords(result.payload ?? "") : [];

      let stored = 0;
      if (equipment?.id && records.length > 0 && body.persist !== false) {
        for (const record of records.slice(0, 5000)) {
          const { error } = await admin.from("equipment_pending_records").insert({
            equipment_id: equipment.id,
            company_id: companyId,
            employee_identifier: record.identifier,
            recorded_at: record.recordedAt.toISOString(),
            raw_data: { nsr: record.nsr, source: "henry_tcp" },
          });
          if (!error) stored++;
        }
        await admin
          .from("time_clock_equipment")
          .update({
            is_online: true,
            last_communication: new Date().toISOString(),
            last_sync: new Date().toISOString(),
          })
          .eq("id", equipment.id);
      }
      await logCommunication(result.online ? "success" : "error", result.error ?? "Leitura de marcações", stored);

      return json({
        success: result.online,
        online: result.online,
        recordsFound: records.length,
        recordsStored: stored,
        error: result.error,
        preview: records.slice(0, 20),
      });
    }

    if (action === "raw") {
      if (!isAdmin) return json({ error: "Apenas administradores podem enviar comandos crus" }, 403);
      const command = String(body.command ?? "").slice(0, 2000);
      if (!command) return json({ error: "Comando vazio" }, 400);
      const result = await sendHenryCommand(target, command);
      await logCommunication(result.online ? "success" : "error", `Comando: ${command}`);
      return json({ success: result.online, ...result });
    }

    if (action === "commands") {
      return json({ success: true, defaults: DEFAULT_HENRY_COMMANDS, active: server?.command_map ?? null });
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (error) {
    console.error("[henry-tcp]", errMsg(error));
    return json({ error: errMsg(error) }, 500);
  }
});
