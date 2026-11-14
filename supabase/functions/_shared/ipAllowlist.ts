// Lista de IPs autorizados (sem dependências de runtime; testada em src/lib/__tests__).
// Aceita IPs exatos (IPv4/IPv6) e faixas IPv4 em CIDR, separados por vírgula ou espaço.

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    value = value * 256 + n;
  }
  return value;
}

export function parseAllowlist(raw: string | undefined | null): string[] {
  return (raw ?? "").split(/[\s,]+/).map((s) => s.trim()).filter(Boolean);
}

/** Remove o prefixo IPv4 mapeado em IPv6 (::ffff:1.2.3.4). */
export function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  return trimmed.toLowerCase().startsWith("::ffff:") && trimmed.includes(".") ? trimmed.slice(7) : trimmed;
}

export function isIpAllowed(ip: string | null | undefined, allowlist: string[]): boolean {
  if (allowlist.length === 0) return true; // sem lista configurada: qualquer IP
  if (!ip) return false;
  const candidate = normalizeIp(ip);
  const asInt = ipv4ToInt(candidate);
  return allowlist.some((entry) => {
    if (!entry.includes("/")) return normalizeIp(entry).toLowerCase() === candidate.toLowerCase();
    const [base, bitsRaw] = entry.split("/");
    const bits = Number(bitsRaw);
    const baseInt = ipv4ToInt(base);
    if (asInt === null || baseInt === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
    const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
    return ((asInt & mask) >>> 0) === ((baseInt & mask) >>> 0);
  });
}

/**
 * IP do cliente informado pelo proxy da VPS (Caddy grava X-Pontomax-Client-IP e sobrescreve
 * qualquer valor enviado pelo cliente). Sem o cabeçalho, usa o primeiro X-Forwarded-For.
 */
export function clientIpFromHeaders(headers: Headers): string | null {
  const direct = headers.get("x-pontomax-client-ip");
  if (direct) return direct.trim();
  const forwarded = headers.get("x-forwarded-for");
  return forwarded ? forwarded.split(",")[0].trim() : null;
}
