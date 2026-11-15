import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { randomBytes, randomInt } from 'node:crypto';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import { AuditService } from '../audit/audit.service.js';
import { sha256Hex } from '../common/crypto.js';
import type { RequestMeta } from '../common/tenant.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { addDays, local } from '../timesheet/timesheet.core.js';
import { mirrorHashOf } from './mirror-hash.js';
import { TimesheetService } from '../timesheet/timesheet.service.js';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
const toMin = (hm: string | null | undefined) => (hm ? Number(hm.slice(0, 2)) * 60 + Number(hm.slice(3, 5)) : null);

// ---------------------------------------------------------------------------------------------
// Painel ao vivo
// ---------------------------------------------------------------------------------------------

export const liveSchema = z.object({ companyId: z.uuid(), departmentId: z.uuid().optional(), groupingId: z.uuid().optional(), toleranceMinutes: z.coerce.number().int().min(0).max(120).default(10) });
export type LiveQuery = z.infer<typeof liveSchema>;
export type LiveState = 'WORKING' | 'ON_BREAK' | 'LEFT' | 'NOT_YET' | 'LATE_NOW' | 'ABSENT' | 'OFF' | 'LEAVE' | 'NO_SCHEDULE';
export const LIVE_LABEL: Record<LiveState, string> = {
  WORKING: 'Trabalhando', ON_BREAK: 'Em intervalo', LEFT: 'Saiu', NOT_YET: 'Ainda não começou', LATE_NOW: 'Atrasado (sem marcação)',
  ABSENT: 'Não veio', OFF: 'Folga', LEAVE: 'Afastado/abonado', NO_SCHEDULE: 'Marcou sem jornada',
};

/**
 * Situação de cada funcionário AGORA: usa a apuração do dia (espelho diário) e o horário atual de
 * Brasília para separar quem está trabalhando, em intervalo, já saiu, ainda vai entrar ou está atrasado.
 */
export function liveState(day: { punches: Array<{ status: string }>; expected: Record<string, unknown>; leave: unknown; allowance: { fullDay: boolean } | null }, nowMin: number, tolerance: number): LiveState {
  const n = day.punches.filter((p) => p.status === 'ORIGINAL' || p.status === 'INCLUDED').length;
  const exp = day.expected as { isWorkday?: boolean; start?: string | null; end?: string | null; breakMinutes?: number; scheduleName?: string | null };
  if (day.leave || day.allowance?.fullDay) return 'LEAVE';
  const start = toMin(exp.start);
  let end = toMin(exp.end);
  if (start !== null && end !== null && end <= start) end += 1440;
  if (n === 0) {
    if (!exp.isWorkday || start === null) return 'OFF';
    if (nowMin < start) return 'NOT_YET';
    if (end !== null && nowMin >= end) return 'ABSENT';
    return nowMin >= start + tolerance ? 'LATE_NOW' : 'NOT_YET';
  }
  if (!exp.isWorkday && !exp.scheduleName) return n % 2 ? 'NO_SCHEDULE' : 'LEFT';
  if (n % 2 === 1) return 'WORKING';
  // Par: duas marcações com intervalo previsto e antes do fim = intervalo; senão saiu.
  return n === 2 && (exp.breakMinutes ?? 0) > 0 && end !== null && nowMin < end - 30 ? 'ON_BREAK' : 'LEFT';
}

@Injectable()
export class LiveService {
  constructor(private readonly timesheet: TimesheetService) {}

