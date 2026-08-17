// Henry (Henry Equipamentos) TCP/IP client for REP devices.
// Implements the Henry ASCII frame protocol over a raw TCP socket:
//
//   [STX 0x02][TAMANHO 2 bytes LE][PAYLOAD ASCII][ETX 0x03][CHECKSUM XOR]
//
// The payload follows the Henry command pattern: `01+<CMD>+<INDEX>]<args>`
// Command strings are overridable per server (command_map) because Henry
// firmwares (Hexa / Prisma / Orion / Primme) expose slightly different verbs.

const STX = 0x02;
const ETX = 0x03;

export const DEFAULT_HENRY_PORT = 3000;

export const DEFAULT_HENRY_COMMANDS: Record<string, string> = {
  // Session / identification
  handshake: "01+EH+00]",
  status: "01+RI+00]",
  serial: "01+RN+00]",
  // Clock
  get_time: "01+RH+00]",
  set_time: "01+EH+00]{datetime}",
  // Records (MRP / AFD)
  read_records: "01+RR+00]{start}]{end}]",
  read_afd: "01+RA+00]{start}]{end}]",
  // Users
  list_users: "01+RU+00]",
  send_user: "01+EU+00]{payload}",
};

export interface HenryTarget {
  host: string;
  port?: number;
  timeoutMs?: number;
  commandMap?: Record<string, string> | null;
}

export interface HenryResult {
  online: boolean;
  command?: string;
  raw?: string;
  payload?: string;
  error?: string;
  latencyMs?: number;
}

/** XOR checksum over TAMANHO + PAYLOAD + ETX (Henry spec). */
function checksum(bytes: Uint8Array): number {
  let chk = 0;
  for (const b of bytes) chk ^= b;
  return chk & 0xff;
}

export function buildFrame(payload: string): Uint8Array {
  const body = new TextEncoder().encode(payload);
  const size = new Uint8Array([body.length & 0xff, (body.length >> 8) & 0xff]);
  const middle = new Uint8Array(size.length + body.length + 1);
  middle.set(size, 0);
  middle.set(body, size.length);
  middle[middle.length - 1] = ETX;

  const frame = new Uint8Array(1 + middle.length + 1);
  frame[0] = STX;
  frame.set(middle, 1);
  frame[frame.length - 1] = checksum(middle);
  return frame;
}

/** Extract the ASCII payload from a Henry response frame (tolerant parser). */
export function parseFrame(data: Uint8Array): string {
  if (data.length === 0) return "";
  const decoder = new TextDecoder("latin1" as string, { fatal: false });
  let start = 0;
  let end = data.length;
  if (data[0] === STX) start = 3; // STX + 2 size bytes
  const etxIndex = data.lastIndexOf(ETX);
  if (etxIndex > start) end = etxIndex;
  return decoder.decode(data.slice(start, end)).trim();
}

function resolveCommand(target: HenryTarget, key: string, args: Record<string, string> = {}): string {
  const template = target.commandMap?.[key] ?? DEFAULT_HENRY_COMMANDS[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (_m, name) => args[name] ?? "");
}

function isPrivateHost(host: string): boolean {
  return /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.0\.0\.0$|localhost$)/i.test(host);
}

