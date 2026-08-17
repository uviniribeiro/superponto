// Control iD client: local device REST (iDClass / iDFace / REP iDX / iDAccess)
// and Control iD "iD Cloud" HTTP API.
//
// Local devices expose a *.fcgi REST API over HTTP:
//   POST /login.fcgi                    -> { session }
//   POST /get_system_information.fcgi   -> device info
//   POST /get_system_time.fcgi          -> { time: <epoch> }
//   POST /set_system_time.fcgi          -> { time: <epoch> }
//   POST /load_objects.fcgi             -> { <object>: [...] }
//   POST /create_objects.fcgi           -> { ids: [...] }
//   GET  /get_afd.fcgi?mode=671         -> AFD text (REP-P models)
//
// iD Cloud uses a token-based JSON API whose base URL is configurable, so new
// endpoints can be reached without redeploying (see `cloudRequest`).

export const DEFAULT_CONTROLID_PORT = 80;
export const DEFAULT_IDCLOUD_BASE_URL = "https://api.idcloud.controlid.com.br";

export interface ControlIdTarget {
  host: string;
  port?: number;
  useHttps?: boolean;
  username?: string;
  password?: string;
  timeoutMs?: number;
}

export interface ControlIdCloudTarget {
  baseUrl?: string | null;
  token: string;
  organizationId?: string | null;
  timeoutMs?: number;
}

export interface ControlIdRecord {
  identifier: string;
  recordedAt: Date;
  nsr?: string;
  deviceId?: string;
  raw?: unknown;
}

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Block SSRF against loopback / link-local / private ranges unless explicitly allowed. */
export function assertPublicHost(host: string, allowPrivate = false) {
  const clean = String(host || "").trim().toLowerCase();
  if (!clean) throw new Error("Host não informado");
  if (allowPrivate) return;
  const privatePatterns = [
    /^localhost$/,
    /^127\./,
    /^0\./,
    /^10\./,
    /^192\.168\./,
    /^169\.254\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^::1$/,
    /^fe80:/,
    /\.local$/,
  ];
  if (privatePatterns.some((re) => re.test(clean))) {
    throw new Error(
      `Host ${host} é de rede privada. Use o agente local (robô Control iD) ou habilite "rede privada".`,
    );
  }
}

export function deviceBaseUrl(target: ControlIdTarget): string {
  const scheme = target.useHttps ? "https" : "http";
  const port = Number(target.port) || DEFAULT_CONTROLID_PORT;
  const defaultPort = target.useHttps ? 443 : 80;
  return port === defaultPort ? `${scheme}://${target.host}` : `${scheme}://${target.host}:${port}`;
}

async function httpJson(
  url: string,
  init: RequestInit,
  timeoutMs = 10000,
): Promise<{ ok: boolean; status: number; body: unknown; text: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    const text = await res.text();
    let body: unknown = text;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      /* keep raw text */
    }
    return { ok: res.ok, status: res.status, body, text };
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------ */
/* Local device (REST *.fcgi)                                          */
/* ------------------------------------------------------------------ */

export async function controlIdLogin(target: ControlIdTarget): Promise<string> {
  const url = `${deviceBaseUrl(target)}/login.fcgi`;
  const { ok, body, text } = await httpJson(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        login: target.username || "admin",
        password: target.password || "admin",
      }),
    },
    target.timeoutMs ?? 10000,
  );
  const session = (body as { session?: string } | null)?.session;
  if (!ok || !session) {
    throw new Error(`Falha no login do equipamento Control iD: ${text.slice(0, 200) || "sem resposta"}`);
  }
  return session;
}

export async function controlIdCall(
  target: ControlIdTarget,
  endpoint: string,
  payload: Record<string, unknown> = {},
  session?: string,
): Promise<{ session: string; body: unknown; text: string; ok: boolean; status: number }> {
  const activeSession = session ?? (await controlIdLogin(target));
  const path = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  const url = `${deviceBaseUrl(target)}${path}${path.includes("?") ? "&" : "?"}session=${activeSession}`;
  const res = await httpJson(
    url,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    target.timeoutMs ?? 10000,
  );
  return { session: activeSession, ...res };
}

export async function controlIdDeviceInfo(target: ControlIdTarget, session?: string) {
  const started = Date.now();
  const res = await controlIdCall(target, "/get_system_information.fcgi", {}, session);
  return { ...res, latencyMs: Date.now() - started };
}

export async function controlIdGetTime(target: ControlIdTarget, session?: string) {
  return await controlIdCall(target, "/get_system_time.fcgi", {}, session);
}

export async function controlIdSetTime(target: ControlIdTarget, when = new Date(), session?: string) {
  return await controlIdCall(
    target,
    "/set_system_time.fcgi",
    { time: Math.floor(when.getTime() / 1000) },
    session,
  );
}

export async function controlIdLoadObjects(
  target: ControlIdTarget,
  object: string,
  where?: Record<string, unknown>,
  session?: string,
) {
  const payload: Record<string, unknown> = { object };
  if (where) payload.where = where;
  return await controlIdCall(target, "/load_objects.fcgi", payload, session);
}

