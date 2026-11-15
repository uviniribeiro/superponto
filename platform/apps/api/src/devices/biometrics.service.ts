import { BadRequestException, Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { AuthUser } from '../auth/auth-user.js';
import { AuditService } from '../audit/audit.service.js';
import type { RequestMeta } from '../common/tenant.js';
import { FieldCipher, sha256Hex } from '../common/crypto.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { PrismaService, type Tx } from '../prisma/prisma.service.js';
import type { FingerprintInput } from './devices.schemas.js';

const PUBLIC = { id: true, employmentId: true, finger: true, format: true, quality: true, capturedDeviceId: true, createdAt: true } as const;

/** Equipamentos de ponto ativos da empresa do vínculo que recebem cadastros (com portaria definida). */
export async function repTargets(tx: Tx, companyId: string) {
  return tx.device.findMany({ where: { companyId, deletedAt: null, status: { not: 'DISABLED' }, ordinance: { not: null }, usage: { has: 'TIME' } }, select: { id: true } });
}

@Injectable()
export class BiometricsService {
  private readonly cipher: FieldCipher | null;
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, @Inject(APP_CONFIG) config: AppConfig) {
    this.cipher = config.BIOMETRIC_ENCRYPTION_KEY ? new FieldCipher(config.BIOMETRIC_ENCRYPTION_KEY) : null;
  }

  private requireCipher() {
    if (!this.cipher) throw new ServiceUnavailableException('Cadastro de digitais desativado: configure BIOMETRIC_ENCRYPTION_KEY na API');
    return this.cipher;
  }

  private async employment(tx: Tx, id: string) {
    const e = await tx.employment.findFirst({ where: { id, deletedAt: null }, select: { id: true, companyId: true, status: true } });
    if (!e) throw new NotFoundException('Vínculo não encontrado');
    return e;
  }

  list(tenantId: string, employmentId: string) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      await this.employment(tx, employmentId);
      return tx.biometricTemplate.findMany({ where: { employmentId, revokedAt: null }, select: PUBLIC, orderBy: { finger: 'asc' } });
    });
  }

  /** Grava a digital cifrada, revoga a anterior do mesmo dedo e agenda o envio aos REPs da empresa. */
  enroll(tenantId: string, user: AuthUser, employmentId: string, input: FingerprintInput, meta: RequestMeta) {
    const cipher = this.requireCipher();
    const raw = Buffer.from(input.template, 'base64');
    if (raw.length < 64) throw new BadRequestException('Template de digital muito pequeno: confira a captura');
    return this.prisma.forTenant(tenantId, async (tx) => {
      const emp = await this.employment(tx, employmentId);
      if (emp.status !== 'ACTIVE') throw new BadRequestException('Só é possível cadastrar digital de vínculo ativo');
      const hash = sha256Hex(raw);
      const previous = await tx.biometricTemplate.findMany({ where: { employmentId, finger: input.finger, format: input.format, revokedAt: null }, select: { id: true, templateSha256: true } });
      if (previous.some((p) => p.templateSha256 === hash)) throw new BadRequestException('Esta digital já está cadastrada');
      if (previous.length) await tx.biometricTemplate.updateMany({ where: { id: { in: previous.map((p) => p.id) } }, data: { revokedAt: new Date() } });
      const saved = await tx.biometricTemplate.create({
        data: { tenantId, employmentId, finger: input.finger, format: input.format, templateEnc: cipher.encrypt(raw), templateSha256: hash, quality: input.quality, capturedDeviceId: input.capturedDeviceId, capturedById: user.id },
        select: PUBLIC,
      });
      const targets = await repTargets(tx, emp.companyId);
      if (targets.length) {
        // A fila guarda só a referência: o template é decifrado no momento do envio, nunca copiado.
        await tx.deviceSyncJob.createMany({ data: targets.map((d) => ({ tenantId, deviceId: d.id, action: 'UPSERT_FINGERPRINT', payload: { employmentId, biometricId: saved.id }, createdById: user.id })) });
      }
      // Auditoria sem o template: só metadados.
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'CREATE', entity: 'biometric_template', entityId: saved.id, after: { ...saved, replaced: previous.map((p) => p.id), queuedDevices: targets.length }, ...meta });
      return { ...saved, queuedDevices: targets.length };
    });
  }

  revoke(tenantId: string, user: AuthUser, employmentId: string, id: string, meta: RequestMeta) {
    return this.prisma.forTenant(tenantId, async (tx) => {
      const emp = await this.employment(tx, employmentId);
      const row = await tx.biometricTemplate.findFirst({ where: { id, employmentId, revokedAt: null }, select: PUBLIC });
      if (!row) throw new NotFoundException('Digital não encontrada');
      await tx.biometricTemplate.update({ where: { id }, data: { revokedAt: new Date() } });
      const targets = await repTargets(tx, emp.companyId);
      if (targets.length) await tx.deviceSyncJob.createMany({ data: targets.map((d) => ({ tenantId, deviceId: d.id, action: 'DELETE_FINGERPRINTS', payload: { employmentId, biometricId: id }, createdById: user.id })) });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'DELETE', entity: 'biometric_template', entityId: id, before: row, ...meta });
    });
  }

  /** Template em claro para o envio ao equipamento (uso interno do Servidor de Comunicação). */
  decryptForDevice(tx: Tx, id: string): Promise<Buffer> {
    const cipher = this.requireCipher();
    return tx.biometricTemplate.findFirstOrThrow({ where: { id, revokedAt: null }, select: { templateEnc: true } }).then((r) => cipher.decrypt(r.templateEnc));
  }
}
