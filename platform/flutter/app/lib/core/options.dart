// Listas fixas usadas em formulários.
const ufs = ['AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA', 'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO'];

const brTimezones = [
  ('America/Sao_Paulo', 'Brasília (SP, RJ, MG, Sul, GO, DF, BA...)'),
  ('America/Fortaleza', 'Fortaleza (CE, RN, PB, PI, MA)'),
  ('America/Recife', 'Recife (PE)'),
  ('America/Maceio', 'Maceió (AL, SE)'),
  ('America/Bahia', 'Salvador (BA)'),
  ('America/Belem', 'Belém (PA leste, AP)'),
  ('America/Araguaina', 'Araguaína (TO)'),
  ('America/Santarem', 'Santarém (PA oeste)'),
  ('America/Cuiaba', 'Cuiabá (MT)'),
  ('America/Campo_Grande', 'Campo Grande (MS)'),
  ('America/Manaus', 'Manaus (AM)'),
  ('America/Porto_Velho', 'Porto Velho (RO)'),
  ('America/Boa_Vista', 'Boa Vista (RR)'),
  ('America/Rio_Branco', 'Rio Branco (AC)'),
  ('America/Noronha', 'Fernando de Noronha'),
];

const segments = {'GENERAL': 'Geral', 'EDUCATION': 'Educação', 'HEALTH': 'Saúde', 'PUBLIC_SECTOR': 'Setor público', 'INDUSTRY': 'Indústria', 'RETAIL': 'Varejo', 'SERVICES': 'Serviços'};

String maskCep(String v) {
  final d = v.replaceAll(RegExp(r'\D'), '');
  final s = d.length > 8 ? d.substring(0, 8) : d;
  return s.length > 5 ? '${s.substring(0, 5)}-${s.substring(5)}' : s;
}

String maskPhone(String v) {
  final d = v.replaceAll(RegExp(r'\D'), '');
  final s = d.length > 11 ? d.substring(0, 11) : d;
  if (s.length <= 2) return s;
  if (s.length <= 6) return '(${s.substring(0, 2)}) ${s.substring(2)}';
  final split = s.length == 11 ? 7 : 6;
  return '(${s.substring(0, 2)}) ${s.substring(2, split)}-${s.substring(split)}';
}

const contractTypes = [
  ('CLT', 'CLT'),
  ('STATUTORY', 'Estatutário'),
  ('TEMPORARY', 'Temporário'),
  ('INTERN', 'Estagiário'),
  ('APPRENTICE', 'Aprendiz'),
  ('CONTRACTOR', 'Terceirizado'),
  ('SERVICE_PROVIDER', 'Autônomo / prestador'),
  ('VOLUNTEER', 'Voluntário'),
  ('OTHER', 'Outro'),
];
const statusLabel = {'ACTIVE': 'Ativo', 'ON_LEAVE': 'Afastado', 'SUSPENDED': 'Suspenso', 'TERMINATED': 'Desligado'};