/** Basic guard so an operator cannot point the server at loopback/metadata addresses. */
export function assertPublicHost(host: string, allowPrivate = false): void {
  if (!host || host.length > 255) throw new Error("Endereço do servidor inválido");
  if (!allowPrivate && isPrivateHost(host)) {
    throw new Error(
      "Endereço privado/loopback não é acessível pelo servidor em nuvem. Use o IP público do servidor Henry (ex.: 191.252.125.30) ou o agente local.",
    );
  }
}

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: number | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timeout (${ms}ms) em ${label}`)), ms) as unknown as number;
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Opens a TCP socket, sends one Henry command and reads the answer. */
export async function sendHenryCommand(
  target: HenryTarget,
  payload: string,
): Promise<HenryResult> {
  const port = target.port ?? DEFAULT_HENRY_PORT;
  const timeoutMs = Math.min(Math.max(target.timeoutMs ?? 8000, 1000), 30000);
  const startedAt = Date.now();
  let conn: Deno.Conn | null = null;

  try {
    conn = await withTimeout(
      Deno.connect({ hostname: target.host, port, transport: "tcp" }),
      timeoutMs,
      "conexão TCP",
    );

    await withTimeout(conn.write(buildFrame(payload)), timeoutMs, "envio do comando");

    const chunks: Uint8Array[] = [];
    const buf = new Uint8Array(8192);
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const n = await withTimeout(conn.read(buf), Math.max(deadline - Date.now(), 500), "leitura");
      if (n === null || n === 0) break;
      chunks.push(buf.slice(0, n));
      // A complete Henry frame ends with ETX + checksum.
      const last = chunks[chunks.length - 1];
      if (last.includes(ETX)) break;
      if (chunks.reduce((acc, c) => acc + c.length, 0) > 4 * 1024 * 1024) break;
    }

    const total = chunks.reduce((acc, c) => acc + c.length, 0);
    const data = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      data.set(c, offset);
      offset += c.length;
    }

    const parsed = parseFrame(data);
    return {
      online: true,
      command: payload,
      raw: parsed.slice(0, 200000),
      payload: parsed.slice(0, 200000),
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      online: false,
      command: payload,
      error: error instanceof Error ? error.message : String(error),
      latencyMs: Date.now() - startedAt,
    };
  } finally {
    try {
      conn?.close();
    } catch {
      /* socket already closed */
    }
  }
}

export function henryCommand(target: HenryTarget, key: string, args?: Record<string, string>) {
  return sendHenryCommand(target, resolveCommand(target, key, args));
}

export interface ParsedRecord {
  identifier: string;
  recordedAt: Date;
  recordType?: string;
  nsr?: string;
}

/**
 * Parses AFD / MRP content returned by Henry devices.
 * Supports Portaria 1510 (type 3) and Portaria 671 (type 7) marking lines,
 * plus the Henry inline format `NSR;PIS;DDMMYYYYHHMM`.
 */
export function parseHenryRecords(content: string): ParsedRecord[] {
  const out: ParsedRecord[] = [];
  if (!content) return out;

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.length < 12) continue;

    // Portaria 1510 type 3: NSR(9) + tipo(1=3) + DDMMYYYY + HHMM + PIS(12)
    const p1510 = /^(\d{9})3(\d{2})(\d{2})(\d{4})(\d{2})(\d{2})(\d{12})/.exec(line);
    if (p1510) {
      const [, nsr, dd, mm, yyyy, hh, mi, pis] = p1510;
      out.push({
        nsr,
        identifier: pis.replace(/^0+/, "") || pis,
        recordedAt: new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:00`),
      });
      continue;
    }

    // Portaria 671 type 7: NSR(9) + 7 + ISO datetime + PIS(12)
    const p671 = /^(\d{9})7(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})[-+]\d{2}:?\d{2}(\d{11,12})/.exec(line);
    if (p671) {
      const [, nsr, iso, pis] = p671;
      out.push({ nsr, identifier: pis.replace(/^0+/, "") || pis, recordedAt: new Date(iso) });
      continue;
    }

    // Henry inline: NSR;IDENTIFICADOR;DDMMYYYYHHMM(SS)
    const inline = /^(\d+)[;|](\w+)[;|](\d{2})(\d{2})(\d{4})(\d{2})(\d{2})(\d{2})?/.exec(line);
    if (inline) {
      const [, nsr, id, dd, mm, yyyy, hh, mi, ss] = inline;
      out.push({
        nsr,
        identifier: id,
        recordedAt: new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss ?? "00"}`),
      });
    }
  }

  return out.filter((r) => !Number.isNaN(r.recordedAt.getTime()));
}

/** Formats a Date as Henry's DDMMYYYYHHMMSS clock argument. */
export function henryDateTime(date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return (
    p(date.getDate()) + p(date.getMonth() + 1) + date.getFullYear() +
    p(date.getHours()) + p(date.getMinutes()) + p(date.getSeconds())
  );
}
