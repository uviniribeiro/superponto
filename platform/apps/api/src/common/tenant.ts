import { ForbiddenException, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';

export const PLATFORM_NO_TENANT_DATA = 'O Super Admin usa só o painel da plataforma e não acessa dados de clientes. Para atender um cliente, entre com o usuário de suporte dele.';

/**
 * Tenant ativo da requisição: sempre o do próprio usuário — cada cliente só enxerga os próprios dados.
 * O cabeçalho X-Tenant-Id é ignorado, e o Super Admin (que não pertence a cliente nenhum) não acessa
 * dados de clientes: ele usa só as rotas /v1/platform.
 */
export function resolveTenant(user: AuthUser, _header: string | undefined): string {
  if (user.isPlatformAdmin) throw new ForbiddenException(PLATFORM_NO_TENANT_DATA);
  if (!user.tenantId) throw new ForbiddenException('Usuário sem organização vinculada');
  return user.tenantId;
}

export const ActiveTenant = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const req = ctx.switchToHttp().getRequest();
  return resolveTenant(req.user as AuthUser, req.headers['x-tenant-id'] as string | undefined);
});

export interface RequestMeta {
  ip: string | null;
  userAgent: string | null;
}

export const RequestInfo = createParamDecorator((_data: unknown, ctx: ExecutionContext): RequestMeta => {
  const req = ctx.switchToHttp().getRequest();
  return { ip: req.ip ?? null, userAgent: (req.headers['user-agent'] as string | undefined) ?? null };
});

export const pageSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  search: z.string().trim().max(200).optional(),
});
export type PageQuery = z.infer<typeof pageSchema>;
