/**
 * Exigências legais e normativas do registro de ponto (MTE) e como o SuperPonto atende cada uma.
 * Fonte única: alimenta a tela /conformidade e o arquivo CONFORMIDADE_MTE.md (npm run docs).
 * Ao concluir um item no sistema, atualize o status aqui — nunca marque "feito" sem a funcionalidade pronta e testada.
 */

export type Status = 'feito' | 'andamento' | 'planejado' | 'cliente' | 'fornecedor';

export const STATUS_LABEL: Record<Status, string> = {
  feito: 'Atendido no sistema',
  andamento: 'Em desenvolvimento',
  planejado: 'Planejado',
  cliente: 'Obrigação do empregador',
  fornecedor: 'Ação da SuperPonto (fornecedor)',
};

export interface Requirement {
  id: string;
  title: string;
  /** o que a norma exige, em linguagem direta */
  rule: string;
  basis: string;
  status: Status;
  /** como o SuperPonto atende ou vai atender */
  howWe: string;
}

export interface RequirementGroup {
  id: string;
  title: string;
  intro: string;
  items: Requirement[];
}

export const LAST_REVIEW = '15/11/2026';

export const DISCLAIMER =
  'Este checklist resume as exigências para orientar o produto e os clientes. Ele não substitui parecer jurídico nem a leitura do texto vigente das normas no portal gov.br; acordos e convenções coletivas da categoria podem trazer regras adicionais.';

