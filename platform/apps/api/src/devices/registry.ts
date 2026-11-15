import {
  BadRequestException, Body, ConflictException, Controller, Delete, Get, Headers, HttpCode, Inject, Injectable, Logger, NotFoundException, Param, Patch, Post, Query,
  UnauthorizedException, type OnApplicationBootstrap, type OnApplicationShutdown,
} from '@nestjs/common';
import { CurrentUser, Public } from '@nestjs/authentication';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { normalizeCnpj } from '@superponto/br-docs';
import { repName, validateEmployer, workerIdFor } from '@superponto/rep-protocols';
import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import { AuditService } from '../audit/audit.service.js';
import { RequirePermission } from '../authorization/authorization.js';
import { sha256Hex } from '../common/crypto.js';
import { ActiveTenant, RequestInfo, type RequestMeta } from '../common/tenant.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { MailService } from '../mail/mail.service.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import { BiometricsService } from './biometrics.service.js';
import { DevicesService, layoutOf } from './devices.service.js';

const idSchema = z.uuid();
const email = z.email();
export const deviceSchema = z.object({
  companyId: z.uuid(),
  unitId: z.uuid().nullable().optional(),
  name: z.string().trim().min(2).max(80),
  ordinance: z.enum(['P1510_2009', 'P373_2011', 'P671_2021']),
  serialNumber: z.string().trim().max(40).nullable().optional(),
  repNumber: z.string().trim().regex(/^\d{17}$/, 'Número do REP com 17 dígitos').nullable().optional(),
  manufacturer: z.string().trim().max(60).nullable().optional(),
  modelName: z.string().trim().max(60).nullable().optional(),
  host: z.string().trim().max(120).nullable().optional(),
  port: z.number().int().min(1).max(65535).nullable().optional(),
  groupName: z.string().trim().max(60).nullable().optional(),
  collectIntervalMinutes: z.number().int().min(5).max(1440).nullable().optional(),
  alertEmails: z.array(email).max(10).default([]),
  timezone: z.string().trim().max(60).default('America/Sao_Paulo'),
  active: z.boolean().default(true),
});
export type DeviceInput = z.infer<typeof deviceSchema>;
export const ACTIONS = ['SET_DATETIME', 'SET_EMPLOYER', 'SYNC_EMPLOYEES', 'RECEIVE_EMPLOYEES', 'RECEIVE_FINGERPRINTS', 'RECEIVE_EMPLOYER', 'COLLECT_RECORDS'] as const;
export const commandSchema = z.object({ action: z.enum(ACTIONS) });
export const groupCommandSchema = z.object({ companyId: z.uuid(), groupName: z.string().trim().min(1).max(60), action: z.enum(ACTIONS) });
const resultSchema = z.object({
  status: z.enum(['SUCCEEDED', 'FAILED']),
  error: z.string().max(1000).optional(),
  data: z.object({
    employees: z.array(z.object({ workerId: z.string().regex(/^\d{11,12}$/), name: z.string().max(120).optional(), registration: z.string().max(40).optional(), fingerprints: z.number().int().min(0).max(10).optional() })).max(20000).optional(),
    fingerprints: z.array(z.object({ workerId: z.string().regex(/^\d{11,12}$/), finger: z.number().int().min(0).max(9), format: z.enum(['ISO_19794_2', 'ANSI_378', 'CONTROLID', 'HENRY', 'OTHER']), template: z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/).max(22_000) })).max(20000).optional(),
    employer: z.object({ cnpj: z.string().max(20), name: z.string().max(150).optional() }).optional(),
    afd: z.string().max(20_000_000).optional(),
  }).optional(),
});
type ResultInput = z.infer<typeof resultSchema>;
const heartbeatSchema = z.object({ firmware: z.string().max(60).optional(), adapterVersion: z.string().max(60).optional(), message: z.string().max(300).optional() });

/** "Online" = falou com a API dentro de 3 intervalos de coleta (mínimo 15 min). */
export const offlineAfterMinutes = (d: { collectIntervalMinutes: number | null }) => Math.max(15, 3 * (d.collectIntervalMinutes ?? 5));

const PUBLIC_SELECT = {
  id: true, companyId: true, unitId: true, name: true, ordinance: true, serialNumber: true, repNumber: true, manufacturer: true, modelName: true, host: true, port: true,
  groupName: true, collectIntervalMinutes: true, alertEmails: true, timezone: true, status: true, lastSeenAt: true, lastSyncAt: true, firmware: true, adapterVersion: true,
  agentKeyHash: true, createdAt: true, company: { select: { legalName: true, tradeName: true } }, unit: { select: { name: true } },
} as const;

