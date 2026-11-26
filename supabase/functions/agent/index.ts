// Rotas do agente local no MESMO contrato da v2, para usar o mesmo servidor de comunicação
// (superponto-communication-server). O servidor repassa para <SYSTEM_URL>/v1/agent/* — na v1, use
// SYSTEM_URL = https://<projeto>.supabase.co/functions (as rotas ficam em /functions/v1/agent/*).
//   POST /heartbeat · GET /jobs · POST /jobs/:id/result · POST /afd
// Autenticação: X-Device-Key (chave spd_ do equipamento; só o SHA-256 fica no banco) e, com
// COMM_SERVER_TOKEN definido, X-Comm-Token igual (só o servidor de comunicação fala com o sistema).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const fail = (status: number, message: string) => json({ statusCode: status, message }, status);
const sha256 = async (v: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v)))).map((b) => b.toString(16).padStart(2, "0")).join("");
const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const repName = (n: string) => n.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\x20-\x7E]/g, "").trim().slice(0, 52);

function sameSecret(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

type Equipment = { id: string; company_id: string | null; name: string; manufacturer: string; model: string; ip_address: string; port: number; portaria_compliance: string | null; timezone: string; sync_interval_seconds: number; last_nsr: number; is_active: boolean; location: string | null };
const layoutOf = (e: Equipment) => (String(e.portaria_compliance ?? "").includes("671") ? "671" : "1510");

// Comandos da v1 (device_commands.command) → ações do protocolo da v2.
const ACTION: Record<string, string> = {
  sync_time: "SET_DATETIME", set_datetime: "SET_DATETIME", collect_records: "COLLECT_RECORDS", set_employer: "SET_EMPLOYER",
  upsert_employee: "UPSERT_EMPLOYEE", receive_employees: "RECEIVE_EMPLOYEES", receive_employer: "RECEIVE_EMPLOYER",
};

async function auth(req: Request): Promise<Equipment> {
  const key = req.headers.get("x-device-key") ?? "";
  if (!key.startsWith("spd_") || key.length > 100) throw new Response(null, { status: 401 });
  const { data } = await db.from("time_clock_equipment")
    .select("id, company_id, name, manufacturer, model, ip_address, port, portaria_compliance, timezone, sync_interval_seconds, last_nsr, is_active, location")
    .eq("agent_key_hash", await sha256(key)).maybeSingle();
  if (!data) throw new Response(null, { status: 401 });
  if (!data.is_active) throw new Response(null, { status: 403 });
  return data as Equipment;
}

async function seen(e: Equipment, message?: string) {
  const now = new Date().toISOString();
  await db.from("time_clock_equipment").update({ is_online: true, last_communication: now, updated_at: now }).eq("id", e.id);
  if (message) await db.from("equipment_communication_logs").insert({ equipment_id: e.id, company_id: e.company_id, status: "success", request_type: "agent_heartbeat", message: `Contato: ${message}`.slice(0, 300) });
}

/** AFD (1.510: PIS, data sem fuso; 671: CPF, data ISO com fuso) → marcações pendentes, sem duplicar. */
async function importAfd(e: Equipment, content: string) {
  let imported = 0, duplicates = 0, invalid = 0, maxNsr = Number(e.last_nsr ?? 0);
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trimEnd();
    if (line.length < 30 || !/^\d{9}[37]/.test(line)) continue;
    const nsr = Number(line.slice(0, 9));
    let at: Date, worker: string;
    if (line[14] === "-" && line[17] === "-") {
      // Portaria 671: NSR(9) tipo(1) AAAA-MM-DDThh:mm:00-0300(24) CPF(12)
      at = new Date(line.slice(10, 34).replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
      worker = digits(line.slice(34, 46));
    } else {
      // Portaria 1.510: NSR(9) 3 ddmmaaaa hhmm PIS(12) — hora local do equipamento (Brasília)
      const d = line.slice(10, 18), h = line.slice(18, 22);
      at = new Date(`${d.slice(4, 8)}-${d.slice(2, 4)}-${d.slice(0, 2)}T${h.slice(0, 2)}:${h.slice(2, 4)}:00-03:00`);
      worker = digits(line.slice(22, 34));
    }
    if (Number.isNaN(at.getTime()) || worker.length < 11) { invalid++; continue; }
    const identifier = worker.replace(/^0+(?=\d{11}$)/, "");
    const { data: dup } = await db.from("equipment_pending_records").select("id").eq("equipment_id", e.id).eq("employee_identifier", identifier).eq("recorded_at", at.toISOString()).maybeSingle();
    if (dup) { duplicates++; continue; }
    const { error } = await db.from("equipment_pending_records").insert({ equipment_id: e.id, company_id: e.company_id, employee_identifier: identifier, recorded_at: at.toISOString(), record_type: null, raw_data: { nsr, afd: line }, is_processed: false });
    if (error) invalid++; else imported++;
    if (nsr > maxNsr) maxNsr = nsr;
  }
  const now = new Date().toISOString();
  await db.from("time_clock_equipment").update({ last_nsr: maxNsr, last_sync: now, last_communication: now, is_online: true, updated_at: now }).eq("id", e.id);
  await db.from("equipment_communication_logs").insert({ equipment_id: e.id, company_id: e.company_id, status: "success", request_type: "agent_collect", message: `AFD: ${imported} marcação(ões) nova(s), ${duplicates} repetida(s)`, records_synced: imported });
  return { imported, duplicates, unmatched: 0, invalid };
}

async function pull(e: Equipment) {
  const layout = layoutOf(e);
  // Comandos presos em execução há mais de 15 minutos voltam para a fila.
  await db.from("device_commands").update({ status: "pending" }).eq("equipment_id", e.id).eq("status", "running").lt("started_at", new Date(Date.now() - 15 * 60_000).toISOString());
  // "Enviar funcionários" vira um comando por funcionário ativo da empresa (como na v2).
  const { data: bulk } = await db.from("device_commands").select("id, company_id, created_by").eq("equipment_id", e.id).eq("status", "pending").eq("command", "push_employees");
  for (const b of bulk ?? []) {
    const { data: people } = await db.from("profiles").select("id").eq("company_id", e.company_id).eq("is_active", true);
    if (people?.length) await db.from("device_commands").insert(people.map((p) => ({ company_id: b.company_id, equipment_id: e.id, command: "upsert_employee", payload: { profile_id: p.id }, status: "pending", created_by: b.created_by })));
    await db.from("device_commands").update({ status: "completed", finished_at: new Date().toISOString(), result: { expanded: people?.length ?? 0 } }).eq("id", b.id);
  }
  const { data: cmds } = await db.from("device_commands").select("id, command, payload").eq("equipment_id", e.id).eq("status", "pending").order("created_at").limit(50);
  const jobs = [];
  for (const c of cmds ?? []) {
    const action = ACTION[c.command];
    if (!action) continue; // comandos do robô antigo (reboot, discover…) ficam para ele
    let data: Record<string, unknown> = {};
    try {
      if (action === "SET_DATETIME") data = { now: new Date().toISOString(), timezone: e.timezone };
      else if (action === "COLLECT_RECORDS") data = { sinceNsr: Number(e.last_nsr ?? 0) };
      else if (action === "SET_EMPLOYER") {
        const { data: co } = await db.from("companies").select("name, trade_name, cnpj").eq("id", e.company_id).maybeSingle();
        if (!co?.cnpj) throw new Error("Empresa sem CNPJ");
        data = { employer: { idType: "CNPJ", id: String(co.cnpj).replace(/[^0-9A-Za-z]/g, "").toUpperCase(), name: co.name, location: e.location || co.trade_name || co.name } };
      } else if (action === "UPSERT_EMPLOYEE") {
        const pid = (c.payload as { profile_id?: string })?.profile_id;
        const { data: p } = await db.from("profiles").select("id, full_name, cpf, pis, registration_number").eq("id", pid).maybeSingle();
        if (!p) throw new Error("Funcionário não encontrado");
        const value = digits(layout === "1510" ? p.pis : p.cpf);
        if (value.length !== 11) throw new Error(`${p.full_name}: equipamento da Portaria ${layout === "1510" ? "1.510 exige PIS" : "671 exige CPF"} válido`);
        data = { worker: { type: layout === "1510" ? "PIS" : "CPF", value }, name: repName(p.full_name ?? ""), registration: p.registration_number };
      }
    } catch (err) {
      await db.from("device_commands").update({ status: "failed", error_message: (err as Error).message, finished_at: new Date().toISOString() }).eq("id", c.id);
      continue;
    }
    await db.from("device_commands").update({ status: "running", started_at: new Date().toISOString() }).eq("id", c.id);
    jobs.push({ id: c.id, action, layout, data });
  }
  return { jobs };
}

async function result(e: Equipment, id: string, body: { status?: string; error?: string; data?: Record<string, unknown> }) {
  const { data: c } = await db.from("device_commands").select("id, command, status").eq("id", id).eq("equipment_id", e.id).maybeSingle();
  if (!c) return fail(404, "Comando não encontrado");
  if (c.status !== "running") return fail(409, "Este comando não está em execução");
  const ok = body.status === "SUCCEEDED";
  let summary: Record<string, unknown> = {};
  if (ok && ACTION[c.command] === "COLLECT_RECORDS" && typeof body.data?.afd === "string") summary = await importAfd(e, body.data.afd as string);
  if (ok && ACTION[c.command] === "RECEIVE_EMPLOYEES") summary = { received: Array.isArray(body.data?.employees) ? (body.data!.employees as unknown[]).length : 0, employees: body.data?.employees };
  if (ok && ACTION[c.command] === "RECEIVE_EMPLOYER") summary = { employer: body.data?.employer ?? null };
  const now = new Date().toISOString();
  await db.from("device_commands").update({ status: ok ? "completed" : "failed", error_message: ok ? null : (body.error ?? "sem detalhe").slice(0, 1000), result: summary, finished_at: now }).eq("id", id);
  if (ok) await db.from("time_clock_equipment").update({ last_sync: now }).eq("id", e.id);
  return json({ ok, ...summary, employees: undefined });
}

Deno.serve(async (req) => {
  try {
    const expected = Deno.env.get("COMM_SERVER_TOKEN");
    if (expected && !sameSecret(req.headers.get("x-comm-token") ?? "", expected)) return fail(401, "Use o servidor de comunicação para falar com o sistema");
    const path = new URL(req.url).pathname.replace(/^.*\/agent/, "").replace(/\/+$/, "");
    const e = await auth(req);
    if (req.method === "POST" && path === "/heartbeat") {
      const b = await req.json().catch(() => ({}));
      await seen(e, typeof b?.message === "string" ? b.message : undefined);
      return json({ ok: true, serverTime: new Date().toISOString(), device: { name: e.name, manufacturer: e.manufacturer, modelName: e.model, host: e.ip_address, port: e.port, layout: layoutOf(e), timezone: e.timezone, collectIntervalMinutes: Math.max(1, Math.round((e.sync_interval_seconds ?? 600) / 60)) } });
    }
    if (req.method === "GET" && path === "/jobs") { await seen(e); return json(await pull(e)); }
    const m = path.match(/^\/jobs\/([0-9a-f-]{36})\/result$/);
    if (req.method === "POST" && m) return await result(e, m[1], await req.json().catch(() => ({})));
    if (req.method === "POST" && path === "/afd") {
      const b = await req.json().catch(() => ({}));
      if (typeof b?.content !== "string" || b.content.length < 10 || b.content.length > 20_000_000) return fail(400, "AFD inválido");
      return json(await importAfd(e, b.content));
    }
    return fail(404, "Rota não encontrada");
  } catch (r) {
    if (r instanceof Response) return r.status === 403 ? fail(401, "Equipamento desativado") : fail(401, "Chave do equipamento ausente ou inválida");
    console.error(r);
    return fail(500, "Erro interno");
  }
});