  async live(tenantId: string, q: LiveQuery, now = new Date()) {
    const { date, time } = local(now);
    const nowMin = toMin(time)!;
    const d = await this.timesheet.daily(tenantId, { companyId: q.companyId, date, departmentId: q.departmentId, groupingId: q.groupingId });
    const rows = d.rows.map((r) => {
      const state = liveState(r.day, nowMin, q.toleranceMinutes);
      const punches = r.day.punches.filter((p) => p.status === 'ORIGINAL' || p.status === 'INCLUDED');
      const exp = r.day.expected as { start?: string | null; end?: string | null; scheduleName?: string | null };
      return {
        employmentId: r.employmentId, registration: r.registration, name: r.name, state, label: LIVE_LABEL[state],
        lastPunch: punches.at(-1)?.time ?? null, punches: punches.map((p) => p.time), expectedStart: exp.start ?? null, expectedEnd: exp.end ?? null,
        lateMinutes: state === 'LATE_NOW' && exp.start ? nowMin - toMin(exp.start)! : 0,
      };
    });
    const totals = Object.fromEntries((Object.keys(LIVE_LABEL) as LiveState[]).map((k) => [k, rows.filter((r) => r.state === k).length])) as Record<LiveState, number>;
    return { date, time, rows, totals };
  }
}

// ---------------------------------------------------------------------------------------------
// E-mails agendados (resumo)
// ---------------------------------------------------------------------------------------------

export const NOTIFICATION_KINDS = ['ABSENCES', 'LATE', 'PENDING_ADJUSTMENTS', 'PENDING_REQUESTS', 'DEVICES_OFFLINE'] as const;
export const notificationSchema = z.object({
  companyId: z.uuid(),
  name: z.string().trim().min(2).max(80),
  kinds: z.array(z.enum(NOTIFICATION_KINDS)).min(1).max(5).transform((k) => [...new Set(k)]),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário no formato HH:mm'),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).default([]).transform((w) => [...new Set(w)].sort()),
  recipients: z.array(z.email()).min(1).max(20),
  active: z.boolean().default(true),
});
export type NotificationInput = z.infer<typeof notificationSchema>;