@Injectable()
export class DeviceRegistryService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, private readonly devices: DevicesService) {}

  private shape(d: { agentKeyHash: string | null; [k: string]: unknown }) {
    const { agentKeyHash, ...rest } = d;
    return { ...rest, hasAgentKey: !!agentKeyHash };
  }

  private async one(tx: Tx, id: string) {
    const d = await tx.device.findFirst({ where: { id, deletedAt: null }, select: PUBLIC_SELECT });
    if (!d) throw new NotFoundException('Equipamento não encontrado');
    return d;
  }

  list(tenantId: string, q: { companyId?: string; groupName?: string }) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const rows = await tx.device.findMany({ where: { deletedAt: null, ...(q.companyId ? { companyId: q.companyId } : {}), ...(q.groupName ? { groupName: q.groupName } : {}) }, select: PUBLIC_SELECT, orderBy: [{ groupName: 'asc' }, { name: 'asc' }] });
      const pending = await tx.deviceSyncJob.groupBy({ by: ['deviceId'], where: { deviceId: { in: rows.map((r) => r.id) }, status: { in: ['QUEUED', 'RUNNING'] } }, _count: { _all: true } });
      const failed = await tx.deviceSyncJob.groupBy({ by: ['deviceId'], where: { deviceId: { in: rows.map((r) => r.id) }, status: 'FAILED' }, _count: { _all: true } });
      return rows.map((r) => ({ ...this.shape(r), pendingJobs: pending.find((p) => p.deviceId === r.id)?._count._all ?? 0, failedJobs: failed.find((p) => p.deviceId === r.id)?._count._all ?? 0 }));
    });
  }

  get(tenantId: string, id: string) {
    return this.prisma.forTenant(tenantId, async (tx) => this.shape(await this.one(tx, id)));
  }

  private async check(tx: Tx, input: Partial<DeviceInput>, companyId: string) {
    if (input.unitId) {
      const u = await tx.companyUnit.findFirst({ where: { id: input.unitId, deletedAt: null } });
      if (!u || u.companyId !== companyId) throw new BadRequestException('Unidade não pertence a esta empresa');
    }
  }

  async create(tenantId: string, user: AuthUser, input: DeviceInput, meta: RequestMeta) {
    try {
      return await this.prisma.forTenant(tenantId, async (tx) => {
        if (!(await tx.company.findFirst({ where: { id: input.companyId, deletedAt: null } }))) throw new NotFoundException('Empresa não encontrada');
        await this.check(tx, input, input.companyId);
        const { active, ...data } = input;
        const d = await tx.device.create({ data: { tenantId, ...data, status: active ? 'PENDING' : 'DISABLED' }, select: PUBLIC_SELECT });
        await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'device', entityId: d.id, after: this.shape(d), ...meta });
        return this.shape(d);
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') throw new ConflictException('Já existe um equipamento com este número de série');
      throw e;
    }
  }

  async update(tenantId: string, user: AuthUser, id: string, input: Partial<DeviceInput>, meta: RequestMeta) {
    try {
      return await this.prisma.forTenant(tenantId, async (tx) => {
        const before = await this.one(tx, id);
        await this.check(tx, input, before.companyId);
        const { active, companyId: _c, ...data } = input;
        const status = active === false ? 'DISABLED' : active === true && before.status === 'DISABLED' ? 'PENDING' : undefined;
        const d = await tx.device.update({ where: { id }, data: { ...data, ...(status ? { status } : {}) }, select: PUBLIC_SELECT });
        await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'device', entityId: id, before: this.shape(before), after: this.shape(d), ...meta });
        return this.shape(d);
      });
    } catch (e) {
      if ((e as { code?: string }).code === 'P2002') throw new ConflictException('Já existe um equipamento com este número de série');
      throw e;
    }
  }

  remove(tenantId: string, user: AuthUser, id: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const before = await this.one(tx, id);
      await tx.device.update({ where: { id }, data: { deletedAt: new Date(), agentKeyHash: null, status: 'DISABLED' } });
      await tx.deviceSyncJob.updateMany({ where: { deviceId: id, status: 'QUEUED' }, data: { status: 'CANCELLED' } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'DELETE', entity: 'device', entityId: id, before: this.shape(before), ...meta });
    });
  }

  /** Gera (ou troca) a chave do agente local; ela só aparece agora. */
  agentKey(tenantId: string, user: AuthUser, id: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      await this.one(tx, id);
      const key = `spd_${randomBytes(24).toString('base64url')}`;
      await tx.device.update({ where: { id }, data: { agentKeyHash: sha256Hex(key) } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'device_agent_key', entityId: id, after: { rotated: true }, ...meta });
      return { key };
    });
  }

  /** Enfileira um comando para o equipamento. "Enviar funcionários" usa a montagem existente (empregador + funcionários + digitais). */
  async command(tenantId: string, user: AuthUser, id: string, action: (typeof ACTIONS)[number], meta: RequestMeta) {
    if (action === 'SYNC_EMPLOYEES') return this.devices.syncRoster(tenantId, user, id, meta);
    return this.prisma.forTenant(tenantId, async (tx) => {
      const d = await this.one(tx, id);
      if (d.status === 'DISABLED') throw new BadRequestException('Equipamento desativado');
      layoutOf(d.ordinance);
      const job = await tx.deviceSyncJob.create({ data: { tenantId, deviceId: id, action, payload: {}, createdById: user.id } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'device_command', entityId: id, after: { action, jobId: job.id }, ...meta });
      return { queued: 1, jobId: job.id };
    });
  }

  async groupCommand(tenantId: string, user: AuthUser, input: z.infer<typeof groupCommandSchema>, meta: RequestMeta) {
    const devices = await this.prisma.forTenant(tenantId, (tx) => tx.device.findMany({ where: { companyId: input.companyId, groupName: input.groupName, deletedAt: null, status: { not: 'DISABLED' } }, select: { id: true, name: true } }));
    if (!devices.length) throw new NotFoundException('Nenhum equipamento ativo neste grupo');
    const results = [];
    for (const d of devices) {
      try { results.push({ deviceId: d.id, name: d.name, ok: true, result: await this.command(tenantId, user, d.id, input.action, meta) }); }
      catch (e) { results.push({ deviceId: d.id, name: d.name, ok: false, error: (e as Error).message }); }
    }
    return { devices: results.length, results };
  }

  cancelJob(tenantId: string, user: AuthUser, deviceId: string, jobId: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      await this.one(tx, deviceId);
      const job = await tx.deviceSyncJob.findFirst({ where: { id: jobId, deviceId } });
      if (!job) throw new NotFoundException('Comando não encontrado');
      if (job.status !== 'QUEUED' && job.status !== 'FAILED') throw new ConflictException('Só comandos na fila ou com falha podem ser cancelados');
      await tx.deviceSyncJob.update({ where: { id: jobId }, data: { status: 'CANCELLED', finishedAt: new Date() } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'device_command', entityId: jobId, after: { status: 'CANCELLED' }, ...meta });
    });
  }

  retryFailed(tenantId: string, user: AuthUser, deviceId: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      await this.one(tx, deviceId);
      const { count } = await tx.deviceSyncJob.updateMany({ where: { deviceId, status: 'FAILED' }, data: { status: 'QUEUED', lastError: null, scheduledAt: new Date() } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'UPDATE', entity: 'device_command', entityId: deviceId, after: { retried: count }, ...meta });
      return { retried: count };
    });
  }

  /** Funcionários no cadastro × lidos do relógio × último envio. */
  roster(tenantId: string, id: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const d = await this.one(tx, id);
      const layout = layoutOf(d.ordinance);
      const [emps, roster, jobs] = await Promise.all([
        tx.employment.findMany({ where: { companyId: d.companyId, deletedAt: null, status: 'ACTIVE' }, select: { id: true, registration: true, person: { select: { fullName: true, cpf: true, pis: true } }, biometrics: { where: { revokedAt: null }, select: { id: true } } }, orderBy: { person: { fullName: 'asc' } } }),
        tx.deviceRosterEntry.findMany({ where: { deviceId: id } }),
        tx.deviceSyncJob.findMany({ where: { deviceId: id, action: 'UPSERT_EMPLOYEE' }, orderBy: { scheduledAt: 'desc' }, select: { status: true, scheduledAt: true, finishedAt: true, lastError: true, payload: true } }),
      ]);
      const byWorker = new Map(roster.map((r) => [r.workerId.padStart(11, '0'), r]));
      const seen = new Set<string>();
      const rows = emps.map((e) => {
        let workerId: string | null = null, problem: string | null = null;
        try { workerId = workerIdFor(layout, { employmentId: e.id, name: e.person.fullName, cpf: e.person.cpf, pis: e.person.pis }).value.padStart(11, '0'); } catch (err) { problem = (err as Error).message; }
        const inDevice = workerId ? byWorker.get(workerId) : undefined;
        if (workerId) seen.add(workerId);
        const job = jobs.find((j) => (j.payload as { employmentId?: string }).employmentId === e.id);
        return {
          employmentId: e.id, name: e.person.fullName, registration: e.registration, workerId, problem, fingerprints: e.biometrics.length,
          inDevice: !!inDevice, deviceFingerprints: inDevice?.fingerprints ?? null,
          lastSend: job ? { status: job.status, at: job.finishedAt ?? job.scheduledAt, error: job.lastError } : null,
        };
      });
      const extra = roster.filter((r) => !seen.has(r.workerId.padStart(11, '0'))).map((r) => ({ workerId: r.workerId, name: r.name, registration: r.registration }));
      const receivedAt = roster.reduce<Date | null>((m, r) => (!m || r.receivedAt > m ? r.receivedAt : m), null);
      return { layout, receivedAt, rows, extra, totals: { registry: rows.length, inDevice: rows.filter((r) => r.inDevice).length, missing: rows.filter((r) => r.workerId && !r.inDevice).length, extra: extra.length, problems: rows.filter((r) => r.problem).length } };
    });
  }

  /** Registros e comunicação por dia (gráfico). */
  stats(tenantId: string, id: string, days: number) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const d = await this.one(tx, id);
      const since = new Date(Date.now() - days * 86_400_000);
      const records = await tx.$queryRaw<Array<{ day: string; n: bigint }>>`SELECT to_char(recorded_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS day, count(*) AS n FROM time_records WHERE device_id = ${id}::uuid AND recorded_at >= ${since} GROUP BY 1`;
      const logs = await tx.$queryRaw<Array<{ day: string; level: string; n: bigint }>>`SELECT to_char(created_at AT TIME ZONE 'America/Sao_Paulo', 'YYYY-MM-DD') AS day, level, count(*) AS n FROM device_logs WHERE device_id = ${id}::uuid AND created_at >= ${since} GROUP BY 1, 2`;
      const out = [];
      for (let i = days - 1; i >= 0; i--) {
        const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date(Date.now() - i * 86_400_000));
        out.push({
          day, records: Number(records.find((r) => r.day === day)?.n ?? 0),
          contacts: Number(logs.filter((l) => l.day === day && l.level === 'info').reduce((s, l) => s + Number(l.n), 0)),
          alerts: Number(logs.filter((l) => l.day === day && l.level !== 'info').reduce((s, l) => s + Number(l.n), 0)),
        });
      }
      const recent = await tx.deviceLog.findMany({ where: { deviceId: id }, orderBy: { createdAt: 'desc' }, take: 20, select: { level: true, message: true, createdAt: true } });
      return { lastSeenAt: d.lastSeenAt, status: d.status, offlineAfterMinutes: offlineAfterMinutes(d), days: out, recent };
    });
  }

  /** Registros originais coletados do equipamento (linhas do AFD), por período. */
  afdExport(tenantId: string, id: string, from: string, to: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const d = await this.one(tx, id);
      const events = await tx.deviceEvent.findMany({
        where: { deviceId: id, kind: 'TIME_RECORD', occurredAt: { gte: new Date(`${from}T00:00:00-03:00`), lt: new Date(new Date(`${to}T00:00:00-03:00`).getTime() + 86_400_000) } },
        orderBy: { nsr: 'asc' }, select: { payload: true, nsr: true },
      });
      const lines = events.map((e) => (e.payload as { line?: string }).line).filter((l): l is string => !!l);
      return { filename: `registros-${(d.repNumber ?? d.serialNumber ?? d.name).replace(/[^\w-]/g, '_')}-${from}-${to}.txt`, lines: lines.length, content: lines.join('\r\n') + (lines.length ? '\r\n' : '') };
    });
  }
}

