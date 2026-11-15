import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { normalizeCnpj, onlyDigits } from '@superponto/br-docs';
import { assertEmployerFitsLayout, parseAfd, RepCommandError, validateEmployer, workerIdFor, type AfdLayout } from '@superponto/rep-protocols';
import type { AuthUser } from '../auth/auth-user.js';
import { AuditService } from '../audit/audit.service.js';
import { sha256Hex } from '../common/crypto.js';
import type { RequestMeta } from '../common/tenant.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';

/** Portaria do equipamento → leiaute do AFD e identificador do trabalhador. */
export function layoutOf(ordinance: string | null): AfdLayout {
  if (!ordinance) throw new BadRequestException('Defina a portaria do equipamento (1.510/2009, 373/2011 ou 671/2021) antes de usá-lo');
  return ordinance === 'P671_2021' ? '671' : '1510';
}

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService) {}

  private async device(tx: Tx, id: string) {
    const d = await tx.device.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, name: true, companyId: true, ordinance: true, timezone: true, company: { select: { cnpj: true, legalName: true, tradeName: true } }, unit: { select: { name: true } } },
    });
    if (!d) throw new NotFoundException('Equipamento não encontrado');
    return d;
  }

  /**
   * Importa um AFD (Portaria 1.510, 373 ou 671): grava cada evento bruto do equipamento e cria as
   * marcações dos trabalhadores identificados (PIS ou CPF). Reimportar o mesmo arquivo não duplica nada.
   */
  importAfd(tenantId: string, user: AuthUser, deviceId: string, content: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const device = await this.device(tx, deviceId);
      const expected = layoutOf(device.ordinance);
      const afd = parseAfd(content, { timeZone: device.timezone });
      const warnings = [...afd.warnings];
      if (afd.layout !== expected && device.ordinance !== 'P373_2011') {
        warnings.push(`Arquivo no leiaute da Portaria ${afd.layout === '671' ? '671/2021' : '1.510/2009'}, mas o equipamento está cadastrado como ${device.ordinance}`);
      }
      const companyCnpj = device.company.cnpj ? normalizeCnpj(device.company.cnpj) : null;
      if (afd.header?.employerIdType === 'CNPJ' && companyCnpj && normalizeCnpj(afd.header.employerId) !== companyCnpj) {
        throw new BadRequestException(`O AFD é do CNPJ ${afd.header.employerId}, diferente da empresa do equipamento (${companyCnpj})`);
      }
      if (!afd.punches.length) return { layout: afd.layout, header: afd.header, punches: 0, imported: 0, duplicates: 0, unmatched: [], warnings };

      // Eventos brutos (idempotentes pela chave equipamento + tipo + NSR + horário), com o texto original da linha.
      const rawLines = content.split(/\r?\n/);
      const events = await tx.deviceEvent.createMany({
        data: afd.punches.map((p) => ({ tenantId, deviceId, kind: 'TIME_RECORD' as const, occurredAt: p.occurredAt, identifier: p.workerId, nsr: BigInt(p.nsr), payload: { layout: afd.layout, recordType: p.recordType, workerIdType: p.workerIdType, line: p.line, text: rawLines[p.line - 1]?.trimEnd() ?? null, hash: p.hash ?? null } })),
        skipDuplicates: true,
      });

      // Trabalhadores da empresa pelo identificador do leiaute.
      const field = afd.layout === '1510' ? 'pis' : 'cpf';
      const ids = [...new Set(afd.punches.map((p) => p.workerId.padStart(11, '0')))];
      const employments = await tx.employment.findMany({
        where: { companyId: device.companyId, deletedAt: null, person: { [field]: { in: ids } } },
        select: { id: true, hiredAt: true, terminatedAt: true, person: { select: { cpf: true, pis: true } } },
      });
      const byWorker = new Map<string, typeof employments>();
      for (const e of employments) {
        const key = onlyDigits((field === 'pis' ? e.person.pis : e.person.cpf) ?? '');
        byWorker.set(key, [...(byWorker.get(key) ?? []), e]);
      }

      const keys = afd.punches.map((p) => `afd:${deviceId}:${p.nsr}`);
      const existing = new Set((await tx.timeRecord.findMany({ where: { idempotencyKey: { in: keys } }, select: { idempotencyKey: true } })).map((r) => r.idempotencyKey));
      const lastHash = new Map<string, string | null>();
      const unmatched = new Map<string, number>();
      let imported = 0;
      let duplicates = 0;

      for (const p of [...afd.punches].sort((a, b) => a.occurredAt.getTime() - b.occurredAt.getTime() || a.nsr - b.nsr)) {
        const key = `afd:${deviceId}:${p.nsr}`;
        if (existing.has(key)) { duplicates++; continue; }
        const day = p.occurredAt.toLocaleDateString('sv-SE', { timeZone: device.timezone }); // AAAA-MM-DD no fuso do equipamento
        // Com mais de um vínculo na mesma empresa, vale o vigente na data da marcação.
        const emp = (byWorker.get(p.workerId.padStart(11, '0')) ?? []).find((e) => e.hiredAt.toISOString().slice(0, 10) <= day && (!e.terminatedAt || e.terminatedAt.toISOString().slice(0, 10) >= day));
        if (!emp) { unmatched.set(p.workerId, (unmatched.get(p.workerId) ?? 0) + 1); continue; }
        if (!lastHash.has(emp.id)) {
          const last = await tx.timeRecord.findFirst({ where: { employmentId: emp.id }, orderBy: { receivedAt: 'desc' }, select: { hash: true } });
          lastHash.set(emp.id, last?.hash ?? null);
        }
        const previousHash = lastHash.get(emp.id) ?? null;
        const hash = sha256Hex([previousHash ?? '', emp.id, p.occurredAt.toISOString(), deviceId, p.nsr].join('|'));
        await tx.timeRecord.create({ data: { tenantId, employmentId: emp.id, recordedAt: p.occurredAt, timezone: device.timezone, source: 'DEVICE', deviceId, deviceNsr: BigInt(p.nsr), hash, previousHash, idempotencyKey: key } });
        lastHash.set(emp.id, hash);
        imported++;
      }

      await tx.device.update({ where: { id: deviceId }, data: { lastSyncAt: new Date() } });
      const summary = { layout: afd.layout, header: afd.header, punches: afd.punches.length, newEvents: events.count, imported, duplicates, unmatched: [...unmatched].map(([workerId, count]) => ({ workerId, count })), warnings };
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'afd_import', entityId: deviceId, after: { ...summary, header: undefined, warnings: warnings.length }, ...meta });
      return summary;
    });
  }

  /**
   * Agenda o envio ao REP do empregador, dos funcionários ativos da empresa e das digitais.
   * Funcionários sem o documento exigido pela portaria (PIS ou CPF) voltam na lista "skipped".
   */
  syncRoster(tenantId: string, user: AuthUser, deviceId: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const device = await this.device(tx, deviceId);
      const layout = layoutOf(device.ordinance);
      const cnpj = device.company.cnpj;
      if (!cnpj) throw new BadRequestException('A empresa do equipamento não tem CNPJ cadastrado');
      try {
        const employer = validateEmployer({ idType: 'CNPJ', id: cnpj, name: device.company.legalName, location: device.unit?.name ?? device.company.tradeName ?? device.company.legalName });
        assertEmployerFitsLayout(layout, employer);
      } catch (e) {
        if (e instanceof RepCommandError) throw new BadRequestException(e.message);
        throw e;
      }

      const employments = await tx.employment.findMany({
        where: { companyId: device.companyId, deletedAt: null, status: 'ACTIVE' },
        select: { id: true, registration: true, person: { select: { fullName: true, cpf: true, pis: true } }, biometrics: { where: { revokedAt: null }, select: { id: true } } },
        orderBy: { registration: 'asc' },
      });
      const jobs: Array<{ action: string; payload: object }> = [{ action: 'SET_EMPLOYER', payload: { companyId: device.companyId } }];
      const skipped: Array<{ employmentId: string; name: string; reason: string }> = [];
      for (const e of employments) {
        try {
          workerIdFor(layout, { employmentId: e.id, name: e.person.fullName, cpf: e.person.cpf, pis: e.person.pis });
        } catch (err) {
          skipped.push({ employmentId: e.id, name: e.person.fullName, reason: (err as Error).message });
          continue;
        }
        jobs.push({ action: 'UPSERT_EMPLOYEE', payload: { employmentId: e.id } });
        for (const b of e.biometrics) jobs.push({ action: 'UPSERT_FINGERPRINT', payload: { employmentId: e.id, biometricId: b.id } });
      }
      await tx.deviceSyncJob.createMany({ data: jobs.map((j) => ({ tenantId, deviceId, action: j.action, payload: j.payload, createdById: user.id })) });
      const result = { layout, queued: jobs.length, employees: employments.length - skipped.length, fingerprints: jobs.filter((j) => j.action === 'UPSERT_FINGERPRINT').length, skipped };
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'device_sync', entityId: deviceId, after: { ...result, skipped: skipped.length }, ...meta });
      return result;
    });
  }

  jobs(tenantId: string, deviceId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      await this.device(tx, deviceId);
      return tx.deviceSyncJob.findMany({ where: { deviceId }, orderBy: { scheduledAt: 'desc' }, take: 200, select: { id: true, action: true, payload: true, status: true, attempts: true, lastError: true, scheduledAt: true, finishedAt: true } });
    });
  }
}