@Injectable()
export class NotificationsService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('E-mails agendados');
  private timer?: NodeJS.Timeout;
  constructor(
    private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly mail: MailService, private readonly liveSvc: LiveService,
    private readonly timesheet: TimesheetService, @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onApplicationBootstrap() {
    if (this.config.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.tick().catch((e: Error) => this.log.error(e.message)), 60_000);
    this.timer.unref();
  }
  onApplicationShutdown() { if (this.timer) clearInterval(this.timer); }

  list(tenantId: string, companyId?: string) {
    return this.prisma.forTenant(tenantId, (tx) => tx.notificationSchedule.findMany({ where: companyId ? { companyId } : {}, orderBy: [{ time: 'asc' }, { name: 'asc' }] }));
  }

  private async one(tx: Tx, id: string) {
    const n = await tx.notificationSchedule.findFirst({ where: { id } });
    if (!n) throw new NotFoundException('Agendamento não encontrado');
    return n;
  }

  async create(tenantId: string, user: AuthUser, input: NotificationInput, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      if (!(await tx.company.findFirst({ where: { id: input.companyId, deletedAt: null } }))) throw new NotFoundException('Empresa não encontrada');
      const n = await tx.notificationSchedule.create({ data: { tenantId, ...input } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'notification_schedule', entityId: n.id, after: n, ...meta });
      return n;
    });
  }

  async update(tenantId: string, user: AuthUser, id: string, input: Partial<NotificationInput>, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const before = await this.one(tx, id);
      const { companyId: _c, ...data } = input;
      const n = await tx.notificationSchedule.update({ where: { id }, data });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'notification_schedule', entityId: id, before, after: n, ...meta });
      return n;
    });
  }

  async remove(tenantId: string, user: AuthUser, id: string, meta: RequestMeta) {
    await this.prisma.forTenant(tenantId, async (tx) => {
      const before = await this.one(tx, id);
      await tx.notificationSchedule.delete({ where: { id } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'DELETE', entity: 'notification_schedule', entityId: id, before, ...meta });
    });
  }

  /** Monta o resumo de uma empresa com os blocos escolhidos (só números e nomes reais do banco). */
  async digest(tenantId: string, companyId: string, kinds: string[], now = new Date()) {
    const today = local(now).date;
    const sections: Array<{ kind: string; title: string; lines: string[] }> = [];
    const company = await this.prisma.forTenant(tenantId, (tx) => tx.company.findFirst({ where: { id: companyId }, select: { legalName: true, tradeName: true } }));
    if (!company) throw new NotFoundException('Empresa não encontrada');
    if (kinds.includes('ABSENCES')) {
      const y = addDays(today, -1);
      const d = await this.timesheet.daily(tenantId, { companyId, date: y });
      sections.push({ kind: 'ABSENCES', title: `Faltas de ontem (${y.split('-').reverse().join('/')})`, lines: d.rows.filter((r) => r.situation === 'ABSENT').map((r) => `${r.registration} — ${r.name}`) });
    }
    if (kinds.includes('LATE')) {
      const l = await this.liveSvc.live(tenantId, { companyId, toleranceMinutes: 10 }, now);
      sections.push({ kind: 'LATE', title: `Atrasados agora (${l.time}), sem marcação de entrada`, lines: l.rows.filter((r) => r.state === 'LATE_NOW').map((r) => `${r.registration} — ${r.name} (previsto ${r.expectedStart}, ${r.lateMinutes} min)`) });
    }
    await this.prisma.forTenant(tenantId, async (tx) => {
      if (kinds.includes('PENDING_ADJUSTMENTS')) {
        const emps = await tx.employment.findMany({ where: { companyId, deletedAt: null }, select: { id: true, registration: true, person: { select: { fullName: true } } } });
        const a = await tx.timeRecordAdjustment.findMany({ where: { status: 'PENDING', employmentId: { in: emps.map((e) => e.id) } }, select: { employmentId: true }, take: 2000 });
        const by = new Map<string, number>();
        for (const x of a) { const e = emps.find((m) => m.id === x.employmentId)!; const k = `${e.registration} — ${e.person.fullName}`; by.set(k, (by.get(k) ?? 0) + 1); }
        sections.push({ kind: 'PENDING_ADJUSTMENTS', title: `Ajustes de marcação aguardando aprovação (${a.length})`, lines: [...by].map(([k, v]) => `${k}: ${v}`) });
      }
      if (kinds.includes('PENDING_REQUESTS')) {
        const r = await tx.timeRequest.findMany({ where: { status: 'PENDING', employment: { companyId } }, select: { type: true, createdAt: true, employment: { select: { registration: true, person: { select: { fullName: true } } } } }, orderBy: { createdAt: 'asc' }, take: 200 });
        sections.push({ kind: 'PENDING_REQUESTS', title: `Solicitações pendentes (${r.length})`, lines: r.map((x) => `${x.employment.registration} — ${x.employment.person.fullName}: ${x.type} desde ${local(x.createdAt).date.split('-').reverse().join('/')}`) });
      }
      if (kinds.includes('DEVICES_OFFLINE')) {
        const d = await tx.device.findMany({ where: { companyId, deletedAt: null, status: 'OFFLINE' }, select: { name: true, lastSeenAt: true } });
        sections.push({ kind: 'DEVICES_OFFLINE', title: `Equipamentos sem comunicação (${d.length})`, lines: d.map((x) => `${x.name}${x.lastSeenAt ? ` — último contato ${x.lastSeenAt.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` : ''}`) });
      }
    });
    return { company: company.tradeName ?? company.legalName, date: today, sections };
  }

  private render(name: string, d: Awaited<ReturnType<NotificationsService['digest']>>) {
    const subject = `SuperPonto: ${name} — ${d.company}`;
    const text = [`${name} — ${d.company} — ${d.date.split('-').reverse().join('/')}`, '', ...d.sections.flatMap((s) => [s.title, ...(s.lines.length ? s.lines.map((l) => `  • ${l}`) : ['  Nada a informar.']), ''])].join('\n');
    const html = `<h2>${esc(name)}</h2><p>${esc(d.company)} — ${esc(d.date.split('-').reverse().join('/'))}</p>${d.sections.map((s) => `<h3>${esc(s.title)}</h3>${s.lines.length ? `<ul>${s.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>` : '<p>Nada a informar.</p>'}`).join('')}`;
    return { subject, text, html };
  }

  async preview(tenantId: string, id: string) {
    const n = await this.prisma.forTenant(tenantId, (tx) => this.one(tx, id));
    return this.digest(tenantId, n.companyId, n.kinds);
  }

  /** Envia agora (botão "enviar agora" e o agendador). */
  async send(tenantId: string, id: string, now = new Date()) {
    const n = await this.prisma.forTenant(tenantId, (tx) => this.one(tx, id));
    const d = await this.digest(tenantId, n.companyId, n.kinds, now);
    const m = this.render(n.name, d);
    let sent = 0;
    for (const to of n.recipients) {
      try { await this.mail.send({ to, ...m }); sent++; } catch (e) { this.log.warn(`Falha ao enviar para ${to}: ${(e as Error).message}`); }
    }
    await this.prisma.forTenant(tenantId, (tx) => tx.notificationSchedule.update({ where: { id }, data: { lastRunAt: now } }));
    return { sent, recipients: n.recipients.length, digest: d };
  }

  /** Roda a cada minuto: envia os agendamentos do horário atual (uma vez por dia cada). */
  async tick(now = new Date()) {
    const { date, time } = local(now);
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const due = await this.prisma.asPlatform((tx) => tx.notificationSchedule.findMany({ where: { active: true, time: { lte: time } }, select: { id: true, tenantId: true, weekdays: true, lastRunAt: true, time: true } }));
    let n = 0;
    for (const s of due) {
      if (s.weekdays.length && !s.weekdays.includes(weekday)) continue;
      if (s.lastRunAt && local(s.lastRunAt).date === date) continue;
      // Só dispara dentro de 15 minutos do horário (evita mandar o das 07:00 quando a API sobe às 18:00).
      if (toMin(time)! - toMin(s.time)! > 15) continue;
      await this.send(s.tenantId, s.id, now).catch((e: Error) => this.log.error(`${s.id}: ${e.message}`));
      n++;
    }
    return n;
  }
}

