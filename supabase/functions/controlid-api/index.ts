import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from "../_shared/cors.ts";
import {
  assertPublicHost,
  cloudListDevices,
  cloudReadRecords,
  cloudRequest,
  controlIdCall,
  controlIdDeviceInfo,
  controlIdGetAfd,
  controlIdGetTime,
  controlIdLoadObjects,
  controlIdReadRecords,
  controlIdSetTime,
  DEFAULT_CONTROLID_PORT,
  parseControlIdAfd,
  type ControlIdCloudTarget,
  type ControlIdRecord,
  type ControlIdTarget,
} from "../_shared/controlid.ts";

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

interface ServerRow {
  id: string;
  company_id: string | null;
  host: string;
  port: number;
  timeout_ms: number;
  allow_private_network: boolean;
  connection_mode: string | null;
  api_base_url: string | null;
  api_username: string | null;
  cloud_organization_id: string | null;
  use_https: boolean | null;
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

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Não autenticado" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) return json({ error: "Não autenticado" }, 401);
    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceKey);
    const [{ data: roles }, { data: companyId }] = await Promise.all([
      admin.from("user_roles").select("role").eq("user_id", userId),
      admin.rpc("get_user_company_id", { _user_id: userId }),
    ]);
    const roleList = (roles ?? []).map((r: { role: string }) => r.role);
    const isAdmin = roleList.includes("admin");
    if (!isAdmin && !roleList.includes("manager")) {
      return json({ error: "Permissão insuficiente" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action: string = body.action ?? "test";

    /* -------- resolve server / equipment -------- */
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
        .eq("manufacturer", "control_id")
        .eq("is_active", true)
        .order("is_default", { ascending: false })
        .limit(1)
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
        .select("id, name, company_id, ip_address, port, manufacturer, model, communication_server_id, cloud_device_id")
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

    /* -------- decrypted secrets -------- */
    let apiPassword: string | null = body.password ?? null;
    let cloudToken: string | null = body.token ?? null;
    if (server?.id) {
      const { data: secrets } = await admin.rpc("get_communication_server_secrets", { _server_id: server.id });
      const row = Array.isArray(secrets) ? secrets[0] : secrets;
      apiPassword = apiPassword ?? (row?.api_password ?? null);
      cloudToken = cloudToken ?? (row?.cloud_token ?? null);
    }

    const mode: string = body.mode ?? server?.connection_mode ?? "device";
    const isCloud = mode === "cloud";

    const logCommunication = async (status: string, message: string, records = 0) => {
      if (!equipment?.id) return;
      await admin.from("equipment_communication_logs").insert({
        equipment_id: equipment.id,
        company_id: companyId,
        status,
        message: String(message).slice(0, 500),
        request_type: `controlid_${isCloud ? "cloud" : "device"}_${action}`,
        records_synced: records,
      });
    };

    const persistRecords = async (records: ControlIdRecord[], source: string) => {
      if (!equipment?.id || records.length === 0 || body.persist === false) return 0;
      let stored = 0;
      for (const record of records.slice(0, 5000)) {
        const { error } = await admin.from("equipment_pending_records").insert({
          equipment_id: equipment.id,
          company_id: companyId,
          employee_identifier: record.identifier,
          recorded_at: record.recordedAt.toISOString(),
          raw_data: { nsr: record.nsr ?? null, device_id: record.deviceId ?? null, source },
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
      return stored;
    };

    const markServerTest = async (ok: boolean, message: string) => {
      if (!server?.id) return;
      await admin
        .from("communication_servers")
        .update({
          last_test_at: new Date().toISOString(),
          last_test_status: ok ? "success" : "error",
          last_test_message: String(message).slice(0, 300),
        })
        .eq("id", server.id);
    };

    /* ================= CLOUD MODE (iD Cloud) ================= */
    if (isCloud) {
      if (!cloudToken) {
        return json({ success: false, online: false, error: "Token da iD Cloud não configurado" }, 400);
      }
      const cloud: ControlIdCloudTarget = {
        baseUrl: body.baseUrl ?? server?.api_base_url ?? null,
        token: cloudToken,
        organizationId: body.organizationId ?? server?.cloud_organization_id ?? null,
        timeoutMs: Number(body.timeoutMs ?? server?.timeout_ms ?? 15000),
      };

      if (action === "test" || action === "status" || action === "list_devices") {
        const res = await cloudListDevices(cloud);
        await markServerTest(res.ok, res.ok ? "iD Cloud conectada" : res.text);
        await logCommunication(res.ok ? "success" : "error", res.ok ? "iD Cloud OK" : res.text);
        return json({
          success: res.ok,
          online: res.ok,
          mode: "cloud",
          latencyMs: res.latencyMs,
          endpoint: res.url,
          devices: res.ok ? res.body : undefined,
          error: res.ok ? undefined : `iD Cloud respondeu ${res.status}: ${res.text.slice(0, 200)}`,
        });
      }

      if (action === "read_records" || action === "read_afd") {
        const since = body.since ? new Date(String(body.since)) : new Date(Date.now() - 7 * 864e5);
        const result = await cloudReadRecords(cloud, {
          since,
          deviceId: (body.deviceId as string) ?? (equipment?.cloud_device_id as string) ?? null,
        });
        const stored = await persistRecords(result.records, "controlid_cloud");
        await logCommunication(result.online ? "success" : "error", result.error ?? "Leitura iD Cloud", stored);
        return json({
          success: result.online,
          online: result.online,
          mode: "cloud",
          recordsFound: result.records.length,
          recordsStored: stored,
          preview: result.records.slice(0, 20),
          error: result.error,
        });
      }

      if (action === "raw") {
        if (!isAdmin) return json({ error: "Apenas administradores podem enviar requisições cruas" }, 403);
        const res = await cloudRequest(cloud, String(body.path ?? "/devices"), {
          method: String(body.method ?? "GET"),
          body: body.payload,
        });
        return json({ success: res.ok, status: res.status, endpoint: res.url, response: res.body });
      }

      return json({ error: `Ação desconhecida para iD Cloud: ${action}` }, 400);
    }

    /* ================= LOCAL DEVICE MODE ================= */
    const host: string = (body.host as string) || (equipment?.ip_address as string) || server?.host || "";
    if (!host) {
      return json({ error: "Nenhum equipamento/servidor Control iD configurado" }, 400);
    }
    const target: ControlIdTarget = {
      host,
      port: Number(body.port ?? equipment?.port ?? server?.port ?? DEFAULT_CONTROLID_PORT),
      useHttps: Boolean(body.useHttps ?? server?.use_https ?? false),
      username: (body.username as string) ?? server?.api_username ?? "admin",
      password: apiPassword ?? "admin",
      timeoutMs: Number(body.timeoutMs ?? server?.timeout_ms ?? 10000),
    };

    try {
      assertPublicHost(target.host, Boolean(server?.allow_private_network || body.allowPrivate));
    } catch (e) {
      return json({ success: false, online: false, error: errMsg(e) }, 400);
    }

    if (action === "test" || action === "status") {
      try {
        const info = await controlIdDeviceInfo(target);
        await markServerTest(info.ok, info.ok ? "Equipamento respondeu" : info.text);
        await logCommunication(info.ok ? "success" : "error", info.ok ? "Teste Control iD" : info.text);
        return json({
          success: info.ok,
          online: info.ok,
          mode: "device",
          host: target.host,
          port: target.port,
          latencyMs: info.latencyMs,
          response: info.body,
        });
      } catch (e) {
        await markServerTest(false, errMsg(e));
        await logCommunication("error", errMsg(e));
        return json({ success: false, online: false, host: target.host, port: target.port, error: errMsg(e) });
      }
    }

    if (action === "get_time") {
      try {
        const res = await controlIdGetTime(target);
        return json({ success: res.ok, online: res.ok, response: res.body });
      } catch (e) {
        return json({ success: false, online: false, error: errMsg(e) });
      }
    }

    if (action === "set_time") {
      if (!isAdmin) return json({ error: "Apenas administradores podem ajustar o relógio" }, 403);
      try {
        const res = await controlIdSetTime(target, new Date());
        await logCommunication(res.ok ? "success" : "error", "Ajuste de relógio Control iD");
        return json({ success: res.ok, online: res.ok, response: res.body });
      } catch (e) {
        return json({ success: false, online: false, error: errMsg(e) });
      }
    }

    if (action === "read_records") {
      const since = body.since ? new Date(String(body.since)) : undefined;
      const result = await controlIdReadRecords(target, { since });
      const stored = await persistRecords(result.records, "controlid_device");
      await logCommunication(result.online ? "success" : "error", result.error ?? "Leitura de marcações", stored);
      return json({
        success: result.online,
        online: result.online,
        mode: "device",
        recordsFound: result.records.length,
        recordsStored: stored,
        preview: result.records.slice(0, 20),
        error: result.error,
      });
    }

    if (action === "read_afd") {
      try {
        const afdMode = body.afdMode === "1510" ? "1510" : "671";
        const res = await controlIdGetAfd(target, afdMode);
        const records = parseControlIdAfd(res.text);
        const stored = await persistRecords(records, `controlid_afd_${afdMode}`);
        await logCommunication(res.ok ? "success" : "error", `AFD ${afdMode}`, stored);
        return json({
          success: res.ok,
          online: res.ok,
          recordsFound: records.length,
          recordsStored: stored,
          preview: records.slice(0, 20),
          afdPreview: res.text.slice(0, 2000),
        });
      } catch (e) {
        return json({ success: false, online: false, error: errMsg(e) });
      }
    }

    if (action === "list_users") {
      try {
        const res = await controlIdLoadObjects(target, "users");
        return json({ success: res.ok, online: res.ok, response: res.body });
      } catch (e) {
        return json({ success: false, online: false, error: errMsg(e) });
      }
    }

    if (action === "raw") {
      if (!isAdmin) return json({ error: "Apenas administradores podem enviar comandos crus" }, 403);
      const endpoint = String(body.endpoint ?? "").slice(0, 120);
      if (!endpoint) return json({ error: "Endpoint vazio" }, 400);
      try {
        const res = await controlIdCall(target, endpoint, (body.payload as Record<string, unknown>) ?? {});
        await logCommunication(res.ok ? "success" : "error", `Comando: ${endpoint}`);
        return json({ success: res.ok, status: res.status, response: res.body });
      } catch (e) {
        return json({ success: false, error: errMsg(e) });
      }
    }

    return json({ error: `Ação desconhecida: ${action}` }, 400);
  } catch (error) {
    console.error("[controlid-api]", errMsg(error));
    return json({ error: errMsg(error) }, 500);
  }
});
