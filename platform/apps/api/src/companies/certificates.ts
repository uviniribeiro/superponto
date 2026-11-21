// Certificado digital ICP-Brasil A1 da empresa (PFX e senha cifrados) e assinatura CAdES (.p7s
// destacada, SHA-256, signing-certificate-v2) do AFD do REP-P e do AEJ, pelo OpenSSL do servidor.
import { BadRequestException, Body, Controller, Delete, Get, HttpCode, Inject, Injectable, Module, NotFoundException, Param, Put, ServiceUnavailableException } from '@nestjs/common';
import { CurrentUser } from '@nestjs/authentication';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { normalizeCnpj } from '@superponto/br-docs';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { z } from 'zod';
import type { AuthUser } from '../auth/auth-user.js';
import { AuditService } from '../audit/audit.service.js';
import { RequirePermission } from '../authorization/authorization.js';
import { FieldCipher } from '../common/crypto.js';
import { ActiveTenant, RequestInfo, type RequestMeta } from '../common/tenant.js';
import { APP_CONFIG, type AppConfig } from '../config.js';
import { PrismaService } from '../prisma/prisma.service.js';

const run = promisify(execFile);
const OPENSSL = process.env.OPENSSL_BIN ?? 'openssl';

export class CertificateError extends Error {}
export interface CertificateInfo { subject: string; issuer: string; serialNumber: string; notBefore: Date; notAfter: Date }

/** CNPJ do e-CNPJ ICP-Brasil (nome comum termina em ":<14 caracteres>"). */
export const certCnpj = (subject: string) => /CN\s*=\s*[^,]*:([0-9A-Z]{14})/.exec(subject)?.[1] ?? null;

export class CadesSigner {
  private async temp<T>(fn: (dir: string) => Promise<T>) {
    const dir = await mkdtemp(join(tmpdir(), 'sp-cert-'));
    try { return await fn(dir); } finally { await rm(dir, { recursive: true, force: true }); }
  }

  private async pkcs12(pfx: string, password: string, what: string[]) {
    for (const legacy of [false, true]) {
      try {
        const r = await run(OPENSSL, ['pkcs12', '-in', pfx, '-passin', 'env:SP_PFX_PASSWORD', ...what, ...(legacy ? ['-legacy'] : [])], { env: { ...process.env, SP_PFX_PASSWORD: password }, encoding: 'latin1' });
        return r.stdout;
      } catch { /* tenta o modo legado */ }
    }
    throw new CertificateError('Senha do certificado incorreta ou arquivo PFX inválido');
  }

  private async requireOpenssl() {
    try { await run(OPENSSL, ['version']); } catch { throw new CertificateError('OpenSSL não está instalado no servidor (necessário para a assinatura digital)'); }
  }

  async inspect(pfx: Buffer, password: string): Promise<CertificateInfo> {
    await this.requireOpenssl();
    return this.temp(async (dir) => {
      const p = join(dir, 'c.pfx');
      await writeFile(p, pfx, { mode: 0o600 });
      const certPem = await this.pkcs12(p, password, ['-clcerts', '-nokeys']);
      const keyPem = await this.pkcs12(p, password, ['-nocerts', '-nodes']);
      if (!keyPem.includes('PRIVATE KEY')) throw new CertificateError('O arquivo PFX não tem a chave privada (exporte o certificado A1 com a chave)');
      const c = join(dir, 'c.pem');
      await writeFile(c, certPem, { encoding: 'latin1', mode: 0o600 });
      let out: string;
      try { out = (await run(OPENSSL, ['x509', '-in', c, '-noout', '-subject', '-issuer', '-serial', '-startdate', '-enddate', '-nameopt', 'utf8,sep_comma_plus'])).stdout; }
      catch { throw new CertificateError('Certificado do titular não encontrado no PFX'); }
      const f: Record<string, string> = {};
      for (const line of out.split('\n')) { const i = line.indexOf('='); if (i > 0) f[line.slice(0, i).trim()] = line.slice(i + 1).trim(); }
      const date = (v?: string) => {
        const d = new Date(v ?? '');
        if (Number.isNaN(d.getTime())) throw new CertificateError('Validade do certificado ilegível');
        return d;
      };
      return { subject: f.subject ?? '', issuer: f.issuer ?? '', serialNumber: (f.serial ?? '').toUpperCase(), notBefore: date(f.notBefore), notAfter: date(f.notAfter) };
    });
  }

