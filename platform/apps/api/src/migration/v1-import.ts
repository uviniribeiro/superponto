/**
 * Migração da v1 (backup JSON exportado do Supabase/Lovable Cloud) para a v2.
 *
 * - Cada organização raiz da v1 (empresa sem "parent_organization_id") vira um cliente (tenant) com
 *   uma empresa; as filhas (secretarias/setores com o mesmo CNPJ) viram unidades dessa empresa.
 * - Locais georreferenciados viram unidades com cerca virtual.
 * - Departamentos, cargos, funções, tipos de funcionário e justificativas viram os cadastros da v2.
 * - Perfis com CPF, PIS ou matrícula viram pessoa + vínculo; contas de login viram usuários com o
 *   mesmo e-mail e a mesma senha (hash bcrypt da v1, convertido para scrypt no primeiro login).
 * - Marcações viram marcações (origem "importação"), com hash encadeado novo e chave de idempotência.
 * - Equipamentos viram equipamentos (sem senha: o agente local guarda as credenciais).
 *
 * Não migra: papel "super_admin" (a plataforma tem um administrador só), contas de suporte sintéticas
 * da v1 (a v2 cria a própria), diagnósticos, manutenção, preferências e licenças (viram plano na v2).
 * Rodar de novo pula os clientes já importados (marcados em tenants.settings.v1RootId).
 */
import { isValidCnpj, isValidCpf, isValidPis, normalizeCnpj, onlyDigits } from '@superponto/br-docs';
import { createHash } from 'node:crypto';

type Row = Record<string, unknown>;
export interface V1Backup { exported_at?: string; tables: Array<{ schema: string; name: string; rows: Row[] }> }
export interface ImportReport { dryRun: boolean; tenants: Array<{ v1Id: string; name: string; slug: string; status: 'created' | 'skipped' }>; counts: Record<string, number>; warnings: string[] }

// Cliente Prisma do pacote de banco (transação com RLS liberada).
type Db = { $transaction: <T>(fn: (tx: any) => Promise<T>, opts?: { timeout?: number; maxWait?: number }) => Promise<T> };

const s = (v: unknown) => (v === null || v === undefined || v === '' ? null : String(v));
const bool = (v: unknown) => v === true || v === 'True' || v === 'true';
const slugify = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'cliente';
const ROLE: Record<string, string> = { admin: 'company_admin', hr: 'hr', manager: 'manager', supervisor: 'supervisor', employee: 'employee', director: 'director' };
const PLATFORM_ADMIN = 'viniciusacacio1@gmail.com';
const SEGMENT: Record<string, string> = { city_hall: 'PUBLIC_SECTOR', school: 'EDUCATION', hospital: 'HEALTH', company: 'GENERAL' };

class DryRun extends Error {}

