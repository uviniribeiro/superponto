// Shared caller authentication/authorization helpers for edge functions.
// Functions are deployed with verify_jwt = false, so auth MUST be enforced in code.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export interface AuthContext {
  userId: string;
  roles: string[];
  companyId: string | null;
  isServiceRole: boolean;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

function bearer(req: Request): string | null {
  const header = req.headers.get("Authorization") ?? req.headers.get("authorization");
  if (!header) return null;
  return header.replace(/^Bearer\s+/i, "").trim() || null;
}

/**
 * Resolves the caller identity from the request JWT.
 * Throws AuthError when the caller is anonymous or the token is invalid.
 */
export async function getAuthContext(req: Request): Promise<AuthContext> {
  const token = bearer(req);
  if (!token) throw new AuthError("Autenticação obrigatória");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  // Trusted server-to-server calls (other edge functions) use the service role key.
  if (token === serviceKey) {
    return { userId: "service_role", roles: ["service_role"], companyId: null, isServiceRole: true };
  }

  // The anon key alone is NOT an identity.
  if (token === anonKey) throw new AuthError("Autenticação obrigatória");

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) throw new AuthError("Token inválido");

  const [{ data: roleRows }, { data: profile }] = await Promise.all([
    admin.from("user_roles").select("role").eq("user_id", user.id),
    admin.from("profiles").select("company_id").eq("user_id", user.id).maybeSingle(),
  ]);

  return {
    userId: user.id,
    roles: (roleRows ?? []).map((r: { role: string }) => r.role),
    companyId: (profile as { company_id?: string | null } | null)?.company_id ?? null,
    isServiceRole: false,
  };
}

/** Requires the caller to hold at least one of the given roles (service role always passes). */
export async function requireRole(req: Request, roles: string[]): Promise<AuthContext> {
  const ctx = await getAuthContext(req);
  if (ctx.isServiceRole) return ctx;
  if (!roles.some((r) => ctx.roles.includes(r))) {
    throw new AuthError("Permissão insuficiente para executar esta ação", 403);
  }
  return ctx;
}

/** Ensures a tenant-scoped action targets the caller's own company (super admins may cross tenants). */
export function assertCompanyAccess(ctx: AuthContext, companyId: string | null | undefined): void {
  if (ctx.isServiceRole || ctx.roles.includes("super_admin")) return;
  if (!companyId || ctx.companyId !== companyId) {
    throw new AuthError("Acesso negado a esta empresa", 403);
  }
}

/** Standard error response for auth failures. */
export function authErrorResponse(error: unknown, corsHeaders: Record<string, string>): Response | null {
  if (!(error instanceof AuthError)) return null;
  return new Response(JSON.stringify({ error: error.message }), {
    status: error.status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Cryptographically strong password generator for provisioned accounts. */
export function generateSecurePassword(length = 20): string {
  const lower = "abcdefghijkmnopqrstuvwxyz";
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const digits = "23456789";
  const special = "!@#$%&*?";
  const charset = lower + upper + digits + special;
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let pw = "";
  for (let i = 0; i < length; i++) pw += charset[bytes[i] % charset.length];
  const extra = crypto.getRandomValues(new Uint8Array(4));
  return (
    pw.slice(0, length - 4) +
    lower[extra[0] % lower.length] +
    upper[extra[1] % upper.length] +
    digits[extra[2] % digits.length] +
    special[extra[3] % special.length]
  );
}

/**
 * Guard for scheduled/administrative functions: returns an error Response when the caller
 * lacks the roles (service role always passes, e.g. the VPS scheduler), or null when allowed.
 */
export async function guardRoles(
  req: Request,
  roles: string[],
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  try {
    await requireRole(req, roles);
    return null;
  } catch (error) {
    return authErrorResponse(error, corsHeaders) ??
      new Response(JSON.stringify({ error: "Falha de autenticação" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
  }
}
