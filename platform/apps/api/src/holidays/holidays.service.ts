import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { MUNICIPAL_RULES, nationalHolidays, municipalHolidays, ruleDate, stateHolidays, UFS, type Holiday, type Movable } from '@superponto/br-docs';
import type { AuthUser } from '../auth/auth-user.js';
import { AuditService } from '../audit/audit.service.js';
import type { RequestMeta } from '../common/tenant.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import type { HolidayOverrideInput, HolidayRuleInput } from './holidays.schemas.js';

export interface CompanyHoliday {
  date: string;
  name: string;
  scope: 'NATIONAL' | 'STATE' | 'MUNICIPAL' | 'COMPANY';
  kind: 'HOLIDAY' | 'OPTIONAL';
  basis: string | null;
  review: boolean;
  /** true = dia de trabalho (ponto facultativo trabalhado ou feriado desconsiderado pela empresa) */
  workday: boolean;
  overridden: boolean;
  ruleId?: string;
  note?: string | null;
}

const day = (d: Date) => d.toISOString().slice(0, 10);

@Injectable()
export class HolidaysService {
  private readonly log = new Logger('Feriados');
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  /** Gera (de forma idempotente) o catálogo do ano: nacionais, estaduais de todas as UFs e municipais da base. */
  async generateYear(year: number): Promise<number> {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new BadRequestException('Ano inválido');
    const items: Holiday[] = [
      ...nationalHolidays(year),
      ...UFS.flatMap((uf) => stateHolidays(year, uf)),
      ...Object.keys(MUNICIPAL_RULES).flatMap((ibge) => municipalHolidays(year, ibge)),
    ];
    const res = await this.prisma.asPlatform((tx) => tx.publicHoliday.createMany({
      data: items.map((h) => ({ date: new Date(`${h.date}T00:00:00Z`), year, name: h.name, scope: h.scope, kind: h.kind, uf: h.uf ?? '', ibge: h.ibge ?? '', basis: h.basis, review: h.review })),
      skipDuplicates: true,
    }));
    if (res.count) this.log.log(`${year}: ${res.count} feriado(s) cadastrado(s)`);
    return res.count;
  }

  /** Garante o ano corrente e o próximo (roda na subida e periodicamente; em 01/01 o próximo ano já existe). */
  async ensureUpcoming(now = new Date()) {
    const y = now.getUTCFullYear();
    return { [y]: await this.generateYear(y), [y + 1]: await this.generateYear(y + 1) };
  }

  private async company(tx: Tx, id: string) {
    const c = await tx.company.findFirst({ where: { id, deletedAt: null }, select: { id: true, state: true, ibgeCode: true, city: true } });
    if (!c) throw new NotFoundException('Empresa não encontrada');
    return c;
  }