/**
 * Protocolo do agente local (instalado na rede do cliente, perto dos relógios). Autentica pela chave
 * do equipamento (cabeçalho X-Device-Key), busca comandos, devolve resultados e envia registros.
 */
@Injectable()
export class AgentService {
  private readonly log = new Logger('Agente');
  constructor(private readonly prisma: PrismaService, private readonly devices: DevicesService, private readonly biometrics: BiometricsService, private readonly audit: AuditService, private readonly monitor: DeviceMonitor) {}

  async auth(key: string | undefined) {
    if (!key || !key.startsWith('spd_') || key.length > 100) throw new UnauthorizedException('Chave do equipamento ausente ou inválida');
    const d = await this.prisma.asPlatform((tx) => tx.device.findFirst({ where: { agentKeyHash: sha256Hex(key), deletedAt: null }, select: { id: true, tenantId: true, status: true } }));
    if (!d) throw new UnauthorizedException('Chave do equipamento ausente ou inválida');
    if (d.status === 'DISABLED') throw new UnauthorizedException('Equipamento desativado');
    return d;
  }

  async heartbeat(key: string | undefined, input: z.infer<typeof heartbeatSchema>) {
    const d = await this.auth(key);
    await this.monitor.seen(d.tenantId, d.id, input);
    return { ok: true, serverTime: new Date().toISOString() };
  }

