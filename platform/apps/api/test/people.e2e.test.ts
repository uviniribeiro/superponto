// Fase 2: funcionários (pessoa + vínculo), importação por planilha, agrupamentos e regras de acesso.
import type { INestApplication } from '@nestjs/common';
import { PasswordHasher } from '@nestjs/authentication';
import { createPrismaClient } from '@superponto/database';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { api, createApp, ownerUrl } from './helpers.js';

const PASSWORD = 'Senha-Muito-Forte-2026';
const owner = createPrismaClient(ownerUrl);
const hasher = new PasswordHasher();
let app: INestApplication;
let admin = '';
let reader = '';
let other = '';
const ids: Record<string, string> = {};
const as = (t: string) => ({ Authorization: `Bearer ${t}` });
const login = (email: string, password = PASSWORD) => api(app).post('/v1/auth/token').send({ email, password });
const token = async (email: string, password = PASSWORD) => (await login(email, password).expect(200)).body.accessToken as string;

// CPFs e PIS válidos (gerados com os dígitos verificadores corretos)
const ANA = { cpf: '52998224725', pis: '12056462127' };
const BRUNO = { cpf: '11144477735' };
const CARLA = { cpf: '93541134780' };

describe('Fase 2: funcionários, importação, agrupamentos e acesso', () => {
  beforeAll(async () => {
    ({ app } = await createApp());
    await owner.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      const adminRole = await tx.role.findFirstOrThrow({ where: { tenantId: null, key: 'company_admin' } });
      for (const slug of ['pes-a', 'pes-b']) {
        const t = await tx.tenant.create({ data: { name: slug, slug } });
        ids[slug] = t.id;
        const u = await tx.user.create({ data: { tenantId: t.id, email: `admin@${slug}.test`, displayName: 'Admin', passwordHash: await hasher.hash(PASSWORD) } });
        await tx.userRole.create({ data: { userId: u.id, roleId: adminRole.id, tenantId: t.id, scope: 'TENANT' } });
      }
      const t = ids['pes-a']!;
      ids.co1 = (await tx.company.create({ data: { tenantId: t, legalName: 'Prefeitura Saúde' } })).id;
      ids.co2 = (await tx.company.create({ data: { tenantId: t, legalName: 'Prefeitura Educação' } })).id;
      ids.saude = (await tx.department.create({ data: { tenantId: t, companyId: ids.co1, name: 'Secretaria de Saúde' } })).id;
      ids.ubs = (await tx.department.create({ data: { tenantId: t, companyId: ids.co1, name: 'UBS Centro', parentId: ids.saude } })).id;
      ids.escola = (await tx.department.create({ data: { tenantId: t, companyId: ids.co2, name: 'Escola Municipal' } })).id;
      ids.vacina = (await tx.sector.create({ data: { tenantId: t, departmentId: ids.ubs, name: 'Vacinação' } })).id;
      ids.enf = (await tx.jobPosition.create({ data: { tenantId: t, companyId: ids.co1, name: 'Enfermeiro' } })).id;
      ids.union = (await tx.laborUnion.create({ data: { tenantId: t, name: 'Sindicato Saúde', acronym: 'SINDSAUDE' } })).id;
      // usuário só com leitura de vínculos (sem dados sensíveis)
      const perms = await tx.permission.findMany({ where: { key: { in: ['people.employments:read'] } } });
      const role = await tx.role.create({ data: { tenantId: t, key: 'leitor', name: 'Leitor' } });
      await tx.rolePermission.createMany({ data: perms.map((p) => ({ roleId: role.id, permissionId: p.id })) });
      const r = await tx.user.create({ data: { tenantId: t, email: 'leitor@pes-a.test', displayName: 'Leitor', passwordHash: await hasher.hash(PASSWORD) } });
      await tx.userRole.create({ data: { userId: r.id, roleId: role.id, tenantId: t, scope: 'TENANT' } });
      ids.reader = r.id;
    });
    admin = await token('admin@pes-a.test');
    reader = await token('leitor@pes-a.test');
    other = await token('admin@pes-b.test');
  });

  afterAll(async () => {
    await app.close();
    await owner.$disconnect();
  });

  describe('funcionários', () => {
    it('cadastra pessoa + vínculo com a estrutura', async () => {
      const r = await api(app).post('/v1/employees').set(as(admin)).send({
        companyId: ids.co1, fullName: 'Ana Souza', cpf: '529.982.247-25', pis: ANA.pis, birthDate: '1990-05-10', email: 'ana@x.test',
        registration: '1001', hiredAt: '2024-03-01', departmentId: ids.ubs, sectorId: ids.vacina, positionId: ids.enf, unionId: ids.union, weeklyHours: 40,
      }).expect(201);
      ids.ana = r.body.id;
      expect(r.body).toMatchObject({ fullName: 'Ana Souza', cpf: ANA.cpf, registration: '1001', status: 'ACTIVE', department: { name: 'UBS Centro' }, sector: { name: 'Vacinação' }, position: { name: 'Enfermeiro' }, union: { acronym: 'SINDSAUDE' }, weeklyHours: 40 });
    });

    it('valida CPF/PIS e exige ao menos um', async () => {
      await api(app).post('/v1/employees').set(as(admin)).send({ companyId: ids.co1, fullName: 'Sem Doc', registration: '9', hiredAt: '2024-01-01' }).expect(400);
      await api(app).post('/v1/employees').set(as(admin)).send({ companyId: ids.co1, fullName: 'CPF Ruim', cpf: '11111111111', registration: '9', hiredAt: '2024-01-01' }).expect(400);
    });

    it('matrícula única por empresa; mesma pessoa pode ter vínculo em outra empresa', async () => {
      const dup = await api(app).post('/v1/employees').set(as(admin)).send({ companyId: ids.co1, fullName: 'Outra', cpf: BRUNO.cpf, registration: '1001', hiredAt: '2024-01-01' }).expect(409);
      expect(dup.body.message).toMatch(/Matrícula/);
      const second = await api(app).post('/v1/employees').set(as(admin)).send({ companyId: ids.co2, fullName: 'Ana Souza', cpf: ANA.cpf, registration: 'E-77', hiredAt: '2025-02-01', departmentId: ids.escola }).expect(201);
      expect(second.body.personId).toBeDefined();
      const detail = await api(app).get(`/v1/employees/${ids.ana}`).set(as(admin)).expect(200);
      expect(detail.body.otherEmployments.map((e: { registration: string }) => e.registration)).toEqual(['E-77']);
      expect(second.body.personId).toBe(detail.body.personId); // mesma pessoa
    });

    it('cadastro de outra empresa não pode ser usado (departamento, cargo)', async () => {
      const r = await api(app).post('/v1/employees').set(as(admin)).send({ companyId: ids.co2, fullName: 'Bruno', cpf: BRUNO.cpf, registration: '2', hiredAt: '2024-01-01', departmentId: ids.ubs }).expect(400);
      expect(r.body.message).toMatch(/Departamento não pertence/);
    });

    it('CPF e PIS mascarados para quem não tem "dados sensíveis"; busca por CPF só com a permissão', async () => {
      const r = await api(app).get(`/v1/employees/${ids.ana}`).set(as(reader)).expect(200);
      expect(r.body).toMatchObject({ cpf: '***.***.247-25', sensitiveVisible: false });
      expect(r.body.pis).not.toContain(ANA.pis);
      expect((await api(app).get('/v1/employees?search=52998').set(as(reader)).expect(200)).body.total).toBe(0);
      expect((await api(app).get('/v1/employees?search=52998').set(as(admin)).expect(200)).body.total).toBe(2); // dois vínculos da Ana
      await api(app).post('/v1/employees').set(as(reader)).send({}).expect(403);
    });

    it('filtro por departamento inclui os subdepartamentos', async () => {
      await api(app).post('/v1/employees').set(as(admin)).send({ companyId: ids.co1, fullName: 'Carla Lima', cpf: CARLA.cpf, registration: '1002', hiredAt: '2024-01-01', departmentId: ids.saude }).expect(201);
      const withSub = await api(app).get(`/v1/employees?departmentId=${ids.saude}`).set(as(admin)).expect(200);
      expect(withSub.body.data.map((e: { fullName: string }) => e.fullName)).toEqual(['Ana Souza', 'Carla Lima']);
      const only = await api(app).get(`/v1/employees?departmentId=${ids.saude}&includeSubdepartments=false`).set(as(admin)).expect(200);
      expect(only.body.data.map((e: { fullName: string }) => e.fullName)).toEqual(['Carla Lima']);
    });

    it('troca de departamento solta a seção e grava o histórico', async () => {
      const r = await api(app).patch(`/v1/employees/${ids.ana}`).set(as(admin)).send({ departmentId: ids.saude, effectiveAt: '2026-11-01', reason: 'Remanejamento' }).expect(200);
      expect(r.body).toMatchObject({ department: { name: 'Secretaria de Saúde' }, sector: null });
      const d = await api(app).get(`/v1/employees/${ids.ana}`).set(as(admin)).expect(200);
      expect(d.body.history.map((h: { field: string }) => h.field).sort()).toEqual(['departmentId', 'sectorId']);
      expect(d.body.history[0]).toMatchObject({ reason: 'Remanejamento', effectiveAt: '2026-11-01T00:00:00.000Z' });
    });

    it('desligamento e reativação; desligado não é alterado e some da lista padrão', async () => {
      await api(app).post(`/v1/employees/${ids.ana}/terminate`).set(as(admin)).send({ terminatedAt: '2020-01-01', reason: 'Pedido' }).expect(400); // antes da admissão
      await api(app).post(`/v1/employees/${ids.ana}/terminate`).set(as(admin)).send({ terminatedAt: '2026-11-10', reason: 'Pedido de demissão' }).expect(201);
      await api(app).patch(`/v1/employees/${ids.ana}`).set(as(admin)).send({ fullName: 'Ana S.' }).expect(400);
      const active = await api(app).get(`/v1/employees?companyId=${ids.co1}`).set(as(admin)).expect(200);
      expect(active.body.data.map((e: { fullName: string }) => e.fullName)).toEqual(['Carla Lima']);
      const term = await api(app).get(`/v1/employees?companyId=${ids.co1}&status=TERMINATED`).set(as(admin)).expect(200);
      expect(term.body.data[0]).toMatchObject({ fullName: 'Ana Souza', terminatedAt: '2026-11-10' });
      await api(app).post(`/v1/employees/${ids.ana}/reactivate`).set(as(admin)).expect(201);
    });

    it('a auditoria nunca guarda o CPF completo', async () => {
      const logs = await owner.auditLog.findMany({ where: { entity: 'employment', entityId: ids.ana } });
      expect(logs.length).toBeGreaterThan(2);
      expect(JSON.stringify(logs.map((l) => [l.before, l.after]))).not.toContain(ANA.cpf);
    });
  });

  describe('importação por planilha', () => {
    const rows = [
      { nome: 'Daniel Rocha', cpf: '390.533.447-05', matricula: '2001', admissao: '01/02/2025', departamento: 'ubs centro', secao: 'Vacinação', cargo: 'Enfermeiro', sindicato: 'sindsaude', contrato: 'Estatutário', carga_semanal: '30' },
      { nome: 'Elisa Prado', cpf: '123.456.789-00', matricula: '2002', admissao: '2025-02-30' },
      { nome: 'Fabio Reis', pis: '12056462127', matricula: '2003', admissao: '10/03/2025', departamento: 'Farmácia', cargo: 'Farmacêutico', funcao: 'Dispensação' },
      { nome: 'Gabi', cpf: '111.444.777-35', matricula: '2001', admissao: '01/01/2025' },
    ];

    it('simulação: valida tudo, aponta erros por linha e não grava nada', async () => {
      const r = await api(app).post('/v1/employees/import').set(as(admin)).send({ companyId: ids.co1, dryRun: true, rows }).expect(201);
      expect(r.body).toMatchObject({ dryRun: true, total: 4, valid: 1, errors: 3 });
      const byLine = Object.fromEntries(r.body.results.map((x: { line: number; messages: string[] }) => [x.line, x.messages.join(' | ')]));
      expect(byLine[3]).toMatch(/CPF inválido/);
      expect(byLine[3]).toMatch(/admissão inválida/);
      expect(byLine[4]).toMatch(/Departamento "Farmácia" não cadastrado/);
      expect(byLine[5]).toMatch(/Matrícula repetida na planilha \(linha 2\)/);
      expect(await owner.employment.count({ where: { companyId: ids.co1, registration: { startsWith: '200' } } })).toBe(0);
    });

    it('com "criar cadastros ausentes", cria departamento, cargo e função e importa', async () => {
      const r = await api(app).post('/v1/employees/import').set(as(admin)).send({ companyId: ids.co1, dryRun: false, createMissing: true, rows: [rows[0], rows[2]] }).expect(201);
      expect(r.body).toMatchObject({ created: 2, errors: 0, toCreate: { departments: ['Farmácia'], positions: ['Farmacêutico'], functions: ['Dispensação'] } });
      const daniel = await owner.employment.findFirstOrThrow({ where: { companyId: ids.co1, registration: '2001' }, include: { department: true, sector: true, position: true, person: true } });
      expect(daniel).toMatchObject({ contractType: 'STATUTORY', department: { name: 'UBS Centro' }, sector: { name: 'Vacinação' }, position: { name: 'Enfermeiro' } });
      expect(daniel.hiredAt.toISOString().slice(0, 10)).toBe('2025-02-01');
    });

    it('matrícula existente: erro, ou atualização com "atualizar existentes"', async () => {
      const again = await api(app).post('/v1/employees/import').set(as(admin)).send({ companyId: ids.co1, dryRun: true, rows: [{ ...rows[0], nome: 'Daniel R. Rocha' }] }).expect(201);
      expect(again.body.results[0].messages[0]).toMatch(/já cadastrada/);
      const up = await api(app).post('/v1/employees/import').set(as(admin)).send({ companyId: ids.co1, dryRun: false, updateExisting: true, rows: [{ ...rows[0], nome: 'Daniel R. Rocha' }] }).expect(201);
      expect(up.body.updated).toBe(1);
      expect((await owner.employment.findFirstOrThrow({ where: { registration: '2001' }, include: { person: true } })).person.fullName).toBe('Daniel R. Rocha');
    });
  });

  describe('agrupamentos', () => {
    it('cria, define membros e filtra funcionários pelo agrupamento', async () => {
      const g = await api(app).post('/v1/groupings').set(as(admin)).send({ name: 'Plantão noturno', code: 'PN' }).expect(201);
      ids.group = g.body.id;
      const members = await api(app).put(`/v1/groupings/${g.body.id}/members`).set(as(admin)).send({ employmentIds: [ids.ana], positionIds: [ids.enf] }).expect(200);
      expect(members.body.employments.map((e: { fullName: string }) => e.fullName)).toEqual(['Ana Souza']);
      expect(members.body.positions.map((p: { name: string }) => p.name)).toEqual(['Enfermeiro']);
      const list = await api(app).get(`/v1/employees?groupingId=${g.body.id}`).set(as(admin)).expect(200);
      expect(list.body.data.map((e: { fullName: string }) => e.fullName)).toEqual(['Ana Souza']);
      await api(app).delete(`/v1/groupings/${g.body.id}`).set(as(admin)).expect(409); // em uso
      await api(app).put(`/v1/groupings/${g.body.id}/members`).set(as(other)).send({ employmentIds: [] }).expect(404);
    });
  });

  describe('acesso dos usuários', () => {
    it('dias da semana: fora dos dias permitidos o login é recusado com o motivo', async () => {
      const today = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' })).getDay();
      const others = [0, 1, 2, 3, 4, 5, 6].filter((d) => d !== today);
      await api(app).patch(`/v1/users/${ids.reader}`).set(as(admin)).send({ accessWeekdays: others }).expect(200);
      const r = await login('leitor@pes-a.test').expect(403);
      expect(r.body.message).toMatch(/não é permitido em/);
      await api(app).get('/v1/employees').set(as(reader)).expect(401); // sessão já emitida também cai
      await api(app).patch(`/v1/users/${ids.reader}`).set(as(admin)).send({ accessWeekdays: [] }).expect(200);
      reader = await token('leitor@pes-a.test');
    });

    it('bloqueio por período: login recusado com o motivo; revogar libera', async () => {
      const b = await api(app).post(`/v1/users/${ids.reader}/blocks`).set(as(admin)).send({ reason: 'Férias', startsAt: new Date(Date.now() - 60_000).toISOString(), endsAt: new Date(Date.now() + 86_400_000).toISOString() }).expect(201);
      await api(app).get('/v1/employees').set(as(reader)).expect(401);
      const r = await login('leitor@pes-a.test').expect(403);
      expect(r.body.message).toMatch(/Acesso bloqueado até .* Motivo: Férias/);
      const wrong = await login('leitor@pes-a.test', 'senha-errada').expect(401); // senha errada não revela o bloqueio
      expect(wrong.body.message).not.toMatch(/bloqueado/);
      const list = await api(app).get('/v1/access-blocks').set(as(admin)).expect(200);
      expect(list.body[0]).toMatchObject({ reason: 'Férias', state: 'ACTIVE', user: { email: 'leitor@pes-a.test' } });
      await api(app).delete(`/v1/users/${ids.reader}/blocks/${b.body.id}`).set(as(admin)).expect(204);
      reader = await token('leitor@pes-a.test');
    });

    it('não é possível bloquear o próprio acesso nem limitar os próprios dias', async () => {
      const me = (await api(app).get('/v1/auth/me').set(as(admin)).expect(200)).body;
      await api(app).post(`/v1/users/${me.id}/blocks`).set(as(admin)).send({ reason: 'Teste', startsAt: new Date().toISOString() }).expect(400);
      await api(app).patch(`/v1/users/${me.id}`).set(as(admin)).send({ accessWeekdays: [1] }).expect(400);
    });

    it('troca de senha pelo próprio usuário; troca obrigatória fica desmarcada', async () => {
      await api(app).patch(`/v1/users/${ids.reader}`).set(as(admin)).send({ mustChangePassword: true }).expect(200);
      // a API relê o usuário a cada requisição: o token atual já enxerga a troca obrigatória
      expect((await api(app).get('/v1/auth/me').set(as(reader)).expect(200)).body.mustChangePassword).toBe(true);
      await api(app).post('/v1/auth/password/change').set(as(reader)).send({ currentPassword: 'errada', newPassword: 'Nova-Senha-Forte-2027' }).expect(400);
      await api(app).post('/v1/auth/password/change').set(as(reader)).send({ currentPassword: PASSWORD, newPassword: 'curta' }).expect(400);
      await api(app).post('/v1/auth/password/change').set(as(reader)).send({ currentPassword: PASSWORD, newPassword: 'Nova-Senha-Forte-2027' }).expect(204);
      await login('leitor@pes-a.test').expect(401);
      const t = await token('leitor@pes-a.test', 'Nova-Senha-Forte-2027');
      expect((await api(app).get('/v1/auth/me').set(as(t)).expect(200)).body.mustChangePassword).toBe(false);
    });
  });

  it('outro cliente não vê os funcionários', async () => {
    expect((await api(app).get('/v1/employees').set(as(other)).expect(200)).body.total).toBe(0);
    await api(app).get(`/v1/employees/${ids.ana}`).set(as(other)).expect(404);
    await api(app).patch(`/v1/employees/${ids.ana}`).set(as(other)).send({ fullName: 'Xavier Invasor' }).expect(404);
  });
});
