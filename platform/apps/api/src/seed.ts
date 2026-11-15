// Seed idempotente: catálogo de permissões, perfis de sistema e (opcionalmente) o primeiro SuperAdmin.
// Uso: DATABASE_URL=<papel dono> SEED_ADMIN_EMAIL=... node dist/seed.js
import { createPrismaClient } from '@superponto/database';
import { PERMISSIONS, SYSTEM_ROLES } from './authorization/catalog.js';

type Client = ReturnType<typeof createPrismaClient>;

export async function seed(client: Client, adminEmail = process.env.SEED_ADMIN_EMAIL) {
  await client.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
    for (const [key, description] of Object.entries(PERMISSIONS)) {
      await tx.permission.upsert({ where: { key }, update: { description, module: key.split('.')[0]! }, create: { key, description, module: key.split('.')[0]! } });
    }
    const perms = new Map((await tx.permission.findMany()).map((p) => [p.key, p.id]));
    for (const role of SYSTEM_ROLES) {
      const existing = await tx.role.findFirst({ where: { tenantId: null, key: role.key } });
      const saved = existing
        ? await tx.role.update({ where: { id: existing.id }, data: { name: role.name, description: role.description, isSystem: true } })
        : await tx.role.create({ data: { key: role.key, name: role.name, description: role.description, isSystem: true } });
      await tx.rolePermission.deleteMany({ where: { roleId: saved.id } });
      await tx.rolePermission.createMany({ data: role.permissions.map((p) => ({ roleId: saved.id, permissionId: perms.get(p)! })) });
    }
    if (adminEmail) {
      const email = adminEmail.trim().toLowerCase();
      const user = await tx.user.upsert({
        where: { email },
        update: { isPlatformAdmin: true, isActive: true },
        create: { email, displayName: 'Administrador da plataforma', isPlatformAdmin: true },
      });
      const role = await tx.role.findFirstOrThrow({ where: { tenantId: null, key: 'super_admin' } });
      const has = await tx.userRole.findFirst({ where: { userId: user.id, roleId: role.id } });
      if (!has) await tx.userRole.create({ data: { userId: user.id, roleId: role.id, scope: 'PLATFORM' } });
    }
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!process.env.DATABASE_URL) throw new Error('Defina DATABASE_URL (papel dono do banco)');
  const prisma = createPrismaClient(process.env.DATABASE_URL);
  await seed(prisma);
  console.log(`Seed concluído: ${Object.keys(PERMISSIONS).length} permissões, ${SYSTEM_ROLES.length} perfis de sistema.`);
  await prisma.$disconnect();
}