  /** Entrega até 50 comandos da fila (marcados como em execução), já com os dados que o relógio precisa. */
  async pull(key: string | undefined) {
    const dev = await this.auth(key);
    await this.monitor.seen(dev.tenantId, dev.id, {});
    return this.prisma.forTenant(dev.tenantId, async (tx) => {
      const d = await tx.device.findFirstOrThrow({ where: { id: dev.id }, select: { id: true, companyId: true, ordinance: true, timezone: true, company: { select: { cnpj: true, legalName: true, tradeName: true } }, unit: { select: { name: true } } } });
      const layout = layoutOf(d.ordinance);
      // Comandos presos em execução há mais de 15 minutos voltam para a fila.
      await tx.deviceSyncJob.updateMany({ where: { deviceId: d.id, status: 'RUNNING', scheduledAt: { lt: new Date(Date.now() - 15 * 60_000) } }, data: { status: 'QUEUED' } });
      const jobs = await tx.deviceSyncJob.findMany({ where: { deviceId: d.id, status: 'QUEUED', scheduledAt: { lte: new Date() } }, orderBy: { scheduledAt: 'asc' }, take: 50 });
      const out = [];
      for (const j of jobs) {
        const p = j.payload as { employmentId?: string; biometricId?: string };
        let data: Record<string, unknown> = {};
        try {
          if (j.action === 'SET_EMPLOYER') data = { employer: validateEmployer({ idType: 'CNPJ', id: d.company.cnpj ?? '', name: d.company.legalName, location: d.unit?.name ?? d.company.tradeName ?? d.company.legalName }) };
          else if (j.action === 'SET_DATETIME') data = { now: new Date().toISOString(), timezone: d.timezone };
          else if (j.action === 'UPSERT_EMPLOYEE' || j.action === 'UPSERT_FINGERPRINT' || j.action === 'DELETE_FINGERPRINTS') {
            const e = await tx.employment.findFirstOrThrow({ where: { id: p.employmentId }, select: { id: true, registration: true, person: { select: { fullName: true, cpf: true, pis: true } } } });
            const worker = workerIdFor(layout, { employmentId: e.id, name: e.person.fullName, cpf: e.person.cpf, pis: e.person.pis });
            data = { worker, name: repName(e.person.fullName), registration: e.registration };
            if (j.action === 'UPSERT_FINGERPRINT' && p.biometricId) {
              const b = await tx.biometricTemplate.findFirstOrThrow({ where: { id: p.biometricId }, select: { finger: true, format: true } });
              data = { ...data, finger: b.finger, format: b.format, template: (await this.biometrics.decryptForDevice(tx, p.biometricId)).toString('base64') };
            }
          } else if (j.action === 'COLLECT_RECORDS') {
            const last = await tx.deviceEvent.findFirst({ where: { deviceId: d.id, kind: 'TIME_RECORD' }, orderBy: { nsr: 'desc' }, select: { nsr: true } });
            data = { sinceNsr: last?.nsr ? Number(last.nsr) : 0 };
          }
        } catch (e) {
          await tx.deviceSyncJob.update({ where: { id: j.id }, data: { status: 'FAILED', attempts: { increment: 1 }, lastError: (e as Error).message, finishedAt: new Date() } });
          continue;
        }
        await tx.deviceSyncJob.update({ where: { id: j.id }, data: { status: 'RUNNING', attempts: { increment: 1 }, scheduledAt: new Date() } });
        out.push({ id: j.id, action: j.action, layout, data });
      }
      return { jobs: out };
    });
  }

