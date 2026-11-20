// Feriados automáticos por local (CEP → IBGE) e consulta de CEP/CNPJ para preencher formulários.
import type { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { createPrismaClient } from '@superponto/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { HolidaysService } from '../src/holidays/holidays.service.js';
import { api, createApp, hook, ownerUrl } from './helpers.js';

const PASSWORD = 'Senha-Muito-Forte-2026';
const owner = createPrismaClient(ownerUrl);
let app: INestApplication;
let token = '';
let other = '';
const as = (t: string) => ({ Authorization: `Bearer ${t}` });
const calls: string[] = [];

/** Respostas reais simplificadas da BrasilAPI e do ViaCEP. */
async function fakeFetch(input: string | URL | Request): Promise<Response> {
  const url = String(input);
  calls.push(url);
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  if (url.endsWith('/cep/v2/30130010')) return json({ cep: '30130010', state: 'MG', city: 'Belo Horizonte', neighborhood: 'Centro', street: 'Praça Sete de Setembro', ibge: { city: '3106200', state: '31' }, timezoneName: 'America/Sao_Paulo' });
  if (url.endsWith('/cep/v2/01001000')) return json({ message: 'erro' }, 500); // BrasilAPI fora: usa ViaCEP
  if (url.includes('viacep.com.br/ws/01001000')) return json({ cep: '01001-000', logradouro: 'Praça da Sé', bairro: 'Sé', localidade: 'São Paulo', uf: 'SP', ibge: '3550308' });
  if (url.endsWith('/cep/v2/99999999')) return json({ message: 'não encontrado' }, 404);
  if (url.includes('viacep.com.br/ws/99999999')) return json({ erro: true });
  if (url.endsWith('/cnpj/v1/11222333000181')) return json({ razao_social: 'ESCOLA HORIZONTE LTDA', nome_fantasia: 'COLEGIO HORIZONTE', descricao_situacao_cadastral: 'ATIVA', cnae_fiscal_descricao: 'Ensino fundamental', cep: '30130010', descricao_tipo_de_logradouro: 'PRACA', logradouro: 'SETE DE SETEMBRO', numero: '100', bairro: 'CENTRO', municipio: 'BELO HORIZONTE', uf: 'MG', codigo_municipio_ibge: 3106200, ddd_telefone_1: '3133334444', email: 'CONTATO@HORIZONTE.TEST' });
  if (url.endsWith('/cnpj/v1/11444777000161')) return json({ message: 'CNPJ não encontrado' }, 404);
  return json({}, 503);
}

describe('Feriados automáticos e preenchimento por CEP/CNPJ', () => {
  beforeAll(async () => {
    ({ app } = await createApp({ fetch: fakeFetch as typeof fetch }));
    const hasher = new PasswordHasher();
    await owner.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      const role = await tx.role.findFirstOrThrow({ where: { tenantId: null, key: 'company_admin' } });
      for (const slug of ['fer-a', 'fer-b']) {
        const tenant = await tx.tenant.create({ data: { name: slug, slug } });
        const user = await tx.user.create({ data: { tenantId: tenant.id, email: `admin@${slug}.test`, displayName: 'Admin', passwordHash: await hasher.hash(PASSWORD) } });
        await tx.userRole.create({ data: { userId: user.id, roleId: role.id, tenantId: tenant.id, scope: 'TENANT' } });
      }
    });
    token = (await api(app).post('/v1/auth/token').send({ email: 'admin@fer-a.test', password: PASSWORD }).expect(200)).body.accessToken;
    other = (await api(app).post('/v1/auth/token').send({ email: 'admin@fer-b.test', password: PASSWORD }).expect(200)).body.accessToken;
  });

  afterAll(async () => {
    await app.close();
    await owner.$disconnect();
  });

  describe('CEP', () => {
    it('preenche endereço com código IBGE e fuso', async () => {
      const res = await api(app).get('/v1/lookup/cep/30130-010').set(as(token)).expect(200);
      expect(res.body).toMatchObject({ cep: '30130010', street: 'Praça Sete de Setembro', district: 'Centro', city: 'Belo Horizonte', uf: 'MG', ibge: '3106200', timezone: 'America/Sao_Paulo' });
    });
    it('usa o ViaCEP quando a BrasilAPI falha', async () => {
      const res = await api(app).get('/v1/lookup/cep/01001000').set(as(token)).expect(200);
      expect(res.body).toMatchObject({ city: 'São Paulo', ibge: '3550308' });
    });
    it('CEP inexistente: 404; formato errado: 400; sem login: 401', async () => {
      await api(app).get('/v1/lookup/cep/99999999').set(as(token)).expect(404);
      await api(app).get('/v1/lookup/cep/123').set(as(token)).expect(400);
      await api(app).get('/v1/lookup/cep/30130010').expect(401);
    });
    it('guarda em cache: a segunda consulta não chama o serviço externo', async () => {
      const before = calls.length;
      await api(app).get('/v1/lookup/cep/30130010').set(as(token)).expect(200);
      expect(calls.length).toBe(before);
    });
  });

  describe('CNPJ', () => {
    it('valida e preenche razão social, nome fantasia, situação e endereço', async () => {
      const res = await api(app).get('/v1/lookup/cnpj/11.222.333.0001-81').set(as(token)).expect(200);
      expect(res.body).toMatchObject({
        legalName: 'ESCOLA HORIZONTE LTDA', tradeName: 'COLEGIO HORIZONTE', status: 'ATIVA', phone: '3133334444', email: 'contato@horizonte.test',
        // endereço completado pela base de CEP: nomes acentuados e fuso
        address: { cep: '30130010', street: 'Praça Sete de Setembro', number: '100', district: 'Centro', city: 'Belo Horizonte', uf: 'MG', ibge: '3106200', timezone: 'America/Sao_Paulo' },
      });
    });
    it('dígito verificador errado é recusado sem consultar a Receita', async () => {
      const before = calls.length;
      await api(app).get('/v1/lookup/cnpj/11222333000182').set(as(token)).expect(400);
      expect(calls.length).toBe(before);
    });
    it('CNPJ válido inexistente: 404; alfanumérico: aviso para preencher manualmente', async () => {
      await api(app).get('/v1/lookup/cnpj/11444777000161').set(as(token)).expect(404);
      const alfa = await api(app).get('/v1/lookup/cnpj/12ABC34501DE35').set(as(token)).expect(404);
      expect(alfa.body.message).toMatch(/alfanumérico/);
    });
  });

  describe('feriados', () => {
    let bh = '';
    let semCidade = '';

    it('geração do ano é idempotente (rodar de novo não duplica)', async () => {
      const generate = (year: number) => hook('holidays-generate', () => app.get(HolidaysService).generateYear(year), (b) => b.created as number, { year });
      // Anos que nenhum outro teste usa (os arquivos de teste rodam em paralelo no mesmo banco).
      const first = await generate(2041);
      expect(first).toBeGreaterThan(40);
      expect(await generate(2041)).toBe(0);
      const now = '2041-01-01T03:00:00Z';
      const r = await hook('holidays-ensure', () => app.get(HolidaysService).ensureUpcoming(new Date(now)), (b) => b as Record<number, number>, { now });
      expect(r[2041]).toBe(0);
      expect(r[2042]).toBeGreaterThan(40); // o ano seguinte já fica pronto antes da virada
    });

    it('empresa com endereço em BH recebe nacionais, Corpus Christi municipal, 15/08 e 08/12', async () => {
      const c = await api(app).post('/v1/companies').set(as(token)).send({ legalName: 'Escola Horizonte Ltda', cnpj: '11222333000181', zipCode: '30130-010', street: 'Praça Sete', number: '100', district: 'Centro', city: 'Belo Horizonte', state: 'mg', ibgeCode: '3106200' }).expect(201);
      bh = c.body.id;
      expect(c.body).toMatchObject({ zipCode: '30130010', state: 'MG', ibgeCode: '3106200' });
      const res = await api(app).get(`/v1/companies/${bh}/holidays?year=2027`).set(as(token)).expect(200);
      const by = Object.fromEntries(res.body.holidays.map((h: { date: string }) => [h.date, h]));
      expect(res.body.location).toMatchObject({ city: 'Belo Horizonte', ibge: '3106200', municipalBase: true });
      expect(by['2027-11-20']).toMatchObject({ scope: 'NATIONAL', kind: 'HOLIDAY', workday: false });
      expect(by['2027-05-27']).toMatchObject({ name: 'Corpus Christi', scope: 'MUNICIPAL', kind: 'HOLIDAY', workday: false });
      expect(by['2027-08-15']).toMatchObject({ scope: 'MUNICIPAL', review: true });
      expect(by['2027-02-09']).toMatchObject({ kind: 'OPTIONAL', workday: true }); // Carnaval: facultativo
    });

    it('ano ainda não gerado é gerado na hora da consulta', async () => {
      const res = await api(app).get(`/v1/companies/${bh}/holidays?year=2031`).set(as(token)).expect(200);
      expect(res.body.holidays.some((h: { date: string }) => h.date === '2031-11-20')).toBe(true);
    });

    it('empresa sem cidade na base: só nacionais; feriado municipal próprio é repetido todo ano', async () => {
      semCidade = (await api(app).post('/v1/companies').set(as(token)).send({ legalName: 'Filial Interior', state: 'MG', city: 'Itabirito', ibgeCode: '3133006' }).expect(201)).body.id;
      const before = await api(app).get(`/v1/companies/${semCidade}/holidays?year=2027`).set(as(token)).expect(200);
      expect(before.body.location.municipalBase).toBe(false);
      expect(before.body.holidays.some((h: { scope: string }) => h.scope === 'MUNICIPAL')).toBe(false);
      await api(app).post(`/v1/companies/${semCidade}/holiday-rules`).set(as(token)).send({ name: 'Aniversário de Itabirito', month: 6, day: 23 }).expect(201);
      await api(app).post(`/v1/companies/${semCidade}/holiday-rules`).set(as(token)).send({ name: 'Corpus Christi (municipal)', movable: 'CORPUS_CHRISTI' }).expect(201);
      for (const [year, cc] of [[2027, '2027-05-27'], [2028, '2028-06-15']] as const) {
        const res = await api(app).get(`/v1/companies/${semCidade}/holidays?year=${year}`).set(as(token)).expect(200);
        const by = Object.fromEntries(res.body.holidays.map((h: { date: string }) => [h.date, h]));
        expect(by[`${year}-06-23`]).toMatchObject({ scope: 'COMPANY', kind: 'HOLIDAY' });
        expect(by[cc]).toMatchObject({ scope: 'COMPANY', kind: 'HOLIDAY', name: 'Corpus Christi (municipal)' });
      }
    });

    it('regra inválida é recusada (data inexistente ou sem data)', async () => {
      await api(app).post(`/v1/companies/${semCidade}/holiday-rules`).set(as(token)).send({ name: 'Errado', month: 2, day: 30 }).expect(400);
      await api(app).post(`/v1/companies/${semCidade}/holiday-rules`).set(as(token)).send({ name: 'Sem data' }).expect(400);
    });

    it('a empresa decide: folgar no Carnaval e trabalhar no 15/08', async () => {
      await api(app).put(`/v1/companies/${bh}/holiday-overrides`).set(as(token)).send({ date: '2027-02-09', workday: false, note: 'Folga de Carnaval' }).expect(200);
      await api(app).put(`/v1/companies/${bh}/holiday-overrides`).set(as(token)).send({ date: '2027-08-15', workday: true }).expect(200);
      const res = await api(app).get(`/v1/companies/${bh}/holidays?year=2027`).set(as(token)).expect(200);
      const by = Object.fromEntries(res.body.holidays.map((h: { date: string }) => [h.date, h]));
      expect(by['2027-02-09']).toMatchObject({ workday: false, overridden: true, note: 'Folga de Carnaval' });
      expect(by['2027-08-15']).toMatchObject({ workday: true, overridden: true });
      await api(app).delete(`/v1/companies/${bh}/holiday-overrides/2027-08-15`).set(as(token)).expect(204);
      const again = await api(app).get(`/v1/companies/${bh}/holidays?year=2027`).set(as(token)).expect(200);
      expect(again.body.holidays.find((h: { date: string }) => h.date === '2027-08-15')).toMatchObject({ workday: false, overridden: false });
    });

    it('outro cliente não vê os feriados nem as regras da empresa', async () => {
      await api(app).get(`/v1/companies/${bh}/holidays?year=2027`).set(as(other)).expect(404);
      await api(app).post(`/v1/companies/${bh}/holiday-rules`).set(as(other)).send({ name: 'Invasão', month: 1, day: 2 }).expect(404);
    });

    it('o catálogo global não pode ser alterado pelo papel da API', async () => {
      const appDb = createPrismaClient(process.env.TEST_APP_DATABASE_URL!);
      try {
        await appDb.publicHoliday.deleteMany({ where: { year: 2027 } });
        expect(await owner.publicHoliday.count({ where: { year: 2027 } })).toBeGreaterThan(40);
      } finally {
        await appDb.$disconnect();
      }
    });
  });
});
