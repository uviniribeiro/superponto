import { afterAll, describe, expect, it } from 'vitest';
import postgres from 'postgres';

const connection = process.env.SUPABASE_DB_URL;
const sql = connection ? postgres(connection, { max: 1, connect_timeout: 15, onnotice: () => {} }) : null;

afterAll(async () => { await sql?.end(); });

describe.skipIf(!sql)('Existing login and company protection', () => {
  it('snapshots all 28 existing profiles and 11 existing companies', async () => {
    if (!sql) throw new Error('Database connection required');
    const [row] = await sql`select
      (select count(*)::int from private.locked_profile_logins) as profiles,
      (select count(*)::int from private.locked_companies) as companies`;
    expect(row.profiles).toBe(28);
    expect(row.companies).toBe(11);
  });

  it('rejects changes to existing profile email without retaining any writes', async () => {
    if (!sql) throw new Error('Database connection required');
    await expect(sql.begin(async tx => {
      await tx`update public.profiles set email = 'blocked-change@example.invalid'
        where id = (select profile_id from private.locked_profile_logins limit 1)`;
      throw new Error('Unexpectedly allowed email change');
    })).rejects.toMatchObject({ code: '23514' });
  });

  it('rejects changes to existing profile company association', async () => {
    if (!sql) throw new Error('Database connection required');
    await expect(sql.begin(async tx => {
      await tx`update public.profiles set company_id =
        (select c.id from public.companies c where c.id is distinct from profiles.company_id limit 1)
        where id = (select profile_id from private.locked_profile_logins limit 1)`;
      throw new Error('Unexpectedly allowed company change');
    })).rejects.toMatchObject({ code: '23514' });
  });

  it('rejects edits to existing companies', async () => {
    if (!sql) throw new Error('Database connection required');
    await expect(sql.begin(async tx => {
      await tx`update public.companies set name = name || ' changed'
        where id = (select company_id from private.locked_companies limit 1)`;
      throw new Error('Unexpectedly allowed company edit');
    })).rejects.toMatchObject({ code: '23514' });
  });

  it('allows login recovery counters without changing identifiers', async () => {
    if (!sql) throw new Error('Database connection required');
    const rollback = new Error('Intentional test rollback');
    await expect(sql.begin(async tx => {
      const rows = await tx`update public.profiles set failed_login_attempts = 0, locked_until = null
        where id = (select profile_id from private.locked_profile_logins limit 1)
        returning id`;
      expect(rows.length).toBe(1);
      throw rollback;
    })).rejects.toBe(rollback);
  });
});