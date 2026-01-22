/**
 * Servidor Backend Alternativo (Node.js/Express)
 * 
 * Use este servidor se não quiser usar Deno/Edge Functions.
 * 
 * Para executar:
 *   npx tsx server/index.ts
 * 
 * Ou compile e execute:
 *   npx tsc server/index.ts --outDir server/dist
 *   node server/dist/index.js
 */

import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.API_PORT || 3001;

// Configuração do pool PostgreSQL
const pool = new Pool({
  connectionString: process.env.SUPABASE_DB_URL || 'postgresql://superponto_user:SuperPonto@2024@localhost:5432/superponto',
});

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'seu_jwt_secret_muito_seguro_aqui';
const JWT_EXPIRES_IN = '7d';

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Middleware de autenticação
interface AuthRequest extends express.Request {
  user?: { id: string; email: string; role: string };
}

const authMiddleware = async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string };
    req.user = decoded;
    
    // Definir usuário atual no PostgreSQL
    await pool.query("SELECT auth.set_current_user($1)", [decoded.id]);
    
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

// ============================================
// Rotas de Autenticação
// ============================================

// Login
app.post('/auth/login', async (req, res) => {
  try {
    const { email, password, company_code } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email e senha são obrigatórios' });
    }

    // Buscar usuário
    const userResult = await pool.query(
      `SELECT u.id, u.email, u.encrypted_password, p.full_name, p.company_id, p.must_change_password
       FROM auth.users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.email = $1`,
      [email.toLowerCase()]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    const user = userResult.rows[0];

    // Verificar senha usando a função do banco
    const passwordResult = await pool.query(
      `SELECT auth.verify_password($1, $2) as valid`,
      [password, user.encrypted_password]
    );

    if (!passwordResult.rows[0].valid) {
      return res.status(401).json({ error: 'Credenciais inválidas' });
    }

    // Se company_code fornecido, verificar
    if (company_code && user.company_id) {
      const companyResult = await pool.query(
        `SELECT id FROM companies WHERE company_code = $1 AND id = $2`,
        [company_code, user.company_id]
      );

      if (companyResult.rows.length === 0) {
        return res.status(401).json({ error: 'Código da empresa inválido' });
      }
    }

    // Buscar roles
    const rolesResult = await pool.query(
      `SELECT role FROM user_roles WHERE user_id = $1`,
      [user.id]
    );

    const roles = rolesResult.rows.map(r => r.role);

    // Gerar token
    const token = jwt.sign(
      { id: user.id, email: user.email, roles },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    // Atualizar último login
    await pool.query(
      `UPDATE auth.users SET last_sign_in_at = NOW() WHERE id = $1`,
      [user.id]
    );

    res.json({
      access_token: token,
      token_type: 'bearer',
      expires_in: 604800, // 7 dias em segundos
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        company_id: user.company_id,
        must_change_password: user.must_change_password,
        roles,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Logout
app.post('/auth/logout', authMiddleware, async (req, res) => {
  // Em uma implementação real, você invalidaria o token
  res.json({ message: 'Logout realizado com sucesso' });
});

// Verificar sessão
app.get('/auth/session', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;

    const profileResult = await pool.query(
      `SELECT p.*, c.name as company_name
       FROM profiles p
       LEFT JOIN companies c ON c.id = p.company_id
       WHERE p.user_id = $1`,
      [user.id]
    );

    if (profileResult.rows.length === 0) {
      return res.status(404).json({ error: 'Perfil não encontrado' });
    }

    res.json({
      user: {
        id: user.id,
        email: user.email,
      },
      profile: profileResult.rows[0],
    });
  } catch (error) {
    console.error('Session error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Alterar senha
app.post('/auth/change-password', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { current_password, new_password } = req.body;
    const userId = req.user!.id;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Senhas são obrigatórias' });
    }

    // Verificar senha atual
    const userResult = await pool.query(
      `SELECT encrypted_password FROM auth.users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const passwordResult = await pool.query(
      `SELECT auth.verify_password($1, $2) as valid`,
      [current_password, userResult.rows[0].encrypted_password]
    );

    if (!passwordResult.rows[0].valid) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }

    // Hash da nova senha
    const hashedPasswordResult = await pool.query(
      `SELECT auth.hash_password($1) as hashed`,
      [new_password]
    );

    // Atualizar senha
    await pool.query(
      `UPDATE auth.users SET encrypted_password = $1, updated_at = NOW() WHERE id = $2`,
      [hashedPasswordResult.rows[0].hashed, userId]
    );

    // Remover flag must_change_password
    await pool.query(
      `UPDATE profiles SET must_change_password = FALSE WHERE user_id = $1`,
      [userId]
    );

    res.json({ message: 'Senha alterada com sucesso' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ============================================
// Rotas das Edge Functions (adaptadas)
// ============================================

// Validate Company Login
app.post('/functions/v1/validate-company-login', async (req, res) => {
  try {
    const { company_code, email } = req.body;

    if (!company_code || !email) {
      return res.status(400).json({ error: 'company_code e email são obrigatórios' });
    }

    const result = await pool.query(
      `SELECT c.id, c.name, c.is_active, p.email as internal_email
       FROM companies c
       LEFT JOIN profiles p ON p.company_id = c.id AND p.email ILIKE $2
       WHERE c.company_code = $1`,
      [company_code, email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Empresa ou usuário não encontrado' });
    }

    const company = result.rows[0];

    if (!company.is_active) {
      return res.status(403).json({ error: 'Empresa inativa' });
    }

    res.json({
      success: true,
      company_id: company.id,
      company_name: company.name,
      internal_email: company.internal_email,
    });
  } catch (error) {
    console.error('Validate company error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// CNPJ Lookup
app.post('/functions/v1/cnpj-lookup', async (req, res) => {
  try {
    const { cnpj } = req.body;

    if (!cnpj) {
      return res.status(400).json({ error: 'CNPJ é obrigatório' });
    }

    // Limpar CNPJ
    const cleanCnpj = cnpj.replace(/\D/g, '');

    // Consultar API externa (ReceitaWS)
    const response = await fetch(`https://receitaws.com.br/v1/cnpj/${cleanCnpj}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      return res.status(404).json({ error: 'CNPJ não encontrado' });
    }

    const data = await response.json();

    res.json({
      cnpj: data.cnpj,
      razao_social: data.nome,
      nome_fantasia: data.fantasia,
      endereco: `${data.logradouro}, ${data.numero}`,
      bairro: data.bairro,
      cidade: data.municipio,
      estado: data.uf,
      cep: data.cep,
      telefone: data.telefone,
      email: data.email,
    });
  } catch (error) {
    console.error('CNPJ lookup error:', error);
    res.status(500).json({ error: 'Erro ao consultar CNPJ' });
  }
});

// Sync Municipal Data
app.post('/functions/v1/sync-municipal-data', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const { company_id, type } = req.body;

    if (!company_id || !type) {
      return res.status(400).json({ error: 'company_id e type são obrigatórios' });
    }

    // Buscar empresa
    const companyResult = await pool.query(
      `SELECT id, name, city, state, parent_organization_id FROM companies WHERE id = $1`,
      [company_id]
    );

    if (companyResult.rows.length === 0) {
      return res.status(404).json({ error: 'Empresa não encontrada' });
    }

    const company = companyResult.rows[0];
    let cityName = company.city || 'Município';
    let stateName = company.state || 'SP';

    // Se for setor, buscar prefeitura pai
    if (company.parent_organization_id) {
      const parentResult = await pool.query(
        `SELECT city, state FROM companies WHERE id = $1`,
        [company.parent_organization_id]
      );
      if (parentResult.rows.length > 0) {
        cityName = parentResult.rows[0].city || cityName;
        stateName = parentResult.rows[0].state || stateName;
      }
    }

    let count = 0;

    if (type === 'schools') {
      // Gerar escolas de exemplo
      const sampleSchools = [
        { name: `EMEI ${cityName} I`, school_type: 'EMEI - Escola Municipal de Educação Infantil' },
        { name: `EMEI ${cityName} II`, school_type: 'EMEI - Escola Municipal de Educação Infantil' },
        { name: `EMEF ${cityName} Central`, school_type: 'EMEF - Escola Municipal de Ensino Fundamental' },
        { name: `CMEI Pequenos Passos`, school_type: 'CMEI - Centro Municipal de Educação Infantil' },
      ];

      for (const school of sampleSchools) {
        const exists = await pool.query(
          `SELECT id FROM schools WHERE company_id = $1 AND name = $2`,
          [company_id, school.name]
        );

        if (exists.rows.length === 0) {
          await pool.query(
            `INSERT INTO schools (company_id, name, school_type, city, state, is_active)
             VALUES ($1, $2, $3, $4, $5, true)`,
            [company_id, school.name, school.school_type, cityName, stateName]
          );
          count++;
        }
      }
    } else if (type === 'health_units') {
      // Gerar unidades de saúde de exemplo
      const sampleUnits = [
        { name: `UBS Central ${cityName}`, unit_type: 'UBS - Unidade Básica de Saúde' },
        { name: `UPA 24h ${cityName}`, unit_type: 'UPA - Unidade de Pronto Atendimento' },
        { name: `Hospital Municipal de ${cityName}`, unit_type: 'Hospital Municipal' },
      ];

      for (const unit of sampleUnits) {
        const exists = await pool.query(
          `SELECT id FROM health_units WHERE company_id = $1 AND name = $2`,
          [company_id, unit.name]
        );

        if (exists.rows.length === 0) {
          await pool.query(
            `INSERT INTO health_units (company_id, name, unit_type, city, state, is_active)
             VALUES ($1, $2, $3, $4, $5, true)`,
            [company_id, unit.name, unit.unit_type, cityName, stateName]
          );
          count++;
        }
      }
    }

    res.json({ success: true, count, message: `${count} registros sincronizados` });
  } catch (error) {
    console.error('Sync municipal data error:', error);
    res.status(500).json({ error: 'Erro ao sincronizar dados' });
  }
});

// ============================================
// Health Check
// ============================================

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// ============================================
// Iniciar Servidor
// ============================================

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════╗
║  SuperPonto - Backend API                     ║
║  Servidor rodando em http://localhost:${PORT}   ║
╚═══════════════════════════════════════════════╝
  `);
});

export default app;