  async result(key: string | undefined, jobId: string, input: ResultInput) {
    const dev = await this.auth(key);
    const job = await this.prisma.forTenant(dev.tenantId, (tx) => tx.deviceSyncJob.findFirst({ where: { id: jobId, deviceId: dev.id } }));
    if (!job) throw new NotFoundException('Comando não encontrado');
    if (job.status !== 'RUNNING') throw new ConflictException('Este comando não está em execução');
    let summary: Record<string, unknown> = {};
    if (input.status === 'SUCCEEDED') {
      try { summary = await this.applyData(dev.tenantId, dev.id, job.action, input.data ?? {}, job.createdById); }
      catch (e) { input = { status: 'FAILED', error: (e as Error).message }; }
    }
    await this.prisma.forTenant(dev.tenantId, async (tx) => {
      await tx.deviceSyncJob.update({ where: { id: jobId }, data: { status: input.status, lastError: input.error ?? null, finishedAt: new Date() } });
      if (input.status === 'SUCCEEDED') await tx.device.update({ where: { id: dev.id }, data: { lastSyncAt: new Date() } });
      await tx.deviceLog.create({ data: { tenantId: dev.tenantId, deviceId: dev.id, level: input.status === 'SUCCEEDED' ? 'info' : 'error', message: `${job.action}: ${input.status === 'SUCCEEDED' ? 'concluído' : `falhou — ${input.error ?? 'sem detalhe'}`}`, details: summary as never } });
    });
    return { ok: input.status === 'SUCCEEDED', ...summary };
  }

