import { BadRequestException, Body, Controller, Get, HttpCode, Injectable, Post, Put } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth-user.js';
import { LdapService } from '../auth/ldap.service.js';
import { AuditService } from '../audit/audit.service.js';
import { RequirePermission } from '../authorization/authorization.js';
import { ActiveTenant, RequestInfo, type RequestMeta } from '../common/tenant.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { ldapConfigSchema, ldapTestSchema, type LdapConfigInput } from './users.schemas.js';

/** Visão pública: a senha da conta de serviço nunca sai da API (só "tem senha"). */
function view(c: { enabled: boolean; url: string; startTls: boolean; allowInsecureTls: boolean; bindDn: string | null; bindPasswordEnc: string | null; baseDn: string; userFilter: string; timeoutMs: number; updatedAt: Date } | null) {
  if (!c) return { configured: false as const };
  const { bindPasswordEnc, ...rest } = c;
  return { configured: true as const, ...rest, hasBindPassword: !!bindPasswordEnc };
}

const MESSAGES: Record<string, string> = {
  not_found: 'Conexão funcionou, mas nenhum usuário com este e-mail foi encontrado no diretório (confira a base e o filtro).',
  ambiguous: 'Mais de um usuário corresponde ao filtro: ajuste-o para encontrar uma única conta.',
  invalid_credentials: 'Conta de serviço ou senha do usuário recusada pelo diretório.',
  unreachable: 'Não foi possível conectar ao servidor LDAP.',
  config: 'O diretório recusou a configuração (DN, base ou filtro inválidos).',
};

@Injectable()
export class LdapConfigService {
  constructor(private readonly prisma: PrismaService, private readonly ldap: LdapService, private readonly audit: AuditService) {}

  get(tenantId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => view(await tx.tenantLdapConfig.findUnique({ where: { tenantId } })));
  }

  async save(tenantId: string, user: AuthUser, input: LdapConfigInput, meta: RequestMeta) {
    await this.ldap.assertSafeUrl(input.url);
    if (input.allowInsecureTls && !input.url.toLowerCase().startsWith('ldaps://') && !input.startTls) {
      throw new BadRequestException('"Aceitar certificado próprio" só faz sentido com ldaps:// ou STARTTLS');
    }
    const enc = input.bindPassword ? this.ldap.encrypt(input.bindPassword) : input.bindPassword === null ? null : undefined;
    return this.prisma.forTenant(tenantId, async (tx) => {
      const before = await tx.tenantLdapConfig.findUnique({ where: { tenantId } });
      const bindDn = input.bindDn || null;
      const finalEnc = enc === undefined ? before?.bindPasswordEnc ?? null : enc;
      if (bindDn && !finalEnc) throw new BadRequestException('Informe a senha da conta de serviço');
      const data = {
        enabled: input.enabled, url: input.url, startTls: input.startTls, allowInsecureTls: input.allowInsecureTls,
        bindDn, bindPasswordEnc: bindDn ? finalEnc : null, baseDn: input.baseDn, userFilter: input.userFilter, timeoutMs: input.timeoutMs,
      };
      const saved = await tx.tenantLdapConfig.upsert({ where: { tenantId }, create: { tenantId, ...data }, update: data });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: before ? 'UPDATE' : 'CREATE', entity: 'ldap_config', entityId: saved.id, before: view(before), after: view(saved), ...meta });
      return view(saved);
    });
  }

  /** Testa a configuração salva: encontra o usuário pelo e-mail e, se a senha vier, confere o login. */
  async test(tenantId: string, email: string, password?: string) {
    const cfg = await this.prisma.forTenant(tenantId, (tx) => tx.tenantLdapConfig.findUnique({ where: { tenantId } }));
    if (!cfg) throw new BadRequestException('Salve a configuração antes de testar');
    const r = password ? await this.ldap.authenticate(cfg, email, password) : await this.ldap.findUser(cfg, email);
    return r.ok
      ? { ok: true, dn: r.dn, message: password ? 'Login conferido no diretório.' : 'Usuário encontrado no diretório.' }
      : { ok: false, reason: r.reason, message: MESSAGES[r.reason] ?? 'Falha no teste' };
  }
}

@ApiTags('usuários')
@ApiBearerAuth()
@Controller('v1/ldap-config')
export class LdapConfigController {
  constructor(private readonly svc: LdapConfigService) {}

  @Get()
  @RequirePermission('admin.ldap:manage')
  get(@ActiveTenant() tenantId: string) {
    return this.svc.get(tenantId);
  }

  @Put()
  @RequirePermission('admin.ldap:manage')
  save(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Body({ schema: ldapConfigSchema }) body: LdapConfigInput, @RequestInfo() meta: RequestMeta) {
    return this.svc.save(tenantId, user, body, meta);
  }

  @Post('test')
  @HttpCode(200)
  @RequirePermission('admin.ldap:manage')
  test(@ActiveTenant() tenantId: string, @Body({ schema: ldapTestSchema }) body: { email: string; password?: string }) {
    return this.svc.test(tenantId, body.email, body.password);
  }
}