  async sign(pfx: Buffer, password: string, content: Buffer): Promise<Buffer> {
    await this.requireOpenssl();
    return this.temp(async (dir) => {
      const p = join(dir, 'c.pfx'), cert = join(dir, 'cert.pem'), key = join(dir, 'key.pem'), chain = join(dir, 'chain.pem'), data = join(dir, 'data'), out = join(dir, 'sig.p7s');
      await writeFile(p, pfx, { mode: 0o600 });
      await writeFile(cert, await this.pkcs12(p, password, ['-clcerts', '-nokeys']), { encoding: 'latin1', mode: 0o600 });
      await writeFile(key, await this.pkcs12(p, password, ['-nocerts', '-nodes']), { encoding: 'latin1', mode: 0o600 });
      const ca = await this.pkcs12(p, password, ['-cacerts', '-nokeys']);
      const hasChain = ca.includes('BEGIN CERTIFICATE');
      if (hasChain) await writeFile(chain, ca, { encoding: 'latin1', mode: 0o600 });
      await writeFile(data, content);
      try {
        await run(OPENSSL, ['cms', '-sign', '-binary', '-cades', '-md', 'sha256', '-nosmimecap', '-in', data, '-signer', cert, '-inkey', key, ...(hasChain ? ['-certfile', chain] : []), '-outform', 'DER', '-out', out]);
      } catch (e) {
        throw new CertificateError(`Falha ao assinar: ${String((e as { stderr?: string }).stderr ?? e).split('\n')[0]}`);
      }
      return readFile(out);
    });
  }
}

const uploadSchema = z.object({
  pfxBase64: z.string().min(100, 'Envie o arquivo .pfx do certificado A1 (até 64 KB)').max(90000, 'Envie o arquivo .pfx do certificado A1 (até 64 KB)'),
  password: z.string().min(1, 'Informe a senha do certificado').max(200),
});

const br = (d: Date) => d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });

function companyFilter(user: AuthUser, permission: string): string[] | null {
  if (user.isPlatformAdmin) return null;
  const grants = user.grants.filter((g) => g.permission === permission);
  if (grants.some((g) => g.scope === 'TENANT' || g.scope === 'PLATFORM')) return null;
  return grants.filter((g) => g.scope === 'COMPANY' && g.companyId).map((g) => g.companyId!);
}

type Row = { subject: string; issuer: string; serialNumber: string; notBefore: Date; notAfter: Date; updatedAt: Date };
const publicView = (c: Row) => ({ subject: c.subject, issuer: c.issuer, serialNumber: c.serialNumber, notBefore: c.notBefore, notAfter: c.notAfter, expired: c.notAfter < new Date(), updatedAt: c.updatedAt });
const select = { subject: true, issuer: true, serialNumber: true, notBefore: true, notAfter: true, updatedAt: true } as const;

@Injectable()
export class CertificatesService {
  private readonly cipher: FieldCipher | null;
  readonly signer = new CadesSigner();
  constructor(private readonly prisma: PrismaService, private readonly audit: AuditService, @Inject(APP_CONFIG) config: AppConfig) {
    this.cipher = config.SECRETS_ENCRYPTION_KEY ? new FieldCipher(config.SECRETS_ENCRYPTION_KEY) : null;
  }

  private requireCipher() {
    if (!this.cipher) throw new ServiceUnavailableException('Assinatura digital desativada: configure SECRETS_ENCRYPTION_KEY na API');
    return this.cipher;
  }

  private async checkCompany(tenantId: string, id: string, allowed: string[] | null) {
    const c = await this.prisma.forTenant(tenantId, (tx) => tx.company.findFirst({ where: { id, deletedAt: null }, select: { id: true, cnpj: true } }));
    if (!c || (allowed && !allowed.includes(id))) throw new NotFoundException('Empresa não encontrada');
    return c;
  }

  async get(tenantId: string, user: AuthUser, id: string) {
    await this.checkCompany(tenantId, id, companyFilter(user, 'org.companies:read'));
    const c = await this.prisma.forTenant(tenantId, (tx) => tx.companyCertificate.findUnique({ where: { companyId: id }, select }));
    return { certificate: c ? publicView(c) : null };
  }