  private async applyData(tenantId: string, deviceId: string, action: string, data: NonNullable<ResultInput['data']>, actorId: string | null) {
    if (action === 'RECEIVE_EMPLOYEES') {
      const list = data.employees ?? [];
      await this.prisma.forTenant(tenantId, async (tx) => {
        await tx.deviceRosterEntry.deleteMany({ where: { deviceId } });
        if (list.length) await tx.deviceRosterEntry.createMany({ data: list.map((e) => ({ tenantId, deviceId, workerId: e.workerId, name: e.name ?? null, registration: e.registration ?? null, fingerprints: e.fingerprints ?? 0 })), skipDuplicates: true });
      });
      return { received: list.length };
    }
    if (action === 'RECEIVE_FINGERPRINTS') {
      // Digitais lidas do relógio entram cifradas para os funcionários da empresa (sem duplicar).
      const list = data.fingerprints ?? [];
      const ctx = await this.prisma.forTenant(tenantId, (tx) => tx.device.findFirstOrThrow({ where: { id: deviceId }, select: { companyId: true, ordinance: true } }));
      const field = layoutOf(ctx.ordinance) === '1510' ? 'pis' : 'cpf';
      let imported = 0, duplicates = 0, unmatched = 0;
      for (const f of list) {
        const emp = await this.prisma.forTenant(tenantId, (tx) => tx.employment.findFirst({ where: { companyId: ctx.companyId, deletedAt: null, status: 'ACTIVE', person: { [field]: f.workerId.padStart(11, '0') } }, select: { id: true } }));
        if (!emp) { unmatched++; continue; }
        try {
          await this.biometrics.enroll(tenantId, { id: actorId } as AuthUser, emp.id, { finger: f.finger, format: f.format, template: f.template, capturedDeviceId: deviceId }, { ip: null, userAgent: 'agente-local' });
          imported++;
        } catch (e) {
          if ((e as Error).message.includes('já está cadastrada')) duplicates++; else throw e;
        }
      }
      return { imported, duplicates, unmatched };
    }
    if (action === 'RECEIVE_EMPLOYER') {
      const ctx = await this.prisma.forTenant(tenantId, (tx) => tx.device.findFirstOrThrow({ where: { id: deviceId }, select: { company: { select: { cnpj: true } } } }));
      const matches = !!data.employer && !!ctx.company.cnpj && normalizeCnpj(data.employer.cnpj) === normalizeCnpj(ctx.company.cnpj);
      return { employer: data.employer ?? null, matchesCompany: matches };
    }
    if (action === 'COLLECT_RECORDS') {
      if (!data.afd) return { imported: 0 };
      const r = await this.devices.importAfd(tenantId, { id: actorId } as AuthUser, deviceId, data.afd, { ip: null, userAgent: 'agente-local' });
      return { imported: r.imported, duplicates: r.duplicates, unmatched: r.unmatched.length };
    }
    return {};
  }

