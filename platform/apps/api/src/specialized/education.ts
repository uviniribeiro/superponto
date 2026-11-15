import { BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, Injectable, NotFoundException, Param, Post, Query } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import { AuditService } from '../audit/audit.service.js';
import { RequirePermission } from '../authorization/authorization.js';
import { ActiveTenant, RequestInfo, type RequestMeta } from '../common/tenant.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';

const id = { schema: z.uuid() };
const day = z.iso.date();
const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Horário HH:mm');
const toMin = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3));
const D = (v: string) => new Date(`${v}T00:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);

export const courseSchema = z.object({ companyId: z.uuid(), name: z.string().trim().min(2).max(120), level: z.string().trim().max(60).nullable().optional() });
export const subjectSchema = z.object({ companyId: z.uuid(), courseId: z.uuid().nullable().optional(), name: z.string().trim().min(2).max(120), code: z.string().trim().max(20).nullable().optional(), weeklyLessons: z.number().int().min(1).max(60).nullable().optional() });
export const periodSchema = z.object({ companyId: z.uuid(), name: z.string().trim().min(2).max(60), startsOn: day, endsOn: day }).refine((p) => p.endsOn > p.startsOn, { message: 'O fim deve ser depois do início', path: ['endsOn'] });
export const classSchema = z.object({ unitId: z.uuid(), periodId: z.uuid(), courseId: z.uuid().nullable().optional(), name: z.string().trim().min(1).max(60), grade: z.string().trim().max(30).nullable().optional(), shift: z.enum(['MANHA', 'TARDE', 'NOITE', 'INTEGRAL']).nullable().optional() });
export const assignmentSchema = z.object({ employmentId: z.uuid(), subjectId: z.uuid(), classId: z.uuid(), weeklyLessons: z.number().int().min(1).max(60).nullable().optional(), validFrom: day, validTo: day.nullable().optional() });
export const slotSchema = z.object({ assignmentId: z.uuid(), weekday: z.number().int().min(0).max(6), startTime: hm, endTime: hm }).refine((s) => toMin(s.endTime) > toMin(s.startTime), { message: 'O fim deve ser depois do início', path: ['endTime'] });
export const sessionSchema = z.object({ scheduleId: z.uuid(), date: day, status: z.enum(['HELD', 'NOT_HELD', 'SUBSTITUTED', 'CANCELLED']), substituteEmploymentId: z.uuid().nullable().optional(), notes: z.string().trim().max(300).nullable().optional() })
  .refine((s) => s.status !== 'SUBSTITUTED' || !!s.substituteEmploymentId, { message: 'Informe o professor substituto', path: ['substituteEmploymentId'] });

const PERSON = { select: { id: true, registration: true, person: { select: { fullName: true, socialName: true } } } } as const;
const nameOf = (e: { person: { fullName: string; socialName: string | null } }) => e.person.socialName ?? e.person.fullName;

/**
 * Educação: cursos, disciplinas, períodos letivos, turmas, alocação de professores, grade horária
 * (com conflito de horário do professor) e registro das aulas do dia (dada, não dada, substituída).
 */
@Injectable()
export class EducationService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private async company(tx: Tx, companyId: string) {
    if (!(await tx.company.findFirst({ where: { id: companyId, deletedAt: null } }))) throw new NotFoundException('Empresa não encontrada');
  }

  async overview(tenantId: string, companyId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      await this.company(tx, companyId);
      const [courses, subjects, calendars] = await Promise.all([
        tx.course.findMany({ where: { companyId, deletedAt: null }, orderBy: { name: 'asc' } }),
        tx.subject.findMany({ where: { companyId, deletedAt: null }, orderBy: { name: 'asc' } }),
        tx.calendar.findMany({ where: { companyId, isAcademic: true, deletedAt: null }, include: { periods: { orderBy: { startsOn: 'desc' } } } }),
      ]);
      const periods = calendars.flatMap((c) => c.periods).map((p) => ({ id: p.id, name: p.name, startsOn: iso(p.startsOn), endsOn: iso(p.endsOn) }));
      const classes = await tx.schoolClass.findMany({
        where: { deletedAt: null, periodId: { in: periods.map((p) => p.id) } }, orderBy: { name: 'asc' },
        include: { course: { select: { name: true } }, assignments: { include: { employment: PERSON, subject: { select: { name: true } }, slots: { include: { classroom: { select: { name: true } } }, orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }] } } } },
      });
      return {
        courses, subjects, periods,
        classes: classes.map((c) => ({
          id: c.id, name: c.name, grade: c.grade, shift: c.shift, unitId: c.unitId, periodId: c.periodId, courseId: c.courseId, course: c.course?.name ?? null,
          assignments: c.assignments.filter((a) => !a.validTo || a.validTo >= new Date()).map((a) => ({ id: a.id, employmentId: a.employmentId, teacher: nameOf(a.employment), subjectId: a.subjectId, subject: a.subject.name, weeklyLessons: a.weeklyLessons, slots: a.slots.map((s) => ({ id: s.id, weekday: s.weekday, startTime: s.startTime, endTime: s.endTime, classroom: s.classroom?.name ?? null })) })),
        })),
      };
    });
  }

  async createCourse(tenantId: string, user: AuthUser, b: z.infer<typeof courseSchema>, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      await this.company(tx, b.companyId);
      if (await tx.course.findFirst({ where: { companyId: b.companyId, name: b.name, deletedAt: null } })) throw new ConflictException('Já existe um curso com esse nome');
      const c = await tx.course.create({ data: { tenantId, ...b, level: b.level ?? null } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'course', entityId: c.id, after: c, ...meta });
      return c;
    });
  }

  async createSubject(tenantId: string, user: AuthUser, b: z.infer<typeof subjectSchema>, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      await this.company(tx, b.companyId);
      if (b.courseId && !(await tx.course.findFirst({ where: { id: b.courseId, companyId: b.companyId, deletedAt: null } }))) throw new NotFoundException('Curso não encontrado');
      const s = await tx.subject.create({ data: { tenantId, ...b, courseId: b.courseId ?? null, code: b.code ?? null, weeklyLessons: b.weeklyLessons ?? null } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'subject', entityId: s.id, after: s, ...meta });
      return s;
    });
  }

  /** Período letivo dentro do calendário acadêmico da empresa (criado na primeira vez). */
  async createPeriod(tenantId: string, user: AuthUser, b: z.infer<typeof periodSchema>, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      await this.company(tx, b.companyId);
      const cal = (await tx.calendar.findFirst({ where: { companyId: b.companyId, isAcademic: true, deletedAt: null } })) ?? (await tx.calendar.create({ data: { tenantId, companyId: b.companyId, name: 'Calendário letivo', isAcademic: true } }));
      const p = await tx.academicPeriod.create({ data: { tenantId, calendarId: cal.id, name: b.name, startsOn: D(b.startsOn), endsOn: D(b.endsOn) } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'academic_period', entityId: p.id, after: b, ...meta });
      return p;
    });
  }

  async createClass(tenantId: string, user: AuthUser, b: z.infer<typeof classSchema>, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      if (!(await tx.companyUnit.findFirst({ where: { id: b.unitId, deletedAt: null } }))) throw new NotFoundException('Unidade não encontrada');
      if (!(await tx.academicPeriod.findFirst({ where: { id: b.periodId } }))) throw new NotFoundException('Período letivo não encontrado');
      const c = await tx.schoolClass.create({ data: { tenantId, ...b, courseId: b.courseId ?? null, grade: b.grade ?? null, shift: b.shift ?? null } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'school_class', entityId: c.id, after: c, ...meta });
      return c;
    });
  }

  async assign(tenantId: string, user: AuthUser, b: z.infer<typeof assignmentSchema>, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const [e, s, c] = await Promise.all([
        tx.employment.findFirst({ where: { id: b.employmentId, deletedAt: null, status: { not: 'TERMINATED' } } }),
        tx.subject.findFirst({ where: { id: b.subjectId, deletedAt: null } }),
        tx.schoolClass.findFirst({ where: { id: b.classId, deletedAt: null } }),
      ]);
      if (!e) throw new NotFoundException('Professor não encontrado');
      if (!s || !c) throw new NotFoundException('Disciplina ou turma não encontrada');
      if (await tx.teachingAssignment.findFirst({ where: { classId: b.classId, subjectId: b.subjectId, validTo: null } })) throw new ConflictException('Esta disciplina já tem professor nesta turma: encerre a alocação atual antes');
      const a = await tx.teachingAssignment.create({ data: { tenantId, ...b, weeklyLessons: b.weeklyLessons ?? s.weeklyLessons, validFrom: D(b.validFrom), validTo: b.validTo ? D(b.validTo) : null } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'teaching_assignment', entityId: a.id, after: b, ...meta });
      return a;
    });
  }

  async endAssignment(tenantId: string, user: AuthUser, assignmentId: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const a = await tx.teachingAssignment.findFirst({ where: { id: assignmentId } });
      if (!a) throw new NotFoundException('Alocação não encontrada');
      const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z');
      const u = await tx.teachingAssignment.update({ where: { id: assignmentId }, data: { validTo: today } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'teaching_assignment', entityId: assignmentId, after: { validTo: iso(today) }, ...meta });
      return u;
    });
  }

  /** Horário na grade; recusa quando o professor já tem aula no mesmo dia e horário. */
  async addSlot(tenantId: string, user: AuthUser, b: z.infer<typeof slotSchema>, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const a = await tx.teachingAssignment.findFirst({ where: { id: b.assignmentId } });
      if (!a) throw new NotFoundException('Alocação não encontrada');
      const mine = await tx.classSchedule.findMany({ where: { weekday: b.weekday, assignment: { employmentId: a.employmentId, OR: [{ validTo: null }, { validTo: { gte: new Date() } }] } }, include: { assignment: { include: { schoolClass: { select: { name: true } } } } } });
      const clash = mine.find((s) => toMin(s.startTime) < toMin(b.endTime) && toMin(b.startTime) < toMin(s.endTime));
      if (clash) throw new ConflictException(`O professor já tem aula das ${clash.startTime} às ${clash.endTime} na turma ${clash.assignment.schoolClass.name}`);
      const s = await tx.classSchedule.create({ data: { tenantId, ...b } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'class_schedule', entityId: s.id, after: b, ...meta });
      return s;
    });
  }

  async removeSlot(tenantId: string, user: AuthUser, slotId: string, meta: RequestMeta) {
    await this.prisma.forTenant(tenantId, async (tx) => {
      const s = await tx.classSchedule.findFirst({ where: { id: slotId }, include: { _count: { select: { sessions: true } } } });
      if (!s) throw new NotFoundException('Horário não encontrado');
      if (s._count.sessions) throw new ConflictException('Este horário já tem aulas registradas: encerre a alocação em vez de apagar');
      await tx.classSchedule.delete({ where: { id: slotId } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'DELETE', entity: 'class_schedule', entityId: slotId, before: s, ...meta });
    });
  }

  /** Aulas previstas no dia (pela grade e vigência da alocação) com o registro já feito. */
  async day(tenantId: string, companyId: string, date: string) {
    const weekday = D(date).getUTCDay();
    return this.prisma.forTenant(tenantId, async (tx) => {
      await this.company(tx, companyId);
      const slots = await tx.classSchedule.findMany({
        where: { weekday, assignment: { validFrom: { lte: D(date) }, OR: [{ validTo: null }, { validTo: { gte: D(date) } }], subject: { companyId } } },
        include: { assignment: { include: { employment: PERSON, subject: { select: { name: true } }, schoolClass: { select: { name: true } } } }, classroom: { select: { name: true } }, sessions: { where: { sessionDate: D(date) } } },
        orderBy: { startTime: 'asc' },
      });
      const subs = await tx.employment.findMany({ where: { id: { in: slots.map((s) => s.sessions[0]?.substituteEmploymentId).filter(Boolean) as string[] } }, ...PERSON });
      return slots.map((s) => {
        const ses = s.sessions[0];
        return { scheduleId: s.id, startTime: s.startTime, endTime: s.endTime, className: s.assignment.schoolClass.name, subject: s.assignment.subject.name, teacher: nameOf(s.assignment.employment), classroom: s.classroom?.name ?? null, status: ses?.status ?? 'SCHEDULED', substitute: ses?.substituteEmploymentId ? nameOf(subs.find((x) => x.id === ses.substituteEmploymentId)!) : null, notes: ses?.notes ?? null };
      });
    });
  }

  async record(tenantId: string, user: AuthUser, b: z.infer<typeof sessionSchema>, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const s = await tx.classSchedule.findFirst({ where: { id: b.scheduleId }, include: { assignment: true } });
      if (!s) throw new NotFoundException('Horário não encontrado');
      if (D(b.date).getUTCDay() !== s.weekday) throw new BadRequestException('Este horário não tem aula nesse dia da semana');
      if (b.substituteEmploymentId === s.assignment.employmentId) throw new BadRequestException('O substituto deve ser outro professor');
      const data = { status: b.status, substituteEmploymentId: b.status === 'SUBSTITUTED' ? b.substituteEmploymentId ?? null : null, notes: b.notes ?? null };
      const r = await tx.classSession.upsert({ where: { scheduleId_sessionDate: { scheduleId: b.scheduleId, sessionDate: D(b.date) } }, create: { tenantId, scheduleId: b.scheduleId, sessionDate: D(b.date), ...data }, update: data });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'class_session', entityId: r.id, after: b, ...meta });
      return r;
    });
  }

  /** Aulas dadas, não dadas e substituições por professor no período (para conferência e folha). */
  async summary(tenantId: string, companyId: string, from: string, to: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const sessions = await tx.classSession.findMany({ where: { sessionDate: { gte: D(from), lte: D(to) }, schedule: { assignment: { subject: { companyId } } } }, include: { schedule: { include: { assignment: { include: { employment: PERSON } } } } } });
      const by = new Map<string, { teacher: string; registration: string; held: number; notHeld: number; substitutedOut: number; substitutedIn: number; minutes: number }>();
      const row = (e: { id: string; registration: string; person: { fullName: string; socialName: string | null } }) => by.get(e.id) ?? by.set(e.id, { teacher: nameOf(e), registration: e.registration, held: 0, notHeld: 0, substitutedOut: 0, substitutedIn: 0, minutes: 0 }).get(e.id)!;
      const subs = await tx.employment.findMany({ where: { id: { in: sessions.map((s) => s.substituteEmploymentId).filter(Boolean) as string[] } }, ...PERSON });
      for (const s of sessions) {
        const len = toMin(s.schedule.endTime) - toMin(s.schedule.startTime);
        const r = row(s.schedule.assignment.employment);
        if (s.status === 'HELD') { r.held++; r.minutes += len; }
        if (s.status === 'NOT_HELD') r.notHeld++;
        if (s.status === 'SUBSTITUTED' && s.substituteEmploymentId) { r.substitutedOut++; const sub = row(subs.find((x) => x.id === s.substituteEmploymentId)!); sub.substitutedIn++; sub.minutes += len; }
      }
      return [...by.values()].sort((a, b) => a.teacher.localeCompare(b.teacher));
    });
  }
}

@ApiTags('educação')
@ApiBearerAuth()
@Controller('v1/education')
export class EducationController {
  constructor(private readonly svc: EducationService) {}

  @Get()
  @RequirePermission('education.academic:read')
  overview(@ActiveTenant() t: string, @Query({ schema: z.object({ companyId: z.uuid() }) }) q: { companyId: string }) { return this.svc.overview(t, q.companyId); }

  @Post('courses')
  @RequirePermission('education.academic:manage')
  course(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: courseSchema }) b: z.infer<typeof courseSchema>, @RequestInfo() m: RequestMeta) { return this.svc.createCourse(t, u, b, m); }

  @Post('subjects')
  @RequirePermission('education.academic:manage')
  subject(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: subjectSchema }) b: z.infer<typeof subjectSchema>, @RequestInfo() m: RequestMeta) { return this.svc.createSubject(t, u, b, m); }

  @Post('periods')
  @RequirePermission('education.academic:manage')
  period(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: periodSchema }) b: z.infer<typeof periodSchema>, @RequestInfo() m: RequestMeta) { return this.svc.createPeriod(t, u, b, m); }

  @Post('classes')
  @RequirePermission('education.academic:manage')
  klass(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: classSchema }) b: z.infer<typeof classSchema>, @RequestInfo() m: RequestMeta) { return this.svc.createClass(t, u, b, m); }

  @Post('assignments')
  @RequirePermission('education.academic:manage')
  assign(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: assignmentSchema }) b: z.infer<typeof assignmentSchema>, @RequestInfo() m: RequestMeta) { return this.svc.assign(t, u, b, m); }

  @Post('assignments/:id/end')
  @HttpCode(200)
  @RequirePermission('education.academic:manage')
  end(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) aid: string, @RequestInfo() m: RequestMeta) { return this.svc.endAssignment(t, u, aid, m); }

  @Post('slots')
  @RequirePermission('education.academic:manage')
  slot(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: slotSchema }) b: z.infer<typeof slotSchema>, @RequestInfo() m: RequestMeta) { return this.svc.addSlot(t, u, b, m); }

  @Delete('slots/:id')
  @HttpCode(204)
  @RequirePermission('education.academic:manage')
  removeSlot(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', id) sid: string, @RequestInfo() m: RequestMeta) { return this.svc.removeSlot(t, u, sid, m); }

  @Get('day')
  @RequirePermission('education.academic:read')
  day(@ActiveTenant() t: string, @Query({ schema: z.object({ companyId: z.uuid(), date: day }) }) q: { companyId: string; date: string }) { return this.svc.day(t, q.companyId, q.date); }

  @Post('sessions')
  @HttpCode(200)
  @RequirePermission('education.sessions:manage')
  record(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: sessionSchema }) b: z.infer<typeof sessionSchema>, @RequestInfo() m: RequestMeta) { return this.svc.record(t, u, b, m); }

  @Get('summary')
  @RequirePermission('education.academic:read')
  summary(@ActiveTenant() t: string, @Query({ schema: z.object({ companyId: z.uuid(), from: day, to: day }) }) q: { companyId: string; from: string; to: string }) { return this.svc.summary(t, q.companyId, q.from, q.to); }
}
