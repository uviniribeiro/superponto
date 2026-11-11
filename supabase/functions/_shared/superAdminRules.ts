// Regras puras de gestão de super administradores (sem dependências de runtime),
// compartilhadas pela Edge Function manage-super-admin e pelos testes.

export const SUPER_ADMIN_MIN_PASSWORD = 12;

export interface SuperAdminSummary {
  user_id: string;
  is_active: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: unknown): string {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

export function validateEmail(email: string): string | null {
  return EMAIL_RE.test(email) ? null : "Informe um e-mail válido";
}

export function validateFullName(fullName: unknown): string | null {
  return typeof fullName === "string" && fullName.trim().length >= 3
    ? null
    : "Informe o nome completo (mínimo 3 caracteres)";
}

export function validatePassword(password: unknown): string | null {
  if (typeof password !== "string" || password.length < SUPER_ADMIN_MIN_PASSWORD) {
    return `Senha deve ter pelo menos ${SUPER_ADMIN_MIN_PASSWORD} caracteres`;
  }
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  return classes >= 3 ? null : "Senha deve combinar ao menos 3 tipos: minúsculas, maiúsculas, números e símbolos";
}

/** Retorna o motivo do bloqueio ou null quando a remoção da permissão é permitida. */
export function removalBlockReason(admins: SuperAdminSummary[], actorId: string, targetId: string): string | null {
  if (targetId === actorId) return "Você não pode remover sua própria permissão de super admin";
  if (!admins.some((a) => a.user_id === targetId)) return "Usuário não é super admin";
  const remainingActive = admins.filter((a) => a.user_id !== targetId && a.is_active).length;
  return remainingActive === 0 ? "Deve haver pelo menos um super admin ativo" : null;
}

/** Retorna o motivo do bloqueio ou null quando a desativação é permitida. */
export function deactivationBlockReason(admins: SuperAdminSummary[], actorId: string, targetId: string): string | null {
  if (targetId === actorId) return "Você não pode desativar a própria conta";
  const remainingActive = admins.filter((a) => a.user_id !== targetId && a.is_active).length;
  return remainingActive === 0 ? "Deve haver pelo menos um super admin ativo" : null;
}