  async listForCompany(tenantId: string, companyId: string, year: number) {
    if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new BadRequestException('Ano inválido');
    if (!(await this.prisma.asPlatform((tx) => tx.publicHoliday.count({ where: { year } })))) await this.generateYear(year);
    return this.prisma.forTenant(tenantId, async (tx) => {
      const c = await this.company(tx, companyId);
      const [catalog, rules, overrides] = await Promise.all([
        tx.publicHoliday.findMany({
          where: { year, OR: [{ scope: 'NATIONAL' }, ...(c.state ? [{ scope: 'STATE' as const, uf: c.state }] : []), ...(c.ibgeCode ? [{ scope: 'MUNICIPAL' as const, ibge: c.ibgeCode }] : [])] },
        }),
        tx.companyHolidayRule.findMany({ where: { companyId, deletedAt: null } }),
        tx.companyHolidayOverride.findMany({ where: { companyId, date: { gte: new Date(`${year}-01-01T00:00:00Z`), lte: new Date(`${year}-12-31T00:00:00Z`) } } }),
      ]);
      const items: CompanyHoliday[] = [
        ...catalog.map((h) => ({ date: day(h.date), name: h.name, scope: h.scope, kind: h.kind, basis: h.basis, review: h.review, workday: false, overridden: false })),
        ...rules.map((r) => ({ date: ruleDate({ name: r.name, kind: r.kind, month: r.month ?? undefined, day: r.day ?? undefined, movable: (r.movable ?? undefined) as Movable | undefined }, year), name: r.name, scope: 'COMPANY' as const, kind: r.kind, basis: 'Cadastrado pela empresa', review: false, workday: false, overridden: false, ruleId: r.id })),
      ];
      // Um por data: o mais específico vence (empresa > municipal > estadual > nacional) e feriado vence facultativo.
      const rank = (h: CompanyHoliday) => (h.kind === 'HOLIDAY' ? 10 : 0) + { COMPANY: 4, MUNICIPAL: 3, STATE: 2, NATIONAL: 1 }[h.scope];
      const byDate = new Map<string, CompanyHoliday>();
      for (const h of items) {
        const cur = byDate.get(h.date);
        if (!cur || rank(h) > rank(cur)) byDate.set(h.date, h);
      }
      // Ponto facultativo é dia de trabalho até a empresa decidir folgar; a decisão da empresa prevalece.
      for (const h of byDate.values()) h.workday = h.kind === 'OPTIONAL';
      for (const o of overrides) {
        const d = day(o.date);
        const h = byDate.get(d);
        if (h) Object.assign(h, { workday: o.workday, overridden: true, note: o.note });
        else if (!o.workday) byDate.set(d, { date: d, name: o.note || 'Folga concedida pela empresa', scope: 'COMPANY', kind: 'HOLIDAY', basis: 'Decisão da empresa', review: false, workday: false, overridden: true, note: o.note });
      }
      return {
        year,
        location: { city: c.city, state: c.state, ibge: c.ibgeCode, municipalBase: !!(c.ibgeCode && MUNICIPAL_RULES[c.ibgeCode]) },
        holidays: [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date)),
      };
    });
  }

  addRule(tenantId: string, user: AuthUser, companyId: string, input: HolidayRuleInput, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      await this.company(tx, companyId);
      const rule = await tx.companyHolidayRule.create({ data: { tenantId, companyId, name: input.name, kind: input.kind, month: input.month ?? null, day: input.day ?? null, movable: input.movable ?? null } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'company_holiday_rule', entityId: rule.id, after: rule, ...meta });
      return rule;
    });
  }

  removeRule(tenantId: string, user: AuthUser, companyId: string, ruleId: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rule = await tx.companyHolidayRule.findFirst({ where: { id: ruleId, companyId, deletedAt: null } });
      if (!rule) throw new NotFoundException('Feriado não encontrado');
      await tx.companyHolidayRule.update({ where: { id: ruleId }, data: { deletedAt: new Date() } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'DELETE', entity: 'company_holiday_rule', entityId: ruleId, before: rule, ...meta });
    });
  }

  setOverride(tenantId: string, user: AuthUser, companyId: string, input: HolidayOverrideInput, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      await this.company(tx, companyId);
      const date = new Date(`${input.date}T00:00:00Z`);
      const before = await tx.companyHolidayOverride.findUnique({ where: { companyId_date: { companyId, date } } });
      const saved = await tx.companyHolidayOverride.upsert({
        where: { companyId_date: { companyId, date } },
        create: { tenantId, companyId, date, workday: input.workday, note: input.note ?? null },
        update: { workday: input.workday, note: input.note ?? null },
      });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: before ? 'UPDATE' : 'CREATE', entity: 'company_holiday_override', entityId: saved.id, before, after: saved, ...meta });
      return saved;
    });
  }

  clearOverride(tenantId: string, user: AuthUser, companyId: string, date: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const row = await tx.companyHolidayOverride.findFirst({ where: { companyId, date: new Date(`${date}T00:00:00Z`) } });
      if (!row) throw new NotFoundException('Nenhuma decisão para esta data');
      await tx.companyHolidayOverride.delete({ where: { id: row.id } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'DELETE', entity: 'company_holiday_override', entityId: row.id, before: row, ...meta });
    });
  }
}
