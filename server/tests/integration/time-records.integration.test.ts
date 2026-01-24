/**
 * Testes de Integração - Registros de Ponto
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import {
  createTestContext,
  cleanupTestData,
  seedTestData,
  TestContext,
  TEST_DB_CONFIG,
} from './setup';

const INTEGRATION_TIMEOUT = 60000;

describe('Time Records Integration Tests', { timeout: INTEGRATION_TIMEOUT }, () => {
  let ctx: TestContext;
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeAll(async () => {
    // Tentar conectar
    try {
      const pool = new Pool(TEST_DB_CONFIG);
      await pool.query('SELECT 1');
      await pool.end();
    } catch {
      throw new Error('Containers de teste não estão rodando. Execute: docker-compose -f server/tests/integration/docker-compose.test.yml up -d');
    }
    
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.cleanup();
  });

  beforeEach(async () => {
    await cleanupTestData(ctx.pool);
    testData = await seedTestData(ctx.pool);
  });

  describe('Time Record Creation', () => {
    it('should create entry record', async () => {
      const result = await ctx.pool.query(`
        INSERT INTO time_records (profile_id, record_time, record_type, source)
        VALUES ($1, NOW(), 'entry', 'web')
        RETURNING id, record_type
      `, [testData.profile.id]);
      
      expect(result.rows[0].record_type).toBe('entry');
    });

    it('should create exit record', async () => {
      const result = await ctx.pool.query(`
        INSERT INTO time_records (profile_id, record_time, record_type, source)
        VALUES ($1, NOW(), 'exit', 'web')
        RETURNING id, record_type
      `, [testData.profile.id]);
      
      expect(result.rows[0].record_type).toBe('exit');
    });

    it('should support geolocation', async () => {
      const result = await ctx.pool.query(`
        INSERT INTO time_records (profile_id, record_time, record_type, latitude, longitude)
        VALUES ($1, NOW(), 'entry', -23.550520, -46.633308)
        RETURNING latitude, longitude
      `, [testData.profile.id]);
      
      expect(parseFloat(result.rows[0].latitude)).toBeCloseTo(-23.550520, 5);
      expect(parseFloat(result.rows[0].longitude)).toBeCloseTo(-46.633308, 5);
    });

    it('should track source of record', async () => {
      const sources = ['web', 'mobile', 'equipment', 'manual'];
      
      for (const source of sources) {
        await ctx.pool.query(`
          INSERT INTO time_records (profile_id, record_time, record_type, source)
          VALUES ($1, NOW(), 'entry', $2)
        `, [testData.profile.id, source]);
      }
      
      const result = await ctx.pool.query(`
        SELECT DISTINCT source FROM time_records WHERE profile_id = $1
      `, [testData.profile.id]);
      
      expect(result.rows.length).toBe(4);
    });
  });

  describe('Time Record Queries', () => {
    beforeEach(async () => {
      // Criar registros de exemplo
      await ctx.pool.query(`
        INSERT INTO time_records (profile_id, record_time, record_type, source)
        VALUES 
          ($1, NOW() - INTERVAL '8 hours', 'entry', 'web'),
          ($1, NOW() - INTERVAL '4 hours', 'exit', 'web'),
          ($1, NOW() - INTERVAL '3 hours', 'entry', 'web'),
          ($1, NOW(), 'exit', 'web')
      `, [testData.profile.id]);
    });

    it('should get records for specific date range', async () => {
      const result = await ctx.pool.query(`
        SELECT * FROM time_records 
        WHERE profile_id = $1 
          AND record_time >= NOW() - INTERVAL '1 day'
        ORDER BY record_time
      `, [testData.profile.id]);
      
      expect(result.rows.length).toBe(4);
    });

    it('should get records grouped by type', async () => {
      const result = await ctx.pool.query(`
        SELECT record_type, COUNT(*) as count
        FROM time_records 
        WHERE profile_id = $1
        GROUP BY record_type
      `, [testData.profile.id]);
      
      const counts = result.rows.reduce((acc, row) => {
        acc[row.record_type] = parseInt(row.count);
        return acc;
      }, {} as Record<string, number>);
      
      expect(counts.entry).toBe(2);
      expect(counts.exit).toBe(2);
    });

    it('should calculate worked hours', async () => {
      const result = await ctx.pool.query(`
        WITH paired_records AS (
          SELECT 
            record_time,
            record_type,
            LEAD(record_time) OVER (ORDER BY record_time) as next_time,
            LEAD(record_type) OVER (ORDER BY record_time) as next_type
          FROM time_records
          WHERE profile_id = $1
        )
        SELECT 
          SUM(EXTRACT(EPOCH FROM (next_time - record_time)) / 3600) as total_hours
        FROM paired_records
        WHERE record_type = 'entry' AND next_type = 'exit'
      `, [testData.profile.id]);
      
      expect(parseFloat(result.rows[0].total_hours)).toBeGreaterThan(0);
    });
  });

  describe('Data Integrity', () => {
    it('should not allow records for non-existent profile', async () => {
      const fakeProfileId = '00000000-0000-0000-0000-000000000000';
      
      await expect(
        ctx.pool.query(`
          INSERT INTO time_records (profile_id, record_time, record_type)
          VALUES ($1, NOW(), 'entry')
        `, [fakeProfileId])
      ).rejects.toThrow();
    });

    it('should delete records when profile is deleted', async () => {
      await ctx.pool.query(`
        INSERT INTO time_records (profile_id, record_time, record_type)
        VALUES ($1, NOW(), 'entry')
      `, [testData.profile.id]);
      
      // Deletar o profile (que deve cascatear para time_records)
      await ctx.pool.query('DELETE FROM profiles WHERE id = $1', [testData.profile.id]);
      
      const result = await ctx.pool.query(
        'SELECT * FROM time_records WHERE profile_id = $1',
        [testData.profile.id]
      );
      
      expect(result.rows.length).toBe(0);
    });
  });
});