  async upload(tenantId: string, user: AuthUser, id: string, input: z.infer<typeof uploadSchema>, meta: RequestMeta) {
    const cipher = this.requireCipher();
    const pfx = Buffer.from(input.pfxBase64.replace(/\s/g, ''), 'base64');
    if (pfx.length < 64) throw new BadRequestException('Arquivo do certificado inválido');
    if (pfx.length > 65536) throw new BadRequestException('Envie o arquivo .pfx do certificado A1 (até 64 KB)');
    const company = await this.checkCompany(tenantId, id, companyFilter(user, 'org.companies:update'));
    let info: CertificateInfo;
    try { info = await this.signer.inspect(pfx, input.password); }
    catch (e) { if (e instanceof CertificateError) throw new BadRequestException(e.message); throw e; }
    const now = new Date();
    if (info.notAfter < now) throw new BadRequestException(`Certificado vencido em ${br(info.notAfter)}`);
    if (info.notBefore > now) throw new BadRequestException(`Certificado só vale a partir de ${br(info.notBefore)}`);
    const cc = certCnpj(info.subject);
    if (company.cnpj && cc && normalizeCnpj(cc).slice(0, 8) !== normalizeCnpj(company.cnpj).slice(0, 8)) throw new BadRequestException(`O certificado é do CNPJ ${cc}, de outra empresa`);
    return this.prisma.forTenant(tenantId, async (tx) => {
      const before = await tx.companyCertificate.findUnique({ where: { companyId: id }, select: { serialNumber: true } });
      const data = { pfxEnc: cipher.encrypt(pfx), passwordEnc: cipher.encrypt(Buffer.from(input.password, 'utf8')), subject: info.subject, issuer: info.issuer, serialNumber: info.serialNumber, notBefore: info.notBefore, notAfter: info.notAfter, uploadedById: user.id };
      const saved = await tx.companyCertificate.upsert({ where: { companyId: id }, create: { tenantId, companyId: id, ...data }, update: data, select });
      await this.audit.record(tx, {
        tenantId, actorUserId: user.id, action: before ? 'UPDATE' : 'CREATE', entity: 'company_certificate', entityId: id,
        before: before ? { serialNumber: before.serialNumber } : null, after: { serialNumber: info.serialNumber, subject: info.subject, notAfter: info.notAfter.toISOString() }, ...meta,
      });
      return { certificate: publicView(saved) };
    });
  }

  async remove(tenantId: string, user: AuthUser, id: string, meta: RequestMeta) {
    await this.checkCompany(tenantId, id, companyFilter(user, 'org.companies:update'));
    await this.prisma.forTenant(tenantId, async (tx) => {
      const before = await tx.companyCertificate.findUnique({ where: { companyId: id }, select: { serialNumber: true } });
      if (!before) throw new NotFoundException('Certificado não encontrado');
      await tx.companyCertificate.delete({ where: { companyId: id } });
      await this.audit.record(tx, { tenantId, actorUserId: user.id, action: 'DELETE', entity: 'company_certificate', entityId: id, before: { serialNumber: before.serialNumber }, ...meta });
    });
  }

  /** Assina o arquivo exportado; sem certificado (ou com falha) devolve o aviso e o arquivo segue sem assinatura. */
  async signExport(tenantId: string, companyId: string, content: Buffer, filename: string): Promise<{ signature: { filename: string; mime: string; base64: string } | null; warning: string | null }> {
    const c = await this.prisma.forTenant(tenantId, (tx) => tx.companyCertificate.findUnique({ where: { companyId }, select: { pfxEnc: true, passwordEnc: true, notAfter: true } }));
    if (!c) return { signature: null, warning: 'Sem certificado digital da empresa (Empresas › Certificado digital): o arquivo saiu sem a assinatura .p7s.' };
    if (c.notAfter < new Date()) return { signature: null, warning: `O certificado digital da empresa venceu em ${br(c.notAfter)}: envie um novo para assinar o arquivo.` };
    if (!this.cipher) return { signature: null, warning: 'Assinatura digital desativada: configure SECRETS_ENCRYPTION_KEY na API.' };
    try {
      const sig = await this.signer.sign(this.cipher.decrypt(c.pfxEnc), this.cipher.decrypt(c.passwordEnc).toString('utf8'), content);
      return { signature: { filename: `${filename}.p7s`, mime: 'application/pkcs7-signature', base64: sig.toString('base64') }, warning: null };
    } catch (e) {
      if (e instanceof CertificateError) return { signature: null, warning: `Não foi possível assinar o arquivo: ${e.message}.` };
      throw e;
    }
  }
}

const idParam = { schema: z.uuid() };

@ApiTags('organização')
@ApiBearerAuth()
@Controller('v1/companies')
export class CertificatesController {
  constructor(private readonly svc: CertificatesService) {}

  @Get(':id/certificate')
  @RequirePermission('org.companies:read')
  get(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', idParam) id: string) { return this.svc.get(t, u, id); }

  @Put(':id/certificate')
  @RequirePermission('admin.settings:manage')
  upload(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', idParam) id: string, @Body({ schema: uploadSchema }) b: z.infer<typeof uploadSchema>, @RequestInfo() m: RequestMeta) { return this.svc.upload(t, u, id, b, m); }

  @Delete(':id/certificate')
  @HttpCode(204)
  @RequirePermission('admin.settings:manage')
  remove(@ActiveTenant() t: string, @CurrentUser() u: AuthUser, @Param('id', idParam) id: string, @RequestInfo() m: RequestMeta) { return this.svc.remove(t, u, id, m); }
}

@Module({ controllers: [CertificatesController], providers: [CertificatesService], exports: [CertificatesService] })
export class CertificatesModule {}
