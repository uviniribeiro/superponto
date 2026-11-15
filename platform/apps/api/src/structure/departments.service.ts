import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { AuditService } from '../audit/audit.service.js';
import type { RequestMeta } from '../common/tenant.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import type { DepartmentInput, DepartmentUpdate, SectorInput } from './structure.schemas.js';

const isUnique = (e: unknown) => typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';

/** Departamentos em árvore (subdepartamentos ilimitados) e seções dentro de cada departamento. */
@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private async company(tx: Tx, id: string) {
    if (!(await tx.company.findFirst({ where: { id, deletedAt: null }, select: { id: true } }))) throw new NotFoundException('Empresa não encontrada');
  }

  private async dept(tx: Tx, id: string) {
    const d = await tx.department.findFirst({ where: { id, deletedAt: null } });
    if (!d) throw new NotFoundException('Departamento não encontrado');
    return d;
  }

  /** Lista plana com nível e caminho ("Saúde › UBS Centro › Recepção"), pronta para desenhar a árvore. */
  list(tenantId: string, companyId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      await this.company(tx, companyId);
      const rows = await tx.department.findMany({
        where: { companyId, deletedAt: null },
        select: { id: true, name: true, code: true, parentId: true, unitId: true, sectors: { where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: 'asc' } }, _count: { select: { employments: { where: { deletedAt: null, status: 'ACTIVE' } } } } },
        orderBy: { name: 'asc' },
      });
      const byId = new Map(rows.map((r) => [r.id, r]));
      const out: Array<Record<string, unknown>> = [];
      const walk = (parentId: string | null, depth: number, trail: string[]) => {
        for (const r of rows.filter((x) => x.parentId === parentId)) {
          const path = [...trail, r.name];
          out.push({ id: r.id, name: r.name, code: r.code, parentId: r.parentId, unitId: r.unitId, depth, path: path.join(' › '), sectors: r.sectors, employees: r._count.employments, children: rows.filter((x) => x.parentId === r.id).length });
          walk(r.id, depth + 1, path);
        }
      };
      walk(null, 0, []);
      // pais excluídos deixam filhos órfãos: aparecem na raiz
      for (const r of rows) if (r.parentId && !byId.has(r.parentId) && !out.some((o) => o.id === r.id)) { out.push({ id: r.id, name: r.name, code: r.code, parentId: null, unitId: r.unitId, depth: 0, path: r.name, sectors: r.sectors, employees: r._count.employments, children: 0 }); }
      return out;
    });
  }

  /** Impede ciclos: o novo pai não pode ser o próprio departamento nem um descendente dele. */
  private async assertNoCycle(tx: Tx, id: string, parentId: string) {
    let cur: string | null = parentId;
    for (let i = 0; cur && i < 100; i++) {
      if (cur === id) throw new BadRequestException('Um departamento não pode ficar dentro dele mesmo ou de um subdepartamento seu');
      const p: { parentId: string | null } | null = await tx.department.findFirst({ where: { id: cur }, select: { parentId: true } });
      cur = p?.parentId ?? null;
    }
  }

  async create(tenantId: string, user: AuthUser, input: DepartmentInput, meta: RequestMeta) {
    try {
      return await this.prisma.forTenant(tenantId, async (tx) => {
        await this.company(tx, input.companyId);
        if (input.parentId) {
          const parent = await this.dept(tx, input.parentId);
          if (parent.companyId !== input.companyId) throw new BadRequestException('O departamento pai é de outra empresa');
        }
        const d = await tx.department.create({ data: { tenantId, companyId: input.companyId, name: input.name, code: input.code, parentId: input.parentId } });
        await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'department', entityId: d.id, after: d, ...meta });
        return d;
      });
    } catch (e) {
      if (isUnique(e)) throw new ConflictException('Já existe um departamento com este código nesta empresa');
      throw e;
    }
  }

  async update(tenantId: string, user: AuthUser, id: string, input: DepartmentUpdate, meta: RequestMeta) {
    try {
      return await this.prisma.forTenant(tenantId, async (tx) => {
        const before = await this.dept(tx, id);
        if (input.parentId) {
          const parent = await this.dept(tx, input.parentId);
          if (parent.companyId !== before.companyId) throw new BadRequestException('O departamento pai é de outra empresa');
          await this.assertNoCycle(tx, id, input.parentId);
        }
        const d = await tx.department.update({ where: { id }, data: { name: input.name, code: input.code, parentId: input.parentId === undefined ? undefined : input.parentId } });
        await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'department', entityId: id, before, after: d, ...meta });
        return d;
      });
    } catch (e) {
      if (isUnique(e)) throw new ConflictException('Já existe um departamento com este código nesta empresa');
      throw e;
    }
  }

  remove(tenantId: string, user: AuthUser, id: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const before = await this.dept(tx, id);
      if (await tx.department.count({ where: { parentId: id, deletedAt: null } })) throw new ConflictException('Mova ou exclua os subdepartamentos antes');
      const n = await tx.employment.count({ where: { departmentId: id, deletedAt: null, status: 'ACTIVE' } });
      if (n) throw new ConflictException(`Departamento com ${n} funcionário(s) ativo(s): transfira-os antes de excluir`);
      await tx.department.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'DELETE', entity: 'department', entityId: id, before, ...meta });
    });
  }

  addSector(tenantId: string, user: AuthUser, departmentId: string, input: SectorInput, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      await this.dept(tx, departmentId);
      if (await tx.sector.findFirst({ where: { departmentId, deletedAt: null, name: { equals: input.name, mode: 'insensitive' } } })) throw new ConflictException('Já existe uma seção com este nome neste departamento');
      const s = await tx.sector.create({ data: { tenantId, departmentId, name: input.name } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'sector', entityId: s.id, after: s, ...meta });
      return s;
    });
  }

  removeSector(tenantId: string, user: AuthUser, departmentId: string, sectorId: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const s = await tx.sector.findFirst({ where: { id: sectorId, departmentId, deletedAt: null } });
      if (!s) throw new NotFoundException('Seção não encontrada');
      const n = await tx.employment.count({ where: { sectorId, deletedAt: null, status: 'ACTIVE' } });
      if (n) throw new ConflictException(`Seção com ${n} funcionário(s) ativo(s)`);
      await tx.sector.update({ where: { id: sectorId }, data: { deletedAt: new Date() } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'DELETE', entity: 'sector', entityId: sectorId, before: s, ...meta });
    });
  }
}