/** Read punches from a local Control iD device (access_logs / afd). */
export async function controlIdReadRecords(
  target: ControlIdTarget,
  options: { since?: Date; limit?: number } = {},
): Promise<{ online: boolean; records: ControlIdRecord[]; error?: string; raw?: unknown }> {
  try {
    const session = await controlIdLogin(target);
    const where = options.since
      ? { access_logs: { ">=": { time: Math.floor(options.since.getTime() / 1000) } } }
      : undefined;
    const res = await controlIdLoadObjects(target, "access_logs", where, session);
    const logs =
      (res.body as { access_logs?: Array<Record<string, unknown>> } | null)?.access_logs ?? [];

    const records: ControlIdRecord[] = logs
      .slice(0, options.limit ?? 5000)
      .map((log) => {
        const epoch = Number(log.time ?? log.timestamp ?? 0);
        return {
          identifier: String(log.user_id ?? log.pis ?? log.identifier ?? ""),
          recordedAt: new Date(epoch * 1000),
          nsr: log.id != null ? String(log.id) : undefined,
          raw: log,
        };
      })
      .filter((r) => r.identifier && !Number.isNaN(r.recordedAt.getTime()) && r.recordedAt.getTime() > 0);

    return { online: true, records, raw: res.body };
  } catch (error) {
    return { online: false, records: [], error: errMsg(error) };
  }
}

/** Raw AFD download (REP-P models expose get_afd.fcgi). */
export async function controlIdGetAfd(target: ControlIdTarget, mode: "671" | "1510" = "671") {
  const session = await controlIdLogin(target);
  const url = `${deviceBaseUrl(target)}/get_afd.fcgi?session=${session}&mode=${mode}`;
  const res = await httpJson(url, { method: "GET" }, target.timeoutMs ?? 20000);
  return { ok: res.ok, text: res.text, session };
}

/** Parse AFD (Portaria 671 / 1510) marking lines into records. */
export function parseControlIdAfd(afd: string): ControlIdRecord[] {
  const out: ControlIdRecord[] = [];
  for (const line of afd.split(/\r?\n/)) {
    const raw = line.trim();
    if (raw.length < 34) continue;
    const nsr = raw.slice(0, 9);
    const type = raw.slice(9, 10);
    // Type 3 (1510) and type 7 (671) are punch registers.
    if (type !== "3" && type !== "7") continue;

    let dateStr: string;
    let timeStr: string;
    let identifier: string;
    if (type === "3") {
      dateStr = raw.slice(10, 18); // ddmmyyyy
      timeStr = raw.slice(18, 22); // hhmm
      identifier = raw.slice(22, 34).replace(/^0+/, "");
      const day = +dateStr.slice(0, 2), month = +dateStr.slice(2, 4), year = +dateStr.slice(4, 8);
      const hour = +timeStr.slice(0, 2), minute = +timeStr.slice(2, 4);
      const recordedAt = new Date(year, month - 1, day, hour, minute);
      if (identifier && !Number.isNaN(recordedAt.getTime())) out.push({ identifier, recordedAt, nsr });
    } else {
      // 671: NSR(9) tipo(1) dataHora ISO (aaaa-mm-ddThh:mm:ss-03:00) + PIS(12)
      const iso = raw.slice(10, 34);
      identifier = raw.slice(34, 46).replace(/^0+/, "");
      const recordedAt = new Date(iso);
      if (identifier && !Number.isNaN(recordedAt.getTime())) out.push({ identifier, recordedAt, nsr });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* iD Cloud                                                            */
/* ------------------------------------------------------------------ */

export async function cloudRequest(
  target: ControlIdCloudTarget,
  path: string,
  init: { method?: string; body?: unknown; query?: Record<string, string> } = {},
) {
  const base = (target.baseUrl || DEFAULT_IDCLOUD_BASE_URL).replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const qs = new URLSearchParams(init.query ?? {});
  if (target.organizationId) qs.set("organization_id", target.organizationId);
  const url = `${base}${cleanPath}${qs.toString() ? `?${qs}` : ""}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${target.token}`,
    "X-Access-Token": target.token,
  };
  if (target.organizationId) headers["X-Organization-Id"] = target.organizationId;

  const started = Date.now();
  const res = await httpJson(
    url,
    { method: init.method ?? "GET", headers, body: init.body ? JSON.stringify(init.body) : undefined },
    target.timeoutMs ?? 15000,
  );
  return { ...res, url, latencyMs: Date.now() - started };
}

export async function cloudListDevices(target: ControlIdCloudTarget) {
  return await cloudRequest(target, "/devices");
}

/** Fetch punches from iD Cloud and normalize them. */
export async function cloudReadRecords(
  target: ControlIdCloudTarget,
  options: { since?: Date; deviceId?: string | null } = {},
): Promise<{ online: boolean; records: ControlIdRecord[]; error?: string; raw?: unknown }> {
  try {
    const query: Record<string, string> = {};
    if (options.since) query.start_date = options.since.toISOString();
    if (options.deviceId) query.device_id = options.deviceId;

    const res = await cloudRequest(target, "/access_logs", { query });
    if (!res.ok) {
      return { online: false, records: [], error: `iD Cloud respondeu ${res.status}: ${res.text.slice(0, 200)}` };
    }
    const payload = res.body as Record<string, unknown> | null;
    const list =
      (payload?.access_logs as Array<Record<string, unknown>>) ??
      (payload?.data as Array<Record<string, unknown>>) ??
      (Array.isArray(payload) ? (payload as Array<Record<string, unknown>>) : []);

    const records = list
      .map((log) => {
        const rawTime = log.time ?? log.timestamp ?? log.date_time ?? log.created_at;
        const recordedAt =
          typeof rawTime === "number" ? new Date(rawTime * 1000) : new Date(String(rawTime ?? ""));
        return {
          identifier: String(log.pis ?? log.user_id ?? log.registration ?? log.identifier ?? ""),
          recordedAt,
          nsr: log.nsr != null ? String(log.nsr) : undefined,
          deviceId: log.device_id != null ? String(log.device_id) : undefined,
          raw: log,
        } as ControlIdRecord;
      })
      .filter((r) => r.identifier && !Number.isNaN(r.recordedAt.getTime()));

    return { online: true, records, raw: res.body };
  } catch (error) {
    return { online: false, records: [], error: errMsg(error) };
  }
}
