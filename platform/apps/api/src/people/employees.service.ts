import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@superponto/database';
import type { AuthUser } from '../auth/auth-user.js';
import { AuditService } from '../audit/audit.service.js';
import { can } from '../authorization/authorization.js';
import type { RequestMeta } from '../common/tenant.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import type { EmployeeCreate, EmployeeList, EmployeeUpdate, TerminateInput } from './employees.schemas.js';

const isUnique = (e: unknown) => typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002';
const date = (v: string) => new Date(`${v}T00:00:00Z`);
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

/** CPF e PIS só aparecem completos para quem tem "Ver dados sensíveis". */
export function maskCpf(v: string | null) { return v ? `***.***.${v.slice(6, 9)}-${v.slice(9)}` : null; }
export function maskPis(v: string | null) { return v ? `***.*****.${v.slice(8, 10)}-${v.slice(10)}` : null; }

const INCLUDE = {
  person: true,
  company: { select: { id: true, legalName: true, tradeName: true } },
  unit: { select: { id: true, name: true } },
  department: { select: { id: true, name: true } },
  sector: { select: { id: true, name: true } },
  position: { select: { id: true, name: true, cbo: true } },
  jobFunction: { select: { id: true, name: true } },
  costCenter: { select: { id: true, name: true } },
  employeeType: { select: { id: true, name: true } },
  laborUnion: { select: { id: true, acronym: true } },
  supervisor: { select: { id: true, person: { select: { fullName: true } } } },
} satisfies Prisma.EmploymentInclude;
type Row = Prisma.EmploymentGetPayload<{ include: typeof INCLUDE }>;

/** Visão sem dados sensíveis, usada na auditoria (o log nunca guarda CPF/PIS completos). */
const auditView = (user: AuthUser) => ({ ...user, isPlatformAdmin: false, grants: [] }) as AuthUser;

