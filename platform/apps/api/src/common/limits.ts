import { ForbiddenException } from '@nestjs/common';
import type { Tx } from '../prisma/prisma.service.js';

/** Limites do plano (chave da plan_features). Sem assinatura = sem limite (clientes antigos e instalação própria). */
export const LIMITS = {
  'limit.employments': { label: 'funcionários ativos' },
  'limit.devices': { label: 'equipamentos' },
  'limit.users': { label: 'usuários' },
} as const;
export type LimitKey = keyof typeof LIMITS;

const ACTIVE = ['TRIALING', 'ACTIVE', 'PAST_DUE'] as const;

/** Uso atual de cada limite no cliente (dentro da transação do tenant). */
export async function usage(tx: Tx, tenantId: string): Promise<Record<LimitKey, number>> {
  const [employments, devices, users] = await Promise.all([
    tx.employment.count({ where: { deletedAt: null, status: { not: 'TERMINATED' } } }),
    tx.device.count({ where: { deletedAt: null } }),
    tx.user.count({ where: { tenantId, deletedAt: null, isActive: true, isSupport: false } }),
  ]);
  return { 'limit.employments': employments, 'limit.devices': devices, 'limit.users': users };
}

/** Assinatura vigente com os limites efetivos (plano + ajustes do contrato). */
export async function currentPlan(tx: Tx) {
  const sub = await tx.subscription.findFirst({ where: { status: { in: [...ACTIVE] } }, orderBy: { createdAt: 'desc' }, include: { plan: { include: { features: true } } } });
  if (!sub) return null;
  const limits: Partial<Record<LimitKey, number>> = {};
  for (const f of sub.plan.features) if (f.key in LIMITS && typeof f.value === 'number') limits[f.key as LimitKey] = f.value;
  for (const [k, v] of Object.entries((sub.overrides ?? {}) as Record<string, unknown>)) if (k in LIMITS && typeof v === 'number') limits[k as LimitKey] = v;
  return { subscription: sub, limits };
}

/** Recusa a criação quando o plano não comporta mais um item. */
export async function assertLimit(tx: Tx, tenantId: string, key: LimitKey, adding = 1) {
  const plan = await currentPlan(tx);
  const max = plan?.limits[key];
  if (max === undefined) return;
  const used = (await usage(tx, tenantId))[key];
  if (used + adding > max) throw new ForbiddenException(`Limite do plano ${plan!.subscription.plan.name} atingido: ${max} ${LIMITS[key].label} (em uso: ${used}). Fale com a equipe SuperPonto para ampliar.`);
}