export const GROUPS: RequirementGroup[] = [
  {
    id: 'obrigatoriedade',
    title: 'Quem precisa registrar o ponto',
    intro: 'Regras da CLT que definem quando o controle de jornada é obrigatório e quais formas são aceitas.',
    items: [
      {
        id: 'clt-74-2',
        title: 'Registro obrigatório acima de 20 trabalhadores',
        rule: 'Estabelecimentos com mais de 20 trabalhadores devem anotar a hora de entrada e de saída (registro manual, mecânico ou eletrônico). É permitida a pré-assinalação do período de repouso.',
        basis: 'CLT, art. 74, § 2º (redação da Lei nº 13.874/2019)',
        status: 'planejado',
        howWe: 'O registro de ponto da V2 (fase de Ponto) atende por estabelecimento/CNPJ; a contagem de trabalhadores por estabelecimento aparecerá no painel do cliente.',
      },
      {
        id: 'domestico',
        title: 'Empregado doméstico: registro sempre obrigatório',
        rule: 'O registro do horário do empregado doméstico é obrigatório por qualquer meio idôneo, independentemente do número de empregados.',
        basis: 'Lei Complementar nº 150/2015, art. 12',
        status: 'planejado',
        howWe: 'Será tratado como regra do vínculo (tipo "doméstico"), sem o corte de 20 trabalhadores.',
      },
      {
        id: 'clt-74-3',
        title: 'Trabalho externo',
        rule: 'Quando o trabalho for executado fora do estabelecimento, o horário deve constar em registro em poder do empregado (ficha, papeleta ou meio eletrônico).',
        basis: 'CLT, art. 74, § 3º',
        status: 'andamento',
        howWe: 'Marcação pelo navegador (Ponto › Registrar ponto) com cerca virtual da unidade: fora do raio a marcação é recusada. O app do funcionário com GPS ainda será ligado à V2.',
      },
      {
        id: 'clt-74-4',
        title: 'Ponto por exceção',
        rule: 'O registro apenas das exceções à jornada é permitido mediante acordo individual escrito, convenção ou acordo coletivo.',
        basis: 'CLT, art. 74, § 4º',
        status: 'planejado',
        howWe: 'Opção por vínculo, exigindo o anexo do acordo antes de ser ativada.',
      },
      {
        id: 'clt-62',
        title: 'Quem fica fora do controle de jornada',
        rule: 'Empregados em atividade externa incompatível com horário fixo, gerentes e cargos de gestão (com gratificação de no mínimo 40%) e teletrabalho por produção ou tarefa não se sujeitam ao controle de jornada; a condição deve constar no contrato e no registro.',
        basis: 'CLT, art. 62',
        status: 'planejado',
        howWe: 'Marcação do vínculo como "sem controle de jornada", com motivo obrigatório e registro na auditoria.',
      },
    ],
  },
  {
    id: 'rep',
    title: 'Registrador eletrônico de ponto (REP)',
    intro: 'A Portaria MTP nº 671/2021 define três tipos de registrador e o programa que trata as marcações; equipamentos das Portarias 1.510/2009 e 373/2011 seguem aceitos.',
    items: [
      {
        id: 'rep-tipos',
        title: 'Usar um dos três tipos de REP',
        rule: 'REP-C (convencional: equipamento com certificação de conformidade do Inmetro), REP-A (alternativo: autorizado por convenção ou acordo coletivo) ou REP-P (via programa: software registrado no INPI, executado em servidor dedicado ou em nuvem).',
        basis: 'Portaria MTP nº 671/2021 (registro eletrônico de ponto)',
        status: 'andamento',
        howWe: 'O SuperPonto é um REP-P (app e navegador) e também recebe marcações de relógios REP-C pelo Servidor de Comunicação. O cadastro de equipamentos guardará tipo, fabricante, número de fabricação e certificado.',
      },
      {
        id: 'rep-legado',
        title: 'Equipamentos das Portarias 1.510/2009 e 373/2011',
        rule: 'REPs certificados pela Portaria nº 1.510/2009 e sistemas alternativos autorizados pela Portaria nº 373/2011 (hoje REP-C e REP-A) continuam podendo ser usados; o AFD deles identifica o trabalhador pelo PIS e grava data e hora sem fuso.',
        basis: 'Portaria nº 1.510/2009; Portaria nº 373/2011; Portaria MTP nº 671/2021 (regras de transição)',
        status: 'feito',
        howWe: 'Cada equipamento é cadastrado com a sua portaria e o seu fuso. A API lê o AFD dos leiautes 1.510 e 671 (detecção automática), cria as marcações pelo PIS ou pelo CPF, não duplica numa reimportação, avisa sobre lacunas de NSR e recusa arquivo de outro CNPJ. Coberto por testes.',
      },
      {
        id: 'rep-envio',
        title: 'Envio de empregador, funcionários e digitais ao REP',
        rule: 'O REP precisa conhecer o empregador (CNPJ/CPF, razão social e local) e os trabalhadores (PIS no REP da 1.510, CPF no da 671) para registrar e identificar as marcações.',
        basis: 'Portaria nº 1.510/2009; Portaria MTP nº 671/2021 (registros de empresa e de empregado no AFD)',
        status: 'andamento',
        howWe: 'A API monta a fila de envio (empregador, funcionários ativos e digitais) por equipamento, conferindo PIS ou CPF e barrando CNPJ alfanumérico em REP da 1.510. O adaptador Control iD gera os comandos; a execução pelo Servidor de Comunicação e a homologação em equipamento real estão em andamento.',
      },
      {
        id: 'inpi',
        title: 'Registro do software no INPI',
        rule: 'O programa do REP-P e o programa de tratamento de registro de ponto precisam de certificado de registro de programa de computador no Instituto Nacional da Propriedade Industrial (INPI).',
        basis: 'Portaria MTP nº 671/2021',
        status: 'fornecedor',
        howWe: 'Pendente: a SuperPonto (desenvolvedora) precisa registrar o programa no INPI e informar o número do certificado no sistema e no Atestado Técnico.',
      },
      {
        id: 'atestado',
        title: 'Atestado Técnico e Termo de Responsabilidade',
        rule: 'O fabricante ou desenvolvedor deve fornecer ao empregador o Atestado Técnico e Termo de Responsabilidade, declarando que o sistema atende à portaria. O empregador deve guardá-lo e apresentá-lo à fiscalização.',
        basis: 'Portaria MTP nº 671/2021',
        status: 'fornecedor',
        howWe: 'Será emitido pelo sistema para cada cliente (com CNPJ do cliente e dados do responsável técnico) depois do registro no INPI.',
      },
      {
        id: 'proibicoes',
        title: 'Condutas proibidas no sistema de ponto',
        rule: 'O sistema não pode restringir horários de marcação, fazer marcação automática, exigir autorização prévia para marcar horas extras nem permitir alterar ou apagar as marcações registradas.',
        basis: 'Portaria MTP nº 671/2021',
        status: 'andamento',
        howWe: 'Marcações e auditoria são imutáveis no banco (alteração e exclusão bloqueadas por gatilho); ajustes só incluem ou desconsideram, com justificativa, sem apagar o original; período fechado trava alterações. Marcação pelo navegador usa a hora do servidor e desafio de uso único. Falta a homologação formal do REP-P.',
      },
      {
        id: 'nsr',
        title: 'Número sequencial de registro (NSR) e inalterabilidade',
        rule: 'Cada marcação recebe um NSR sequencial que não se repete nem é reiniciado, e os dados originais ficam protegidos contra alteração.',
        basis: 'Portaria MTP nº 671/2021, anexos de leiaute',
        status: 'andamento',
        howWe: 'Marcações já têm cadeia de hash (cada uma guarda o hash da anterior do mesmo vínculo) e não podem ser alteradas. Falta o NSR sequencial por registrador para as marcações do navegador e do app.',
      },
      {
        id: 'hora-legal',
        title: 'Hora oficial sincronizada',
        rule: 'Data e hora das marcações devem seguir a Hora Legal Brasileira, com o fuso horário do local de trabalho.',
        basis: 'Portaria MTP nº 671/2021',
        status: 'andamento',
        howWe: 'A marcação pelo navegador usa sempre a hora do servidor (nunca a do aparelho) e o fuso de Brasília. A sincronização por NTP é configuração do servidor na instalação.',
      },
    ],
  },
  {
    id: 'arquivos',
    title: 'Comprovantes, arquivos e relatórios obrigatórios',
    intro: 'Documentos que o sistema precisa gerar para o trabalhador, para o empregador e para a Auditoria-Fiscal do Trabalho.',
    items: [
      {
        id: 'comprovante',
        title: 'Comprovante de registro de ponto do trabalhador',
        rule: 'A cada marcação o trabalhador deve ter acesso ao comprovante, com os campos definidos na portaria (empregador com CNPJ/CPF, local, nome e CPF do trabalhador, data, hora e NSR). No REP-P o comprovante é eletrônico.',
        basis: 'Portaria MTP nº 671/2021',
        status: 'andamento',
        howWe: 'Cada marcação pelo navegador mostra o comprovante na tela (funcionário, empresa, CNPJ, data, hora e código de integridade). Envio por e-mail e consulta pública de autenticidade ainda faltam.',
      },
      {
        id: 'afd',
        title: 'AFD: Arquivo Fonte de Dados',
        rule: 'O registrador gera o AFD com todas as marcações e eventos no leiaute oficial, assinado eletronicamente, sempre que solicitado.',
        basis: 'Portaria MTP nº 671/2021, anexo de leiaute do AFD',
        status: 'planejado',
        howWe: 'Exportação por registrador e período no leiaute oficial, com assinatura digital (CAdES, certificado ICP-Brasil), aceitando CNPJ alfanumérico.',
      },
      {
        id: 'aej',
        title: 'AEJ: Arquivo Eletrônico de Jornada',
        rule: 'O programa de tratamento gera o AEJ com jornadas contratuais, marcações, tratamentos e ausências no leiaute oficial, assinado eletronicamente.',
        basis: 'Portaria MTP nº 671/2021, anexo de leiaute do AEJ',
        status: 'planejado',
        howWe: 'Gerado a partir do motor de cálculo de jornada (já pronto e testado) e dos tratamentos registrados.',
      },
      {
        id: 'espelho',
        title: 'Espelho de ponto',
        rule: 'O programa de tratamento emite o espelho de ponto do período, com identificação do empregador e do trabalhador, horário contratual, marcações originais e tratadas, e indicação de cada tratamento.',
        basis: 'Portaria MTP nº 671/2021',
        status: 'andamento',
        howWe: 'Espelho mensal na tela (Ponto › Espelho de ponto) com marcações originais, incluídas e desconsideradas, saldo, extras, noturno e ocorrências, e impressão pelo navegador. PDF assinado e ciência eletrônica do trabalhador ainda faltam.',
      },
      {
        id: 'tratamento',
        title: 'Tratamento de marcações com justificativa',
        rule: 'Inclusões, desconsiderações e abonos são feitos apenas no programa de tratamento, com motivo, preservando a marcação original e identificando quem tratou.',
        basis: 'Portaria MTP nº 671/2021',
        status: 'feito',
        howWe: 'Inclusão e desconsideração de marcação com justificativa obrigatória, aprovação por quem tem permissão (quem pediu não aprova) e auditoria; a marcação original nunca é alterada e aparece no espelho como desconsiderada.',
      },
      {
        id: 'fiscalizacao',
        title: 'Entrega à fiscalização e guarda dos dados',
        rule: 'O empregador deve apresentar AFD, AEJ, espelhos e o Atestado Técnico à Auditoria-Fiscal do Trabalho no prazo da notificação, e manter os registros pelo prazo prescricional.',
        basis: 'Portaria MTP nº 671/2021; CF/88, art. 7º, XXIX (prescrição de 5 anos)',
        status: 'cliente',
        howWe: 'O sistema guarda marcações e arquivos por no mínimo 5 anos (sem exclusão física) e terá um botão "Pacote de fiscalização" que reúne tudo de uma vez.',
      },
    ],
  },
  {
    id: 'jornada',
    title: 'Regras de jornada que o cálculo precisa respeitar',
    intro: 'Regras da CLT aplicadas pelo motor de cálculo. Convenções coletivas podem alterar algumas delas, dentro dos limites da lei.',
    items: [
      {
        id: 'clt-58',
        title: 'Tolerância de 5 minutos por marcação',
        rule: 'Variações de até 5 minutos por marcação, até o máximo de 10 minutos diários, não são descontadas nem contadas como hora extra.',
        basis: 'CLT, art. 58, § 1º',
        status: 'feito',
        howWe: 'Implementado e testado no motor de cálculo de jornada (pacote time-engine).',
      },
      {
        id: 'clt-59',
        title: 'Horas extras e banco de horas',
        rule: 'Até 2 horas extras por dia, com adicional mínimo de 50%. Banco de horas por acordo individual escrito (compensação em até 6 meses) ou por convenção ou acordo coletivo (até 1 ano); compensação no mesmo mês pode ser por acordo tácito ou escrito.',
        basis: 'CLT, art. 59, §§ 1º, 2º, 5º e 6º; CF/88, art. 7º, XVI',
        status: 'feito',
        howWe: 'Percentuais (mínimo de 50% validado), faixas e limite diário em Jornada › Regras de apuração; banco de horas por empresa com vencimento configurável (a tela lembra o limite de 6 meses do acordo individual e 1 ano da convenção), créditos e débitos lançados no fechamento, extrato e zerar em lote; política de hora extra aponta a extra sem autorização prévia.',
      },
      {
        id: 'clt-59a',
        title: 'Escala 12x36',
        rule: 'Permitida por acordo individual escrito, convenção ou acordo coletivo, com intervalos para repouso e alimentação observados ou indenizados.',
        basis: 'CLT, art. 59-A',
        status: 'feito',
        howWe: 'Escala 12x36 (e outros ciclos) em Jornada › Horários, com opção de seguir o ciclo no feriado; atribuição com vigência e grade da equipe em Jornada › Escalas. A previsão em convenção ou acordo é responsabilidade da empresa.',
      },
      {
        id: 'clt-66-67',
        title: 'Descanso entre jornadas e semanal',
        rule: 'Mínimo de 11 horas consecutivas entre duas jornadas e descanso semanal remunerado de 24 horas consecutivas, preferencialmente aos domingos.',
        basis: 'CLT, arts. 66 e 67; Lei nº 605/1949',
        status: 'planejado',
        howWe: 'Verificação de interjornada e de DSR será acrescentada ao motor de cálculo, com alertas na tela e no espelho.',
      },
      {
        id: 'clt-71',
        title: 'Intervalo para repouso e alimentação',
        rule: 'Jornada acima de 6 horas: intervalo de 1 a 2 horas. De 4 a 6 horas: 15 minutos. Supressão total ou parcial é paga com acréscimo de 50% sobre o período suprimido, com natureza indenizatória.',
        basis: 'CLT, art. 71, caput, § 1º e § 4º',
        status: 'andamento',
        howWe: 'Verificação de intervalo no motor; o valor indenizatório sai na exportação para a folha.',
      },
      {
        id: 'clt-73',
        title: 'Trabalho noturno',
        rule: 'Das 22h às 5h (trabalho urbano): hora noturna de 52 minutos e 30 segundos e adicional mínimo de 20%; prorrogação após as 5h segue a regra noturna.',
        basis: 'CLT, art. 73',
        status: 'feito',
        howWe: 'Hora reduzida e período noturno implementados e testados no motor de cálculo.',
      },
      {
        id: 'professor',
        title: 'Categorias com regras próprias',
        rule: 'Professores, médicos e outras categorias têm regras próprias de jornada na CLT, em leis específicas e nas convenções coletivas.',
        basis: 'CLT, arts. 317 a 324 (professores); Lei nº 3.999/1961 (médicos); convenções coletivas',
        status: 'planejado',
        howWe: 'Módulos Educação e Saúde com perfis de regra por vínculo, configuráveis por convenção.',
      },
    ],
  },
  {
    id: 'cadastro',
    title: 'Cadastro, eSocial e identificação',
    intro: 'Dados que identificam empregador e trabalhador nos arquivos oficiais e nas integrações.',
    items: [
      {
        id: 'cnpj-alfa',
        title: 'CNPJ alfanumérico',
        rule: 'A partir de julho de 2026 a Receita Federal emite CNPJs com letras e números nas 12 primeiras posições e 2 dígitos verificadores numéricos (cálculo módulo 11 sobre o valor ASCII − 48). Os CNPJs numéricos existentes continuam válidos.',
        basis: 'Instrução Normativa RFB nº 2.229/2024',
        status: 'feito',
        howWe: 'Validação, máscara e busca aceitam os dois formatos na API, no banco (restrição de formato) e nas telas, com testes do exemplo oficial (12.ABC.345/01DE-35). CNPJ numérico válido é consultado na Receita e preenche o cadastro; para o alfanumérico, a consulta pública ainda não está disponível e o preenchimento é manual.',
      },
      {
        id: 'multi-cnpj',
        title: 'Vários CNPJs por cliente (matriz e filiais)',
        rule: 'Cada estabelecimento é identificado pelo próprio CNPJ nos registros, nos arquivos e no eSocial.',
        basis: 'Portaria MTP nº 671/2021 (identificação do empregador); leiautes do eSocial',
        status: 'feito',
        howWe: 'Cada cliente (tenant) tem várias empresas/CNPJs, isoladas por segurança em nível de linha (RLS) no banco; o mesmo CNPJ pode existir em clientes diferentes sem vazar dados.',
      },
      {
        id: 'feriados',
        title: 'Feriados nacionais, estaduais e municipais',
        rule: 'Trabalho em feriado civil ou religioso é proibido salvo autorização, e o dia é remunerado; os feriados são definidos por lei federal, estadual e municipal (religiosos municipais limitados a quatro, incluída a Sexta-feira da Paixão).',
        basis: 'Lei nº 605/1949, arts. 8º e 9º; Lei nº 9.093/1995; Lei nº 662/1949; Lei nº 14.759/2023',
        status: 'feito',
        howWe: 'Feriados nacionais (fixos e móveis) calculados para qualquer ano; estaduais por UF e municipais pelo código IBGE vindo do CEP; o ano seguinte é cadastrado automaticamente antes de 1º de janeiro. A empresa pode cadastrar feriados locais repetidos todo ano e decidir folga ou trabalho em cada data, com auditoria. A base municipal inicial cobre as capitais e vem marcada para conferência.',
      },
      {
        id: 'esocial',
        title: 'Integração com folha e eSocial',
        rule: 'Horas extras, adicional noturno, faltas e DSR viram rubricas da folha, informadas no eSocial (eventos de remuneração) pelo empregador.',
        basis: 'Decreto nº 8.373/2014 (eSocial) e leiautes vigentes',
        status: 'planejado',
        howWe: 'Exportação de eventos de folha por rubrica configurável; o envio ao eSocial continua com o sistema de folha do cliente.',
      },
    ],
  },
  {
    id: 'lgpd',
    title: 'Proteção de dados (LGPD) e segurança',
    intro: 'O ponto trata dados pessoais e, com biometria e geolocalização, dados sensíveis.',
    items: [
      {
        id: 'lgpd-base',
        title: 'Base legal e finalidade',
        rule: 'O tratamento dos dados do ponto se apoia no cumprimento de obrigação legal e na execução do contrato de trabalho; biometria é dado sensível e exige base legal do art. 11 e cuidados adicionais.',
        basis: 'Lei nº 13.709/2018 (LGPD), arts. 7º e 11',
        status: 'cliente',
        howWe: 'O empregador é o controlador e a SuperPonto a operadora; o contrato de tratamento de dados e o aviso de privacidade ao trabalhador entram no fluxo de contratação.',
      },
      {
        id: 'lgpd-seguranca',
        title: 'Segurança e acesso mínimo',
        rule: 'Medidas técnicas para proteger os dados contra acessos não autorizados, com registro de quem acessou e alterou.',
        basis: 'LGPD, arts. 46 a 49',
        status: 'feito',
        howWe: 'Senhas com hash forte, tokens em cookies httpOnly, isolamento por cliente no banco (RLS), permissões por perfil verificadas na API e auditoria imutável.',
      },
      {
        id: 'lgpd-biometria',
        title: 'Digitais (biometria) protegidas',
        rule: 'Biometria é dado pessoal sensível: guardar só o necessário, com segurança reforçada, acesso restrito e registro de uso.',
        basis: 'LGPD, arts. 5º, II, 11 e 46',
        status: 'feito',
        howWe: 'Guarda só o template da digital (nunca a imagem), cifrado com AES-256-GCM e chave própria; o template não volta para as telas nem para a auditoria, e a fila de envio aos REPs leva só a referência. Permissão exclusiva (people.biometrics:manage), isolamento por cliente no banco e template inalterável por gatilho.',
      },
      {
        id: 'lgpd-titular',
        title: 'Direitos do trabalhador (titular)',
        rule: 'Acesso aos próprios dados, correção e informação sobre compartilhamento, respeitando a guarda obrigatória dos registros de ponto.',
        basis: 'LGPD, art. 18',
        status: 'planejado',
        howWe: 'Área "Meus dados" no app do funcionário, com exportação; exclusão só após o prazo legal de guarda.',
      },
    ],
  },
];

export function summary() {
  const all = GROUPS.flatMap((g) => g.items);
  const by = (s: Status) => all.filter((i) => i.status === s).length;
  return { total: all.length, feito: by('feito'), andamento: by('andamento'), planejado: by('planejado'), cliente: by('cliente'), fornecedor: by('fornecedor') };
}
