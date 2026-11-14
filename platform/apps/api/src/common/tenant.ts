import { BadRequestException, ForbiddenException, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';

const uuid = z.uuid();

/**
 * Tenant ativo da requisição: o do usuário; SuperAdmin escolhe com o cabeçalho X-Tenant-Id.
 * Usuário comum nunca troca de tenant (o cabeçalho é ignorado para ele).
 */
export function resolveTenant(user: AuthUser, header: string | undefined): string {
  if (user.isPlatformAdmin) {
    if (!header) throw new BadRequestException('Informe o cabeçalho X-Tenant-Id');
    if (!uuid.safeParse(header).success) throw new BadRequestException('X-Tenant-Id inválido');
    return header;
  }
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
