// No Supabase, a API REST pública age como `anon`/`authenticated`. O esquema da v2 não pode ser
// alcançado por eles — nem tabelas de dados, nem sessões e tokens de autenticação.
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ownerUrl } from './helpers.js';

const client = new pg.Client({ connectionString: ownerUrl });

describe('esquema superponto fechado para os papéis públicos do Supabase', () => {
  beforeAll(() => client.connect());
  afterAll(() => client.end());

  for (const role of ['anon', 'authenticated']) {
    for (const table of ['auth_sessions', 'auth_refresh_tokens', 'users', 'companies', 'time_records']) {
      it(`${role} não lê superponto.${table}`, async () => {
        await client.query('BEGIN');
        try {
          await client.query(`SET LOCAL ROLE ${role}`);
          await expect(client.query(`SELECT 1 FROM superponto.${table} LIMIT 1`)).rejects.toThrow(/permission denied/);
        } finally {
          await client.query('ROLLBACK');
        }
      });
    }
  }
});
