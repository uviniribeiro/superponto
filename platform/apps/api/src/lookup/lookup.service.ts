import { BadGatewayException, BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { isValidCnpj, normalizeCnpj, onlyDigits } from '@superponto/br-docs';

/** fetch injetável (testes usam um falso; produção usa o global). */
export const HTTP_FETCH = Symbol('HTTP_FETCH');
export type HttpFetch = typeof fetch;

export interface Address {
  cep: string;
  street: string;
  number?: string;
  complement?: string;
  district: string;
  city: string;
  uf: string;
  /** código IBGE do município (7 dígitos): define os feriados municipais */
  ibge: string | null;
  timezone?: string;
}

export interface CnpjInfo {
  cnpj: string;
  legalName: string;
  tradeName: string | null;
  status: string | null;
  activity: string | null;
  openedAt: string | null;
  phone: string | null;
  email: string | null;
  address: Address | null;
  source: string;
}

const TTL = 24 * 60 * 60 * 1000;
const titleCase = (v: string) => v.toLowerCase().replace(/(^|[\s/-])([a-zà-ú])/g, (_m, sep: string, c: string) => sep + c.toUpperCase()).replace(/\b(De|Da|Do|Das|Dos|E)\b/g, (w) => w.toLowerCase());

/** Consulta pública de CEP e CNPJ com reserva entre provedores e cache de 24 h. */
@Injectable()
export class LookupService {
  private readonly cache = new Map<string, { at: number; value: unknown }>();
  constructor(@Inject(HTTP_FETCH) private readonly http: HttpFetch) {}

  private async json(url: string): Promise<{ status: number; body: unknown }> {
    const res = await this.http(url, { headers: { Accept: 'application/json', 'User-Agent': 'SuperPonto/2' }, signal: AbortSignal.timeout(8000) });
    const text = await res.text();
    let body: unknown = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = null; }
    return { status: res.status, body };
  }

  private cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < TTL) return Promise.resolve(hit.value as T);
    return load().then((value) => {
      if (this.cache.size > 5000) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, { at: Date.now(), value });
      return value;
    });
  }

  cep(input: string): Promise<Address> {
    const cep = onlyDigits(input);
    if (cep.length !== 8) throw new BadRequestException('CEP deve ter 8 dígitos');
    return this.cached(`cep:${cep}`, async () => {
      let notFound = 0;
      // 1) BrasilAPI (já traz código IBGE e fuso)
      try {
        const r = await this.json(`https://brasilapi.com.br/api/cep/v2/${cep}`);
        const b = r.body as Record<string, any> | null;
        if (r.status === 200 && b?.city) {
          return { cep, street: b.street ?? '', district: b.neighborhood ?? '', city: b.city, uf: b.state, ibge: b.ibge?.city ?? null, timezone: b.timezoneName ?? undefined };
        }
        if (r.status === 404) notFound++;
      } catch { /* tenta o próximo */ }
      // 2) ViaCEP
      try {
        const r = await this.json(`https://viacep.com.br/ws/${cep}/json/`);
        const b = r.body as Record<string, any> | null;
        if (r.status === 200 && b && !b.erro && b.localidade) {
          return { cep, street: b.logradouro ?? '', district: b.bairro ?? '', city: b.localidade, uf: b.uf, ibge: b.ibge ?? null };
        }
        if (r.status === 200 && b?.erro) notFound++;
      } catch { /* sem resposta */ }
      if (notFound) throw new NotFoundException('CEP não encontrado');
      throw new BadGatewayException('Serviço de CEP indisponível no momento; preencha o endereço manualmente');
    });
  }

  cnpj(input: string): Promise<CnpjInfo> {
    const cnpj = normalizeCnpj(input);
    if (!isValidCnpj(cnpj)) throw new BadRequestException('CNPJ inválido: confira os dígitos verificadores');
    if (/[A-Z]/.test(cnpj)) {
      throw new NotFoundException('A consulta pública ainda não cobre CNPJ alfanumérico; preencha os dados manualmente');
    }
    return this.cached(`cnpj:${cnpj}`, async () => {
      const r = await this.json(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`).catch(() => ({ status: 0, body: null }));
      const b = r.body as Record<string, any> | null;
      if (r.status === 404) throw new NotFoundException('CNPJ não encontrado na Receita Federal');
      if (r.status !== 200 || !b?.razao_social) throw new BadGatewayException('Consulta de CNPJ indisponível no momento; preencha manualmente');
      const ibge = b.codigo_municipio_ibge ? String(b.codigo_municipio_ibge) : null;
      const street = [b.descricao_tipo_de_logradouro, b.logradouro].filter(Boolean).join(' ').trim();
      const phone = onlyDigits(String(b.ddd_telefone_1 ?? ''));
      return {
        cnpj,
        legalName: String(b.razao_social).trim(),
        tradeName: b.nome_fantasia ? String(b.nome_fantasia).trim() : null,
        status: b.descricao_situacao_cadastral ?? null,
        activity: b.cnae_fiscal_descricao ?? null,
        openedAt: b.data_inicio_atividade ?? null,
        phone: phone.length >= 10 ? phone : null,
        email: b.email ? String(b.email).toLowerCase() : null,
        address: b.cep ? {
          cep: onlyDigits(String(b.cep)).padStart(8, '0'),
          street: street ? titleCase(street) : '',
          number: b.numero ? String(b.numero) : undefined,
          complement: b.complemento ? String(b.complemento) : undefined,
          district: b.bairro ? titleCase(String(b.bairro)) : '',
          city: b.municipio ? titleCase(String(b.municipio)) : '',
          uf: b.uf ?? '',
          ibge: ibge && /^\d{7}$/.test(ibge) ? ibge : null,
        } : null,
        source: 'Receita Federal (via BrasilAPI)',
      };
    }).then(async (info) => {
      // A Receita grava o endereço em maiúsculas e sem acentos: completa com a base de CEP
      // (nomes oficiais, código IBGE e fuso), mantendo número e complemento da Receita.
      if (!info.address?.cep) return info;
      const byCep = await this.cep(info.address.cep).catch(() => null);
      if (!byCep) return info;
      return { ...info, address: { ...info.address, street: byCep.street || info.address.street, district: byCep.district || info.address.district, city: byCep.city, uf: byCep.uf, ibge: byCep.ibge ?? info.address.ibge, timezone: byCep.timezone } };
    });
  }
}
