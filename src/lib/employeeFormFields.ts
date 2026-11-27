// Catálogo de dados complementares do funcionário e modelos de cadastro configuráveis por empresa:
// Simplificado, Padrão, Completo ou Personalizado (escolhe os campos e quais são obrigatórios).
export type FieldType = 'text' | 'date' | 'select' | 'tel' | 'email' | 'textarea';
export interface FieldDef { key: string; label: string; group: string; type: FieldType; options?: string[]; placeholder?: string }

export const FIELD_GROUPS = ['Dados pessoais', 'Documentos', 'Contato e emergência', 'Dados bancários', 'Saúde e outros'] as const;

export const EXTRA_FIELDS: FieldDef[] = [
  { key: 'social_name', label: 'Nome social', group: 'Dados pessoais', type: 'text' },
  { key: 'gender', label: 'Sexo', group: 'Dados pessoais', type: 'select', options: ['Feminino', 'Masculino', 'Outro', 'Prefiro não informar'] },
  { key: 'marital_status', label: 'Estado civil', group: 'Dados pessoais', type: 'select', options: ['Solteiro(a)', 'Casado(a)', 'União estável', 'Divorciado(a)', 'Viúvo(a)'] },
  { key: 'nationality', label: 'Nacionalidade', group: 'Dados pessoais', type: 'text', placeholder: 'Brasileira' },
  { key: 'birthplace', label: 'Naturalidade (cidade/UF)', group: 'Dados pessoais', type: 'text' },
  { key: 'mother_name', label: 'Nome da mãe', group: 'Dados pessoais', type: 'text' },
  { key: 'father_name', label: 'Nome do pai', group: 'Dados pessoais', type: 'text' },
  { key: 'education', label: 'Escolaridade', group: 'Dados pessoais', type: 'select', options: ['Fundamental incompleto', 'Fundamental completo', 'Médio incompleto', 'Médio completo', 'Técnico', 'Superior incompleto', 'Superior completo', 'Pós-graduação', 'Mestrado', 'Doutorado'] },
  { key: 'race', label: 'Raça/cor (IBGE)', group: 'Dados pessoais', type: 'select', options: ['Branca', 'Preta', 'Parda', 'Amarela', 'Indígena', 'Não informado'] },
  { key: 'address', label: 'Endereço completo', group: 'Dados pessoais', type: 'textarea' },
  { key: 'rg', label: 'RG', group: 'Documentos', type: 'text' },
  { key: 'rg_issuer', label: 'Órgão emissor / UF', group: 'Documentos', type: 'text', placeholder: 'SSP/SP' },
  { key: 'rg_date', label: 'Data de emissão do RG', group: 'Documentos', type: 'date' },
  { key: 'ctps_number', label: 'CTPS — número', group: 'Documentos', type: 'text' },
  { key: 'ctps_series', label: 'CTPS — série/UF', group: 'Documentos', type: 'text' },
  { key: 'voter_id', label: 'Título de eleitor', group: 'Documentos', type: 'text' },
  { key: 'voter_zone', label: 'Zona / seção', group: 'Documentos', type: 'text' },
  { key: 'military', label: 'Certificado de reservista', group: 'Documentos', type: 'text' },
  { key: 'mobile', label: 'Celular', group: 'Contato e emergência', type: 'tel' },
  { key: 'personal_email', label: 'E-mail pessoal', group: 'Contato e emergência', type: 'email' },
  { key: 'emergency_name', label: 'Contato de emergência — nome', group: 'Contato e emergência', type: 'text' },
  { key: 'emergency_phone', label: 'Contato de emergência — telefone', group: 'Contato e emergência', type: 'tel' },
  { key: 'emergency_relation', label: 'Contato de emergência — parentesco', group: 'Contato e emergência', type: 'text' },
  { key: 'bank', label: 'Banco', group: 'Dados bancários', type: 'text' },
  { key: 'bank_agency', label: 'Agência', group: 'Dados bancários', type: 'text' },
  { key: 'bank_account', label: 'Conta', group: 'Dados bancários', type: 'text' },
  { key: 'bank_account_type', label: 'Tipo de conta', group: 'Dados bancários', type: 'select', options: ['Corrente', 'Poupança', 'Salário'] },
  { key: 'pix_key', label: 'Chave PIX', group: 'Dados bancários', type: 'text' },
  { key: 'blood_type', label: 'Tipo sanguíneo', group: 'Saúde e outros', type: 'select', options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
  { key: 'disability', label: 'Pessoa com deficiência (tipo)', group: 'Saúde e outros', type: 'text', placeholder: 'Deixe em branco se não' },
  { key: 'uniform_size', label: 'Tamanho do uniforme', group: 'Saúde e outros', type: 'select', options: ['PP', 'P', 'M', 'G', 'GG', 'XG'] },
  { key: 'shoe_size', label: 'Número do calçado', group: 'Saúde e outros', type: 'text' },
  { key: 'notes', label: 'Observações', group: 'Saúde e outros', type: 'textarea' },
];

export type FormModel = 'simplificado' | 'padrao' | 'completo' | 'personalizado';
export interface FormConfig { model: FormModel; fields?: Record<string, { show: boolean; required: boolean }> }

export const MODEL_LABEL: Record<FormModel, string> = {
  simplificado: 'Simplificado — só o essencial (nome, CPF, matrícula, admissão)',
  padrao: 'Padrão — dados pessoais, documentos e contato de emergência',
  completo: 'Completo — todos os campos (bancários, saúde, uniforme…)',
  personalizado: 'Personalizado — você escolhe os campos e o que é obrigatório',
};

const PADRAO = ['gender', 'marital_status', 'mother_name', 'education', 'address', 'rg', 'rg_issuer', 'ctps_number', 'ctps_series', 'mobile', 'emergency_name', 'emergency_phone', 'emergency_relation'];

/** Campos que aparecem no formulário, com obrigatoriedade, conforme o modelo da empresa. */
export function visibleFields(cfg: FormConfig | null | undefined): (FieldDef & { required: boolean })[] {
  const model = cfg?.model ?? 'padrao';
  if (model === 'simplificado') return [];
  if (model === 'completo') return EXTRA_FIELDS.map((f) => ({ ...f, required: false }));
  if (model === 'personalizado') {
    return EXTRA_FIELDS.filter((f) => cfg?.fields?.[f.key]?.show).map((f) => ({ ...f, required: !!cfg?.fields?.[f.key]?.required }));
  }
  return EXTRA_FIELDS.filter((f) => PADRAO.includes(f.key)).map((f) => ({ ...f, required: false }));
}
