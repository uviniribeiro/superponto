/**
 * Servidor Backend com Autenticação JWT Completa
 * Suporte a Refresh Tokens e Logout Seguro
 */

import express from 'express';
import cors from 'cors';
import { Pool } from 'pg';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import crypto from 'crypto';

// Carregar variáveis de ambiente
dotenv.config({ path: '.env.local' });

const app = express();
const PORT = process.env.API_PORT || 3001;

// Configuração do pool PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.SUPABASE_DB_URL || 'postgresql://superponto:SuperPonto@2024@localhost:5432/superponto',
});

// JWT Configuration — os segredos são obrigatórios e não possuem valor padrão.
const PLACEHOLDER_SECRETS = new Set([
  'seu_jwt_secret_muito_seguro_aqui',
  'seu_refresh_secret_muito_seguro_aqui',
  'changeme',
]);

function requireSecret(name: string): string {
  const value = process.env[name];
  if (!value || value.trim().length < 32 || PLACEHOLDER_SECRETS.has(value.trim())) {
    console.error(
      `[FATAL] A variável de ambiente ${name} não está configurada com um valor aleatório forte (mínimo 32 caracteres). ` +
      `Gere um segredo com: openssl rand -base64 48`
    );
    process.exit(1);
  }
  return value.trim();
}

const JWT_SECRET = requireSecret('JWT_SECRET');
const JWT_REFRESH_SECRET = requireSecret('JWT_REFRESH_SECRET');

const JWT_EXPIRES_IN = '15m'; // Access token expira em 15 minutos
const JWT_REFRESH_EXPIRES_IN = '7d'; // Refresh token expira em 7 dias

// In-memory store para tokens invalidados (em produção, use Redis)
const invalidatedTokens = new Set<string>();
const refreshTokenStore = new Map<string, { userId: string; expiresAt: Date; family: string }>();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));
app.use(express.json());

// Types
interface AuthRequest extends express.Request {
  user?: { id: string; email: string; roles: string[] };
}

interface TokenPayload {
  id: string;
  email: string;
  roles: string[];
  type: 'access' | 'refresh';
  jti?: string; // JWT ID for refresh token tracking
  family?: string; // Token family for rotation
}

// ============================================
// Utility Functions
// ============================================

function generateTokenId(): string {
  return crypto.randomBytes(32).toString('hex');
}

function generateTokenFamily(): string {
  return crypto.randomBytes(16).toString('hex');
}

function generateAccessToken(payload: Omit<TokenPayload, 'type'>): string {
  return jwt.sign(
    { ...payload, type: 'access' },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

function generateRefreshToken(payload: Omit<TokenPayload, 'type'>): string {
  const jti = generateTokenId();
  const family = payload.family || generateTokenFamily();
  
  const token = jwt.sign(
    { ...payload, type: 'refresh', jti, family },
    JWT_REFRESH_SECRET,
    { expiresIn: JWT_REFRESH_EXPIRES_IN }
  );

  // Armazenar refresh token
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);
  refreshTokenStore.set(jti, { userId: payload.id, expiresAt, family });

  return token;
}

function verifyAccessToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    if (decoded.type !== 'access') return null;
    if (invalidatedTokens.has(token)) return null;
    return decoded;
  } catch {
    return null;
  }
}

function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
    if (decoded.type !== 'refresh') return null;
    if (!decoded.jti) return null;
    
    const storedToken = refreshTokenStore.get(decoded.jti);
    if (!storedToken) return null;
    if (storedToken.expiresAt < new Date()) {
      refreshTokenStore.delete(decoded.jti);
      return null;
    }
    
    return decoded;
  } catch {
    return null;
  }
}

function invalidateRefreshTokenFamily(family: string): void {
  for (const [jti, data] of refreshTokenStore.entries()) {
    if (data.family === family) {
      refreshTokenStore.delete(jti);
    }
  }
}

// ============================================
// Auth Middleware
// ============================================