// ---------------------------------------------------------------------------------------------
// Avisos aos funcionários
// ---------------------------------------------------------------------------------------------

export const announcementSchema = z.object({
  companyId: z.uuid().nullable().optional(),
  groupingId: z.uuid().nullable().optional(),
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(1).max(5000),
  level: z.enum(['INFO', 'IMPORTANT']).default('INFO'),
  startsAt: z.iso.datetime({ offset: true }).transform((v) => new Date(v)),
  endsAt: z.iso.datetime({ offset: true }).nullable().optional().transform((v) => (v ? new Date(v) : null)),
  requireAck: z.boolean().default(false),
}).refine((a) => !a.endsAt || a.endsAt > a.startsAt, { message: 'O fim deve ser depois do início', path: ['endsAt'] });
export type AnnouncementInput = z.infer<typeof announcementSchema>;

@Injectable()
export class AnnouncementsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async list(tenantId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const list = await tx.announcement.findMany({ where: { deletedAt: null }, orderBy: { startsAt: 'desc' }, include: { _count: { select: { reads: true } } }, take: 200 });
      return list.map(({ _count, ...a }) => ({ ...a, reads: _count.reads }));
    });
  }

  private async check(tx: Tx, input: { companyId?: string | null; groupingId?: string | null }) {
    if (input.companyId && !(await tx.company.findFirst({ where: { id: input.companyId, deletedAt: null } }))) throw new NotFoundException('Empresa não encontrada');
    if (input.groupingId && !(await tx.grouping.findFirst({ where: { id: input.groupingId, deletedAt: null } }))) throw new NotFoundException('Agrupamento não encontrado');
  }

  async create(tenantId: string, user: AuthUser, input: AnnouncementInput, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      await this.check(tx, input);
      const a = await tx.announcement.create({ data: { tenantId, ...input, companyId: input.companyId ?? null, groupingId: input.groupingId ?? null, createdById: user.id } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'announcement', entityId: a.id, after: a, ...meta });
      return a;
    });
  }

  async update(tenantId: string, user: AuthUser, id: string, input: AnnouncementInput, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const before = await tx.announcement.findFirst({ where: { id, deletedAt: null } });
      if (!before) throw new NotFoundException('Aviso não encontrado');
      await this.check(tx, input);
      const a = await tx.announcement.update({ where: { id }, data: { ...input, companyId: input.companyId ?? null, groupingId: input.groupingId ?? null } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'announcement', entityId: id, before, after: a, ...meta });
      return a;
    });
  }

  async remove(tenantId: string, user: AuthUser, id: string, meta: RequestMeta) {
    await this.prisma.forTenant(tenantId, async (tx) => {
      const before = await tx.announcement.findFirst({ where: { id, deletedAt: null } });
      if (!before) throw new NotFoundException('Aviso não encontrado');
      await tx.announcement.update({ where: { id }, data: { deletedAt: new Date() } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'DELETE', entity: 'announcement', entityId: id, before, ...meta });
    });
  }

  /** Quem leu (para avisos com ciência obrigatória). */
  async reads(tenantId: string, id: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const reads = await tx.announcementRead.findMany({ where: { announcementId: id }, orderBy: { readAt: 'asc' } });
      const users = await tx.user.findMany({ where: { id: { in: reads.map((r) => r.userId) } }, select: { id: true, displayName: true, email: true } });
      return reads.map((r) => ({ readAt: r.readAt, user: users.find((u) => u.id === r.userId) ?? null }));
    });
  }

  /** Avisos vigentes para o usuário logado: gerais, da empresa dele ou do agrupamento dele. */
  async active(tenantId: string, user: AuthUser, now = new Date()) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const emps = user.personId ? await tx.employment.findMany({ where: { personId: user.personId, deletedAt: null }, select: { companyId: true, groupings: { select: { groupingId: true } } } }) : [];
      const companies = emps.map((e) => e.companyId);
      const groupings = emps.flatMap((e) => e.groupings.map((g) => g.groupingId));
      const list = await tx.announcement.findMany({
        where: {
          deletedAt: null, startsAt: { lte: now }, OR: [{ endsAt: null }, { endsAt: { gt: now } }],
          AND: [{ OR: [{ companyId: null }, { companyId: { in: companies } }] }, { OR: [{ groupingId: null }, { groupingId: { in: groupings } }] }],
        },
        orderBy: [{ level: 'desc' }, { startsAt: 'desc' }], take: 20,
        include: { reads: { where: { userId: user.id }, select: { readAt: true } } },
      });
      return list.map(({ reads, ...a }) => ({ id: a.id, title: a.title, body: a.body, level: a.level, startsAt: a.startsAt, endsAt: a.endsAt, requireAck: a.requireAck, readAt: reads[0]?.readAt ?? null }));
    });
  }

  async markRead(tenantId: string, user: AuthUser, id: string) {
    const visible = (await this.active(tenantId, user)).find((a) => a.id === id);
    if (!visible) throw new NotFoundException('Aviso não encontrado');
    return this.prisma.forTenant(tenantId, (tx) => tx.announcementRead.upsert({ where: { announcementId_userId: { announcementId: id, userId: user.id } }, create: { tenantId, announcementId: id, userId: user.id }, update: {} }));
  }
}

