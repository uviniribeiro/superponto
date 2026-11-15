import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { afdHeader671, afdRecord7, afdTrailer671 } from '@superponto/rep-protocols';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import { AuditService } from '../audit/audit.service.js';
import type { RequestMeta } from '../common/tenant.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toDate } from './timesheet.core.js';

export const repPSettingsSchema = z.object({ companyId: z.uuid(), inpiNumber: z.string().regex(/^\d{17}$/, 'Número do INPI com 17 dígitos').nullable() });
export const repPAfdSchema = z.object({ companyId: z.uuid(), from: z.iso.date(), to: z.iso.date() }).refine((v) => v.to >= v.from, { message: 'Período inválido', path: ['to'] });

/** Identificação do programa no cabeçalho do AFD (CNPJ do desenvolvedor e modelo), definida na instalação. */
const DEVELOPER = { id: process.env.REP_P_DEVELOPER_CNPJ ?? '', model: 'SuperPonto' };

/**
 * REP-P (programa de registro de ponto, Portaria 671): número no INPI por empresa e AFD das
 * marcações feitas pelo navegador e pelo app, com NSR sequencial e hash encadeado gravados na hora
 * da marcação (o arquivo é refeito igual sempre que gerado). A assinatura .p7s é feita pela empresa.
 */
@Injectable()
export class RepPService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async get(tenantId: string, companyId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      if (!(await tx.company.findFirst({ where: { id: companyId, deletedAt: null } }))) throw new NotFoundException('Empresa não encontrada');
      const r = await tx.repPRegister.findUnique({ where: { companyId } });
      return { companyId, inpiNumber: r?.inpiNumber ?? null, lastNsr: Number(r?.lastNsr ?? 0) };
    });
  }

  async save(tenantId: string, user: AuthUser, input: z.infer<typeof repPSettingsSchema>, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      if (!(await tx.company.findFirst({ where: { id: input.companyId, deletedAt: null } }))) throw new NotFoundException('Empresa não encontrada');
      const before = await tx.repPRegister.findUnique({ where: { companyId: input.companyId } });
      const r = await tx.repPRegister.upsert({ where: { companyId: input.companyId }, create: { tenantId, companyId: input.companyId, inpiNumber: input.inpiNumber }, update: { inpiNumber: input.inpiNumber } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'rep_p_register', entityId: r.id, before: { inpiNumber: before?.inpiNumber ?? null }, after: { inpiNumber: r.inpiNumber }, ...meta });
      return { companyId: r.companyId, inpiNumber: r.inpiNumber, lastNsr: Number(r.lastNsr) };
    });
  }

  async afd(tenantId: string, user: AuthUser, q: z.infer<typeof repPAfdSchema>, meta: RequestMeta) {
    const from = new Date(`${q.from}T00:00:00-03:00`);
    const to = new Date(new Date(`${q.to}T00:00:00-03:00`).getTime() + 86_400_000);
    const { company, reg, rows, prevHash } = await this.prisma.forTenant(tenantId, async (tx) => {
      const company = await tx.company.findFirst({ where: { id: q.companyId, deletedAt: null } });
      if (!company) throw new NotFoundException('Empresa não encontrada');
      const reg = await tx.repPRegister.findUnique({ where: { companyId: q.companyId } });
      const rows = await tx.timeRecord.findMany({
        where: { repPCompanyId: q.companyId, recordedAt: { gte: from, lt: to } }, orderBy: { repPNsr: 'asc' },
        select: { repPNsr: true, repPHash: true, recordedAt: true, receivedAt: true, employment: { select: { person: { select: { cpf: true } } } } },
      });
      const first = rows[0]?.repPNsr;
      const prevHash = first && first > 1n ? (await tx.timeRecord.findFirst({ where: { repPCompanyId: q.companyId, repPNsr: first - 1n }, select: { repPHash: true } }))?.repPHash ?? null : null;
      return { company, reg, rows, prevHash };
    });
    if (!company.cnpj) throw new BadRequestException('A empresa precisa de CNPJ para gerar o AFD');
    const warnings: string[] = [];
    if (!reg?.inpiNumber) warnings.push('Número do REP-P no INPI não informado: o cabeçalho saiu com zeros.');
    if (!DEVELOPER.id) warnings.push('CNPJ do desenvolvedor do programa (REP_P_DEVELOPER_CNPJ) não configurado.');
    const lines = [afdHeader671({ employerIdType: 'CNPJ', employerId: company.cnpj, secondaryId: company.cno ?? '', employerName: company.legalName, repId: reg?.inpiNumber ?? '', periodStart: q.from, periodEnd: q.to, generatedAt: new Date(), developerId: DEVELOPER.id, model: DEVELOPER.model })];
    let prev = prevHash;
    let broken = 0;
    for (const r of rows) {
      // Refaz o registro com os dados gravados e confere com o hash da hora da marcação (navegador ou app).
      const tries = (['02', '01'] as const).map((c) => afdRecord7({ nsr: r.repPNsr!, at: r.recordedAt, cpf: r.employment.person.cpf ?? '', recordedAt: r.recordedAt, collector: c, offline: false }, prev));
      const ok = tries.find((t) => t.hash === r.repPHash);
      if (!ok) broken++;
      lines.push((ok ?? tries[0]!).line);
      prev = r.repPHash;
      if (!r.employment.person.cpf) warnings.push(`NSR ${r.repPNsr}: funcionário sem CPF.`);
    }
    if (broken) warnings.push(`${broken} registro(s) não conferem com o hash gravado: verifique a integridade do banco.`);
    lines.push(afdTrailer671({ '7': rows.length }));
    await this.prisma.forTenant(tenantId, (tx) => this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'EXPORT', entity: 'afd_rep_p', after: { companyId: q.companyId, from: q.from, to: q.to, records: rows.length }, ...meta }));
    const content = `${lines.join('\r\n')}\r\n`;
    return { filename: `AFD_REP-P_${company.cnpj.replace(/\W/g, '')}_${q.from}_${q.to}.txt`, mime: 'text/plain;charset=iso-8859-1', base64: Buffer.from(content, 'latin1').toString('base64'), records: rows.length, warnings };
  }
}
