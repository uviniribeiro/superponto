import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { onlyDigits } from '@superponto/br-docs';
import { PrismaService } from '../prisma/prisma.service.js';
import { EMP_SELECT, iso, local, TimesheetCore, toDate } from './timesheet.core.js';

const hhmm = (v: string | null | undefined) => (v ? v.replace(':', '') : '');
const clean = (v: string) => v.replace(/[|\r\n]/g, ' ').trim();

/**
 * AEJ — Arquivo Eletrônico de Jornada (Portaria MTP 671/2021), gerado da apuração do período:
 * 01 cabeçalho, 02 registradores, 03 vínculos, 04 horários contratuais, 05 marcações (originais,
 * incluídas e desconsideradas), 06 matrícula, 07 ausências e banco de horas, 08 programa, 99 trailer.
 * Campos separados por "|". A assinatura eletrônica (CAdES, certificado ICP-Brasil) é feita pela empresa.
 */
@Injectable()
export class AejService {
  constructor(private readonly prisma: PrismaService, private readonly core: TimesheetCore) {}

  async generate(tenantId: string, companyId: string, from: string, to: string) {
    const { company, emps, devices, bank } = await this.prisma.forTenant(tenantId, async (tx) => {
      const company = await tx.company.findFirst({ where: { id: companyId, deletedAt: null } });
      if (!company) throw new NotFoundException('Empresa não encontrada');
      const emps = await tx.employment.findMany({
        where: { companyId, deletedAt: null, hiredAt: { lte: toDate(to) }, OR: [{ terminatedAt: null }, { terminatedAt: { gte: toDate(from) } }] },
        select: { ...EMP_SELECT, person: { select: { fullName: true, socialName: true, cpf: true } }, scheduleAssignments: { where: { validFrom: { lte: toDate(to) }, OR: [{ validTo: null }, { validTo: { gte: toDate(from) } }] }, select: { schedule: { select: { id: true, code: true, name: true, days: true } } } } },
        orderBy: { registration: 'asc' },
      });
      const devices = await tx.device.findMany({ where: { companyId, deletedAt: null }, select: { id: true, repNumber: true, ordinance: true } });
      const bank = await tx.bankHourTransaction.findMany({ where: { account: { employment: { companyId } }, refDate: { gte: toDate(from), lte: toDate(to) }, type: { in: ['CREDIT', 'DEBIT', 'COMPENSATION'] } }, select: { type: true, minutes: true, refDate: true, account: { select: { employmentId: true } } } });
      return { company, emps, devices, bank };
    });
    if (!company.cnpj) throw new BadRequestException('A empresa precisa de CNPJ para gerar o AEJ');
    const warnings: string[] = [];
    const days = await this.core.compute(tenantId, emps as never, from, to);

    // 02: registradores. REP-P (navegador/app) = id 1; relógios com número de fabricação a partir do 2.
    const reps = new Map<string, { id: number; tp: number; nr: string }>();
    reps.set('WEB', { id: 1, tp: 3, nr: '0'.repeat(17) });
    warnings.push('O número do REP-P (registro do programa no INPI) ainda não foi informado: saiu com zeros.');
    let next = 2;
    for (const d of devices) {
      if (!d.repNumber) { warnings.push('Há relógio sem número de fabricação (17 dígitos): as marcações dele saem como REP-P.'); continue; }
      reps.set(d.id, { id: next++, tp: d.ordinance === 'P373_2011' ? 2 : 1, nr: d.repNumber });
    }
    const repOf = (deviceId: string | null) => reps.get(deviceId ?? 'WEB') ?? reps.get('WEB')!;
    const records = await this.prisma.forTenant(tenantId, (tx) => tx.timeRecord.findMany({ where: { employmentId: { in: emps.map((e) => e.id) } }, select: { id: true, deviceId: true } }));
    const deviceOfRecord = new Map(records.map((r) => [r.id, r.deviceId]));

    // 04: horários contratuais usados no período.
    const horarios = new Map<string, { cod: string; line: string }>();
    for (const e of emps) for (const a of e.scheduleAssignments) {
      const s = a.schedule;
      if (horarios.has(s.id)) continue;
      const d = s.days.filter((x) => x.isWorkday && x.startTime && x.endTime).sort((x, y) => x.dayIndex - y.dayIndex)[0];
      const cod = clean(s.code ?? String(horarios.size + 1)).slice(0, 30);
      let e1 = hhmm(d?.startTime), s1 = hhmm(d?.endTime), e2 = '', s2 = '';
      if (d?.breakStart && d.breakMinutes) {
        const b = Number(d.breakStart.slice(0, 2)) * 60 + Number(d.breakStart.slice(3)) + d.breakMinutes;
        s1 = hhmm(d.breakStart); e2 = `${String(Math.floor((b % 1440) / 60)).padStart(2, '0')}${String(b % 60).padStart(2, '0')}`; s2 = hhmm(d.endTime);
      }
      horarios.set(s.id, { cod, line: ['04', cod, String(d?.expectedMinutes ?? 0), e1, s1, e2, s2].join('|') });
    }

    const lines: string[] = [];
    const count: Record<string, number> = {};
    const push = (l: string) => { lines.push(l); const k = l.slice(0, 2); count[k] = (count[k] ?? 0) + 1; };
    const now = new Date();
    const stamp = `${local(now).date}T${local(now).time}:00-0300`;
    push(['01', '1', onlyDigits(company.cnpj).padStart(14, '0').slice(-14), '', company.cno && onlyDigits(company.cno).length === 12 ? onlyDigits(company.cno) : '', clean(company.legalName).slice(0, 150), from, to, stamp, '001'].join('|'));
    for (const r of [...reps.values()].sort((a, b) => a.id - b.id)) push(['02', String(r.id), String(r.tp), r.nr].join('|'));
    const vinc = new Map<string, number>();
    for (const e of emps) {
      if (!e.person.cpf) { warnings.push(`Matrícula ${e.registration} sem CPF: fora do AEJ.`); continue; }
      vinc.set(e.id, vinc.size + 1);
      push(['03', String(vinc.get(e.id)), e.person.cpf, clean(e.person.fullName).slice(0, 150)].join('|'));
    }
    for (const h of horarios.values()) push(h.line);
    for (const e of emps) {
      const v = vinc.get(e.id);
      if (!v) continue;
      const cod = e.scheduleAssignments[0] ? horarios.get(e.scheduleAssignments[0].schedule.id)?.cod ?? '' : '';
      for (const d of days.get(e.id) ?? []) {
        let seq = 0;
        const valid = d.punches.filter((p) => p.status === 'ORIGINAL' || p.status === 'INCLUDED');
        for (const p of d.punches) {
          if (p.status.startsWith('PENDING')) continue;
          const idx = valid.indexOf(p);
          const tp = p.status === 'DISREGARDED' ? 'D' : idx % 2 === 0 ? 'E' : 'S';
          if (tp !== 'D' && idx % 2 === 0) seq++;
          const fonte = p.status === 'INCLUDED' ? 'I' : 'O';
          const rep = repOf(p.status === 'INCLUDED' ? null : deviceOfRecord.get(p.id) ?? null);
          push(['05', String(v), `${p.date}T${p.time}:00-0300`, String(rep.id), tp, tp === 'D' ? '' : String(seq), fonte, cod, fonte === 'I' || tp === 'D' ? clean(p.justification ?? '').slice(0, 150) : ''].join('|'));
        }
      }
      push(['06', String(v), clean(e.registration).slice(0, 30)].join('|'));
      for (const d of days.get(e.id) ?? []) {
        if (d.result?.flags.includes('ABSENCE') && !d.allowance?.disregardsDebits) push(['07', String(v), '2', d.date, String(d.result.absenceMinutes || Math.abs(d.result.balanceMinutes)), ''].join('|'));
      }
      for (const b of bank.filter((x) => x.account.employmentId === e.id)) push(['07', String(v), '3', iso(b.refDate), String(Math.abs(b.minutes)), b.minutes > 0 ? '1' : '2'].join('|'));
    }
    push(['08', 'SuperPonto', '2.0', '1', '', 'SuperPonto', ''].join('|'));
    push(['99', ...['01', '02', '03', '04', '05', '06', '07', '08'].map((k) => String(count[k] ?? 0))].join('|'));
    return {
      filename: `AEJ_${onlyDigits(company.cnpj)}_${from}_${to}.txt`,
      content: lines.join('\r\n') + '\r\n',
      totals: { vinculos: vinc.size, marcacoes: count['05'] ?? 0, horarios: horarios.size, ausencias: count['07'] ?? 0 },
      warnings: [...new Set(warnings)],
    };
  }
}
