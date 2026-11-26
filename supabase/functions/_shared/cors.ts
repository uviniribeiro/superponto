// Shared CORS handling with an origin allowlist.
// Avoids the wildcard `*` origin so arbitrary websites cannot invoke our endpoints.

// The production domain comes from ALLOWED_ORIGINS (set by the VPS installer from APP_DOMAIN).
const STATIC_ALLOWED_ORIGINS = [
  "https://maxponto.srv.br",
  "https://www.maxponto.srv.br",
  "https://superponto.vercel.app",
  "https://superponto-admin.vercel.app",
  "http://localhost:8080",
  "http://localhost:5173",
  "capacitor://localhost",
  "http://localhost",
];

// Extra origin patterns (none by default); exact origins come from ALLOWED_ORIGINS.
const ALLOWED_ORIGIN_PATTERNS: RegExp[] = [];

function envOrigins(): string[] {
  const raw = Deno.env.get("ALLOWED_ORIGINS") ?? Deno.env.get("ALLOWED_ORIGIN") ?? "";
  return raw.split(",").map((o) => o.trim()).filter(Boolean);
}

export function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (STATIC_ALLOWED_ORIGINS.includes(origin)) return true;
  if (envOrigins().includes(origin)) return true;
  return ALLOWED_ORIGIN_PATTERNS.some((re) => re.test(origin));
}

/** Build CORS headers for a request, echoing only allowlisted origins. */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const allowed = isAllowedOrigin(origin) ? origin! : (envOrigins()[0] ?? STATIC_ALLOWED_ORIGINS[0]);
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-terminal-token, x-agent-token",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
