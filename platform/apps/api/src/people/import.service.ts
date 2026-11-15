import { BadRequestException, Injectable } from '@nestjs/common';
import { isValidCpf, isValidPis, onlyDigits } from '@superponto/br-docs';
import type { AuthUser } from '../auth/auth-user.js';
import type { RequestMeta } from '../common/tenant.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { employeeCreateSchema, type EmployeeCreate } from './employees.schemas.js';
import { EmployeesService } from './employees.service.js';

/** Linha da planilha (cabeçalhos já normalizados pelo site). Valores sempre texto. */
export type ImportRow = Partial<Record<
  'nome' | 'nome_social' | 'cpf' | 'pis' | 'matricula' | 'admissao' | 'nascimento' | 'email' | 'telefone' | 'carga_semanal' | 'contrato' |
  'departamento' | 'secao' | 'cargo' | 'funcao' | 'centro_custo' | 'tipo' | 'sindicato' | 'cep' | 'numero' | 'complemento', string>>;

export interface ImportResult {
  line: number;
  registration: string | null;
  name: string | null;
  status: 'ok' | 'created' | 'updated' | 'error' | 'skipped';
  messages: string[];
}

const CONTRACTS: Record<string, string> = {
  clt: 'CLT', celetista: 'CLT', estatutario: 'STATUTORY', estatutário: 'STATUTORY', temporario: 'TEMPORARY', temporário: 'TEMPORARY',
  estagiario: 'INTERN', estagiário: 'INTERN', estagio: 'INTERN', aprendiz: 'APPRENTICE', terceirizado: 'CONTRACTOR', autonomo: 'SERVICE_PROVIDER', autônomo: 'SERVICE_PROVIDER', voluntario: 'VOLUNTEER', voluntário: 'VOLUNTEER',
};