// ---------------------------------------------------------------------------------------------
// Aparelhos liberados para o app do funcionário
// ---------------------------------------------------------------------------------------------

export const appDeviceRequestSchema = z.object({ name: z.string().trim().min(2).max(60) });
export const appDeviceConfirmSchema = z.object({ code: z.string().regex(/^\d{6}$/, 'Código de 6 dígitos') });
const CODE_TTL_MIN = 10;
const MAX_ATTEMPTS = 5;
const DEVICE_SELECT = { id: true, userId: true, name: true, approvedAt: true, lastUsedAt: true, revokedAt: true, createdAt: true, codeExpires: true } as const;

@Injectable()
export class AppDevicesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly mail: MailService) {}

  mine(tenantId: string, user: AuthUser) {
    return this.prisma.forTenant(tenantId, (tx) => tx.appDevice.findMany({ where: { userId: user.id }, select: DEVICE_SELECT, orderBy: { createdAt: 'desc' } }));
  }

  /** Pede a liberação: manda um código de 6 dígitos para o e-mail do usuário (vale 10 minutos). */
  async request(tenantId: string, user: AuthUser, name: string, meta: RequestMeta) {
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const { device, email } = await this.prisma.forTenant(tenantId, async (tx) => {
      const pending = await tx.appDevice.count({ where: { userId: user.id, approvedAt: null, revokedAt: null, codeExpires: { gt: new Date() } } });
      if (pending >= 3) throw new ConflictException('Há pedidos demais aguardando código: confirme ou aguarde 10 minutos');
      const u = await tx.user.findFirstOrThrow({ where: { id: user.id }, select: { email: true } });
      const device = await tx.appDevice.create({ data: { tenantId, userId: user.id, name, codeHash: sha256Hex(`${user.id}:${code}`), codeExpires: new Date(Date.now() + CODE_TTL_MIN * 60_000) }, select: DEVICE_SELECT });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'app_device', entityId: device.id, after: { name }, ...meta });
      return { device, email: u.email };
    });
    await this.mail.send({
      to: email, subject: 'SuperPonto: código para liberar o aparelho',
      text: `Código para liberar "${name}": ${code}\nVale por ${CODE_TTL_MIN} minutos. Se não foi você, ignore este e-mail e avise o RH.`,
      html: `<p>Código para liberar <b>${esc(name)}</b>:</p><p style="font-size:24px;letter-spacing:4px"><b>${code}</b></p><p>Vale por ${CODE_TTL_MIN} minutos. Se não foi você, ignore este e-mail e avise o RH.</p>`,
    });
    return device;
  }

  /** Confere o código e devolve o token do aparelho UMA vez (só o hash fica guardado). */
  async confirm(tenantId: string, user: AuthUser, id: string, code: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const d = await tx.appDevice.findFirst({ where: { id, userId: user.id } });
      if (!d || d.revokedAt) throw new NotFoundException('Pedido não encontrado');
      if (d.approvedAt) throw new ConflictException('Este aparelho já foi liberado');
      if (!d.codeHash || !d.codeExpires || d.codeExpires < new Date()) throw new BadRequestException('Código expirado: peça um novo');
      if (d.attempts >= MAX_ATTEMPTS) throw new ForbiddenException('Tentativas esgotadas: peça um novo código');
      if (sha256Hex(`${user.id}:${code}`) !== d.codeHash) {
        await tx.appDevice.update({ where: { id }, data: { attempts: { increment: 1 } } });
        throw new BadRequestException(`Código incorreto (${MAX_ATTEMPTS - d.attempts - 1} tentativa(s) restante(s))`);
      }
      const token = `spa_${randomBytes(32).toString('base64url')}`;
      const device = await tx.appDevice.update({ where: { id }, data: { tokenHash: sha256Hex(token), approvedAt: new Date(), codeHash: null, codeExpires: null }, select: DEVICE_SELECT });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'APPROVE', entity: 'app_device', entityId: id, after: { name: d.name }, ...meta });
      return { ...device, token };
    });
  }

  list(tenantId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const list = await tx.appDevice.findMany({ where: { approvedAt: { not: null } }, select: DEVICE_SELECT, orderBy: { approvedAt: 'desc' }, take: 500 });
      const users = await tx.user.findMany({ where: { id: { in: [...new Set(list.map((d) => d.userId))] } }, select: { id: true, displayName: true, email: true } });
      return list.map((d) => ({ ...d, user: users.find((u) => u.id === d.userId) ?? null }));
    });
  }

  /** Revoga: o próprio usuário (os dele) ou quem administra usuários (qualquer um). */
  async revoke(tenantId: string, user: AuthUser, id: string, asAdmin: boolean, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const d = await tx.appDevice.findFirst({ where: { id, ...(asAdmin ? {} : { userId: user.id }) } });
      if (!d) throw new NotFoundException('Aparelho não encontrado');
      if (d.revokedAt) return { ok: true };
      await tx.appDevice.update({ where: { id }, data: { revokedAt: new Date(), tokenHash: null, codeHash: null } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'DELETE', entity: 'app_device', entityId: id, before: { name: d.name, userId: d.userId }, ...meta });
      return { ok: true };
    });
  }
}

