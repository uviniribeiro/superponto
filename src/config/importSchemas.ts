import {
  Users, Building2, Briefcase, Wallet, IdCard, MapPin, CalendarDays, ClipboardCheck,
  Clock, UserX, Plane, Landmark, Network, Server,
} from 'lucide-react';

export type ImportFieldType =
  | 'text'
  | 'number'
  | 'boolean'
  | 'date'
  | 'time'
  | 'datetime'
  | 'cpf'
  | 'pis'
  | 'cnpj'
  | 'enum';

export interface ImportField {
  /** Coluna no banco de dados */
  key: string;
  /** Rótulo exibido ao usuário / cabeçalho do CSV modelo */
  label: string;
  type: ImportFieldType;
  required?: boolean;
  /** Nomes alternativos aceitos no cabeçalho do arquivo (minúsculos, sem acento) */
  aliases?: string[];
  /** Valores aceitos quando type = enum */
  options?: string[];
  /** Valor padrão aplicado quando a coluna não vier no arquivo */
  defaultValue?: string | number | boolean;
  /** Largura da coluna no layout TXT posicional */
  width?: number;
  /** Texto de exemplo usado no arquivo modelo */
  sample?: string;
  help?: string;
}

export interface ImportSchema {
  id: string;
  label: string;
  description: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
  table: string;
  /** Campo usado para evitar duplicidade */
  uniqueBy?: string[];
  /** Resolve o funcionário a partir de CPF, PIS ou matrícula e grava em profile_id */
  employeeLookup?: boolean;
  fields: ImportField[];
}

const bool = (label: string, key: string, def = true): ImportField => ({
  key,
  label,
  type: 'boolean',
  aliases: ['ativo', 'situacao', 'status'],
  defaultValue: def,
  width: 1,
  sample: 'SIM',
});

