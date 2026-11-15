import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().default(3000),
  /** Conexão da API: papel `superponto_app` (sujeito à RLS). */
  DATABASE_URL: z.string().min(1),
  /** URL pública do app web (links de e-mail e origem confiável). */
  APP_URL: z.url().default('http://localhost:3001'),
  API_URL: z.url().default('http://localhost:3000'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET precisa de ao menos 32 caracteres'),
  /** Chave AES-256-GCM (base64, 32 bytes) para cifrar segredos de MFA. */
  MFA_ENCRYPTION_KEY: z.string().min(40),
  /** Chave AES-256-GCM (base64, 32 bytes) para cifrar digitais. Sem ela, o cadastro de digitais fica desativado. */
  BIOMETRIC_ENCRYPTION_KEY: z.string().min(40).optional(),
  /**
   * Caixa de e-mail do suporte. Cada cliente ganha um usuário de suporte/treinamento com
   * endereço "suporte+<identificador>@dominio" (o e-mail cai nesta mesma caixa).
   */
  SUPPORT_EMAIL: z.email().default('suporte@superponto.local'),
  MAIL_TRANSPORT: z.enum(['smtp', 'memory']).default('memory'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('SuperPonto <nao-responda@superponto.local>'),
  CORS_ORIGINS: z.string().default(''),
});

export type AppConfig = z.infer<typeof schema>;

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Configuração inválida: ${issues}`);
  }
  if (parsed.data.NODE_ENV === 'production' && parsed.data.MAIL_TRANSPORT === 'memory') {
    throw new Error('Configuração inválida: MAIL_TRANSPORT=memory não é permitido em produção');
  }
  return parsed.data;
}

export const APP_CONFIG = Symbol('APP_CONFIG');