/** dd/mm/aaaa, dd-mm-aaaa ou aaaa-mm-dd → aaaa-mm-dd (ou null se inválida). */
export function parseDate(v: string | undefined): string | null {
  if (!v?.trim()) return null;
  const s = v.trim();
  let y: number, m: number, d: number;
  const br = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(s);
  const isoM = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (br) { d = +br[1]!; m = +br[2]!; y = +br[3]!; } else if (isoM) { y = +isoM[1]!; m = +isoM[2]!; d = +isoM[3]!; } else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

const key = (v: string) => v.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

/**
 * Importação de funcionários por planilha (CSV). Resolve departamento, seção, cargo, função,
 * centro de custo, tipo e sindicato pelo nome (ou código/sigla); com `createMissing`, cria os
 * cadastros que faltarem. Simulação (`dryRun`) valida tudo sem gravar. Matrícula existente na
 * empresa é atualizada só com `updateExisting`.
 */
@Injectable()
export class EmployeeImportService {
  constructor(private readonly prisma: PrismaService, private readonly employees: EmployeesService) {}

  async run(tenantId: string, user: AuthUser, input: { companyId: string; rows: ImportRow[]; dryRun: boolean; createMissing: boolean; updateExisting: boolean }, meta: RequestMeta) {
    if (!input.rows.length) throw new BadRequestException('A planilha está vazia');
    if (input.rows.length > 5000) throw new BadRequestException('Máximo de 5.000 linhas por importação');

    // Catálogos do cliente/empresa, por nome e por código.
    const cat = await this.prisma.forTenant(tenantId, async (tx) => {
      if (!(await tx.company.findFirst({ where: { id: input.companyId, deletedAt: null } }))) throw new BadRequestException('Empresa não encontrada');
      const [departments, sectors, positions, functions, costCenters, types, unions, existing] = await Promise.all([
        tx.department.findMany({ where: { companyId: input.companyId, deletedAt: null }, select: { id: true, name: true, code: true } }),
        tx.sector.findMany({ where: { deletedAt: null, department: { companyId: input.companyId } }, select: { id: true, name: true, departmentId: true } }),
        tx.jobPosition.findMany({ where: { companyId: input.companyId, deletedAt: null }, select: { id: true, name: true } }),
        tx.jobFunction.findMany({ where: { deletedAt: null }, select: { id: true, name: true, code: true } }),
        tx.costCenter.findMany({ where: { deletedAt: null }, select: { id: true, name: true, code: true } }),
        tx.employeeType.findMany({ where: { deletedAt: null }, select: { id: true, name: true, code: true } }),
        tx.laborUnion.findMany({ where: { deletedAt: null }, select: { id: true, name: true, acronym: true } }),
        tx.employment.findMany({ where: { companyId: input.companyId, deletedAt: null }, select: { id: true, registration: true } }),
      ]);
      const index = <T extends { id: string }>(rows: T[], ...fields: Array<keyof T>) => {
        const m = new Map<string, string>();
        for (const r of rows) for (const f of fields) if (r[f]) m.set(key(String(r[f])), r.id);
        return m;
      };
      return {
        departments: index(departments, 'name', 'code'), positions: index(positions, 'name'), functions: index(functions, 'name', 'code'),
        costCenters: index(costCenters, 'name', 'code'), types: index(types, 'name', 'code'), unions: index(unions, 'acronym', 'name'),
        sectors, existing: new Map(existing.map((e) => [key(e.registration), e.id])),
      };
    });

    const missing: Record<string, Set<string>> = { departments: new Set(), positions: new Set(), functions: new Set(), costCenters: new Set(), types: new Set() };
    const seenReg = new Map<string, number>();
    const seenCpf = new Map<string, number>();
    const prepared: Array<{ result: ImportResult; data?: EmployeeCreate; existingId?: string; refs: Record<string, string | undefined> }> = [];

    input.rows.forEach((r, i) => {
      const line = i + 2; // linha 1 = cabeçalho
      const msgs: string[] = [];
      const reg = r.matricula?.trim() || null;
      const name = r.nome?.trim() || null;
      const cpf = r.cpf ? onlyDigits(r.cpf) : '';
      const pis = r.pis ? onlyDigits(r.pis) : '';
      if (!name) msgs.push('Nome obrigatório');
      if (!reg) msgs.push('Matrícula obrigatória');
      if (cpf && !isValidCpf(cpf)) msgs.push(`CPF inválido (${r.cpf})`);
      if (pis && !isValidPis(pis)) msgs.push(`PIS inválido (${r.pis})`);
      if (!cpf && !pis) msgs.push('Informe CPF ou PIS');
      const hired = parseDate(r.admissao);
      if (!hired) msgs.push(r.admissao ? `Data de admissão inválida (${r.admissao})` : 'Data de admissão obrigatória');
      const birth = r.nascimento ? parseDate(r.nascimento) : null;
      if (r.nascimento && !birth) msgs.push(`Data de nascimento inválida (${r.nascimento})`);
      if (reg) { const k = key(reg); if (seenReg.has(k)) msgs.push(`Matrícula repetida na planilha (linha ${seenReg.get(k)})`); else seenReg.set(k, line); }
      if (cpf) { if (seenCpf.has(cpf) && reg) { /* mesma pessoa em dois vínculos é permitido */ } seenCpf.set(cpf, line); }
      const contract = r.contrato ? CONTRACTS[key(r.contrato)] : 'CLT';
      if (r.contrato && !contract) msgs.push(`Tipo de contrato desconhecido (${r.contrato})`);
      const hours = r.carga_semanal ? Number(r.carga_semanal.replace(',', '.')) : undefined;
      if (r.carga_semanal && (!Number.isFinite(hours) || hours! <= 0 || hours! > 80)) msgs.push(`Carga semanal inválida (${r.carga_semanal})`);

      const refs: Record<string, string | undefined> = {};
      const resolve = (field: 'departamento' | 'cargo' | 'funcao' | 'centro_custo' | 'tipo', map: Map<string, string>, bucket: keyof typeof missing, label: string, refKey: string) => {
        const v = r[field]?.trim();
        if (!v) return;
        const id = map.get(key(v));
        if (id) refs[refKey] = id;
        else if (input.createMissing) { missing[bucket]!.add(v); refs[refKey] = `new:${key(v)}`; }
        else msgs.push(`${label} "${v}" não cadastrado(a)`);
      };
      resolve('departamento', cat.departments, 'departments', 'Departamento', 'departmentId');
      resolve('cargo', cat.positions, 'positions', 'Cargo', 'positionId');
      resolve('funcao', cat.functions, 'functions', 'Função', 'functionId');
      resolve('centro_custo', cat.costCenters, 'costCenters', 'Centro de custo', 'costCenterId');
      resolve('tipo', cat.types, 'types', 'Tipo de funcionário', 'employeeTypeId');
      if (r.sindicato?.trim()) { const id = cat.unions.get(key(r.sindicato)); if (id) refs.unionId = id; else msgs.push(`Sindicato "${r.sindicato}" não cadastrado (sindicatos não são criados automaticamente)`); }
      if (r.secao?.trim()) {
        const dep = refs.departmentId;
        const s = cat.sectors.find((x) => key(x.name) === key(r.secao!) && (!dep || x.departmentId === dep));
        if (s) refs.sectorId = s.id; else msgs.push(`Seção "${r.secao}" não encontrada${dep ? ' no departamento informado' : ''}`);
      }
      const existingId = reg ? cat.existing.get(key(reg)) : undefined;
      if (existingId && !input.updateExisting) msgs.push('Matrícula já cadastrada nesta empresa (marque "atualizar existentes" para atualizar)');

      const result: ImportResult = { line, registration: reg, name, status: msgs.length ? 'error' : 'ok', messages: msgs };
      if (msgs.length) { prepared.push({ result, refs }); return; }
      const address = r.cep ? { zipCode: onlyDigits(r.cep), number: r.numero?.trim() || undefined, complement: r.complemento?.trim() || undefined } : undefined;
      const parsed = employeeCreateSchema.safeParse({
        companyId: input.companyId, fullName: name, socialName: r.nome_social?.trim() || undefined, cpf: cpf || undefined, pis: pis || undefined,
        birthDate: birth ?? undefined, email: r.email?.trim() || undefined, phone: r.telefone ? onlyDigits(r.telefone) || undefined : undefined,
        address, registration: reg, hiredAt: hired, contractType: contract, weeklyHours: hours,
      });
      if (!parsed.success) {
        result.status = 'error';
        result.messages = parsed.error.issues.map((x) => `${x.path.join('.') || 'linha'}: ${x.message}`);
        prepared.push({ result, refs });
        return;
      }
      prepared.push({ result, data: parsed.data, existingId, refs });
    });

    const summary = () => ({
      total: prepared.length,
      valid: prepared.filter((p) => p.result.status !== 'error').length,
      errors: prepared.filter((p) => p.result.status === 'error').length,
      created: prepared.filter((p) => p.result.status === 'created').length,
      updated: prepared.filter((p) => p.result.status === 'updated').length,
      toCreate: Object.fromEntries(Object.entries(missing).map(([k, v]) => [k, [...v]])),
    });
    if (input.dryRun) return { dryRun: true, ...summary(), results: prepared.map((p) => p.result) };

    // Cria os cadastros que faltam (uma vez cada) e troca as referências "new:".
    const created: Record<string, Map<string, string>> = {};
    await this.prisma.forTenant(tenantId, async (tx) => {
      const make = async (bucket: keyof typeof missing, fn: (name: string) => Promise<{ id: string }>) => {
        created[bucket] = new Map();
        for (const n of missing[bucket]!) created[bucket]!.set(key(n), (await fn(n)).id);
      };
      await make('departments', (n) => tx.department.create({ data: { tenantId, companyId: input.companyId, name: n } }));
      await make('positions', (n) => tx.jobPosition.create({ data: { tenantId, companyId: input.companyId, name: n } }));
      await make('functions', (n) => tx.jobFunction.create({ data: { tenantId, name: n } }));
      await make('costCenters', (n) => tx.costCenter.create({ data: { tenantId, name: n } }));
      await make('types', (n) => tx.employeeType.create({ data: { tenantId, name: n } }));
    });
    const bucketOf: Record<string, string> = { departmentId: 'departments', positionId: 'positions', functionId: 'functions', costCenterId: 'costCenters', employeeTypeId: 'types' };

    for (const p of prepared) {
      if (!p.data) continue;
      const refs = Object.fromEntries(Object.entries(p.refs).map(([k, v]) => [k, v?.startsWith('new:') ? created[bucketOf[k]!]!.get(v.slice(4)) : v]));
      try {
        if (p.existingId) {
          const { companyId: _c, hiredAt: _h, ...rest } = p.data;
          await this.employees.update(tenantId, user, p.existingId, { ...rest, ...refs, reason: 'Importação de planilha' }, meta);
          p.result.status = 'updated';
        } else {
          await this.employees.create(tenantId, user, { ...p.data, ...refs } as EmployeeCreate, meta);
          p.result.status = 'created';
        }
      } catch (e) {
        p.result.status = 'error';
        p.result.messages = [(e as Error).message];
      }
    }
    return { dryRun: false, ...summary(), results: prepared.map((p) => p.result) };
  }
}
