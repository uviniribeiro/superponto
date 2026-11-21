#!/usr/bin/env node
/**
 * Configuração automática do projeto Supabase do PontoMax (usado pelo GitHub Actions).
 * Só usa a API de gerenciamento do Supabase e a API do próprio projeto; sem dependências.
 *
 *   node scripts/deploy/supabase-setup.mjs keys      -> exporta as chaves para os próximos passos
 *   node scripts/deploy/supabase-setup.mjs auth      -> URL do site, links de recuperação e SMTP
 *   node scripts/deploy/supabase-setup.mjs admin     -> garante o Super Admin (SUPER_ADMIN_EMAIL)
 *
 * Variáveis: SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, SITE_URL, SUPER_ADMIN_EMAIL,
 * SUPER_ADMIN_ONLY (padrão "true": remove o papel super_admin de qualquer outra conta),
 * SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_SENDER_EMAIL, SMTP_SENDER_NAME (opcionais).
 */
import { appendFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

const MGMT = 'https://api.supabase.com/v1';
const env = (name, fallback = '') => (process.env[name]?.trim() || fallback);
const ref = env('SUPABASE_PROJECT_REF');
const token = env('SUPABASE_ACCESS_TOKEN');
// SUPABASE_URL/ANON_KEY/SERVICE_ROLE_KEY permitem usar o comando admin com outra instância (ex.: VPS).
const projectUrl = env('SUPABASE_URL') || `https://${ref}.supabase.co`;

function fail(message) {
  console.error(`::error::${message}`);
  process.exit(1);
}

async function request(url, { method = 'GET', headers = {}, body } = {}) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    const detail = typeof data === 'string' ? data.slice(0, 300) : JSON.stringify(data).slice(0, 300);
    throw new Error(`${method} ${url.replace(/\?.*/, '')} -> HTTP ${res.status}: ${detail}`);
  }
  return data;
}

const mgmt = (path, opts = {}) =>
  request(`${MGMT}${path}`, { ...opts, headers: { Authorization: `Bearer ${token}`, ...(opts.headers ?? {}) } });

/** Chaves legadas (JWT) anon e service_role: usadas pelo app, pelas funções e pelo agendador. */
export async function getKeys() {
  if (env('ANON_KEY') && env('SERVICE_ROLE_KEY')) return { anon: env('ANON_KEY'), service: env('SERVICE_ROLE_KEY') };
  const keys = await mgmt(`/projects/${ref}/api-keys?reveal=true`);
  const find = (name) => keys.find((k) => k.name === name && k.api_key)?.api_key;
  const anon = find('anon');
  const service = find('service_role');
  if (!anon || !service) {
    fail('Chaves legadas (anon/service_role) indisponíveis. No Supabase: Project Settings > API Keys > Legacy API keys > Enable.');
  }
  return { anon, service };
}

