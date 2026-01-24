/**
 * Testes de Integração - Autenticação
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import {
  startTestContainers,
  stopTestContainers,
  createTestContext,
  cleanupTestData,
  seedTestData,
  TestContext,
  TEST_DB_CONFIG,
} from './setup';

// Configuração para testes longos
const INTEGRATION_TIMEOUT = 60000;

describe('Auth Integration Tests', { timeout: INTEGRATION_TIMEOUT }, () => {
  let ctx: TestContext;
  let testData: Awaited<ReturnType<typeof seedTestData>>;

  beforeAll(async () => {
    // Verificar se containers estão rodando
    try {
      const pool = new Pool(TEST_DB_CONFIG);
      await pool.query('SELECT 1');
      await pool.end();
    } catch {
      // Se não estiver rodando, iniciar
      await startTestContainers();
    }
    
    ctx = await createTestContext();
  });

  afterAll(async () => {
    await ctx.cleanup();
    // Não paramos os containers automaticamente para reutilização
  });

  beforeEach(async () => {
    await cleanupTestData(ctx.pool);
    testData = await seedTestData(ctx.pool);
  });

  describe('User Creation', () => {
    it('should create a new user with hashed password', async () => {
      const password = 'novaSenha123';
      const hashedPassword = await bcrypt.hash(password, 10);
      
      const result = await ctx.pool.query(`
        INSERT INTO auth.users (email, encrypted_password)
        VALUES ('novo@teste.com', $1)
        RETURNING id, email
      `, [hashedPassword]);
      
      expect(result.rows[0].email).toBe('novo@teste.com');
      expect(result.rows[0].id).toBeDefined();
    });

    it('should not allow duplicate emails', async () => {
      const hashedPassword = await bcrypt.hash('senha123', 10);
      
      await expect(
        ctx.pool.query(`
          INSERT INTO auth.users (email, encrypted_password)
          VALUES ('teste@empresa.local', $1)
        `, [hashedPassword])
      ).rejects.toThrow();
    });
  });

  describe('Profile Management', () => {
    it('should create profile linked to user', async () => {
      const result = await ctx.pool.query(`
        SELECT p.*, u.email as user_email
        FROM profiles p
        JOIN auth.users u ON u.id = p.user_id
        WHERE p.id = $1
      `, [testData.profile.id]);
      
      expect(result.rows[0].full_name).toBe('Usuário Teste');
      expect(result.rows[0].company_id).toBe(testData.company.id);
    });

    it('should cascade delete profile when user is deleted', async () => {
      await ctx.pool.query('DELETE FROM auth.users WHERE id = $1', [testData.user.id]);
      
      const result = await ctx.pool.query(
        'SELECT * FROM profiles WHERE user_id = $1',
        [testData.user.id]
      );
      
      expect(result.rows.length).toBe(0);
    });
  });

  describe('Roles', () => {
    it('should assign roles to users', async () => {
      await ctx.pool.query(`
        INSERT INTO user_roles (user_id, role)
        VALUES ($1, 'admin')
      `, [testData.user.id]);
      
      const result = await ctx.pool.query(`
        SELECT role FROM user_roles WHERE user_id = $1
      `, [testData.user.id]);
      
      const roles = result.rows.map(r => r.role);
      expect(roles).toContain('employee');
      expect(roles).toContain('admin');
    });

    it('should support multiple roles per user', async () => {
      await ctx.pool.query(`
        INSERT INTO user_roles (user_id, role)
        VALUES ($1, 'admin'), ($1, 'manager')
      `, [testData.user.id]);
      
      const result = await ctx.pool.query(`
        SELECT COUNT(*) as count FROM user_roles WHERE user_id = $1
      `, [testData.user.id]);
      
      expect(parseInt(result.rows[0].count)).toBe(3); // employee + admin + manager
    });
  });

  describe('Sessions', () => {
    it('should create user session', async () => {
      const refreshTokenHash = 'test_token_hash_12345';
      
      const result = await ctx.pool.query(`
        INSERT INTO user_sessions (user_id, refresh_token_hash, user_agent, ip_address, expires_at)
        VALUES ($1, $2, 'Test Agent', '127.0.0.1', NOW() + INTERVAL '7 days')
        RETURNING id
      `, [testData.user.id, refreshTokenHash]);
      
      expect(result.rows[0].id).toBeDefined();
    });

    it('should delete sessions on user delete', async () => {
      await ctx.pool.query(`
        INSERT INTO user_sessions (user_id, refresh_token_hash, expires_at)
        VALUES ($1, 'test_hash', NOW() + INTERVAL '7 days')
      `, [testData.user.id]);
      
      await ctx.pool.query('DELETE FROM auth.users WHERE id = $1', [testData.user.id]);
      
      const result = await ctx.pool.query(
        'SELECT * FROM user_sessions WHERE user_id = $1',
        [testData.user.id]
      );
      
      expect(result.rows.length).toBe(0);
    });
  });

  describe('Password Verification', () => {
    it('should verify correct password', async () => {
      const password = 'senhaCorreta123';
      const hashedPassword = await bcrypt.hash(password, 10);
      
      await ctx.pool.query(`
        UPDATE auth.users SET encrypted_password = $1 WHERE id = $2
      `, [hashedPassword, testData.user.id]);
      
      const result = await ctx.pool.query(`
        SELECT encrypted_password FROM auth.users WHERE id = $1
      `, [testData.user.id]);
      
      const isValid = await bcrypt.compare(password, result.rows[0].encrypted_password);
      expect(isValid).toBe(true);
    });

    it('should reject incorrect password', async () => {
      const password = 'senhaCorreta123';
      const hashedPassword = await bcrypt.hash(password, 10);
      
      await ctx.pool.query(`
        UPDATE auth.users SET encrypted_password = $1 WHERE id = $2
      `, [hashedPassword, testData.user.id]);
      
      const result = await ctx.pool.query(`
        SELECT encrypted_password FROM auth.users WHERE id = $1
      `, [testData.user.id]);
      
      const isValid = await bcrypt.compare('senhaErrada', result.rows[0].encrypted_password);
      expect(isValid).toBe(false);
    });
  });
});
