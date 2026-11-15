import { BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, Inject, Injectable, NotFoundException, Param, Patch, Post, Query, type Type } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z, type ZodType } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import { AuditService } from '../audit/audit.service.js';
import { RequirePermission } from '../authorization/authorization.js';
import type { PermissionKey } from '../authorization/catalog.js';
import { ActiveTenant, pageSchema, RequestInfo, type PageQuery, type RequestMeta } from '../common/tenant.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';

/**
 * Cadastro simples configurável (função, centro de custo, tipo de funcionário, sindicato,
 * competência, cargo). Cada cadastro declara campos, busca, permissões e a regra de "em uso";
 * a fábrica entrega listar/detalhar/criar/editar/excluir (lógico), sempre com auditoria.
 */
export interface CatalogConfig {
  /** caminho da rota: /v1/<path> */
  path: string;
  /** nome do delegate do Prisma (ex.: 'costCenter') */
  model: string;
  /** entidade na auditoria */
  entity: string;
  /** "Centro de custo" — usado nas mensagens */
  label: string;
  /** artigo para mensagens: 'o' ou 'a' */
  gender: 'o' | 'a';
  read: PermissionKey;
  manage: PermissionKey;
  createSchema: ZodType;
  updateSchema: ZodType;
  searchFields: string[];
  orderBy: Record<string, 'asc' | 'desc'>;
  /** exige empresa: lista por ?companyId= e confere que a empresa é do cliente */
  companyScoped?: boolean;
  /** quantos vínculos ativos usam o registro (bloqueia exclusão) */
  usage?: (tx: Tx, id: string) => Promise<number>;
  /** campos com tenantId (por padrão true; cargos usam companyId + tenantId) */
}

type Delegate = {
  findMany(args: unknown): Promise<Array<Record<string, unknown>>>;
  findFirst(args: unknown): Promise<Record<string, unknown> | null>;
  count(args: unknown): Promise<number>;
  create(args: unknown): Promise<Record<string, unknown>>;
  update(args: unknown): Promise<Record<string, unknown>>;
};

const isUnique = (e: unknown) => typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private d(tx: Tx, cfg: CatalogConfig): Delegate {
    return (tx as unknown as Record<string, Delegate>)[cfg.model]!;
  }

  private async company(tx: Tx, id: string | undefined) {
    if (!id || !z.uuid().safeParse(id).success) throw new NotFoundException('Empresa não encontrada');
    const c = await tx.company.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!c) throw new NotFoundException('Empresa não encontrada');
  }

  private conflict(cfg: CatalogConfig) {
    return new ConflictException(`Já existe ${cfg.gender === 'a' ? 'uma' : 'um'} ${cfg.label.toLowerCase()} com este nome ou código`);
  }

  list(cfg: CatalogConfig, tenantId: string, q: PageQuery & { companyId?: string; includeInactive?: boolean }) {
    if (cfg.companyScoped && !q.companyId) throw new BadRequestException('Informe a empresa (companyId)');
    return this.prisma.forTenant(tenantId, async (tx) => {
      if (cfg.companyScoped) await this.company(tx, q.companyId);
      const where = {
        deletedAt: null,
        ...(cfg.companyScoped ? { companyId: q.companyId } : {}),
        ...(q.search ? { OR: cfg.searchFields.map((f) => ({ [f]: { contains: q.search, mode: 'insensitive' } })) } : {}),
      };
      const [data, total] = await Promise.all([
        this.d(tx, cfg).findMany({ where, orderBy: cfg.orderBy, skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
        this.d(tx, cfg).count({ where }),
      ]);
      const withUsage = cfg.usage ? await Promise.all(data.map(async (r) => ({ ...r, inUse: await cfg.usage!(tx, String(r.id)) }))) : data;
      return { data: withUsage, page: q.page, pageSize: q.pageSize, total };
    });
  }

  private async one(tx: Tx, cfg: CatalogConfig, id: string) {
    const row = await this.d(tx, cfg).findFirst({ where: { id, deletedAt: null } });
    if (!row) throw new NotFoundException(`${cfg.label} não encontrad${cfg.gender}`);
    return row;
  }

  get(cfg: CatalogConfig, tenantId: string, id: string) {
    return this.prisma.forTenant(tenantId, (tx) => this.one(tx, cfg, id));
  }

  async create(cfg: CatalogConfig, tenantId: string, user: AuthUser, input: Record<string, unknown>, meta: RequestMeta) {
    try {
      return await this.prisma.forTenant(tenantId, async (tx) => {
        if (cfg.companyScoped) await this.company(tx, input.companyId as string);
        const row = await this.d(tx, cfg).create({ data: { ...input, tenantId } });
        await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: cfg.entity, entityId: String(row.id), after: row, ...meta });
        return row;
      });
    } catch (e) {
      if (isUnique(e)) throw this.conflict(cfg);
      throw e;
    }
  }

  async update(cfg: CatalogConfig, tenantId: string, user: AuthUser, id: string, input: Record<string, unknown>, meta: RequestMeta) {
    try {
      return await this.prisma.forTenant(tenantId, async (tx) => {
        const before = await this.one(tx, cfg, id);
        const { companyId: _ignored, ...data } = input; // a empresa de um registro não muda
        const row = await this.d(tx, cfg).update({ where: { id }, data });
        await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'UPDATE', entity: cfg.entity, entityId: id, before, after: row, ...meta });
        return row;
      });
    } catch (e) {
      if (isUnique(e)) throw this.conflict(cfg);
      throw e;
    }
  }

  remove(cfg: CatalogConfig, tenantId: string, user: AuthUser, id: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const before = await this.one(tx, cfg, id);
      const used = cfg.usage ? await cfg.usage(tx, id) : 0;
      if (used) throw new ConflictException(`${cfg.label} em uso por ${used} vínculo(s): troque antes de excluir ou desative`);
      await this.d(tx, cfg).update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'DELETE', entity: cfg.entity, entityId: id, before, ...meta });
    });
  }
}