function output(name, value, secret = false) {
  if (secret) console.log(`::add-mask::${value}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
}

async function cmdKeys() {
  const { anon, service } = await getKeys();
  output('anon_key', anon, false);
  output('service_role_key', service, true);
  output('supabase_url', projectUrl);
  console.log(`Projeto ${ref}: chaves obtidas.`);
}

/** "Esqueci minha senha": endereço do site, links de retorno permitidos e servidor de e-mail. */
async function cmdAuth() {
  const site = env('SITE_URL').replace(/\/+$/, '');
  if (!/^https:\/\//.test(site)) fail('SITE_URL ausente ou sem https://');

  const config = {
    site_url: site,
    uri_allow_list: [`${site}/**`, 'https://localhost/**', 'capacitor://localhost/**'].join(','),
    // Contas internas (usuario@empresa.pontomax.local) não recebem e-mail: confirmação automática.
    mailer_autoconfirm: true,
    external_email_enabled: true,
    password_min_length: 8,
  };

  const smtpHost = env('SMTP_HOST');
  const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const sender = env('SMTP_SENDER_EMAIL') || (isEmail(env('SMTP_USER')) ? env('SMTP_USER') : '');
  // Sem remetente válido não dá para gravar o SMTP (o Supabase recusa). A publicação segue: os links de
  // recuperação são atualizados e o SMTP que já estiver no projeto continua como está.
  const smtpReady = Boolean(smtpHost) && isEmail(sender);
  if (smtpHost && !smtpReady) {
    console.log('::warning::SMTP_HOST definido, mas sem remetente válido: o SMTP atual do Supabase foi mantido. Para atualizá-lo, crie a variável SMTP_SENDER_EMAIL com o e-mail que envia (ex.: nao-responda@seudominio.com.br).');
  }
  if (smtpReady) {
    Object.assign(config, {
      smtp_host: smtpHost,
      smtp_port: env('SMTP_PORT', '587'),
      smtp_user: env('SMTP_USER'),
      smtp_pass: env('SMTP_PASS'),
      smtp_admin_email: sender,
      smtp_sender_name: env('SMTP_SENDER_NAME', 'PontoMax'),
      rate_limit_email_sent: 60,
      // Personalizar o modelo de e-mail exige SMTP próprio no plano gratuito do Supabase.
      mailer_subjects_recovery: 'SuperPonto - redefinição de senha',
    });
  } else if (!smtpHost) {
    console.log('::warning::SMTP não configurado: o Supabase usa o e-mail padrão, limitado a poucas mensagens por hora e só para membros da equipe do projeto. Defina os secrets SMTP_* para produção.');
  }

  await mgmt(`/projects/${ref}/config/auth`, { method: 'PATCH', body: config });
  console.log(`Auth configurado: site ${site}, recuperação de senha em ${site}/reset-password${smtpReady ? ', SMTP próprio' : ''}.`);
}

/** Garante a conta SUPER_ADMIN_EMAIL como Super Admin (e, por padrão, a única). */
async function cmdAdmin() {
  const email = env('SUPER_ADMIN_EMAIL').toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('SUPER_ADMIN_EMAIL inválido');
  const site = env('SITE_URL').replace(/\/+$/, '');
  const only = env('SUPER_ADMIN_ONLY', 'true') !== 'false';
  const { service } = await getKeys();
  const api = (path, opts = {}) =>
    request(`${projectUrl}${path}`, {
      ...opts,
      headers: { apikey: service, Authorization: `Bearer ${service}`, ...(opts.headers ?? {}) },
    });

  // 1) Conta de login
  let user = null;
  for (let page = 1; page <= 50 && !user; page++) {
    const data = await api(`/auth/v1/admin/users?page=${page}&per_page=200`);
    const users = data?.users ?? [];
    user = users.find((u) => (u.email ?? '').toLowerCase() === email) ?? null;
    if (users.length < 200) break;
  }
  let created = false;
  if (!user && env('SUPER_ADMIN_CREATE') !== 'true') {
    // A migração do Lovable Cloud traz a conta com a senha atual; criar antes geraria um e-mail confuso.
    console.log(`::warning::Conta ${email} ainda não existe neste projeto. Rode "Migrar dados do Lovable Cloud" (traz a conta com a senha atual) ou defina a variável SUPER_ADMIN_CREATE=true para criá-la do zero.`);
    return;
  }
  if (!user) {
    // Senha aleatória descartada: o titular define a dele pelo link de recuperação enviado abaixo.
    user = await api('/auth/v1/admin/users', {
      method: 'POST',
      body: { email, password: randomBytes(24).toString('base64url') + 'Aa1!', email_confirm: true },
    });
    created = true;
  }
  const userId = user.id;

  // 2) Perfil
  const profiles = await api(`/rest/v1/profiles?select=id&user_id=eq.${userId}`);
  if (!profiles?.length) {
    await api('/rest/v1/profiles', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: { user_id: userId, email, full_name: 'Administrador', is_active: true },
    });
  }

  // 3) Papel super_admin
  const roles = await api(`/rest/v1/user_roles?select=role&user_id=eq.${userId}&role=eq.super_admin`);
  if (!roles?.length) {
    await api('/rest/v1/user_roles', {
      method: 'POST',
      headers: { Prefer: 'return=minimal' },
      body: { user_id: userId, role: 'super_admin' },
    });
  }

  // 4) Exclusividade
  if (only) {
    const others = await api(`/rest/v1/user_roles?select=user_id&role=eq.super_admin&user_id=neq.${userId}`);
    if (others?.length) {
      await api(`/rest/v1/user_roles?role=eq.super_admin&user_id=neq.${userId}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' },
      });
      console.log(`Papel super_admin removido de ${others.length} outra(s) conta(s).`);
    }
  }

  // 5) Primeiro acesso: e-mail para definir a senha
  if (created) {
    const redirect = site ? `?redirect_to=${encodeURIComponent(`${site}/reset-password`)}` : '';
    try {
      await api(`/auth/v1/recover${redirect}`, { method: 'POST', body: { email } });
      console.log(`Super Admin criado. E-mail para definir a senha enviado para ${email}.`);
    } catch (e) {
      console.log(`::warning::Super Admin criado, mas o e-mail não saiu (${e.message}). Use "Esqueci minha senha" na tela Admin após configurar o SMTP.`);
    }
  } else {
    console.log(`Super Admin confirmado: ${email}${only ? ' (único)' : ''}.`);
  }
}

const commands = { keys: cmdKeys, auth: cmdAuth, admin: cmdAdmin };
const cmd = process.argv[2];
if (!commands[cmd]) fail(`Uso: supabase-setup.mjs ${Object.keys(commands).join('|')}`);
const local = env('SUPABASE_URL') && env('SERVICE_ROLE_KEY');
if (!local && (!ref || !token)) fail('Defina SUPABASE_PROJECT_REF e SUPABASE_ACCESS_TOKEN');
commands[cmd]().catch((e) => fail(e.message));