export const importSchemas: ImportSchema[] = [
  {
    id: 'employees',
    label: 'Funcionários',
    description: 'Cadastro completo de colaboradores (layout padrão do sistema)',
    group: 'Pessoas',
    icon: Users,
    table: 'profiles',
    uniqueBy: ['cpf', 'email'],
    fields: [
      { key: 'full_name', label: 'Nome', type: 'text', required: true, aliases: ['nome', 'nome_completo', 'name'], width: 60, sample: 'Maria da Silva' },
      { key: 'email', label: 'E-mail', type: 'text', required: true, aliases: ['e-mail', 'e_mail'], width: 60, sample: 'maria.silva@empresa.com.br' },
      { key: 'cpf', label: 'CPF', type: 'cpf', required: true, aliases: ['cpf_number', 'documento'], width: 11, sample: '12345678909' },
      { key: 'pis', label: 'PIS/PASEP', type: 'pis', aliases: ['nit', 'pis_pasep'], width: 11, sample: '12345678919' },
      { key: 'registration_number', label: 'Matrícula', type: 'text', aliases: ['matricula', 'registro', 'mat', 'chapa'], width: 20, sample: '000123' },
      { key: 'department', label: 'Departamento', type: 'text', aliases: ['departamento', 'setor', 'depto'], width: 40, sample: 'Administrativo' },
      { key: 'position', label: 'Cargo', type: 'text', aliases: ['cargo', 'funcao'], width: 40, sample: 'Analista' },
      { key: 'hire_date', label: 'Data de Admissão', type: 'date', aliases: ['data_admissao', 'admissao', 'dt_admissao'], width: 10, sample: '01/03/2024' },
      { key: 'phone', label: 'Telefone', type: 'text', aliases: ['telefone', 'celular', 'tel'], width: 15, sample: '11988887777' },
      bool('Ativo', 'is_active'),
    ],
  },
  {
    id: 'departments',
    label: 'Departamentos',
    description: 'Setores e centros organizacionais',
    group: 'Estrutura',
    icon: Network,
    table: 'departments',
    uniqueBy: ['name'],
    fields: [
      { key: 'name', label: 'Nome', type: 'text', required: true, aliases: ['nome', 'departamento', 'descricao'], width: 60, sample: 'Financeiro' },
      { key: 'description', label: 'Descrição', type: 'text', aliases: ['descricao', 'obs'], width: 120, sample: 'Setor financeiro' },
      bool('Ativo', 'is_active'),
    ],
  },
  {
    id: 'positions',
    label: 'Cargos',
    description: 'Cargos e níveis hierárquicos',
    group: 'Estrutura',
    icon: Briefcase,
    table: 'positions',
    uniqueBy: ['name'],
    fields: [
      { key: 'name', label: 'Nome', type: 'text', required: true, aliases: ['nome', 'cargo', 'descricao'], width: 60, sample: 'Analista Pleno' },
      { key: 'description', label: 'Descrição', type: 'text', aliases: ['descricao'], width: 120, sample: 'Cargo de nível pleno' },
      { key: 'level', label: 'Nível', type: 'number', aliases: ['nivel'], width: 3, sample: '2' },
      bool('Ativo', 'is_active'),
    ],
  },
  {
    id: 'cost_centers',
    label: 'Centros de Custo',
    description: 'Códigos contábeis para rateio',
    group: 'Estrutura',
    icon: Wallet,
    table: 'cost_centers',
    uniqueBy: ['code', 'description'],
    fields: [
      { key: 'code', label: 'Código', type: 'text', aliases: ['codigo', 'cod'], width: 10, sample: '001' },
      { key: 'description', label: 'Descrição', type: 'text', required: true, aliases: ['descricao', 'nome'], width: 60, sample: 'Administração' },
      bool('Ativo', 'is_active'),
    ],
  },
  {
    id: 'job_functions',
    label: 'Funções',
    description: 'Funções exercidas (com opção de isenção de ponto)',
    group: 'Estrutura',
    icon: IdCard,
    table: 'job_functions',
    uniqueBy: ['code', 'description'],
    fields: [
      { key: 'code', label: 'Código', type: 'text', aliases: ['codigo'], width: 10, sample: '10' },
      { key: 'description', label: 'Descrição', type: 'text', required: true, aliases: ['descricao', 'funcao', 'nome'], width: 60, sample: 'Operador de Caixa' },
      { key: 'exempt_from_time_clock', label: 'Isento de Ponto', type: 'boolean', aliases: ['isento', 'isento_ponto'], defaultValue: false, width: 1, sample: 'NAO' },
      bool('Ativo', 'is_active'),
    ],
  },
  {
    id: 'employee_types',
    label: 'Tipos de Funcionário',
    description: 'Vínculos empregatícios (CLT, estagiário, etc.)',
    group: 'Estrutura',
    icon: Users,
    table: 'employee_types',
    uniqueBy: ['code', 'description'],
    fields: [
      { key: 'code', label: 'Código', type: 'text', aliases: ['codigo'], width: 10, sample: '1' },
      { key: 'description', label: 'Descrição', type: 'text', required: true, aliases: ['descricao', 'tipo', 'nome'], width: 60, sample: 'CLT' },
      { key: 'validate_pis', label: 'Valida PIS', type: 'boolean', aliases: ['valida_pis'], defaultValue: true, width: 1, sample: 'SIM' },
      bool('Ativo', 'is_active'),
    ],
  },
  {
    id: 'marital_statuses',
    label: 'Estados Civis',
    description: 'Tabela auxiliar de estado civil',
    group: 'Tabelas Auxiliares',
    icon: Users,
    table: 'marital_statuses',
    uniqueBy: ['description'],
    fields: [
      { key: 'code', label: 'Código', type: 'text', aliases: ['codigo'], width: 10, sample: '1' },
      { key: 'description', label: 'Descrição', type: 'text', required: true, aliases: ['descricao', 'nome'], width: 40, sample: 'Solteiro(a)' },
      bool('Ativo', 'is_active'),
    ],
  },
  {
    id: 'cities',
    label: 'Cidades',
    description: 'Municípios utilizados nos cadastros',
    group: 'Tabelas Auxiliares',
    icon: MapPin,
    table: 'cities',
    uniqueBy: ['description', 'state'],
    fields: [
      { key: 'description', label: 'Cidade', type: 'text', required: true, aliases: ['cidade', 'municipio', 'nome', 'descricao'], width: 60, sample: 'São Paulo' },
      { key: 'state', label: 'UF', type: 'text', required: true, aliases: ['uf', 'estado'], width: 2, sample: 'SP' },
      { key: 'abbreviation', label: 'Sigla/IBGE', type: 'text', aliases: ['sigla', 'ibge', 'codigo'], width: 10, sample: '3550308' },
      bool('Ativo', 'is_active'),
    ],
  },
  {
    id: 'justifications',
    label: 'Justificativas',
    description: 'Códigos de abono e justificativas de ausência',
    group: 'Tabelas Auxiliares',
    icon: ClipboardCheck,
    table: 'justifications',
    uniqueBy: ['code', 'description'],
    fields: [
      { key: 'code', label: 'Código', type: 'text', aliases: ['codigo'], width: 10, sample: '01' },
      { key: 'description', label: 'Descrição', type: 'text', required: true, aliases: ['descricao', 'nome'], width: 60, sample: 'Atestado Médico' },
      { key: 'payroll_code', label: 'Código Folha', type: 'text', aliases: ['codigo_folha', 'rubrica'], width: 10, sample: '120' },
      { key: 'deduct_hours', label: 'Desconta Horas', type: 'boolean', aliases: ['desconta_horas'], defaultValue: false, width: 1, sample: 'NAO' },
      { key: 'visible_to_employees', label: 'Visível ao Funcionário', type: 'boolean', aliases: ['visivel'], defaultValue: true, width: 1, sample: 'SIM' },
      bool('Ativo', 'is_active'),
    ],
  },
  {
    id: 'holidays',
    label: 'Feriados',
    description: 'Calendário de feriados nacionais, estaduais e municipais',
    group: 'Tabelas Auxiliares',
    icon: CalendarDays,
    table: 'holidays',
    uniqueBy: ['name', 'date'],
    fields: [
      { key: 'name', label: 'Descrição', type: 'text', required: true, aliases: ['nome', 'descricao', 'feriado'], width: 60, sample: 'Confraternização Universal' },
      { key: 'date', label: 'Data', type: 'date', required: true, aliases: ['data', 'dia'], width: 10, sample: '01/01/2026' },
      { key: 'end_date', label: 'Data Final', type: 'date', aliases: ['data_final', 'data_fim'], width: 10, sample: '' },
      { key: 'holiday_type', label: 'Tipo', type: 'enum', options: ['nacional', 'estadual', 'municipal', 'facultativo'], aliases: ['tipo', 'abrangencia'], defaultValue: 'nacional', width: 12, sample: 'nacional' },
      { key: 'is_recurring', label: 'Recorrente', type: 'boolean', aliases: ['recorrente', 'anual'], defaultValue: true, width: 1, sample: 'SIM' },
      { key: 'is_partial', label: 'Parcial', type: 'boolean', aliases: ['parcial', 'meio_periodo'], defaultValue: false, width: 1, sample: 'NAO' },
      { key: 'partial_end_time', label: 'Horário Limite', type: 'time', aliases: ['hora_limite', 'horario'], width: 5, sample: '' },
    ],
  },
  {
    id: 'work_stations',
    label: 'Postos de Trabalho',
    description: 'Locais físicos com cerca eletrônica opcional',
    group: 'Locais',
    icon: Building2,
    table: 'work_stations',
    uniqueBy: ['name'],
    fields: [
      { key: 'name', label: 'Nome', type: 'text', required: true, aliases: ['nome', 'posto', 'descricao'], width: 60, sample: 'Sede Administrativa' },
      { key: 'address', label: 'Endereço', type: 'text', aliases: ['endereco', 'logradouro'], width: 120, sample: 'Av. Paulista, 1000' },
      { key: 'city', label: 'Cidade', type: 'text', aliases: ['cidade', 'municipio'], width: 60, sample: 'São Paulo' },
      { key: 'state', label: 'UF', type: 'text', aliases: ['uf', 'estado'], width: 2, sample: 'SP' },
      { key: 'zip_code', label: 'CEP', type: 'text', aliases: ['cep'], width: 8, sample: '01310100' },
      { key: 'latitude', label: 'Latitude', type: 'number', aliases: ['lat'], width: 12, sample: '-23.561414' },
      { key: 'longitude', label: 'Longitude', type: 'number', aliases: ['lon', 'lng', 'long'], width: 12, sample: '-46.655881' },
      { key: 'radius_meters', label: 'Raio (m)', type: 'number', aliases: ['raio', 'raio_metros'], defaultValue: 100, width: 6, sample: '150' },
      bool('Ativo', 'is_active'),
    ],
  },
  {
    id: 'georeferenced_locations',
    label: 'Locais Georreferenciados',
    description: 'Cercas eletrônicas permitidas para registro mobile',
    group: 'Locais',
    icon: MapPin,
    table: 'georeferenced_locations',
    uniqueBy: ['description'],
    fields: [
      { key: 'description', label: 'Descrição', type: 'text', required: true, aliases: ['descricao', 'nome', 'local'], width: 60, sample: 'Obra Centro' },
      { key: 'address', label: 'Endereço', type: 'text', aliases: ['endereco'], width: 120, sample: 'Rua XV de Novembro, 100' },
      { key: 'latitude', label: 'Latitude', type: 'number', required: true, aliases: ['lat'], width: 12, sample: '-23.545100' },
      { key: 'longitude', label: 'Longitude', type: 'number', required: true, aliases: ['lon', 'lng'], width: 12, sample: '-46.634200' },
      { key: 'radius_meters', label: 'Raio (m)', type: 'number', aliases: ['raio'], defaultValue: 100, width: 6, sample: '100' },
      bool('Ativo', 'is_active'),
    ],
  },
  {
    id: 'unions',
    label: 'Sindicatos',
    description: 'Entidades sindicais vinculadas aos funcionários',
    group: 'Estrutura',
    icon: Landmark,
    table: 'unions',
    uniqueBy: ['cnpj', 'code'],
    fields: [
      { key: 'code', label: 'Código', type: 'text', required: true, aliases: ['codigo'], width: 10, sample: '001' },
      { key: 'name', label: 'Razão Social', type: 'text', required: true, aliases: ['nome', 'razao_social'], width: 80, sample: 'Sindicato dos Comerciários' },
      { key: 'abbreviation', label: 'Sigla', type: 'text', required: true, aliases: ['sigla'], width: 20, sample: 'SINDCOM' },
      { key: 'cnpj', label: 'CNPJ', type: 'cnpj', required: true, aliases: ['cnpj'], width: 14, sample: '12345678000199' },
      { key: 'city', label: 'Cidade', type: 'text', aliases: ['cidade'], width: 60, sample: 'São Paulo' },
      { key: 'state', label: 'UF', type: 'text', aliases: ['uf', 'estado'], width: 2, sample: 'SP' },
      bool('Ativo', 'is_active'),
    ],
  },
  {
    id: 'time_records',
    label: 'Registros de Ponto',
    description: 'Marcações históricas (migração de outro sistema)',
    group: 'Movimento',
    icon: Clock,
    table: 'time_records',
    employeeLookup: true,
    fields: [
      { key: '__employee', label: 'CPF / PIS / Matrícula', type: 'text', required: true, aliases: ['cpf', 'pis', 'matricula', 'funcionario'], width: 20, sample: '12345678909' },
      { key: 'recorded_at', label: 'Data e Hora', type: 'datetime', required: true, aliases: ['data_hora', 'datahora', 'data', 'marcacao'], width: 16, sample: '01/03/2026 08:00' },
      { key: 'record_type', label: 'Tipo', type: 'enum', options: ['entrada', 'saida', 'intervalo_inicio', 'intervalo_fim'], required: true, aliases: ['tipo', 'evento'], width: 18, sample: 'entrada' },
      { key: 'nsr', label: 'NSR', type: 'number', aliases: ['nsr', 'sequencial'], width: 9, sample: '' },
      { key: 'address', label: 'Local', type: 'text', aliases: ['local', 'endereco'], width: 120, sample: '' },
    ],
  },
  {
    id: 'employee_absences',
    label: 'Afastamentos',
    description: 'Atestados, licenças e faltas justificadas',
    group: 'Movimento',
    icon: UserX,
    table: 'employee_absences',
    employeeLookup: true,
    fields: [
      { key: '__employee', label: 'CPF / PIS / Matrícula', type: 'text', required: true, aliases: ['cpf', 'pis', 'matricula', 'funcionario'], width: 20, sample: '12345678909' },
      { key: 'absence_type', label: 'Tipo', type: 'text', required: true, aliases: ['tipo', 'motivo_tipo'], width: 30, sample: 'atestado' },
      { key: 'start_date', label: 'Data Início', type: 'date', required: true, aliases: ['data_inicio', 'inicio'], width: 10, sample: '05/03/2026' },
      { key: 'end_date', label: 'Data Fim', type: 'date', required: true, aliases: ['data_fim', 'fim'], width: 10, sample: '07/03/2026' },
      { key: 'reason', label: 'Motivo', type: 'text', aliases: ['motivo', 'descricao'], width: 120, sample: 'Atestado médico 3 dias' },
      { key: 'status', label: 'Situação', type: 'enum', options: ['pending', 'approved', 'rejected'], aliases: ['situacao', 'status'], defaultValue: 'approved', width: 10, sample: 'approved' },
    ],
  },
  {
    id: 'vacation_periods',
    label: 'Períodos Aquisitivos de Férias',
    description: 'Saldos e períodos aquisitivos importados do RH',
    group: 'Movimento',
    icon: Plane,
    table: 'vacation_periods',
    employeeLookup: true,
    fields: [
      { key: '__employee', label: 'CPF / PIS / Matrícula', type: 'text', required: true, aliases: ['cpf', 'pis', 'matricula', 'funcionario'], width: 20, sample: '12345678909' },
      { key: 'period_start', label: 'Início do Período', type: 'date', required: true, aliases: ['inicio', 'periodo_inicio'], width: 10, sample: '01/01/2025' },
      { key: 'period_end', label: 'Fim do Período', type: 'date', required: true, aliases: ['fim', 'periodo_fim'], width: 10, sample: '31/12/2025' },
      { key: 'days_entitled', label: 'Dias de Direito', type: 'number', aliases: ['dias_direito'], defaultValue: 30, width: 3, sample: '30' },
      { key: 'days_taken', label: 'Dias Gozados', type: 'number', aliases: ['dias_gozados'], defaultValue: 0, width: 3, sample: '0' },
    ],
  },
];

