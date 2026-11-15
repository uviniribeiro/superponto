// Fase 1 (estrutura): departamentos em árvore, seções, cargos, funções, centros de custo,
// tipos de funcionário, sindicatos e competências.
import type { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { createPrismaClient } from '@superponto/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, createApp, ownerUrl } from './helpers.js';

const PASSWORD = 'Senha-Muito-Forte-2026';
const owner = createPrismaClient(ownerUrl);
let app: INestApplication;
let admin = '';
let other = '';
let employee = '';
const ids: Record<string, string> = {};
const as = (t: string) => ({ Authorization: `Bearer ${t}` });
const login = async (email: string) => (await api(app).post('/v1/auth/token').send({ email, password: PASSWORD }).expect(200)).body.accessToken as string;

describe('Estrutura: cadastros da fase 1', () => {
  beforeAll(async () => {
    ({ app } = await createApp());
    const hasher = new PasswordHasher();
    await owner.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      const adminRole = await tx.role.findFirstOrThrow({ where: { tenantId: null, key: 'company_admin' } });
      const empRole = await tx.role.findFirstOrThrow({ where: { tenantId: null, key: 'employee' } });
      for (const slug of ['est-a', 'est-b']) {
        const t = await tx.tenant.create({ data: { name: slug, slug } });
        ids[slug] = t.id;
        const u = await tx.user.create({ data: { tenantId: t.id, email: `admin@${slug}.test`, displayName: 'Admin', passwordHash: await hasher.hash(PASSWORD) } });
        await tx.userRole.create({ data: { userId: u.id, roleId: adminRole.id, tenantId: t.id, scope: 'TENANT' } });
        ids[`company-${slug}`] = (await tx.company.create({ data: { tenantId: t.id, legalName: `Empresa ${slug}` } })).id;
      }
      const e = await tx.user.create({ data: { tenantId: ids['est-a']!, email: 'func@est-a.test', displayName: 'Func', passwordHash: await hasher.hash(PASSWORD) } });
      await tx.userRole.create({ data: { userId: e.id, roleId: empRole.id, tenantId: ids['est-a']!, scope: 'TENANT' } });
    });
    admin = await login('admin@est-a.test');
    other = await login('admin@est-b.test');
    employee = await login('func@est-a.test');
  });

  afterAll(async () => {
    await app.close();
    await owner.$disconnect();
  });

  describe('cadastros simples', () => {
    for (const [path, body, label] of [
      ['job-functions', { name: 'Recepcionista', code: 'F01' }, 'Função'],
      ['cost-centers', { name: 'Atenção Básica', code: 'CC10' }, 'Centro de custo'],
      ['employee-types', { name: 'Efetivo', code: 'EF' }, 'Tipo de funcionário'],
    ] as const) {
      it(`${label}: cria, lista, busca, edita e recusa duplicado`, async () => {
        const c = await api(app).post(`/v1/${path}`).set(as(admin)).send(body).expect(201);
        ids[path] = c.body.id;
        expect(c.body).toMatchObject({ ...body, active: true, tenantId: ids['est-a'] });
        const list = await api(app).get(`/v1/${path}?search=${encodeURIComponent(body.name.slice(0, 4))}`).set(as(admin)).expect(200);
        expect(list.body.data.map((r: { id: string }) => r.id)).toEqual([c.body.id]);
        await api(app).patch(`/v1/${path}/${c.body.id}`).set(as(admin)).send({ active: false }).expect(200);
        const dup = await api(app).post(`/v1/${path}`).set(as(admin)).send({ name: body.name.toUpperCase() }).expect(409);
        expect(dup.body.message).toMatch(/Já existe/);
        await api(app).post(`/v1/${path}`).set(as(admin)).send({ name: 'ab' }).expect(400); // mínimo 3
      });
    }
  });

  it('sindicato: CNPJ validado (inclusive alfanumérico) e sigla única', async () => {
    await api(app).post('/v1/labor-unions').set(as(admin)).send({ name: 'Sindicato da Saúde', acronym: 'SINDSAUDE', cnpj: '11.222.333/0001-82' }).expect(400);
    const u = await api(app).post('/v1/labor-unions').set(as(admin)).send({ name: 'Sindicato da Saúde', acronym: 'SINDSAUDE', cnpj: '12.abc.345/01de-35', baseMonth: 5 }).expect(201);
    expect(u.body).toMatchObject({ cnpj: '12ABC34501DE35', entityType: 'SINDICATO', side: 'EMPREGADOS', baseMonth: 5 });
    ids.union = u.body.id;
    await api(app).post('/v1/labor-unions').set(as(admin)).send({ name: 'Outro', acronym: 'sindsaude' }).expect(409);
  });

  it('competência: data final não pode ser anterior à inicial; lista da mais recente', async () => {
    await api(app).post('/v1/competences').set(as(admin)).send({ name: 'Errada', startsOn: '2027-02-01', endsOn: '2027-01-31' }).expect(400);
    await api(app).post('/v1/competences').set(as(admin)).send({ name: 'Janeiro/2027', startsOn: '2027-01-01', endsOn: '2027-01-31' }).expect(201);
    await api(app).post('/v1/competences').set(as(admin)).send({ name: 'Fevereiro/2027', startsOn: '2027-02-01', endsOn: '2027-02-28' }).expect(201);
    const list = await api(app).get('/v1/competences').set(as(admin)).expect(200);
    expect(list.body.data.map((c: { name: string }) => c.name)).toEqual(['Fevereiro/2027', 'Janeiro/2027']);
  });

  it('cargo: listar exige a empresa', async () => {
    const r = await api(app).get('/v1/job-positions').set(as(admin)).expect(400);
    expect(r.body.message).toMatch(/Informe a empresa/);
  });

  it('cargo: cria e lista por empresa', async () => {
    const c = await api(app).post('/v1/job-positions').set(as(admin)).send({ companyId: ids['company-est-a'], name: 'Enfermeiro', cbo: '2235-05', category: 'NURSE' }).expect(201);
    expect(c.body).toMatchObject({ cbo: '223505', category: 'NURSE' });
    ids.position = c.body.id;
    const list = await api(app).get(`/v1/job-positions?companyId=${ids['company-est-a']}`).set(as(admin)).expect(200);
    expect(list.body.total).toBe(1);
    await api(app).post('/v1/job-positions').set(as(admin)).send({ companyId: ids['company-est-b'], name: 'Invasor' }).expect(404); // empresa de outro cliente
  });

  it('unidade: cria por empresa com cerca virtual, valida coordenadas e CNPJ', async () => {
    const c = ids['company-est-a'];
    await api(app).get('/v1/units').set(as(admin)).expect(400);
    await api(app).post('/v1/units').set(as(admin)).send({ companyId: c, name: 'UBS Centro', latitude: '-19,9191' }).expect(400);
    await api(app).post('/v1/units').set(as(admin)).send({ companyId: c, name: 'UBS Centro', latitude: 95, longitude: 10 }).expect(400);
    await api(app).post('/v1/units').set(as(admin)).send({ companyId: c, name: 'UBS Centro', cnpj: '11.111.111/1111-11' }).expect(400);
    const u = await api(app).post('/v1/units').set(as(admin)).send({ companyId: c, name: 'UBS Centro', type: 'UBS', code: 'U1', latitude: '-19,9191', longitude: '-43.9386', geofenceM: '150' }).expect(201);
    expect(u.body).toMatchObject({ name: 'UBS Centro', type: 'UBS', geofenceM: 150, companyId: c });
    expect(Number(u.body.latitude)).toBeCloseTo(-19.9191);
    ids.unit = u.body.id;
    const list = await api(app).get(`/v1/units?companyId=${c}`).set(as(admin)).expect(200);
    expect(list.body.data.map((r: { id: string }) => r.id)).toEqual([u.body.id]);
    await api(app).post('/v1/units').set(as(admin)).send({ companyId: c, name: 'Outra', code: 'U1' }).expect(409);
    await api(app).get(`/v1/units?companyId=${c}`).set(as(other)).expect(404);
    await api(app).get(`/v1/units/${u.body.id}`).set(as(other)).expect(404);
  });

  it('painel: resumo com números reais e só o que o perfil pode ver', async () => {
    const s = await api(app).get('/v1/dashboard/summary').set(as(admin)).expect(200);
    expect(s.body.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(s.body.structure.companies).toBe(1);
    expect(s.body.employees.months).toHaveLength(6);
    expect(s.body.access.users).toBeGreaterThanOrEqual(2);
    const e = await api(app).get('/v1/dashboard/summary').set(as(employee)).expect(200);
    expect(e.body.structure).toBeUndefined();
    expect(e.body.access).toBeUndefined();
  });

  describe('departamentos', () => {
    it('árvore com subdepartamentos, caminho e nível', async () => {
      const co = ids['company-est-a'];
      const saude = await api(app).post('/v1/departments').set(as(admin)).send({ companyId: co, name: 'Secretaria de Saúde', code: 'SMS' }).expect(201);
      const ubs = await api(app).post('/v1/departments').set(as(admin)).send({ companyId: co, name: 'UBS Centro', parentId: saude.body.id }).expect(201);
      const rec = await api(app).post('/v1/departments').set(as(admin)).send({ companyId: co, name: 'Recepção', parentId: ubs.body.id }).expect(201);
      Object.assign(ids, { saude: saude.body.id, ubs: ubs.body.id, rec: rec.body.id });
      const tree = (await api(app).get(`/v1/departments?companyId=${co}`).set(as(admin)).expect(200)).body;
      expect(tree.map((d: { path: string; depth: number }) => [d.path, d.depth])).toEqual([
        ['Secretaria de Saúde', 0], ['Secretaria de Saúde › UBS Centro', 1], ['Secretaria de Saúde › UBS Centro › Recepção', 2],
      ]);
      await api(app).post('/v1/departments').set(as(admin)).send({ companyId: co, name: 'Duplicado', code: 'SMS' }).expect(409);
    });

    it('impede ciclo: pai não pode ser o próprio nem um descendente', async () => {
      await api(app).patch(`/v1/departments/${ids.saude}`).set(as(admin)).send({ parentId: ids.rec }).expect(400);
      await api(app).patch(`/v1/departments/${ids.saude}`).set(as(admin)).send({ parentId: ids.saude }).expect(400);
      await api(app).patch(`/v1/departments/${ids.rec}`).set(as(admin)).send({ parentId: null }).expect(200); // move para a raiz
    });

    it('seções dentro do departamento; exclusão bloqueada com subdepartamentos', async () => {
      const s = await api(app).post(`/v1/departments/${ids.ubs}/sectors`).set(as(admin)).send({ name: 'Vacinação' }).expect(201);
      await api(app).post(`/v1/departments/${ids.ubs}/sectors`).set(as(admin)).send({ name: 'vacinação' }).expect(409);
      const tree = (await api(app).get(`/v1/departments?companyId=${ids['company-est-a']}`).set(as(admin)).expect(200)).body;
      expect(tree.find((d: { id: string }) => d.id === ids.ubs).sectors).toEqual([{ id: s.body.id, name: 'Vacinação' }]);
      await api(app).delete(`/v1/departments/${ids.saude}`).set(as(admin)).expect(409); // tem UBS dentro
      ids.sector = s.body.id;
    });
  });

  it('em uso por vínculo ativo: não exclui (centro de custo, sindicato, departamento, seção)', async () => {
    await owner.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      const p = await tx.person.create({ data: { tenantId: ids['est-a']!, fullName: 'Ana Enfermeira' } });
      await tx.employment.create({ data: { tenantId: ids['est-a']!, personId: p.id, companyId: ids['company-est-a']!, registration: '1', hiredAt: new Date('2026-01-01'), costCenterId: ids['cost-centers'], unionId: ids.union, departmentId: ids.ubs, sectorId: ids.sector, positionId: ids.position } });
    });
    const cc = await api(app).delete(`/v1/cost-centers/${ids['cost-centers']}`).set(as(admin)).expect(409);
    expect(cc.body.message).toMatch(/em uso por 1 vínculo/);
    await api(app).delete(`/v1/labor-unions/${ids.union}`).set(as(admin)).expect(409);
    await api(app).delete(`/v1/job-positions/${ids.position}`).set(as(admin)).expect(409);
    await api(app).delete(`/v1/departments/${ids.ubs}/sectors/${ids.sector}`).set(as(admin)).expect(409);
    const list = await api(app).get('/v1/cost-centers').set(as(admin)).expect(200);
    expect(list.body.data[0].inUse).toBe(1);
    await api(app).delete(`/v1/employee-types/${ids['employee-types']}`).set(as(admin)).expect(204); // sem uso: exclui
  });

  it('empresa: inscrição estadual, CEI/CNO e código externo', async () => {
    const r = await api(app).post('/v1/companies').set(as(admin)).send({ legalName: 'Hospital Municipal', stateRegistration: '062.307.904/0081', cno: '51.234.56789/01', externalCode: 'FOLHA-07' }).expect(201);
    expect(r.body).toMatchObject({ stateRegistration: '0623079040081', cno: '512345678901', externalCode: 'FOLHA-07' });
    await api(app).post('/v1/companies').set(as(admin)).send({ legalName: 'Isenta Ltda', stateRegistration: 'isento' }).expect(201);
    await api(app).post('/v1/companies').set(as(admin)).send({ legalName: 'CNO curto', cno: '123' }).expect(400);
  });

  it('logo da empresa: aceita imagem real, recusa arquivo disfarçado e excesso de tamanho', async () => {
    const co = ids['company-est-a'];
    const png = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(200, 1)]);
    const ok = await api(app).put(`/v1/companies/${co}/logo`).set(as(admin)).send({ dataUrl: `data:image/png;base64,${png.toString('base64')}` }).expect(200);
    expect(ok.body.logoUpdatedAt).toBeTruthy();
    const got = await api(app).get(`/v1/companies/${co}/logo`).set(as(admin)).expect(200);
    expect(got.body.dataUrl).toBe(`data:image/png;base64,${png.toString('base64')}`);
    const fake = Buffer.from('<svg onload="alert(1)"></svg>');
    await api(app).put(`/v1/companies/${co}/logo`).set(as(admin)).send({ dataUrl: `data:image/png;base64,${fake.toString('base64')}` }).expect(400);
    await api(app).put(`/v1/companies/${co}/logo`).set(as(admin)).send({ dataUrl: `data:image/svg+xml;base64,${fake.toString('base64')}` }).expect(400);
    const big = Buffer.concat([png, Buffer.alloc(600 * 1024)]);
    await api(app).put(`/v1/companies/${co}/logo`).set(as(admin)).send({ dataUrl: `data:image/png;base64,${big.toString('base64')}` }).expect(400);
    await api(app).get(`/v1/companies/${co}/logo`).set(as(other)).expect(404);
    await api(app).delete(`/v1/companies/${co}/logo`).set(as(admin)).expect(204);
    await api(app).get(`/v1/companies/${co}/logo`).set(as(admin)).expect(404);
  });

  it('outro cliente não vê nem altera nada da estrutura', async () => {
    expect((await api(app).get('/v1/cost-centers').set(as(other)).expect(200)).body.total).toBe(0);
    await api(app).patch(`/v1/cost-centers/${ids['cost-centers']}`).set(as(other)).send({ name: 'Invadido' }).expect(404);
    await api(app).get(`/v1/departments?companyId=${ids['company-est-a']}`).set(as(other)).expect(404);
  });

  it('funcionário comum não acessa os cadastros (permissão)', async () => {
    await api(app).get('/v1/cost-centers').set(as(employee)).expect(403);
    await api(app).post('/v1/departments').set(as(employee)).send({ companyId: ids['company-est-a'], name: 'Tentativa' }).expect(403);
  });

  it('toda alteração fica na auditoria', async () => {
    const n = await owner.auditLog.count({ where: { tenantId: ids['est-a'], entity: { in: ['cost_center', 'department', 'labor_union', 'competence', 'sector', 'job_position'] } } });
    expect(n).toBeGreaterThan(10);
  });
});