// ---------------------------------------------------------------------------------------------
// Textos personalizados
// ---------------------------------------------------------------------------------------------

export const CUSTOM_TEXTS = {
  DASHBOARD_MESSAGE: 'Mensagem no painel inicial',
  PUNCH_RECEIPT_FOOTER: 'Rodapé do comprovante de marcação',
  MIRROR_FOOTER: 'Rodapé do espelho de ponto impresso',
  MIRROR_ACK_TERM: 'Termo exibido na ciência do espelho',
} as const;
export type CustomTextKey = keyof typeof CUSTOM_TEXTS;
export const customTextSchema = z.object({ text: z.string().max(2000) });

@Injectable()
export class CustomTextsService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  async all(tenantId: string) {
    const rows = await this.prisma.forTenant(tenantId, (tx) => tx.customText.findMany());
    return (Object.keys(CUSTOM_TEXTS) as CustomTextKey[]).map((key) => ({ key, label: CUSTOM_TEXTS[key], text: rows.find((r) => r.key === key)?.text ?? '' }));
  }

  async save(tenantId: string, user: AuthUser, key: string, text: string, meta: RequestMeta) {
    if (!(key in CUSTOM_TEXTS)) throw new NotFoundException('Texto não encontrado');
    return this.prisma.forTenant(tenantId, async (tx) => {
      const before = await tx.customText.findFirst({ where: { key } });
      const t = text.trim();
      if (!t) { if (before) await tx.customText.delete({ where: { id: before.id } }); }
      else await tx.customText.upsert({ where: { tenantId_key: { tenantId, key } }, create: { tenantId, key, text: t }, update: { text: t } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'custom_text', entityId: before?.id ?? null, before: before ? { key, text: before.text } : null, after: { key, text: t }, ...meta });
      return { key, label: CUSTOM_TEXTS[key as CustomTextKey], text: t };
    });
  }
}