export const importSchemaMap: Record<string, ImportSchema> = Object.fromEntries(
  importSchemas.map((s) => [s.id, s]),
);

export const importGroups = Array.from(new Set(importSchemas.map((s) => s.group)));

/** Gera o conteúdo do arquivo CSV modelo de um schema */
export function buildCsvTemplate(schema: ImportSchema, delimiter = ';'): string {
  const header = schema.fields.map((f) => f.label).join(delimiter);
  const sample = schema.fields.map((f) => f.sample ?? '').join(delimiter);
  return `${header}\n${sample}\n`;
}

/** Gera a documentação + exemplo do layout TXT posicional de um schema */
export function buildTxtTemplate(schema: ImportSchema): string {
  let pos = 1;
  const lines: string[] = [];
  lines.push(`# LAYOUT POSICIONAL - ${schema.label.toUpperCase()} (Ponto Max)`);
  lines.push('# Arquivo texto (.txt) sem cabecalho, uma linha por registro, codificacao UTF-8.');
  lines.push('# Campos alinhados a esquerda e completados com espacos ate a largura indicada.');
  lines.push('#');
  lines.push('# INICIO  FIM   TAM  CAMPO');
  for (const f of schema.fields) {
    const w = f.width ?? 30;
    lines.push(
      `# ${String(pos).padStart(6, '0')}  ${String(pos + w - 1).padStart(5, '0')}  ${String(w).padStart(3, '0')}  ${f.label}${f.required ? ' (obrigatorio)' : ''}`,
    );
    pos += w;
  }
  lines.push('#');
  lines.push('# Datas no formato DDMMAAAA ou DD/MM/AAAA. Booleanos: SIM/NAO ou 1/0.');
  lines.push('# Exemplo:');
  lines.push(schema.fields.map((f) => (f.sample ?? '').padEnd(f.width ?? 30, ' ')).join(''));
  return lines.join('\n') + '\n';
}
