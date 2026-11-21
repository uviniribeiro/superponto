// Migração v1 → v2 com um backup fictício: clientes, unidades, funcionários, usuários (senha bcrypt
// da v1 funciona e vira scrypt), marcações, conferência sem gravar e reexecução sem duplicar.
import type { INestApplication } from '@nestjs/common';
import { createPrismaClient } from '@superponto/database';
import bcrypt from 'bcryptjs';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { importV1, type V1Backup } from '../src/migration/v1-import.js';
import { api, createApp, ownerUrl } from './helpers.js';

const owner = createPrismaClient(ownerUrl);
let app: INestApplication;
const ROOT = '11111111-1111-4111-8111-111111111111', CHILD = '22222222-2222-4222-8222-222222222222', OWN = '33333333-3333-4333-8333-333333333333';
const U1 = 'aaaaaaaa-0000-4000-8000-000000000001', U2 = 'aaaaaaaa-0000-4000-8000-000000000002', U3 = 'aaaaaaaa-0000-4000-8000-000000000003';
const P1 = 'bbbbbbbb-0000-4000-8000-000000000001', P2 = 'bbbbbbbb-0000-4000-8000-000000000002', P3 = 'bbbbbbbb-0000-4000-8000-000000000003';
let backup: V1Backup;

describe('Migração da v1', () => {
  beforeAll(async () => {
    ({ app } = await createApp());
    const hash = await bcrypt.hash('SenhaAntigaDaV1!', 10);
    backup = { tables: [
      { schema: 'auth', name: 'users', rows: [
        { id: U1, email: 'gestora@prefeitura-migra.test', encrypted_password: hash, last_sign_in_at: '2026-10-01T10:00:00Z' },
        { id: U2, email: 'suporte@abcd1234.pontomax.local', encrypted_password: hash },
        { id: U3, email: 'chefe@prefeitura-migra.test', encrypted_password: hash },
      ] },
      { schema: 'public', name: 'companies', rows: [
        { id: ROOT, name: 'MUNICIPIO DE MIGRACAO', trade_name: 'PREFEITURA DE MIGRACAO', cnpj: '11.222.333/0001-81', city: 'BETIM', state: 'MG', is_active: 'True', organization_type: 'city_hall', parent_organization_id: null },
        { id: CHILD, name: 'Saúde', cnpj: '11.222.333/0001-81', is_active: 'True', organization_type: 'city_hall', parent_organization_id: ROOT },
        // Mesma base (cliente), CNPJ próprio: vira outra empresa do cliente, escolhida por CNPJ.
        { id: OWN, name: 'FUNDO MUNICIPAL DE SAUDE', cnpj: '33.004.780/0001-05', is_active: 'True', organization_type: 'city_hall', parent_organization_id: ROOT },
      ] },
      { schema: 'public', name: 'profiles', rows: [
        { id: P1, user_id: U1, full_name: 'Gestora Migrada', cpf: '529.982.247-25', pis: null, registration_number: '1000', hire_date: '2025-02-01', company_id: CHILD, department: 'Recursos Humanos', position: 'Assistente', is_active: 'True' },
        { id: P2, user_id: U2, full_name: 'Usuário Suporte', company_id: ROOT, is_active: 'True' },
        { id: P3, user_id: U3, full_name: 'Chefe Migrado', cpf: null, pis: null, registration_number: null, company_id: ROOT, is_active: 'True' },
      ] },
      { schema: 'public', name: 'user_roles', rows: [{ user_id: U1, role: 'manager' }, { user_id: U1, role: 'employee' }, { user_id: U3, role: 'admin' }, { user_id: U3, role: 'super_admin' }] },
      { schema: 'public', name: 'time_records', rows: [
        { id: 'cccccccc-0000-4000-8000-000000000001', profile_id: P1, recorded_at: '2026-10-05T11:00:00Z', latitude: '-19.9', longitude: '-44.1' },
        { id: 'cccccccc-0000-4000-8000-000000000002', profile_id: P1, recorded_at: '2026-10-05T20:00:00Z', latitude: null, longitude: null },
      ] },
      { schema: 'public', name: 'georeferenced_locations', rows: [{ company_id: ROOT, description: 'Sede', latitude: '-19.97', longitude: '-44.19', radius_meters: '150' }] },
      { schema: 'public', name: 'time_clock_equipment', rows: [{ company_id: ROOT, name: 'Relógio da Sede', manufacturer: 'henry', model: 'primme', ip_address: '10.0.0.5', port: '3000', serial_number: '' }] },
      { schema: 'public', name: 'system_diagnostics', rows: [{ id: 'x' }] },
    ] };
  });
  afterAll(async () => { await app.close(); await owner.$disconnect(); });

  it('conferência não grava nada', async () => {
    const r = await importV1(owner as never, backup, { dryRun: true });
    expect(r.counts).toMatchObject({ clientes: 1, empresas: 2, funcionários: 1, usuários: 2, marcações: 2, equipamentos: 1, 'usuários de suporte': 1 });
    expect(await owner.$transaction(async (tx) => { await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`; return tx.tenant.count({ where: { slug: 'municipio-de-migracao' } }); })).toBe(0);
  });

  it('importa, a senha da v1 continua valendo (e vira scrypt) e rodar de novo não duplica', async () => {
    const r = await importV1(owner as never, backup);
    expect(r.tenants).toEqual([expect.objectContaining({ slug: 'municipio-de-migracao', status: 'created' })]);
    expect(r.warnings.join(' ')).toMatch(/super_admin/);
    expect(r.warnings.join(' ')).toMatch(/system_diagnostics \(1\)/);
    const data = await owner.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
      const t = await tx.tenant.findUniqueOrThrow({ where: { slug: 'municipio-de-migracao' } });
      return {
        company: await tx.company.findFirstOrThrow({ where: { tenantId: t.id, cnpj: '11222333000181' } }),
        companies: await tx.company.findMany({ where: { tenantId: t.id }, orderBy: { cnpj: 'asc' } }),
        units: await tx.companyUnit.findMany({ where: { tenantId: t.id }, orderBy: { name: 'asc' } }),
        emp: await tx.employment.findFirstOrThrow({ where: { tenantId: t.id }, include: { person: true, department: true, position: true, unit: true } }),
        records: await tx.timeRecord.findMany({ where: { tenantId: t.id }, orderBy: { recordedAt: 'asc' } }),
        users: await tx.user.findMany({ where: { tenantId: t.id }, include: { roles: { include: { role: true } } }, orderBy: { email: 'asc' } }),
        devices: await tx.device.findMany({ where: { tenantId: t.id } }),
      };
    });
    expect(data.company).toMatchObject({ legalName: 'MUNICIPIO DE MIGRACAO', cnpj: '11222333000181', segment: 'PUBLIC_SECTOR' });
    expect(data.companies.map((c) => c.cnpj)).toEqual(['11222333000181', '33004780000105']);
    expect(data.units.map((u) => [u.name, u.geofenceM])).toEqual([['Saúde', null], ['Sede', 150]]);
    expect(data.emp).toMatchObject({ registration: '1000', person: { cpf: '52998224725' }, department: { name: 'Recursos Humanos' }, position: { name: 'Assistente' }, unit: { name: 'Saúde' } });
    expect(data.records.map((x) => x.source)).toEqual(['IMPORT', 'IMPORT']);
    expect(data.records[1]!.previousHash).toBe(data.records[0]!.hash);
    expect(data.users.filter((u) => !u.isSupport).map((u) => [u.email, u.roles.map((r) => r.role.key).sort().join(',')])).toEqual([['chefe@prefeitura-migra.test', 'company_admin'], ['gestora@prefeitura-migra.test', 'employee,manager']]);
    // Suporte da v1 vira o suporte do cliente: usuário "suporte", oculto, mesma senha.
    expect(data.users.filter((u) => u.isSupport).map((u) => [u.username, u.roles[0]!.role.key])).toEqual([['suporte', 'company_admin']]);
    expect(data.users.some((u) => u.isPlatformAdmin)).toBe(false);
    expect(data.devices[0]).toMatchObject({ name: 'Relógio da Sede', manufacturer: 'henry', host: '10.0.0.5', port: 3000 });

    // Login com a senha antiga; o hash passa para scrypt.
    await api(app).post('/v1/auth/token').send({ email: 'gestora@prefeitura-migra.test', password: 'errada-errada' }).expect(401);
    await api(app).post('/v1/auth/token').send({ email: 'gestora@prefeitura-migra.test', password: 'SenhaAntigaDaV1!' }).expect(200);
    const after = await owner.$transaction(async (tx) => { await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`; return tx.user.findUniqueOrThrow({ where: { email: 'gestora@prefeitura-migra.test' } }); });
    expect(after.passwordHash).toMatch(/^\$scrypt\$/);
    // Login da v1 continua: usuário (parte antes do @) + CNPJ da empresa + senha.
    expect(after.username).toBe('gestora');
    await api(app).post('/v1/auth/token').send({ username: 'gestora', cnpj: '11.222.333/0001-81', password: 'SenhaAntigaDaV1!' }).expect(200);
    await api(app).post('/v1/auth/token').send({ email: 'gestora@prefeitura-migra.test', password: 'SenhaAntigaDaV1!' }).expect(200);
    const sup = await api(app).post('/v1/auth/token').send({ username: 'suporte', cnpj: '11222333000181', password: 'SenhaAntigaDaV1!' }).expect(200);
    expect((await api(app).get('/v1/auth/me').set({ Authorization: `Bearer ${sup.body.accessToken}` }).expect(200)).body.isSupport).toBe(true);

    const again = await importV1(owner as never, backup);
    expect(again.tenants[0]!.status).toBe('skipped');
    expect(again.counts.marcações).toBeUndefined();
  });
});
