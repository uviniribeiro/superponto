// O administrador da plataforma (viniciusacacio1@gmail.com) é irrevogável no próprio banco:
// existe sempre, é administrador ativo com o perfil super_admin e não pode ser excluído, rebaixado nem bloqueado.
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ownerUrl } from './helpers.js';

const client = new pg.Client({ connectionString: ownerUrl });
const EMAIL = 'viniciusacacio1@gmail.com';

async function attempt(sql: string, params: unknown[] = []) {
  await client.query('BEGIN');
  try {
    await client.query('SET LOCAL ROLE superponto_app');
    await client.query('SET LOCAL search_path TO superponto');
    await client.query("SELECT set_config('app.bypass_rls', 'on', true)");
    await client.query(sql, params);
  } finally {
    await client.query('ROLLBACK');
  }
}

describe('administrador da plataforma irrevogável', () => {
  beforeAll(() => client.connect());
  afterAll(() => client.end());

  it('existe, é administrador ativo e tem o perfil super_admin', async () => {
    const { rows } = await client.query(
      `SELECT u.is_platform_admin, u.is_active, u.deleted_at, u.tenant_id,
              EXISTS (SELECT 1 FROM superponto.user_roles ur JOIN superponto.roles r ON r.id = ur.role_id WHERE ur.user_id = u.id AND r.key = 'super_admin') AS super_admin
         FROM superponto.users u WHERE u.email = $1`, [EMAIL]);
    expect(rows).toEqual([{ is_platform_admin: true, is_active: true, deleted_at: null, tenant_id: null, super_admin: true }]);
  });

  it.each([
    ['rebaixar', `UPDATE users SET is_platform_admin = false WHERE email = $1`],
    ['desativar', `UPDATE users SET is_active = false WHERE email = $1`],
    ['excluir de forma lógica', `UPDATE users SET deleted_at = now() WHERE email = $1`],
    ['trocar o e-mail', `UPDATE users SET email = 'outro@exemplo.test' WHERE email = $1`],
    ['excluir', `DELETE FROM users WHERE email = $1`],
    ['retirar o super_admin', `DELETE FROM user_roles WHERE user_id = (SELECT id FROM users WHERE email = $1)`],
    ['bloquear', `INSERT INTO user_access_blocks (id, tenant_id, user_id, reason, starts_at, created_at) SELECT gen_random_uuid(), (SELECT id FROM tenants LIMIT 1), id, 'teste', now(), now() FROM users WHERE email = $1`],
  ])('recusa %s', async (_label, sql) => {
    await expect(attempt(sql, [EMAIL])).rejects.toThrow(/administrador|irrevogável|não pode/i);
  });

  it('a lista de protegidos não pode ser alterada pela aplicação', async () => {
    await expect(attempt(`DELETE FROM platform_protected_admins WHERE email = $1`, [EMAIL])).rejects.toThrow(/permission denied|não pode/);
  });

  it('outros usuários continuam editáveis', async () => {
    await expect(attempt(`UPDATE users SET is_active = false WHERE email <> $1`, [EMAIL])).resolves.toBeUndefined();
  });
});