/** Campos do vínculo que geram histórico (troca de departamento, cargo etc.). */
const TRACKED = ['departmentId', 'sectorId', 'positionId', 'functionId', 'costCenterId', 'employeeTypeId', 'unionId', 'unitId', 'contractType', 'weeklyHours', 'supervisorId', 'registration'] as const;

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  shape(r: Row, viewer: AuthUser) {
    const sensitive = can(viewer, 'people.sensitive:read');
    const p = r.person;
    return {
      id: r.id, personId: p.id, fullName: p.fullName, socialName: p.socialName,
      cpf: sensitive ? p.cpf : maskCpf(p.cpf), pis: sensitive ? p.pis : maskPis(p.pis), sensitiveVisible: sensitive,
      birthDate: iso(p.birthDate), email: p.email, phone: p.phone, address: p.address,
      registration: r.registration, status: r.status, contractType: r.contractType, weeklyHours: r.weeklyHours ? Number(r.weeklyHours) : null,
      hiredAt: iso(r.hiredAt), terminatedAt: iso(r.terminatedAt),
      company: r.company, department: r.department, sector: r.sector, position: r.position, function: r.jobFunction,
      costCenter: r.costCenter, employeeType: r.employeeType, union: r.laborUnion,
      supervisor: r.supervisor ? { id: r.supervisor.id, fullName: r.supervisor.person.fullName } : null,
      unitId: r.unitId, unit: r.unit,
    };
  }

  /** Departamento e todos os subdepartamentos (para filtrar "com subdepartamentos"). */
  private async departmentTree(tx: Tx, rootId: string) {
    const all = await tx.department.findMany({ where: { deletedAt: null }, select: { id: true, parentId: true } });
    const ids = new Set([rootId]);
    let grew = true;
    while (grew) { grew = false; for (const d of all) if (d.parentId && ids.has(d.parentId) && !ids.has(d.id)) { ids.add(d.id); grew = true; } }
    return [...ids];
  }

  list(tenantId: string, viewer: AuthUser, q: EmployeeList) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const sensitive = can(viewer, 'people.sensitive:read');
      const s = q.search;
      const digits = s?.replace(/\D/g, '') ?? '';
      const where: Prisma.EmploymentWhereInput = {
        deletedAt: null,
        ...(q.status === 'ALL' ? {} : { status: q.status }),
        ...(q.companyId ? { companyId: q.companyId } : {}),
        ...(q.departmentId ? { departmentId: q.includeSubdepartments ? { in: await this.departmentTree(tx, q.departmentId) } : q.departmentId } : {}),
        ...(q.positionId ? { positionId: q.positionId } : {}),
        ...(q.employeeTypeId ? { employeeTypeId: q.employeeTypeId } : {}),
        ...(q.costCenterId ? { costCenterId: q.costCenterId } : {}),
        ...(q.groupingId ? { groupings: { some: { groupingId: q.groupingId } } } : {}),
        ...(s ? { OR: [
          { person: { fullName: { contains: s, mode: 'insensitive' } } },
          { person: { socialName: { contains: s, mode: 'insensitive' } } },
          { registration: { contains: s, mode: 'insensitive' } },
          // buscar por CPF/PIS só com permissão de dados sensíveis (senão seria um jeito de descobri-los)
          ...(sensitive && digits.length >= 4 ? [{ person: { cpf: { contains: digits } } }, { person: { pis: { contains: digits } } }] : []),
        ] } : {}),
      };
      const [rows, total] = await Promise.all([
        tx.employment.findMany({ where, include: INCLUDE, orderBy: [{ person: { fullName: 'asc' } }, { registration: 'asc' }], skip: (q.page - 1) * q.pageSize, take: q.pageSize }),
        tx.employment.count({ where }),
      ]);
      return { data: rows.map((r) => this.shape(r, viewer)), page: q.page, pageSize: q.pageSize, total };
    });
  }

  private async load(tx: Tx, id: string) {
    const r = await tx.employment.findFirst({ where: { id, deletedAt: null }, include: INCLUDE });
    if (!r) throw new NotFoundException('Funcionário não encontrado');
    return r;
  }

  get(tenantId: string, viewer: AuthUser, id: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const r = await this.load(tx, id);
      const history = await tx.employmentHistory.findMany({ where: { employmentId: id }, orderBy: { createdAt: 'desc' }, take: 100 });
      const others = await tx.employment.findMany({ where: { personId: r.personId, deletedAt: null, NOT: { id } }, select: { id: true, registration: true, status: true, company: { select: { legalName: true, tradeName: true } } } });
      return { ...this.shape(r, viewer), history, otherEmployments: others };
    });
  }

  /** Confere que departamento, seção, cargo, unidade e superior são da mesma empresa (e existem). */
  private async checkRefs(tx: Tx, companyId: string, v: Partial<Record<string, unknown>>, selfId?: string) {
    const fail = (m: string) => { throw new BadRequestException(m); };
    if (v.departmentId) { const d = await tx.department.findFirst({ where: { id: v.departmentId as string, deletedAt: null } }); if (!d || d.companyId !== companyId) fail('Departamento não pertence a esta empresa'); }
    if (v.sectorId) {
      const s = await tx.sector.findFirst({ where: { id: v.sectorId as string, deletedAt: null } });
      if (!s) fail('Seção não encontrada');
      if (v.departmentId !== undefined && v.departmentId !== null && s!.departmentId !== v.departmentId) fail('A seção não pertence ao departamento escolhido');
    }
    if (v.positionId) { const p = await tx.jobPosition.findFirst({ where: { id: v.positionId as string, deletedAt: null } }); if (!p || p.companyId !== companyId) fail('Cargo não pertence a esta empresa'); }
    if (v.unitId) { const u = await tx.companyUnit.findFirst({ where: { id: v.unitId as string, deletedAt: null } }); if (!u || u.companyId !== companyId) fail('Unidade não pertence a esta empresa'); }
    for (const [key, model, label] of [['functionId', 'jobFunction', 'Função'], ['costCenterId', 'costCenter', 'Centro de custo'], ['employeeTypeId', 'employeeType', 'Tipo de funcionário'], ['unionId', 'laborUnion', 'Sindicato']] as const) {
      if (v[key]) {
        const found = await (tx as unknown as Record<string, { findFirst(a: unknown): Promise<unknown> }>)[model]!.findFirst({ where: { id: v[key], deletedAt: null } });
        if (!found) fail(`${label} não encontrado(a)`);
      }
    }
    if (v.supervisorId) {
      if (v.supervisorId === selfId) fail('O funcionário não pode ser o próprio superior');
      const sup = await tx.employment.findFirst({ where: { id: v.supervisorId as string, deletedAt: null, status: { not: 'TERMINATED' } } });
      if (!sup) fail('Superior não encontrado ou desligado');
    }
  }

  async create(tenantId: string, user: AuthUser, input: EmployeeCreate, meta: RequestMeta) {
    try {
      return await this.prisma.forTenant(tenantId, async (tx) => {
        if (!(await tx.company.findFirst({ where: { id: input.companyId, deletedAt: null } }))) throw new NotFoundException('Empresa não encontrada');
        await this.checkRefs(tx, input.companyId, input);
        // Mesma pessoa (CPF) pode ter mais de um vínculo: reaproveita o cadastro da pessoa.
        let person = input.cpf ? await tx.person.findFirst({ where: { cpf: input.cpf, deletedAt: null } }) : null;
        if (!person && input.pis) person = await tx.person.findFirst({ where: { pis: input.pis, deletedAt: null } });
        if (person && input.cpf && person.cpf && person.cpf !== input.cpf) throw new ConflictException('Este PIS já pertence a outra pessoa com outro CPF');
        if (!person) {
          person = await tx.person.create({ data: {
            tenantId, fullName: input.fullName, socialName: input.socialName, cpf: input.cpf, pis: input.pis,
            birthDate: input.birthDate ? date(input.birthDate) : undefined, email: input.email, phone: input.phone, address: input.address,
          } });
        }
        const e = await tx.employment.create({ data: {
          tenantId, personId: person.id, companyId: input.companyId, registration: input.registration, hiredAt: date(input.hiredAt),
          contractType: input.contractType, weeklyHours: input.weeklyHours, unitId: input.unitId, departmentId: input.departmentId, sectorId: input.sectorId,
          positionId: input.positionId, functionId: input.functionId, costCenterId: input.costCenterId, employeeTypeId: input.employeeTypeId,
          unionId: input.unionId, supervisorId: input.supervisorId,
        } });
        const row = await this.load(tx, e.id);
        await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'employment', entityId: e.id, after: { ...this.shape(row, auditView(user)), reusedPerson: person.createdAt < e.createdAt }, ...meta });
        return this.shape(row, user);
      });
    } catch (e) {
      if (isUnique(e)) {
        const target = String((e as { meta?: { target?: unknown } }).meta?.target ?? '');
        throw new ConflictException(target.includes('cpf') ? 'CPF já cadastrado para outra pessoa' : 'Matrícula já usada nesta empresa');
      }
      throw e;
    }
  }

  async update(tenantId: string, user: AuthUser, id: string, input: EmployeeUpdate, meta: RequestMeta) {
    try {
      return await this.prisma.forTenant(tenantId, async (tx) => {
        const before = await this.load(tx, id);
        if (before.status === 'TERMINATED') throw new BadRequestException('Funcionário desligado: reative antes de alterar');
        const merged = { departmentId: input.departmentId === undefined ? before.departmentId : input.departmentId, ...input };
        await this.checkRefs(tx, before.companyId, merged, id);
        const personData: Prisma.PersonUpdateInput = {};
        for (const k of ['fullName', 'socialName', 'cpf', 'pis', 'email', 'phone'] as const) if (input[k] !== undefined) (personData as Record<string, unknown>)[k] = input[k];
        if (input.birthDate !== undefined) personData.birthDate = input.birthDate ? date(input.birthDate) : null;
        if (input.address !== undefined) personData.address = input.address ?? undefined;
        if (Object.keys(personData).length) await tx.person.update({ where: { id: before.personId }, data: personData });
        const empData: Record<string, unknown> = {};
        for (const k of TRACKED) if (input[k] !== undefined) empData[k] = input[k];
        // seção solta quando muda de departamento sem informar seção
        if (input.departmentId !== undefined && input.departmentId !== before.departmentId && input.sectorId === undefined) empData.sectorId = null;
        if (Object.keys(empData).length) await tx.employment.update({ where: { id }, data: empData });
        // histórico das mudanças do vínculo
        const effectiveAt = date(input.effectiveAt ?? new Date().toISOString().slice(0, 10));
        const hist = Object.keys(empData).filter((k) => {
          const old = (before as unknown as Record<string, unknown>)[k];
          return String(old ?? '') !== String(empData[k] ?? '');
        }).map((field) => ({ tenantId, employmentId: id, field, oldValue: ((before as unknown as Record<string, unknown>)[field] ?? null) as Prisma.InputJsonValue, newValue: (empData[field] ?? null) as Prisma.InputJsonValue, effectiveAt, reason: input.reason, actorUserId: user.id }));
        if (hist.length) await tx.employmentHistory.createMany({ data: hist.map((h) => ({ ...h, oldValue: h.oldValue === null ? undefined : String(h.oldValue), newValue: h.newValue === null ? undefined : String(h.newValue) })) });
        const after = await this.load(tx, id);
        await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'employment', entityId: id, before: this.shape(before, auditView(user)), after: this.shape(after, auditView(user)), ...meta });
        return this.shape(after, user);
      });
    } catch (e) {
      if (isUnique(e)) {
        const target = String((e as { meta?: { target?: unknown } }).meta?.target ?? '');
        throw new ConflictException(target.includes('cpf') ? 'CPF já cadastrado para outra pessoa' : 'Matrícula já usada nesta empresa');
      }
      throw e;
    }
  }

  terminate(tenantId: string, user: AuthUser, id: string, input: TerminateInput, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const before = await this.load(tx, id);
      if (before.status === 'TERMINATED') throw new BadRequestException('Funcionário já desligado');
      const at = date(input.terminatedAt);
      if (at < before.hiredAt) throw new BadRequestException('A data de desligamento é anterior à admissão');
      await tx.employment.update({ where: { id }, data: { status: 'TERMINATED', terminatedAt: at } });
      await tx.employmentHistory.create({ data: { tenantId, employmentId: id, field: 'status', oldValue: before.status, newValue: 'TERMINATED', effectiveAt: at, reason: input.reason, actorUserId: user.id } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'employment', entityId: id, before: { status: before.status }, after: { status: 'TERMINATED', terminatedAt: input.terminatedAt, reason: input.reason }, ...meta });
      return this.shape(await this.load(tx, id), user);
    });
  }

  reactivate(tenantId: string, user: AuthUser, id: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const before = await this.load(tx, id);
      if (before.status !== 'TERMINATED') throw new BadRequestException('Funcionário não está desligado');
      await tx.employment.update({ where: { id }, data: { status: 'ACTIVE', terminatedAt: null } });
      await tx.employmentHistory.create({ data: { tenantId, employmentId: id, field: 'status', oldValue: 'TERMINATED', newValue: 'ACTIVE', effectiveAt: date(new Date().toISOString().slice(0, 10)), reason: 'Reativação', actorUserId: user.id } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'employment', entityId: id, before: { status: 'TERMINATED' }, after: { status: 'ACTIVE' }, ...meta });
      return this.shape(await this.load(tx, id), user);
    });
  }
}
