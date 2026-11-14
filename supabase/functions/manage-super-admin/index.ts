import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders } from "../_shared/cors.ts";
import { AuthError, authErrorResponse, requireRole } from "../_shared/auth.ts";
import {
  deactivationBlockReason,
  normalizeEmail,
  removalBlockReason,
  type SuperAdminSummary,
  validateEmail,
  validateFullName,
  validatePassword,
} from "../_shared/superAdminRules.ts";

class RequestError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const fail = (reason: string | null, status = 400) => {
  if (reason) throw new RequestError(reason, status);
};

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const ctx = await requireRole(req, ["super_admin"]);
    if (ctx.isServiceRole) {
      throw new AuthError("Gestão de super admins exige um super admin autenticado", 403);
    }

    const { action, email, password, fullName, userId, isActive } = await req.json();

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const listAdmins = async () => {
      // user_roles e profiles não têm chave estrangeira entre si: busca em duas etapas.
      const { data: roles, error: rolesError } = await admin
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin");
      if (rolesError) throw rolesError;
      const ids = (roles ?? []).map((r: { user_id: string }) => r.user_id);
      if (ids.length === 0) return [];

      const { data: profiles, error: profilesError } = await admin
        .from("profiles")
        .select("id, user_id, full_name, email, is_active, created_at")
        .in("user_id", ids);
      if (profilesError) throw profilesError;

      // deno-lint-ignore no-explicit-any
      return (profiles ?? []).map((p: any) => ({
        user_id: p.user_id as string,
        profile_id: p.id as string,
        full_name: p.full_name as string,
        email: p.email as string,
        is_active: p.is_active !== false,
        created_at: p.created_at as string,
      }));
    };

    const audit = async (event: string, targetUserId: string, details: Record<string, unknown> = {}) => {
      const { error } = await admin.from("security_logs").insert({
        user_id: ctx.userId,
        event_type: event,
        severity: "warning",
        ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
        user_agent: req.headers.get("user-agent"),
        metadata: { target_user_id: targetUserId, ...details },
      });
      if (error) console.warn("Audit log skipped:", error.message);
    };

    if (action === "list") {
      return json({ success: true, data: await listAdmins() });
    }

    if (action === "create") {
      const normalizedEmail = normalizeEmail(email);
      fail(validateFullName(fullName));
      fail(validateEmail(normalizedEmail));
      fail(validatePassword(password));

      const { data: existingProfile } = await admin
        .from("profiles")
        .select("user_id")
        .ilike("email", normalizedEmail)
        .maybeSingle();
      if (existingProfile) {
        throw new RequestError(
          "Este e-mail já tem cadastro. Use \"Promover usuário existente\" para preservar a conta.",
          409,
        );
      }

      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: normalizedEmail,
        password,
        email_confirm: true,
      });
      if (createError || !created.user) {
        const message = createError?.message ?? "";
        if (/already|registered|exists/i.test(message)) {
          throw new RequestError("Este e-mail já está cadastrado no sistema", 409);
        }
        throw new RequestError(message || "Erro ao criar usuário");
      }

      const newUserId = created.user.id;
      const rollback = async () => {
        await admin.from("user_roles").delete().eq("user_id", newUserId);
        await admin.from("profiles").delete().eq("user_id", newUserId);
        await admin.auth.admin.deleteUser(newUserId);
      };

      const { error: profileError } = await admin.from("profiles").insert({
        user_id: newUserId,
        email: normalizedEmail,
        full_name: String(fullName).trim(),
        is_active: true,
      });
      if (profileError) {
        console.error("Profile error:", profileError);
        await rollback();
        throw new RequestError("Erro ao criar perfil do usuário", 500);
      }

      const { error: roleError } = await admin.from("user_roles").insert({ user_id: newUserId, role: "super_admin" });
      if (roleError) {
        console.error("Role error:", roleError);
        await rollback();
        throw new RequestError("Erro ao atribuir permissão de super admin", 500);
      }

      await audit("super_admin_created", newUserId, { email: normalizedEmail });
      return json({ success: true, message: "Super admin criado com sucesso", user: { id: newUserId, email: normalizedEmail } });
    }

    if (action === "promote") {
      // Concede a permissão a uma conta já existente, sem alterar e-mail, senha ou empresa.
      const normalizedEmail = normalizeEmail(email);
      fail(validateEmail(normalizedEmail));

      const { data: profile } = await admin
        .from("profiles")
        .select("user_id, full_name, is_active")
        .ilike("email", normalizedEmail)
        .maybeSingle();
      if (!profile?.user_id) throw new RequestError("Nenhuma conta encontrada com este e-mail", 404);
      if (profile.is_active === false) throw new RequestError("Reative a conta antes de promovê-la");

      const admins = await listAdmins();
      if (admins.some((a) => a.user_id === profile.user_id)) {
        throw new RequestError("Esta conta já é super admin", 409);
      }

      const { error } = await admin.from("user_roles").insert({ user_id: profile.user_id, role: "super_admin" });
      if (error) throw error;

      await audit("super_admin_promoted", profile.user_id, { email: normalizedEmail });
      return json({ success: true, message: `${profile.full_name} agora é super admin` });
    }

    if (action === "update") {
      // Atualiza apenas nome e status; e-mail e vínculos permanecem protegidos.
      if (!userId) throw new RequestError("ID do usuário é obrigatório");
      const admins = await listAdmins();
      if (!admins.some((a) => a.user_id === userId)) throw new RequestError("Usuário não é super admin", 404);

      const changes: Record<string, unknown> = {};
      if (fullName !== undefined) {
        fail(validateFullName(fullName));
        changes.full_name = String(fullName).trim();
      }
      if (isActive !== undefined) {
        if (typeof isActive !== "boolean") throw new RequestError("Status inválido");
        if (!isActive) fail(deactivationBlockReason(admins as SuperAdminSummary[], ctx.userId, userId));
        changes.is_active = isActive;
      }
      if (Object.keys(changes).length === 0) throw new RequestError("Nada para atualizar");

      const { error } = await admin.from("profiles").update(changes).eq("user_id", userId);
      if (error) throw error;

      await audit("super_admin_updated", userId, changes);
      return json({ success: true, message: "Super admin atualizado" });
    }

    if (action === "remove") {
      if (!userId) throw new RequestError("ID do usuário é obrigatório");
      fail(removalBlockReason(await listAdmins(), ctx.userId, userId));

      const { error } = await admin.from("user_roles").delete().eq("user_id", userId).eq("role", "super_admin");
      if (error) throw error;

      await audit("super_admin_removed", userId);
      return json({ success: true, message: "Permissão de super admin removida" });
    }

    throw new RequestError("Ação inválida. Use 'list', 'create', 'promote', 'update' ou 'remove'");
  } catch (error: unknown) {
    const authResponse = authErrorResponse(error, corsHeaders);
    if (authResponse) return authResponse;
    console.error("Error:", error);
    const status = error instanceof RequestError ? error.status : 400;
    const message = error instanceof Error
      ? error.message
      : (error as { message?: string } | null)?.message ?? "Erro desconhecido";
    return json({ error: message }, status);
  }
});