  /** Coleta enviada por conta própria do agente (sem comando), ex.: na coleta agendada. */
  async pushAfd(key: string | undefined, content: string) {
    const dev = await this.auth(key);
    await this.monitor.seen(dev.tenantId, dev.id, {});
    const r = await this.devices.importAfd(dev.tenantId, { id: null } as unknown as AuthUser, dev.id, content, { ip: null, userAgent: 'agente-local' });
    await this.prisma.forTenant(dev.tenantId, (tx) => tx.device.update({ where: { id: dev.id }, data: { lastSyncAt: new Date() } }));
    return { imported: r.imported, duplicates: r.duplicates, unmatched: r.unmatched.length, warnings: r.warnings };
  }
}

/** Status e alertas: marca sem comunicação e avisa por e-mail quando cai e quando volta. */
@Injectable()
export class DeviceMonitor implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly log = new Logger('Equipamentos');
  private timer?: NodeJS.Timeout;
  constructor(private readonly prisma: PrismaService, private readonly mail: MailService, @Inject(APP_CONFIG) private readonly config: AppConfig) {}

  onApplicationBootstrap() {
    if (this.config.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.checkOffline().catch((e: Error) => this.log.error(e.message)), 60_000);
    this.timer.unref();
  }
  onApplicationShutdown() { if (this.timer) clearInterval(this.timer); }

  private async notify(emails: string[], subject: string, text: string) {
    for (const to of emails) await this.mail.send({ to, subject, text, html: `<p>${text.replace(/[&<>]/g, (c) => `&#${c.charCodeAt(0)};`)}</p>` }).catch((e: Error) => this.log.warn(`Falha ao enviar alerta: ${e.message}`));
  }

  /** O agente falou com a API: atualiza o contato e avisa se o equipamento voltou. */
  async seen(tenantId: string, deviceId: string, info: { firmware?: string; adapterVersion?: string; message?: string }) {
    const back = await this.prisma.forTenant(tenantId, async (tx) => {
      const d = await tx.device.findFirstOrThrow({ where: { id: deviceId }, select: { status: true, name: true, alertEmails: true } });
      await tx.device.update({ where: { id: deviceId }, data: { lastSeenAt: new Date(), status: 'ONLINE', ...(info.firmware ? { firmware: info.firmware } : {}), ...(info.adapterVersion ? { adapterVersion: info.adapterVersion } : {}) } });
      await tx.deviceLog.create({ data: { tenantId, deviceId, level: 'info', message: info.message ? `Contato: ${info.message}` : 'Contato do agente' } });
      return d.status === 'OFFLINE' ? d : null;
    });
    if (back) {
      await this.prisma.forTenant(tenantId, (tx) => tx.deviceLog.create({ data: { tenantId, deviceId, level: 'warn', message: 'Comunicação restabelecida' } }));
      await this.notify(back.alertEmails, `SuperPonto: ${back.name} voltou a se comunicar`, `O equipamento ${back.name} voltou a se comunicar em ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}.`);
    }
  }

  /** Equipamentos sem contato além do limite viram OFFLINE e disparam o alerta (uma vez por queda). */
  async checkOffline(now = new Date()) {
    const candidates = await this.prisma.asPlatform((tx) => tx.device.findMany({ where: { deletedAt: null, status: 'ONLINE', lastSeenAt: { not: null } }, select: { id: true, tenantId: true, name: true, lastSeenAt: true, collectIntervalMinutes: true, alertEmails: true } }));
    let n = 0;
    for (const d of candidates) {
      if (now.getTime() - d.lastSeenAt!.getTime() < offlineAfterMinutes(d) * 60_000) continue;
      await this.prisma.asPlatform(async (tx) => {
        await tx.device.update({ where: { id: d.id }, data: { status: 'OFFLINE' } });
        await tx.deviceLog.create({ data: { tenantId: d.tenantId, deviceId: d.id, level: 'error', message: `Sem comunicação desde ${d.lastSeenAt!.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}` } });
      });
      await this.notify(d.alertEmails, `SuperPonto: ${d.name} sem comunicação`, `O equipamento ${d.name} não se comunica desde ${d.lastSeenAt!.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}. Verifique energia, rede e o agente local.`);
      n++;
    }
    return n;
  }
}

@ApiTags('equipamentos')
@ApiBearerAuth()
@Controller('v1/devices')
export class DeviceRegistryController {
  constructor(private readonly svc: DeviceRegistryService) {}

  @Get()
  @RequirePermission('devices.devices:read')
  list(@ActiveTenant() t: string, @Query({ schema: z.object({ companyId: z.uuid().optional(), groupName: z.string().max(60).optional() }) }) q: { companyId?: string; groupName?: string }) { return this.svc.list(t, q); }

  @Post('group-command')
  @RequirePermission('devices.commands:execute')
  groupCommand(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: groupCommandSchema }) b: z.infer<typeof groupCommandSchema>, @RequestInfo() m: RequestMeta) { return this.svc.groupCommand(t, u, b, m); }

  @Get(':id')
  @RequirePermission('devices.devices:read')
  get(@ActiveTenant() t: string, @Param('id', { schema: idSchema }) id: string) { return this.svc.get(t, id); }

  @Post()
  @RequirePermission('devices.devices:manage')
  create(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Body({ schema: deviceSchema }) b: DeviceInput, @RequestInfo() m: RequestMeta) { return this.svc.create(t, u, b, m); }

  @Patch(':id')
  @RequirePermission('devices.devices:manage')
  update(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', { schema: idSchema }) id: string, @Body({ schema: deviceSchema.partial() }) b: Partial<DeviceInput>, @RequestInfo() m: RequestMeta) { return this.svc.update(t, u, id, b, m); }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermission('devices.devices:manage')
  remove(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', { schema: idSchema }) id: string, @RequestInfo() m: RequestMeta) { return this.svc.remove(t, u, id, m); }

  @Post(':id/agent-key')
  @HttpCode(200)
  @RequirePermission('devices.devices:manage')
  agentKey(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', { schema: idSchema }) id: string, @RequestInfo() m: RequestMeta) { return this.svc.agentKey(t, u, id, m); }

  @Post(':id/commands')
  @RequirePermission('devices.commands:execute')
  command(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', { schema: idSchema }) id: string, @Body({ schema: commandSchema }) b: { action: (typeof ACTIONS)[number] }, @RequestInfo() m: RequestMeta) { return this.svc.command(t, u, id, b.action, m); }

  @Post(':id/jobs/retry')
  @HttpCode(200)
  @RequirePermission('devices.commands:execute')
  retry(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', { schema: idSchema }) id: string, @RequestInfo() m: RequestMeta) { return this.svc.retryFailed(t, u, id, m); }

  @Delete(':id/jobs/:jobId')
  @HttpCode(204)
  @RequirePermission('devices.commands:execute')
  cancel(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', { schema: idSchema }) id: string, @Param('jobId', { schema: idSchema }) jobId: string, @RequestInfo() m: RequestMeta) { return this.svc.cancelJob(t, u, id, jobId, m); }

  @Get(':id/roster')
  @RequirePermission('devices.devices:read')
  roster(@ActiveTenant() t: string, @Param('id', { schema: idSchema }) id: string) { return this.svc.roster(t, id); }

  @Get(':id/stats')
  @RequirePermission('devices.devices:read')
  stats(@ActiveTenant() t: string, @Param('id', { schema: idSchema }) id: string, @Query({ schema: z.object({ days: z.coerce.number().int().min(1).max(60).default(14) }) }) q: { days: number }) { return this.svc.stats(t, id, q.days); }

  @Get(':id/afd-export')
  @RequirePermission('reports.reports:export')
  afdExport(@ActiveTenant() t: string, @Param('id', { schema: idSchema }) id: string, @Query({ schema: z.object({ from: z.iso.date(), to: z.iso.date() }) }) q: { from: string; to: string }) { return this.svc.afdExport(t, id, q.from, q.to); }
}

@ApiTags('agente local')
@Public()
@Controller('v1/agent')
export class AgentController {
  constructor(private readonly svc: AgentService) {}

  @Post('heartbeat')
  @HttpCode(200)
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  heartbeat(@Headers('x-device-key') key: string | undefined, @Body({ schema: heartbeatSchema }) b: z.infer<typeof heartbeatSchema>) { return this.svc.heartbeat(key, b); }

  @Get('jobs')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  jobs(@Headers('x-device-key') key: string | undefined) { return this.svc.pull(key); }

  @Post('jobs/:id/result')
  @HttpCode(200)
  @Throttle({ default: { limit: 600, ttl: 60_000 } })
  result(@Headers('x-device-key') key: string | undefined, @Param('id', { schema: idSchema }) id: string, @Body({ schema: resultSchema }) b: ResultInput) { return this.svc.result(key, id, b); }

  @Post('afd')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  afd(@Headers('x-device-key') key: string | undefined, @Body({ schema: z.object({ content: z.string().min(10).max(20_000_000) }) }) b: { content: string }) { return this.svc.pushAfd(key, b.content); }
}
