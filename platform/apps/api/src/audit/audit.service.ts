import { Injectable } from '@nestjs/common';
import type { AuditAction } from '@superponto/database';
import type { Tx } from '../prisma/prisma.service.js';

export interface AuditEntry {
  tenantId: string | null;
  actorUserId: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

/** Trilha de auditoria: gravada na MESMA transação da alteração (ou ambas acontecem, ou nenhuma). */
@Injectable()
export class AuditService {
  async record(tx: Tx, entry: AuditEntry): Promise<void> {
    await tx.auditLog.create({
      data: {
        tenantId: entry.tenantId,
        actorUserId: entry.actorUserId,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        before: (entry.before ?? undefined) as never,
        after: (entry.after ?? undefined) as never,
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  }
}