// ---------------------------------------------------------------------------------------------
// Ciência eletrônica do espelho
// ---------------------------------------------------------------------------------------------

export const ackSchema = z.object({
  from: z.iso.date(), to: z.iso.date(), employmentId: z.uuid().optional(),
  decision: z.enum(['AGREE', 'DISAGREE']).default('AGREE'),
  comment: z.string().trim().max(1000).optional(),
}).refine((a) => a.decision === 'AGREE' || (a.comment?.length ?? 0) >= 5, { message: 'Explique a ressalva (mínimo 5 caracteres)', path: ['comment'] });
export type AckInput = z.infer<typeof ackSchema>;
type Mirror = Awaited<ReturnType<TimesheetService['mirror']>>;

const mirrorHash = (m: Mirror) => mirrorHashOf(m.employment.id, m.from, m.to, m.days);

@Injectable()
export class AcknowledgmentsService {
  constructor(private readonly prisma: PrismaService, private readonly timesheet: TimesheetService, private readonly audit: AuditService) {}

  /** Situação da ciência do período para o próprio funcionário (e se o espelho mudou desde então). */
  async mine(tenantId: string, user: AuthUser, q: { from: string; to: string; employmentId?: string }) {
    const m = await this.timesheet.myMirror(tenantId, user, q.from, q.to, q.employmentId);
    const { hash } = mirrorHash(m);
    const [ack, term] = await this.prisma.forTenant(tenantId, (tx) => Promise.all([
      tx.mirrorAcknowledgment.findFirst({ where: { employmentId: m.employment.id, periodStart: new Date(`${q.from}T00:00:00Z`), periodEnd: new Date(`${q.to}T00:00:00Z`) } }),
      tx.customText.findFirst({ where: { key: 'MIRROR_ACK_TERM' }, select: { text: true } }),
    ]));
    const today = local(new Date()).date;
    return {
      employmentId: m.employment.id, from: q.from, to: q.to, currentHash: hash, canSign: !ack && q.to < today,
      reason: ack ? null : q.to >= today ? 'O período ainda não terminou' : null,
      term: term?.text ?? 'Declaro que conferi as marcações e os totais deste espelho de ponto.',
      acknowledgment: ack ? { id: ack.id, decision: ack.decision, comment: ack.comment, createdAt: ack.createdAt, contentHash: ack.contentHash, changedSince: ack.contentHash !== hash } : null,
    };
  }

