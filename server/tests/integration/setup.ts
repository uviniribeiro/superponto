/**
 * Setup para testes de integração com containers Docker
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { Pool } from 'pg';
import path from 'path';

const execAsync = promisify(exec);

export interface TestContext {
  pool: Pool;
  cleanup: () => Promise<void>;
}

// Configurações do banco de teste
export const TEST_DB_CONFIG = {
  host: process.env.TEST_DB_HOST || 'localhost',
  port: parseInt(process.env.TEST_DB_PORT || '5433'),
  database: process.env.TEST_DB_NAME || 'superponto_test',
  user: process.env.TEST_DB_USER || 'test_user',
  password: process.env.TEST_DB_PASSWORD || 'test_password',
};

/**
 * Inicia os containers de teste
 */
export async function startTestContainers(): Promise<void> {
  const composePath = path.join(__dirname, 'docker-compose.test.yml');
  
  console.log('🐳 Iniciando containers de teste...');
  
  try {
    await execAsync(`docker-compose -f ${composePath} up -d`);
    
    // Aguardar containers ficarem saudáveis
    let retries = 30;
    while (retries > 0) {
      try {
        const pool = new Pool(TEST_DB_CONFIG);
        await pool.query('SELECT 1');
        await pool.end();
        console.log('✅ Containers prontos!');
        return;
      } catch {
        retries--;
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    throw new Error('Timeout aguardando containers');
  } catch (error) {
    console.error('❌ Erro ao iniciar containers:', error);
    throw error;
  }
}

/**
 * Para e remove os containers de teste
 */
export async function stopTestContainers(): Promise<void> {
  const composePath = path.join(__dirname, 'docker-compose.test.yml');
  
  console.log('🛑 Parando containers de teste...');
  
  try {
    await execAsync(`docker-compose -f ${composePath} down -v --remove-orphans`);
    console.log('✅ Containers removidos!');
  } catch (error) {
    console.error('❌ Erro ao parar containers:', error);
  }
}

/**
 * Cria o contexto de teste com conexão ao banco
 */
export async function createTestContext(): Promise<TestContext> {
  const pool = new Pool(TEST_DB_CONFIG);
  
  // Executar migrations
  await runTestMigrations(pool);
  
  return {
    pool,
    cleanup: async () => {
      await pool.end();
    },
  };
}

/**
 * Executa as migrations no banco de teste
 */
async function runTestMigrations(pool: Pool): Promise<void> {
  // Criar extensões necessárias
  await pool.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  await pool.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  
  // Criar schema auth simulado
  await pool.query(`
    CREATE SCHEMA IF NOT EXISTS auth;
    
    CREATE TABLE IF NOT EXISTS auth.users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      email VARCHAR(255) UNIQUE NOT NULL,
      encrypted_password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      last_sign_in_at TIMESTAMP WITH TIME ZONE,
      email_confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
  
  // Criar tabelas principais
  await pool.query(`
    CREATE TABLE IF NOT EXISTS companies (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name VARCHAR(255) NOT NULL,
      company_code VARCHAR(50) UNIQUE NOT NULL,
      cnpj VARCHAR(20),
      sector VARCHAR(100),
      organization_type VARCHAR(50) DEFAULT 'company',
      is_active BOOLEAN DEFAULT TRUE,
      teacher_module_enabled BOOLEAN DEFAULT FALSE,
      doctor_module_enabled BOOLEAN DEFAULT FALSE,
      payroll_module_enabled BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    CREATE TABLE IF NOT EXISTS profiles (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255),
      cpf VARCHAR(14),
      pis VARCHAR(20),
      registration_number VARCHAR(50),
      department VARCHAR(100),
      position VARCHAR(100),
      hire_date DATE,
      is_active BOOLEAN DEFAULT TRUE,
      company_id UUID REFERENCES companies(id),
      phone VARCHAR(20),
      photo_url TEXT,
      must_change_password BOOLEAN DEFAULT FALSE,
      two_factor_enabled BOOLEAN DEFAULT FALSE,
      two_factor_secret TEXT,
      backup_codes TEXT[],
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    CREATE TABLE IF NOT EXISTS user_roles (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      role VARCHAR(50) NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    
    CREATE TABLE IF NOT EXISTS user_sessions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
      refresh_token_hash VARCHAR(255),
      user_agent TEXT,
      ip_address VARCHAR(50),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      expires_at TIMESTAMP WITH TIME ZONE
    );
    
    CREATE TABLE IF NOT EXISTS time_records (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
      record_time TIMESTAMP WITH TIME ZONE NOT NULL,
      record_type VARCHAR(20) NOT NULL,
      source VARCHAR(50) DEFAULT 'web',
      latitude DECIMAL(10, 8),
      longitude DECIMAL(11, 8),
      photo_url TEXT,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
  `);
  
  console.log('✅ Migrations de teste executadas!');
}

/**
 * Limpa todos os dados do banco de teste
 */
export async function cleanupTestData(pool: Pool): Promise<void> {
  await pool.query(`
    TRUNCATE TABLE time_records CASCADE;
    TRUNCATE TABLE user_sessions CASCADE;
    TRUNCATE TABLE user_roles CASCADE;
    TRUNCATE TABLE profiles CASCADE;
    TRUNCATE TABLE auth.users CASCADE;
    TRUNCATE TABLE companies CASCADE;
  `);
}

/**
 * Cria dados de teste padrão
 */
export async function seedTestData(pool: Pool): Promise<{
  company: { id: string; code: string };
  user: { id: string; email: string };
  profile: { id: string };
}> {
  // Criar empresa
  const companyResult = await pool.query(`
    INSERT INTO companies (name, company_code, cnpj)
    VALUES ('Empresa Teste', 'TESTE001', '12345678000190')
    RETURNING id, company_code
  `);
  const company = { id: companyResult.rows[0].id, code: companyResult.rows[0].company_code };
  
  // Criar usuário
  const hashedPassword = '$2a$10$abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRS'; // hash de 'senha123'
  const userResult = await pool.query(`
    INSERT INTO auth.users (email, encrypted_password)
    VALUES ('teste@empresa.local', $1)
    RETURNING id, email
  `, [hashedPassword]);
  const user = { id: userResult.rows[0].id, email: userResult.rows[0].email };
  
  // Criar perfil
  const profileResult = await pool.query(`
    INSERT INTO profiles (user_id, full_name, email, company_id)
    VALUES ($1, 'Usuário Teste', 'teste@empresa.local', $2)
    RETURNING id
  `, [user.id, company.id]);
  const profile = { id: profileResult.rows[0].id };
  
  // Atribuir role
  await pool.query(`
    INSERT INTO user_roles (user_id, role)
    VALUES ($1, 'employee')
  `, [user.id]);
  
  return { company, user, profile };
}