const authMiddleware = async (req: AuthRequest, res: express.Response, next: express.NextFunction) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token não fornecido' });
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyAccessToken(token);

  if (!payload) {
    return res.status(401).json({ error: 'Token inválido ou expirado', code: 'TOKEN_EXPIRED' });
  }

  req.user = { id: payload.id, email: payload.email, roles: payload.roles };
  
  try {
    await pool.query("SELECT set_config('app.current_user_id', $1, true)", [payload.id]);
    next();
  } catch (error) {
    console.error('Error setting user context:', error);
    next();
  }
};

// ============================================
// Auth Routes
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

    // Verificar senha
    const isValidPassword = await bcrypt.compare(password, user.encrypted_password);
    if (!isValidPassword) {
      // Tentar verificar usando função do banco (compatibilidade)
      try {
        const passwordResult = await pool.query(
          `SELECT auth.verify_password($1, $2) as valid`,
          [password, user.encrypted_password]
        );
        if (!passwordResult.rows[0]?.valid) {
          return res.status(401).json({ error: 'Credenciais inválidas' });
        }
      } catch {
        return res.status(401).json({ error: 'Credenciais inválidas' });
      }
    }

    // Verificar company_code se fornecido
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

    // Gerar tokens
    const tokenPayload = { id: user.id, email: user.email, roles };
    const accessToken = generateAccessToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Atualizar último login
    await pool.query(
      `UPDATE auth.users SET last_sign_in_at = NOW() WHERE id = $1`,
      [user.id]
    );

    // Registrar sessão
    await pool.query(
      `INSERT INTO user_sessions (user_id, refresh_token_hash, user_agent, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')
       ON CONFLICT DO NOTHING`,
      [user.id, crypto.createHash('sha256').update(refreshToken).digest('hex'), 
       req.headers['user-agent'], req.ip]
    ).catch(() => {}); // Ignorar se tabela não existir

    res.json({
      access_token: accessToken,
      refresh_token: refreshToken,
      token_type: 'bearer',
      expires_in: 900, // 15 minutos em segundos
      refresh_expires_in: 604800, // 7 dias em segundos
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

// Refresh Token
app.post('/auth/refresh', async (req, res) => {
  try {
    const { refresh_token } = req.body;

    if (!refresh_token) {
      return res.status(400).json({ error: 'Refresh token é obrigatório' });
    }

    const payload = verifyRefreshToken(refresh_token);
    if (!payload || !payload.jti || !payload.family) {
      return res.status(401).json({ error: 'Refresh token inválido ou expirado' });
    }

    // Invalidar o refresh token usado (rotation)
    refreshTokenStore.delete(payload.jti);

    // Verificar se usuário ainda existe e está ativo
    const userResult = await pool.query(
      `SELECT u.id, u.email, p.is_active
       FROM auth.users u
       LEFT JOIN profiles p ON p.user_id = u.id
       WHERE u.id = $1`,
      [payload.id]
    );

    if (userResult.rows.length === 0 || !userResult.rows[0].is_active) {
      invalidateRefreshTokenFamily(payload.family);
      return res.status(401).json({ error: 'Usuário não encontrado ou inativo' });
    }

    // Buscar roles atualizados
    const rolesResult = await pool.query(
      `SELECT role FROM user_roles WHERE user_id = $1`,
      [payload.id]
    );
    const roles = rolesResult.rows.map(r => r.role);

    // Gerar novos tokens (mantendo a família)
    const newPayload = { id: payload.id, email: payload.email, roles, family: payload.family };
    const newAccessToken = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    res.json({
      access_token: newAccessToken,
      refresh_token: newRefreshToken,
      token_type: 'bearer',
      expires_in: 900,
      refresh_expires_in: 604800,
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Logout
app.post('/auth/logout', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.split(' ')[1];
    const { refresh_token, logout_all } = req.body;

    // Invalidar access token atual
    if (accessToken) {
      invalidatedTokens.add(accessToken);
      // Limpar após expiração (15 minutos)
      setTimeout(() => invalidatedTokens.delete(accessToken), 15 * 60 * 1000);
    }

    // Invalidar refresh token específico ou todos
    if (refresh_token) {
      const payload = verifyRefreshToken(refresh_token);
      if (payload?.jti) {
        if (logout_all && payload.family) {
          // Invalidar toda a família de tokens (logout de todos dispositivos)
          invalidateRefreshTokenFamily(payload.family);
          
          // Limpar sessões do banco
          await pool.query(
            `DELETE FROM user_sessions WHERE user_id = $1`,
            [req.user!.id]
          ).catch(() => {});
        } else {
          refreshTokenStore.delete(payload.jti);
        }
      }
    }

    res.json({ message: 'Logout realizado com sucesso' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Logout de todos os dispositivos
app.post('/auth/logout-all', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id;

    // Invalidar todos os refresh tokens do usuário
    for (const [jti, data] of refreshTokenStore.entries()) {
      if (data.userId === userId) {
        refreshTokenStore.delete(jti);
      }
    }

    // Limpar sessões do banco
    await pool.query(
      `DELETE FROM user_sessions WHERE user_id = $1`,
      [userId]
    ).catch(() => {});

    res.json({ message: 'Logout de todos os dispositivos realizado com sucesso' });
  } catch (error) {
    console.error('Logout all error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
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
        roles: user.roles,
      },
      profile: profileResult.rows[0],
    });
  } catch (error) {
    console.error('Session error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Listar sessões ativas
app.get('/auth/sessions', authMiddleware, async (req: AuthRequest, res) => {
  try {
    const result = await pool.query(
      `SELECT id, user_agent, ip_address, created_at, last_used_at, expires_at
       FROM user_sessions
       WHERE user_id = $1 AND expires_at > NOW()
       ORDER BY last_used_at DESC`,
      [req.user!.id]
    );

    res.json({ sessions: result.rows });
  } catch (error) {
    // Se tabela não existir, retornar lista vazia
    res.json({ sessions: [] });
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

    if (new_password.length < 8) {
      return res.status(400).json({ error: 'Nova senha deve ter no mínimo 8 caracteres' });
    }

    // Verificar senha atual
    const userResult = await pool.query(
      `SELECT encrypted_password FROM auth.users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const isValidPassword = await bcrypt.compare(current_password, userResult.rows[0].encrypted_password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Senha atual incorreta' });
    }

    // Hash da nova senha
    const hashedPassword = await bcrypt.hash(new_password, 10);

    // Atualizar senha
    await pool.query(
      `UPDATE auth.users SET encrypted_password = $1, updated_at = NOW() WHERE id = $2`,
      [hashedPassword, userId]
    );

    // Remover flag must_change_password
    await pool.query(
      `UPDATE profiles SET must_change_password = FALSE WHERE user_id = $1`,
      [userId]
    );

    // Invalidar todos os refresh tokens (forçar relogin em outros dispositivos)
    for (const [jti, data] of refreshTokenStore.entries()) {
      if (data.userId === userId) {
        refreshTokenStore.delete(jti);
      }
    }

    res.json({ message: 'Senha alterada com sucesso' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// ============================================
// Edge Functions Adaptadas
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

    const cleanCnpj = cnpj.replace(/\D/g, '');

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

// ============================================
// Health Check
// ============================================

app.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ 
      status: 'ok', 
      database: 'connected',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'error', 
      database: 'disconnected',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ============================================
// Iniciar Servidor
// ============================================

app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  SuperPonto - Backend API                                 ║
║  Servidor rodando em http://localhost:${PORT}               ║
║                                                           ║
║  Recursos:                                                ║
║  • JWT com Access/Refresh Tokens                          ║
║  • Token Rotation para segurança                          ║
║  • Logout seguro (single e all devices)                   ║
║  • Sessões rastreáveis                                    ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export default app;