  async sign(tenantId: string, user: AuthUser, input: AckInput, meta: RequestMeta) {
    if (input.from > input.to) throw new BadRequestException('Período inválido');
    if (input.to >= local(new Date()).date) throw new BadRequestException('Só dá para dar ciência depois que o período terminar');
    const m = await this.timesheet.myMirror(tenantId, user, input.from, input.to, input.employmentId);
    const { hash, summary } = mirrorHash(m);
    return this.prisma.forTenant(tenantId, async (tx) => {
      const exists = await tx.mirrorAcknowledgment.findFirst({ where: { employmentId: m.employment.id, periodStart: new Date(`${input.from}T00:00:00Z`), periodEnd: new Date(`${input.to}T00:00:00Z`) } });
      if (exists) throw new ConflictException('A ciência deste período já foi registrada');
      const a = await tx.mirrorAcknowledgment.create({ data: {
        tenantId, employmentId: m.employment.id, userId: user.id, periodStart: new Date(`${input.from}T00:00:00Z`), periodEnd: new Date(`${input.to}T00:00:00Z`),
        contentHash: hash, summary, decision: input.decision, comment: input.comment ?? null, ip: meta.ip, userAgent: meta.userAgent?.slice(0, 300) ?? null,
      } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: input.decision === 'AGREE' ? 'APPROVE' : 'REJECT', entity: 'mirror_acknowledgment', entityId: a.id, after: { employmentId: a.employmentId, from: input.from, to: input.to, hash }, ...meta });
      return a;
    });
  }

  /** Lista para o RH: quem deu ciência no período, com ressalva e se o espelho mudou depois. */
  async list(tenantId: string, q: { companyId: string; from: string; to: string }) {
    const emps = await this.prisma.forTenant(tenantId, (tx) => this.timesheet.companyEmployments(tx, q.companyId, q.from, q.to));
    const acks = await this.prisma.forTenant(tenantId, (tx) => tx.mirrorAcknowledgment.findMany({ where: { employmentId: { in: emps.map((e) => e.id) }, periodStart: new Date(`${q.from}T00:00:00Z`), periodEnd: new Date(`${q.to}T00:00:00Z`) } }));
    const rows = [];
    for (const e of emps.sort((a, b) => a.person.fullName.localeCompare(b.person.fullName))) {
      const a = acks.find((x) => x.employmentId === e.id);
      let changed = false;
      if (a) changed = mirrorHash(await this.timesheet.mirror(tenantId, e.id, q.from, q.to)).hash !== a.contentHash;
      rows.push({ employmentId: e.id, registration: e.registration, name: e.person.socialName ?? e.person.fullName, status: a ? a.decision : 'PENDING', signedAt: a?.createdAt ?? null, comment: a?.comment ?? null, ip: a?.ip ?? null, changedSince: changed });
    }
    return { from: q.from, to: q.to, rows, totals: { agree: rows.filter((r) => r.status === 'AGREE').length, disagree: rows.filter((r) => r.status === 'DISAGREE').length, pending: rows.filter((r) => r.status === 'PENDING').length } };
  }
}