export async function importV1(db: Db, backup: V1Backup, opts: { dryRun?: boolean } = {}): Promise<ImportReport> {
  const T = (schema: string, name: string) => backup.tables.find((t) => t.schema === schema && t.name === name)?.rows ?? [];
  const companies = T('public', 'companies');
  const profiles = T('public', 'profiles');
  const authUsers = T('auth', 'users');
  const roles = T('public', 'user_roles');
  const report: ImportReport = { dryRun: !!opts.dryRun, tenants: [], counts: {}, warnings: [] };
  const inc = (k: string, n = 1) => { report.counts[k] = (report.counts[k] ?? 0) + n; };
  const rootOf = new Map<string, string>();
  for (const c of companies) {
    let cur = c, guard = 0;
    while (cur.parent_organization_id && guard++ < 10) cur = companies.find((x) => x.id === cur.parent_organization_id) ?? cur;
    rootOf.set(String(c.id), String(cur.id));
  }

  const run = async (tx: any) => {
    await tx.$queryRaw`SELECT set_config('app.bypass_rls', 'on', true)`;
    const systemRoles = new Map<string, string>((await tx.role.findMany({ where: { tenantId: null } })).map((r: { key: string; id: string }) => [r.key, r.id]));
    for (const root of companies.filter((c) => !c.parent_organization_id)) {
      const rootId = String(root.id);
      const name = s(root.trade_name) ?? s(root.name) ?? 'Cliente';
      const already = await tx.tenant.findFirst({ where: { settings: { path: ['v1RootId'], equals: rootId } } });
      if (already) { report.tenants.push({ v1Id: rootId, name, slug: already.slug, status: 'skipped' }); continue; }
      let slug = slugify(s(root.name) ?? name);
      for (let i = 2; await tx.tenant.findUnique({ where: { slug } }); i++) slug = `${slugify(s(root.name) ?? name).slice(0, 45)}-${i}`;
      const cnpjRaw = s(root.cnpj);
      const cnpj = cnpjRaw && isValidCnpj(cnpjRaw) ? normalizeCnpj(cnpjRaw) : null;
      if (cnpjRaw && !cnpj) report.warnings.push(`${name}: CNPJ "${cnpjRaw}" inválido, ficou em branco`);
      const tenant = await tx.tenant.create({ data: { name, slug, document: cnpj, status: bool(root.is_active) ? 'ACTIVE' : 'SUSPENDED', settings: { v1RootId: rootId, importedAt: new Date().toISOString() } } });
      const tenantId = tenant.id;
      report.tenants.push({ v1Id: rootId, name, slug, status: 'created' });
      inc('clientes');
      const settings = T('public', 'company_settings').find((x) => x.company_id === rootId);
      const company = await tx.company.create({ data: {
        tenantId, legalName: s(root.name) ?? name, tradeName: s(root.trade_name), cnpj, segment: SEGMENT[String(root.organization_type)] ?? 'GENERAL',
        city: s(root.city), state: s(root.state)?.slice(0, 2) ?? null, phone: s(root.phone)?.replace(/\D/g, '').slice(0, 11) || null, cno: s(settings?.cei), externalCode: s(root.company_code),
      } });
      inc('empresas');
      const ids = new Set(companies.filter((c) => rootOf.get(String(c.id)) === rootId).map((c) => String(c.id)));
      const inTenant = (r: Row) => !!r.company_id && ids.has(String(r.company_id));

      // Unidades: organizações filhas e locais georreferenciados.
      const unitOf = new Map<string, string>();
      for (const child of companies.filter((c) => c.parent_organization_id && rootOf.get(String(c.id)) === rootId)) {
        const u = await tx.companyUnit.create({ data: { tenantId, companyId: company.id, name: s(child.name) ?? 'Unidade', type: 'OFFICE' } });
        unitOf.set(String(child.id), u.id);
        inc('unidades');
      }
      for (const g of T('public', 'georeferenced_locations').filter(inTenant)) {
        const lat = Number(g.latitude), lon = Number(g.longitude);
        const ok = Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
        await tx.companyUnit.create({ data: { tenantId, companyId: company.id, name: s(g.description) ?? 'Local', type: 'OPERATIONAL_SITE', address: g.address ? { street: String(g.address) } : undefined, ...(ok ? { latitude: lat, longitude: lon, geofenceM: Math.max(20, Math.min(5000, Number(g.radius_meters) || 100)) } : {}) } });
        inc('unidades (locais)');
      }

      // Cadastros.
      const deptOf = new Map<string, string>();
      for (const d of T('public', 'departments').filter(inTenant).sort((a, b) => (a.parent_id ? 1 : 0) - (b.parent_id ? 1 : 0))) {
        const r = await tx.department.create({ data: { tenantId, companyId: company.id, name: s(d.name) ?? 'Departamento', parentId: d.parent_id ? deptOf.get(String(d.parent_id)) ?? null : null } });
        deptOf.set(String(d.id), r.id);
        inc('departamentos');
      }
      const deptByName = async (name: string | null) => {
        if (!name) return null;
        const hit = await tx.department.findFirst({ where: { companyId: company.id, name, deletedAt: null } });
        if (hit) return hit.id;
        inc('departamentos');
        return (await tx.department.create({ data: { tenantId, companyId: company.id, name } })).id;
      };
      const posByName = async (name: string | null) => {
        if (!name) return null;
        const hit = await tx.jobPosition.findFirst({ where: { companyId: company.id, name, deletedAt: null } });
        if (hit) return hit.id;
        inc('cargos');
        return (await tx.jobPosition.create({ data: { tenantId, companyId: company.id, name } })).id;
      };
      for (const p of T('public', 'positions').filter(inTenant)) await posByName(s(p.name));
      const uniqueCatalog = async (model: 'jobFunction' | 'employeeType', rows: Row[], label: string) => {
        const seen = new Set<string>();
        for (const r of rows.filter((x) => inTenant(x) || !x.company_id)) {
          const nm = s(r.description) ?? s(r.name);
          if (!nm || seen.has(nm.toLowerCase())) continue;
          seen.add(nm.toLowerCase());
          await tx[model].create({ data: { tenantId, name: nm, code: s(r.code), active: r.is_active === undefined ? true : bool(r.is_active) } });
          inc(label);
        }
      };
      await uniqueCatalog('jobFunction', T('public', 'job_functions'), 'funções');
      await uniqueCatalog('employeeType', T('public', 'employee_types'), 'tipos de funcionário');
      const seenJ = new Set<string>();
      for (const j of T('public', 'justifications').filter((x) => inTenant(x) || !x.company_id)) {
        const nm = s(j.description); if (!nm || seenJ.has(nm.toLowerCase())) continue;
        seenJ.add(nm.toLowerCase());
        await tx.justification.create({ data: { tenantId, name: nm, code: s(j.code), disregardsDebits: !bool(j.deduct_hours), usageLimit: j.usage_limit ? Number(j.usage_limit) : null, active: bool(j.is_active ?? 'True') } });
        inc('justificativas');
      }

      // Pessoas, vínculos e usuários.
      const empOf = new Map<string, string>();
      const regs = new Set<string>();
      for (const p of profiles.filter((x) => x.company_id && ids.has(String(x.company_id)))) {
        const cpf = s(p.cpf) ? onlyDigits(String(p.cpf)) : null;
        const pis = s(p.pis) ? onlyDigits(String(p.pis)) : null;
        const validCpf = cpf && isValidCpf(cpf) ? cpf : null;
        const validPis = pis && isValidPis(pis) ? pis : null;
        if (cpf && !validCpf) report.warnings.push(`${p.full_name}: CPF inválido, ficou em branco`);
        if (pis && !validPis) report.warnings.push(`${p.full_name}: PIS inválido, ficou em branco`);
        const authUser = p.user_id ? authUsers.find((u) => u.id === p.user_id) : undefined;
        const email = s(authUser?.email)?.toLowerCase() ?? null;
        const synthetic = !!email && /^suporte@/.test(email) && email.endsWith('.pontomax.local');
        let personId: string | null = null;
        const hasRecords = T('public', 'time_records').some((r) => r.profile_id === p.id);
        if (validCpf || validPis || s(p.registration_number) || hasRecords) {
          const person = (validCpf && (await tx.person.findFirst({ where: { tenantId, cpf: validCpf } }))) || (await tx.person.create({ data: { tenantId, fullName: s(p.full_name) ?? 'Sem nome', cpf: validCpf, pis: validPis, email: email && !email.endsWith('.pontomax.local') ? email : null, phone: s(p.phone)?.replace(/\D/g, '').slice(0, 11) || null } }));
          personId = person.id;
          let reg = s(p.registration_number) ?? `V1-${String(p.id).slice(0, 8)}`;
          while (regs.has(reg)) reg = `${reg}-${String(p.id).slice(0, 4)}`;
          regs.add(reg);
          const e = await tx.employment.create({ data: {
            tenantId, personId, companyId: company.id, registration: reg, hiredAt: new Date(`${s(p.hire_date) ?? String(p.created_at ?? new Date().toISOString()).slice(0, 10)}T00:00:00Z`),
            status: bool(p.is_active) ? 'ACTIVE' : 'TERMINATED', unitId: unitOf.get(String(p.company_id)) ?? null,
            departmentId: await deptByName(s(p.department)), positionId: await posByName(s(p.position)),
          } });
          empOf.set(String(p.id), e.id);
          inc('funcionários');
        }
        if (!authUser || !email || synthetic || email === PLATFORM_ADMIN) { if (synthetic) inc('contas de suporte da v1 (substituídas)'); continue; }
        if (await tx.user.findUnique({ where: { email } })) { report.warnings.push(`${email}: já existe na v2, usuário não importado`); continue; }
        // Mesma pessoa com mais de uma conta na v1: só a primeira fica ligada ao funcionário.
        const linked = personId && (await tx.user.findFirst({ where: { personId } })) ? null : personId;
        if (personId && !linked) report.warnings.push(`${email}: a pessoa já tem outra conta; esta foi importada sem ligação com o funcionário`);
        const user = await tx.user.create({ data: { tenantId, email, displayName: s(p.full_name) ?? email, personId: linked, passwordHash: s(authUser.encrypted_password), isActive: bool(p.is_active) && !authUser.banned_until, lastLoginAt: authUser.last_sign_in_at ? new Date(String(authUser.last_sign_in_at)) : null } });
        const mine = [...new Set(roles.filter((r) => r.user_id === p.user_id).map((r) => ROLE[String(r.role)]).filter(Boolean) as string[])];
        if (!mine.length) mine.push('employee');
        for (const key of mine) await tx.userRole.create({ data: { userId: user.id, roleId: systemRoles.get(key)!, tenantId, scope: 'TENANT' } });
        if (roles.some((r) => r.user_id === p.user_id && r.role === 'super_admin')) report.warnings.push(`${email}: papel super_admin da v1 não migrado (a plataforma tem um administrador só)`);
        inc('usuários');
      }

      // Marcações (hash encadeado por vínculo, como nas demais origens).
      const last = new Map<string, string | null>();
      for (const r of T('public', 'time_records').filter((x) => empOf.has(String(x.profile_id))).sort((a, b) => String(a.recorded_at).localeCompare(String(b.recorded_at)))) {
        const employmentId = empOf.get(String(r.profile_id))!;
        const at = new Date(String(r.recorded_at));
        const key = `v1:${r.id}`;
        const prev = last.get(employmentId) ?? null;
        const hash = createHash('sha256').update([prev ?? '', employmentId, at.toISOString(), 'IMPORT', key].join('|')).digest('hex');
        const lat = Number(r.latitude), lon = Number(r.longitude);
        await tx.timeRecord.create({ data: { tenantId, employmentId, recordedAt: at, source: 'IMPORT', hash, previousHash: prev, idempotencyKey: key, ...(Number.isFinite(lat) && Number.isFinite(lon) && r.latitude !== null ? { latitude: lat, longitude: lon } : {}) } });
        last.set(employmentId, hash);
        inc('marcações');
      }
      const orphan = T('public', 'time_records').filter((x) => !empOf.has(String(x.profile_id)) && profiles.some((p) => p.id === x.profile_id && ids.has(String(p.company_id)))).length;
      if (orphan) report.warnings.push(`${name}: ${orphan} marcação(ões) de perfil sem CPF/PIS/matrícula não importada(s)`);

      // Equipamentos.
      for (const d of T('public', 'time_clock_equipment').filter(inTenant)) {
        const rep = s(d.rep_number) ?? s(d.serial_number);
        await tx.device.create({ data: {
          tenantId, companyId: company.id, name: s(d.name) ?? 'Relógio', manufacturer: s(d.manufacturer), modelName: s(d.model), host: s(d.ip_address), port: d.port ? Number(d.port) : null,
          serialNumber: s(d.serial_number), repNumber: rep && /^\d{17}$/.test(rep) ? rep : null, ordinance: 'P671_2021', status: bool(d.is_active ?? 'True') ? 'PENDING' : 'DISABLED',
        } });
        inc('equipamentos');
      }
    }
    if (opts.dryRun) throw new DryRun();
  };
  try { await db.$transaction(run, { timeout: 600_000, maxWait: 20_000 }); }
  catch (e) { if (!(e instanceof DryRun)) throw e; }
  const skippedTables = ['system_diagnostics', 'system_maintenance', 'user_preferences', 'licenses', 'role_change_history', 'identification_validation_attempts', 'pending_company_users', 'payroll_exports', 'work_schedules', 'employee_schedules', 'holidays']
    .map((n) => [n, T('public', n).length] as const).filter(([, n]) => n > 0);
  if (skippedTables.length) report.warnings.push(`Não migrados (recriar na v2 ou sem equivalente): ${skippedTables.map(([n, c]) => `${n} (${c})`).join(', ')}`);
  return report;
}
