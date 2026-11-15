import type { Grant } from '../authorization/authorization.js';

/** Usuário autenticado, como as rotas o recebem. Nunca contém hash de senha. */
export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  tenantId: string | null;
  personId: string | null;
  isPlatformAdmin: boolean;
  /** usuário de suporte/treinamento da equipe SuperPonto dentro do cliente */
  isSupport: boolean;
  mustChangePassword: boolean;
  grants: Grant[];
}
