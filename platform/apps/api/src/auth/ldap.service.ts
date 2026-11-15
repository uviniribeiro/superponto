import { BadRequestException, Inject, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { Client } from 'ldapts';
import { FieldCipher } from '../common/crypto.js';
import { APP_CONFIG, type AppConfig } from '../config.js';

export interface LdapSettings {
  url: string;
  startTls: boolean;
  allowInsecureTls: boolean;
  bindDn: string | null;
  bindPasswordEnc: string | null;
  baseDn: string;
  userFilter: string;
  timeoutMs: number;
}

export type LdapResult = { ok: true; dn: string } | { ok: false; reason: 'not_found' | 'ambiguous' | 'invalid_credentials' | 'unreachable' | 'config'; detail?: string };

/** Escape de valores em filtros LDAP (RFC 4515): impede injeção como "*)(uid=*". */
export function escapeFilterValue(v: string): string {
  return v.replace(/[\\*()\0]/g, (c) => `\\${c.charCodeAt(0).toString(16).padStart(2, '0')}`);
}

/** Monta o filtro trocando {email} e {login} (parte antes do @), sempre com escape. */
export function buildFilter(template: string, email: string): string {
  const login = email.split('@')[0] ?? email;
  return template.replaceAll('{email}', escapeFilterValue(email)).replaceAll('{login}', escapeFilterValue(login));
}

function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::') return true;
    if (v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')) return true;
    const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]!) : false;
  }
  const [a, b] = ip.split('.').map(Number) as [number, number];
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

/**
 * Login pelo diretório do cliente: conta de serviço busca o usuário pelo filtro e a senha é
 * conferida com um bind do próprio usuário. Senha vazia nunca é enviada (evita "bind anônimo").
 */
@Injectable()
export class LdapService {
  private readonly log = new Logger('LDAP');
  private readonly cipher: FieldCipher | null;
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {
    this.cipher = config.SECRETS_ENCRYPTION_KEY ? new FieldCipher(config.SECRETS_ENCRYPTION_KEY) : null;
  }

  encrypt(secret: string): string {
    if (!this.cipher) throw new ServiceUnavailableException('Login por LDAP desativado: configure SECRETS_ENCRYPTION_KEY na API');
    return this.cipher.encrypt(Buffer.from(secret, 'utf8'));
  }

  private decrypt(enc: string | null): string | null {
    if (!enc) return null;
    if (!this.cipher) throw new ServiceUnavailableException('Login por LDAP desativado: configure SECRETS_ENCRYPTION_KEY na API');
    return this.cipher.decrypt(enc).toString('utf8');
  }

  /** Só ldap:// ou ldaps://; endereço interno só com LDAP_ALLOW_PRIVATE_HOSTS (instalação própria). */
  async assertSafeUrl(raw: string): Promise<void> {
    let u: URL;
    try { u = new URL(raw); } catch { throw new BadRequestException('Endereço do servidor LDAP inválido'); }
    if (u.protocol !== 'ldap:' && u.protocol !== 'ldaps:') throw new BadRequestException('Use ldap:// ou ldaps://');
    if (u.username || u.password || (u.pathname && u.pathname !== '/') || u.search) throw new BadRequestException('Informe só protocolo, servidor e porta (ex.: ldaps://ad.empresa.com.br:636)');
    if (this.config.LDAP_ALLOW_PRIVATE_HOSTS) return;
    const host = u.hostname.replace(/^\[|\]$/g, '');
    let addresses: string[];
    try { addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address); }
    catch { throw new BadRequestException('Servidor LDAP não encontrado (DNS)'); }
    if (!addresses.length || addresses.some(isPrivateAddress)) {
      throw new BadRequestException('O servidor LDAP precisa ter endereço público (com TLS). Endereços internos só em instalação própria do SuperPonto.');
    }
  }

  private client(s: LdapSettings) {
    return new Client({
      url: s.url,
      timeout: s.timeoutMs,
      connectTimeout: s.timeoutMs,
      // Só em ldaps://: com tlsOptions o cliente negocia TLS logo na conexão (STARTTLS usa startTLS()).
      ...(s.url.toLowerCase().startsWith('ldaps://') ? { tlsOptions: { rejectUnauthorized: !s.allowInsecureTls, minVersion: 'TLSv1.2' as const } } : {}),
      strictDN: true,
    });
  }

  /** Busca o DN do usuário com a conta de serviço (ou anônima, se não houver conta). */
  async findUser(s: LdapSettings, email: string): Promise<LdapResult> {
    await this.assertSafeUrl(s.url);
    const c = this.client(s);
    try {
      if (s.startTls) await c.startTLS({ rejectUnauthorized: !s.allowInsecureTls, minVersion: 'TLSv1.2' });
      const pass = this.decrypt(s.bindPasswordEnc);
      if (s.bindDn) {
        if (!pass) return { ok: false, reason: 'config', detail: 'Conta de serviço sem senha' };
        await c.bind(s.bindDn, pass);
      }
      const { searchEntries } = await c.search(s.baseDn, { scope: 'sub', filter: buildFilter(s.userFilter, email), sizeLimit: 2, attributes: ['dn'] });
      if (searchEntries.length === 0) return { ok: false, reason: 'not_found' };
      if (searchEntries.length > 1) return { ok: false, reason: 'ambiguous' };
      return { ok: true, dn: searchEntries[0]!.dn };
    } catch (e) {
      return this.failure(e);
    } finally {
      await c.unbind().catch(() => undefined);
    }
  }

  /** Confere e-mail + senha no diretório. */
  async authenticate(s: LdapSettings, email: string, password: string): Promise<LdapResult> {
    if (!password) return { ok: false, reason: 'invalid_credentials' };
    const found = await this.findUser(s, email);
    if (!found.ok) return found;
    const c = this.client(s);
    try {
      if (s.startTls) await c.startTLS({ rejectUnauthorized: !s.allowInsecureTls, minVersion: 'TLSv1.2' });
      await c.bind(found.dn, password);
      return found;
    } catch (e) {
      return this.failure(e);
    } finally {
      await c.unbind().catch(() => undefined);
    }
  }

  private failure(e: unknown): LdapResult {
    const name = (e as { name?: string })?.name ?? '';
    const msg = (e as Error)?.message ?? String(e);
    if (name === 'InvalidCredentialsError') return { ok: false, reason: 'invalid_credentials' };
    if (name === 'NoSuchObjectError' || name === 'InvalidDNSyntaxError' || name === 'FilterParserError') return { ok: false, reason: 'config', detail: msg };
    this.log.warn(`Falha ao falar com o servidor LDAP: ${msg}`);
    return { ok: false, reason: 'unreachable', detail: msg };
  }
}