const listQuery = pageSchema.extend({ companyId: z.uuid().optional() });
const idSchema = z.uuid();

/** Cria a classe de controller de um cadastro (rotas, permissões e validação). */
export function catalogController(cfg: CatalogConfig): Type<unknown> {
  @ApiTags('estrutura')
  @ApiBearerAuth()
  @Controller(`v1/${cfg.path}`)
  class CatalogController {
    constructor(@Inject(CatalogService) private readonly svc: CatalogService) {}

    @Get()
    @RequirePermission(cfg.read)
    list(@ActiveTenant() tenantId: string, @Query({ schema: listQuery }) q: PageQuery & { companyId?: string }) {
      return this.svc.list(cfg, tenantId, q);
    }

    @Get(':id')
    @RequirePermission(cfg.read)
    get(@ActiveTenant() tenantId: string, @Param('id', { schema: idSchema }) id: string) {
      return this.svc.get(cfg, tenantId, id);
    }

    @Post()
    @RequirePermission(cfg.manage)
    create(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Body({ schema: cfg.createSchema }) body: Record<string, unknown>, @RequestInfo() meta: RequestMeta) {
      return this.svc.create(cfg, tenantId, user, body, meta);
    }

    @Patch(':id')
    @RequirePermission(cfg.manage)
    update(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Param('id', { schema: idSchema }) id: string, @Body({ schema: cfg.updateSchema }) body: Record<string, unknown>, @RequestInfo() meta: RequestMeta) {
      return this.svc.update(cfg, tenantId, user, id, body, meta);
    }

    @Delete(':id')
    @HttpCode(204)
    @RequirePermission(cfg.manage)
    remove(@ActiveTenant() tenantId: string, @CurrentUser() user: AuthUser, @Param('id', { schema: idSchema }) id: string, @RequestInfo() meta: RequestMeta) {
      return this.svc.remove(cfg, tenantId, user, id, meta);
    }
  }
  Object.defineProperty(CatalogController, 'name', { value: `Catalog_${cfg.model}_Controller` });
  return CatalogController;
}
