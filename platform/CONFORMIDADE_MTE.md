<!-- Arquivo gerado por apps/web/scripts/docs.mts a partir de apps/web/src/content. Não edite à mão. -->


# Conformidade MTE: exigências legais do registro de ponto

_Revisado em 15/11/2026. O mesmo conteúdo está no sistema, em Ajuda › Conformidade MTE._

> Este checklist resume as exigências para orientar o produto e os clientes. Ele não substitui parecer jurídico nem a leitura do texto vigente das normas no portal gov.br; acordos e convenções coletivas da categoria podem trazer regras adicionais.

## Resumo

| Situação | Itens |
|---|---|
| Atendido no sistema | 11 |
| Em desenvolvimento | 11 |
| Planejado | 8 |
| Ação da SuperPonto (fornecedor) | 2 |
| Obrigação do empregador | 2 |
| **Total** | **34** |

## Normas de referência

- CLT (Decreto-Lei nº 5.452/1943), arts. 58, 59, 59-A, 62, 66, 67, 71, 73 e 74
- Portaria MTP nº 671/2021: registro eletrônico de ponto (REP-C, REP-A, REP-P), programa de tratamento, AFD, AEJ, comprovante e espelho de ponto
- Lei Complementar nº 150/2015 (empregado doméstico)
- Instrução Normativa RFB nº 2.229/2024 (CNPJ alfanumérico)
- Lei nº 13.709/2018 (LGPD)
- Decreto nº 8.373/2014 (eSocial)

## Quem precisa registrar o ponto

Regras da CLT que definem quando o controle de jornada é obrigatório e quais formas são aceitas.

| Exigência | Situação | Base legal |
|---|---|---|
| [Registro obrigatório acima de 20 trabalhadores](#clt-74-2) | Planejado | CLT, art. 74, § 2º (redação da Lei nº 13.874/2019) |
| [Empregado doméstico: registro sempre obrigatório](#domestico) | Planejado | Lei Complementar nº 150/2015, art. 12 |
| [Trabalho externo](#clt-74-3) | Em desenvolvimento | CLT, art. 74, § 3º |
| [Ponto por exceção](#clt-74-4) | Planejado | CLT, art. 74, § 4º |
| [Quem fica fora do controle de jornada](#clt-62) | Planejado | CLT, art. 62 |

<a id="clt-74-2"></a>
### Registro obrigatório acima de 20 trabalhadores

- **O que a norma exige:** Estabelecimentos com mais de 20 trabalhadores devem anotar a hora de entrada e de saída (registro manual, mecânico ou eletrônico). É permitida a pré-assinalação do período de repouso.
- **Base legal:** CLT, art. 74, § 2º (redação da Lei nº 13.874/2019)
- **Situação:** Planejado
- **No SuperPonto:** O registro de ponto da V2 (fase de Ponto) atende por estabelecimento/CNPJ; a contagem de trabalhadores por estabelecimento aparecerá no painel do cliente.

<a id="domestico"></a>
### Empregado doméstico: registro sempre obrigatório

- **O que a norma exige:** O registro do horário do empregado doméstico é obrigatório por qualquer meio idôneo, independentemente do número de empregados.
- **Base legal:** Lei Complementar nº 150/2015, art. 12
- **Situação:** Planejado
- **No SuperPonto:** Será tratado como regra do vínculo (tipo "doméstico"), sem o corte de 20 trabalhadores.

<a id="clt-74-3"></a>
### Trabalho externo

- **O que a norma exige:** Quando o trabalho for executado fora do estabelecimento, o horário deve constar em registro em poder do empregado (ficha, papeleta ou meio eletrônico).
- **Base legal:** CLT, art. 74, § 3º
- **Situação:** Em desenvolvimento
- **No SuperPonto:** Marcação pelo navegador (Ponto › Registrar ponto) com cerca virtual da unidade: fora do raio a marcação é recusada. O app do funcionário com GPS ainda será ligado à V2.

<a id="clt-74-4"></a>
### Ponto por exceção

- **O que a norma exige:** O registro apenas das exceções à jornada é permitido mediante acordo individual escrito, convenção ou acordo coletivo.
- **Base legal:** CLT, art. 74, § 4º
- **Situação:** Planejado
- **No SuperPonto:** Opção por vínculo, exigindo o anexo do acordo antes de ser ativada.

<a id="clt-62"></a>
### Quem fica fora do controle de jornada

- **O que a norma exige:** Empregados em atividade externa incompatível com horário fixo, gerentes e cargos de gestão (com gratificação de no mínimo 40%) e teletrabalho por produção ou tarefa não se sujeitam ao controle de jornada; a condição deve constar no contrato e no registro.
- **Base legal:** CLT, art. 62
- **Situação:** Planejado
- **No SuperPonto:** Marcação do vínculo como "sem controle de jornada", com motivo obrigatório e registro na auditoria.

## Registrador eletrônico de ponto (REP)

A Portaria MTP nº 671/2021 define três tipos de registrador e o programa que trata as marcações; equipamentos das Portarias 1.510/2009 e 373/2011 seguem aceitos.

| Exigência | Situação | Base legal |
|---|---|---|
| [Usar um dos três tipos de REP](#rep-tipos) | Em desenvolvimento | Portaria MTP nº 671/2021 (registro eletrônico de ponto) |
| [Equipamentos das Portarias 1.510/2009 e 373/2011](#rep-legado) | Atendido no sistema | Portaria nº 1.510/2009; Portaria nº 373/2011; Portaria MTP nº 671/2021 (regras de transição) |
| [Envio de empregador, funcionários e digitais ao REP](#rep-envio) | Em desenvolvimento | Portaria nº 1.510/2009; Portaria MTP nº 671/2021 (registros de empresa e de empregado no AFD) |
| [Registro do software no INPI](#inpi) | Ação da SuperPonto (fornecedor) | Portaria MTP nº 671/2021 |
| [Atestado Técnico e Termo de Responsabilidade](#atestado) | Ação da SuperPonto (fornecedor) | Portaria MTP nº 671/2021 |
| [Condutas proibidas no sistema de ponto](#proibicoes) | Em desenvolvimento | Portaria MTP nº 671/2021 |
| [Número sequencial de registro (NSR) e inalterabilidade](#nsr) | Em desenvolvimento | Portaria MTP nº 671/2021, anexos de leiaute |
| [Hora oficial sincronizada](#hora-legal) | Em desenvolvimento | Portaria MTP nº 671/2021 |

<a id="rep-tipos"></a>
### Usar um dos três tipos de REP

- **O que a norma exige:** REP-C (convencional: equipamento com certificação de conformidade do Inmetro), REP-A (alternativo: autorizado por convenção ou acordo coletivo) ou REP-P (via programa: software registrado no INPI, executado em servidor dedicado ou em nuvem).
- **Base legal:** Portaria MTP nº 671/2021 (registro eletrônico de ponto)
- **Situação:** Em desenvolvimento
- **No SuperPonto:** O SuperPonto é um REP-P (app e navegador) e também recebe marcações de relógios REP-C pelo Servidor de Comunicação. O cadastro de equipamentos guardará tipo, fabricante, número de fabricação e certificado.

<a id="rep-legado"></a>
### Equipamentos das Portarias 1.510/2009 e 373/2011

- **O que a norma exige:** REPs certificados pela Portaria nº 1.510/2009 e sistemas alternativos autorizados pela Portaria nº 373/2011 (hoje REP-C e REP-A) continuam podendo ser usados; o AFD deles identifica o trabalhador pelo PIS e grava data e hora sem fuso.
- **Base legal:** Portaria nº 1.510/2009; Portaria nº 373/2011; Portaria MTP nº 671/2021 (regras de transição)
- **Situação:** Atendido no sistema
- **No SuperPonto:** Cada equipamento é cadastrado com a sua portaria e o seu fuso. A API lê o AFD dos leiautes 1.510 e 671 (detecção automática), cria as marcações pelo PIS ou pelo CPF, não duplica numa reimportação, avisa sobre lacunas de NSR e recusa arquivo de outro CNPJ. Coberto por testes.

<a id="rep-envio"></a>
### Envio de empregador, funcionários e digitais ao REP

- **O que a norma exige:** O REP precisa conhecer o empregador (CNPJ/CPF, razão social e local) e os trabalhadores (PIS no REP da 1.510, CPF no da 671) para registrar e identificar as marcações.
- **Base legal:** Portaria nº 1.510/2009; Portaria MTP nº 671/2021 (registros de empresa e de empregado no AFD)
- **Situação:** Em desenvolvimento
- **No SuperPonto:** Fila de comandos por equipamento e por grupo (enviar e receber empregador, funcionários e digitais, data e hora, coleta), protocolo do agente local com chave por equipamento e comparação cadastro × relógio. Falta o programa do agente para cada marca de relógio e a homologação em equipamento real.

<a id="inpi"></a>
### Registro do software no INPI

- **O que a norma exige:** O programa do REP-P e o programa de tratamento de registro de ponto precisam de certificado de registro de programa de computador no Instituto Nacional da Propriedade Industrial (INPI).
- **Base legal:** Portaria MTP nº 671/2021
- **Situação:** Ação da SuperPonto (fornecedor)
- **No SuperPonto:** Pendente: a SuperPonto (desenvolvedora) precisa registrar o programa no INPI e informar o número do certificado no sistema e no Atestado Técnico.

<a id="atestado"></a>
### Atestado Técnico e Termo de Responsabilidade

- **O que a norma exige:** O fabricante ou desenvolvedor deve fornecer ao empregador o Atestado Técnico e Termo de Responsabilidade, declarando que o sistema atende à portaria. O empregador deve guardá-lo e apresentá-lo à fiscalização.
- **Base legal:** Portaria MTP nº 671/2021
- **Situação:** Ação da SuperPonto (fornecedor)
- **No SuperPonto:** Será emitido pelo sistema para cada cliente (com CNPJ do cliente e dados do responsável técnico) depois do registro no INPI.

<a id="proibicoes"></a>
### Condutas proibidas no sistema de ponto

- **O que a norma exige:** O sistema não pode restringir horários de marcação, fazer marcação automática, exigir autorização prévia para marcar horas extras nem permitir alterar ou apagar as marcações registradas.
- **Base legal:** Portaria MTP nº 671/2021
- **Situação:** Em desenvolvimento
- **No SuperPonto:** Marcações e auditoria são imutáveis no banco (alteração e exclusão bloqueadas por gatilho); ajustes só incluem ou desconsideram, com justificativa, sem apagar o original; período fechado trava alterações. Marcação pelo navegador usa a hora do servidor e desafio de uso único. Falta a homologação formal do REP-P.

<a id="nsr"></a>
### Número sequencial de registro (NSR) e inalterabilidade

- **O que a norma exige:** Cada marcação recebe um NSR sequencial que não se repete nem é reiniciado, e os dados originais ficam protegidos contra alteração.
- **Base legal:** Portaria MTP nº 671/2021, anexos de leiaute
- **Situação:** Em desenvolvimento
- **No SuperPonto:** Marcações já têm cadeia de hash (cada uma guarda o hash da anterior do mesmo vínculo) e não podem ser alteradas. Falta o NSR sequencial por registrador para as marcações do navegador e do app.

<a id="hora-legal"></a>
### Hora oficial sincronizada

- **O que a norma exige:** Data e hora das marcações devem seguir a Hora Legal Brasileira, com o fuso horário do local de trabalho.
- **Base legal:** Portaria MTP nº 671/2021
- **Situação:** Em desenvolvimento
- **No SuperPonto:** A marcação pelo navegador usa sempre a hora do servidor (nunca a do aparelho) e o fuso de Brasília. A sincronização por NTP é configuração do servidor na instalação.

## Comprovantes, arquivos e relatórios obrigatórios

Documentos que o sistema precisa gerar para o trabalhador, para o empregador e para a Auditoria-Fiscal do Trabalho.

| Exigência | Situação | Base legal |
|---|---|---|
| [Comprovante de registro de ponto do trabalhador](#comprovante) | Em desenvolvimento | Portaria MTP nº 671/2021 |
| [AFD: Arquivo Fonte de Dados](#afd) | Em desenvolvimento | Portaria MTP nº 671/2021, anexo de leiaute do AFD |
| [AEJ: Arquivo Eletrônico de Jornada](#aej) | Em desenvolvimento | Portaria MTP nº 671/2021, anexo de leiaute do AEJ |
| [Espelho de ponto](#espelho) | Em desenvolvimento | Portaria MTP nº 671/2021 |
| [Tratamento de marcações com justificativa](#tratamento) | Atendido no sistema | Portaria MTP nº 671/2021 |
| [Entrega à fiscalização e guarda dos dados](#fiscalizacao) | Obrigação do empregador | Portaria MTP nº 671/2021; CF/88, art. 7º, XXIX (prescrição de 5 anos) |

<a id="comprovante"></a>
### Comprovante de registro de ponto do trabalhador

- **O que a norma exige:** A cada marcação o trabalhador deve ter acesso ao comprovante, com os campos definidos na portaria (empregador com CNPJ/CPF, local, nome e CPF do trabalhador, data, hora e NSR). No REP-P o comprovante é eletrônico.
- **Base legal:** Portaria MTP nº 671/2021
- **Situação:** Em desenvolvimento
- **No SuperPonto:** Cada marcação pelo navegador mostra o comprovante na tela (funcionário, empresa, CNPJ, data, hora e código de integridade). Envio por e-mail e consulta pública de autenticidade ainda faltam.

<a id="afd"></a>
### AFD: Arquivo Fonte de Dados

- **O que a norma exige:** O registrador gera o AFD com todas as marcações e eventos no leiaute oficial, assinado eletronicamente, sempre que solicitado.
- **Base legal:** Portaria MTP nº 671/2021, anexo de leiaute do AFD
- **Situação:** Em desenvolvimento
- **No SuperPonto:** Os AFDs dos relógios (1.510, 373 e 671) são importados e as linhas originais podem ser baixadas por equipamento e período (Equipamentos › Arquivos). Falta gerar o AFD do próprio REP-P (navegador/app) com NSR e assinatura CAdES.

<a id="aej"></a>
### AEJ: Arquivo Eletrônico de Jornada

- **O que a norma exige:** O programa de tratamento gera o AEJ com jornadas contratuais, marcações, tratamentos e ausências no leiaute oficial, assinado eletronicamente.
- **Base legal:** Portaria MTP nº 671/2021, anexo de leiaute do AEJ
- **Situação:** Em desenvolvimento
- **No SuperPonto:** Gerado da apuração (Ponto › Fechamento › Gerar AEJ) com registradores, vínculos, horários contratuais, marcações originais/incluídas/desconsideradas, ausências, banco de horas e trailer. Faltam a assinatura CAdES (certificado ICP-Brasil da empresa) e o número do REP-P (registro no INPI); conferir no validador oficial.

<a id="espelho"></a>
### Espelho de ponto

- **O que a norma exige:** O programa de tratamento emite o espelho de ponto do período, com identificação do empregador e do trabalhador, horário contratual, marcações originais e tratadas, e indicação de cada tratamento.
- **Base legal:** Portaria MTP nº 671/2021
- **Situação:** Em desenvolvimento
- **No SuperPonto:** Espelho mensal na tela (Ponto › Espelho de ponto) com marcações originais, incluídas e desconsideradas, saldo, extras, noturno e ocorrências, e impressão pelo navegador. PDF assinado e ciência eletrônica do trabalhador ainda faltam.

<a id="tratamento"></a>
### Tratamento de marcações com justificativa

- **O que a norma exige:** Inclusões, desconsiderações e abonos são feitos apenas no programa de tratamento, com motivo, preservando a marcação original e identificando quem tratou.
- **Base legal:** Portaria MTP nº 671/2021
- **Situação:** Atendido no sistema
- **No SuperPonto:** Inclusão e desconsideração de marcação com justificativa obrigatória, aprovação por quem tem permissão (quem pediu não aprova) e auditoria; a marcação original nunca é alterada e aparece no espelho como desconsiderada.

<a id="fiscalizacao"></a>
### Entrega à fiscalização e guarda dos dados

- **O que a norma exige:** O empregador deve apresentar AFD, AEJ, espelhos e o Atestado Técnico à Auditoria-Fiscal do Trabalho no prazo da notificação, e manter os registros pelo prazo prescricional.
- **Base legal:** Portaria MTP nº 671/2021; CF/88, art. 7º, XXIX (prescrição de 5 anos)
- **Situação:** Obrigação do empregador
- **No SuperPonto:** O sistema guarda marcações e arquivos por no mínimo 5 anos (sem exclusão física) e terá um botão "Pacote de fiscalização" que reúne tudo de uma vez.

## Regras de jornada que o cálculo precisa respeitar

Regras da CLT aplicadas pelo motor de cálculo. Convenções coletivas podem alterar algumas delas, dentro dos limites da lei.

| Exigência | Situação | Base legal |
|---|---|---|
| [Tolerância de 5 minutos por marcação](#clt-58) | Atendido no sistema | CLT, art. 58, § 1º |
| [Horas extras e banco de horas](#clt-59) | Atendido no sistema | CLT, art. 59, §§ 1º, 2º, 5º e 6º; CF/88, art. 7º, XVI |
| [Escala 12x36](#clt-59a) | Atendido no sistema | CLT, art. 59-A |
| [Descanso entre jornadas e semanal](#clt-66-67) | Planejado | CLT, arts. 66 e 67; Lei nº 605/1949 |
| [Intervalo para repouso e alimentação](#clt-71) | Em desenvolvimento | CLT, art. 71, caput, § 1º e § 4º |
| [Trabalho noturno](#clt-73) | Atendido no sistema | CLT, art. 73 |
| [Categorias com regras próprias](#professor) | Planejado | CLT, arts. 317 a 324 (professores); Lei nº 3.999/1961 (médicos); convenções coletivas |

<a id="clt-58"></a>
### Tolerância de 5 minutos por marcação

- **O que a norma exige:** Variações de até 5 minutos por marcação, até o máximo de 10 minutos diários, não são descontadas nem contadas como hora extra.
- **Base legal:** CLT, art. 58, § 1º
- **Situação:** Atendido no sistema
- **No SuperPonto:** Implementado e testado no motor de cálculo de jornada (pacote time-engine).

<a id="clt-59"></a>
### Horas extras e banco de horas

- **O que a norma exige:** Até 2 horas extras por dia, com adicional mínimo de 50%. Banco de horas por acordo individual escrito (compensação em até 6 meses) ou por convenção ou acordo coletivo (até 1 ano); compensação no mesmo mês pode ser por acordo tácito ou escrito.
- **Base legal:** CLT, art. 59, §§ 1º, 2º, 5º e 6º; CF/88, art. 7º, XVI
- **Situação:** Atendido no sistema
- **No SuperPonto:** Percentuais (mínimo de 50% validado), faixas e limite diário em Jornada › Regras de apuração; banco de horas por empresa com vencimento configurável (a tela lembra o limite de 6 meses do acordo individual e 1 ano da convenção), créditos e débitos lançados no fechamento, extrato e zerar em lote; política de hora extra aponta a extra sem autorização prévia.

<a id="clt-59a"></a>
### Escala 12x36

- **O que a norma exige:** Permitida por acordo individual escrito, convenção ou acordo coletivo, com intervalos para repouso e alimentação observados ou indenizados.
- **Base legal:** CLT, art. 59-A
- **Situação:** Atendido no sistema
- **No SuperPonto:** Escala 12x36 (e outros ciclos) em Jornada › Horários, com opção de seguir o ciclo no feriado; atribuição com vigência e grade da equipe em Jornada › Escalas. A previsão em convenção ou acordo é responsabilidade da empresa.

<a id="clt-66-67"></a>
### Descanso entre jornadas e semanal

- **O que a norma exige:** Mínimo de 11 horas consecutivas entre duas jornadas e descanso semanal remunerado de 24 horas consecutivas, preferencialmente aos domingos.
- **Base legal:** CLT, arts. 66 e 67; Lei nº 605/1949
- **Situação:** Planejado
- **No SuperPonto:** Verificação de interjornada e de DSR será acrescentada ao motor de cálculo, com alertas na tela e no espelho.

<a id="clt-71"></a>
### Intervalo para repouso e alimentação

- **O que a norma exige:** Jornada acima de 6 horas: intervalo de 1 a 2 horas. De 4 a 6 horas: 15 minutos. Supressão total ou parcial é paga com acréscimo de 50% sobre o período suprimido, com natureza indenizatória.
- **Base legal:** CLT, art. 71, caput, § 1º e § 4º
- **Situação:** Em desenvolvimento
- **No SuperPonto:** Verificação de intervalo no motor; o valor indenizatório sai na exportação para a folha.

<a id="clt-73"></a>
### Trabalho noturno

- **O que a norma exige:** Das 22h às 5h (trabalho urbano): hora noturna de 52 minutos e 30 segundos e adicional mínimo de 20%; prorrogação após as 5h segue a regra noturna.
- **Base legal:** CLT, art. 73
- **Situação:** Atendido no sistema
- **No SuperPonto:** Hora reduzida e período noturno implementados e testados no motor de cálculo.

<a id="professor"></a>
### Categorias com regras próprias

- **O que a norma exige:** Professores, médicos e outras categorias têm regras próprias de jornada na CLT, em leis específicas e nas convenções coletivas.
- **Base legal:** CLT, arts. 317 a 324 (professores); Lei nº 3.999/1961 (médicos); convenções coletivas
- **Situação:** Planejado
- **No SuperPonto:** Módulos Educação e Saúde com perfis de regra por vínculo, configuráveis por convenção.

## Cadastro, eSocial e identificação

Dados que identificam empregador e trabalhador nos arquivos oficiais e nas integrações.

| Exigência | Situação | Base legal |
|---|---|---|
| [CNPJ alfanumérico](#cnpj-alfa) | Atendido no sistema | Instrução Normativa RFB nº 2.229/2024 |
| [Vários CNPJs por cliente (matriz e filiais)](#multi-cnpj) | Atendido no sistema | Portaria MTP nº 671/2021 (identificação do empregador); leiautes do eSocial |
| [Feriados nacionais, estaduais e municipais](#feriados) | Atendido no sistema | Lei nº 605/1949, arts. 8º e 9º; Lei nº 9.093/1995; Lei nº 662/1949; Lei nº 14.759/2023 |
| [Integração com folha e eSocial](#esocial) | Planejado | Decreto nº 8.373/2014 (eSocial) e leiautes vigentes |

<a id="cnpj-alfa"></a>
### CNPJ alfanumérico

- **O que a norma exige:** A partir de julho de 2026 a Receita Federal emite CNPJs com letras e números nas 12 primeiras posições e 2 dígitos verificadores numéricos (cálculo módulo 11 sobre o valor ASCII − 48). Os CNPJs numéricos existentes continuam válidos.
- **Base legal:** Instrução Normativa RFB nº 2.229/2024
- **Situação:** Atendido no sistema
- **No SuperPonto:** Validação, máscara e busca aceitam os dois formatos na API, no banco (restrição de formato) e nas telas, com testes do exemplo oficial (12.ABC.345/01DE-35). CNPJ numérico válido é consultado na Receita e preenche o cadastro; para o alfanumérico, a consulta pública ainda não está disponível e o preenchimento é manual.

<a id="multi-cnpj"></a>
### Vários CNPJs por cliente (matriz e filiais)

- **O que a norma exige:** Cada estabelecimento é identificado pelo próprio CNPJ nos registros, nos arquivos e no eSocial.
- **Base legal:** Portaria MTP nº 671/2021 (identificação do empregador); leiautes do eSocial
- **Situação:** Atendido no sistema
- **No SuperPonto:** Cada cliente (tenant) tem várias empresas/CNPJs, isoladas por segurança em nível de linha (RLS) no banco; o mesmo CNPJ pode existir em clientes diferentes sem vazar dados.

<a id="feriados"></a>
### Feriados nacionais, estaduais e municipais

- **O que a norma exige:** Trabalho em feriado civil ou religioso é proibido salvo autorização, e o dia é remunerado; os feriados são definidos por lei federal, estadual e municipal (religiosos municipais limitados a quatro, incluída a Sexta-feira da Paixão).
- **Base legal:** Lei nº 605/1949, arts. 8º e 9º; Lei nº 9.093/1995; Lei nº 662/1949; Lei nº 14.759/2023
- **Situação:** Atendido no sistema
- **No SuperPonto:** Feriados nacionais (fixos e móveis) calculados para qualquer ano; estaduais por UF e municipais pelo código IBGE vindo do CEP; o ano seguinte é cadastrado automaticamente antes de 1º de janeiro. A empresa pode cadastrar feriados locais repetidos todo ano e decidir folga ou trabalho em cada data, com auditoria. A base municipal inicial cobre as capitais e vem marcada para conferência.

<a id="esocial"></a>
### Integração com folha e eSocial

- **O que a norma exige:** Horas extras, adicional noturno, faltas e DSR viram rubricas da folha, informadas no eSocial (eventos de remuneração) pelo empregador.
- **Base legal:** Decreto nº 8.373/2014 (eSocial) e leiautes vigentes
- **Situação:** Planejado
- **No SuperPonto:** Exportação de eventos de folha por rubrica configurável; o envio ao eSocial continua com o sistema de folha do cliente.

## Proteção de dados (LGPD) e segurança

O ponto trata dados pessoais e, com biometria e geolocalização, dados sensíveis.

| Exigência | Situação | Base legal |
|---|---|---|
| [Base legal e finalidade](#lgpd-base) | Obrigação do empregador | Lei nº 13.709/2018 (LGPD), arts. 7º e 11 |
| [Segurança e acesso mínimo](#lgpd-seguranca) | Atendido no sistema | LGPD, arts. 46 a 49 |
| [Digitais (biometria) protegidas](#lgpd-biometria) | Atendido no sistema | LGPD, arts. 5º, II, 11 e 46 |
| [Direitos do trabalhador (titular)](#lgpd-titular) | Planejado | LGPD, art. 18 |

<a id="lgpd-base"></a>
### Base legal e finalidade

- **O que a norma exige:** O tratamento dos dados do ponto se apoia no cumprimento de obrigação legal e na execução do contrato de trabalho; biometria é dado sensível e exige base legal do art. 11 e cuidados adicionais.
- **Base legal:** Lei nº 13.709/2018 (LGPD), arts. 7º e 11
- **Situação:** Obrigação do empregador
- **No SuperPonto:** O empregador é o controlador e a SuperPonto a operadora; o contrato de tratamento de dados e o aviso de privacidade ao trabalhador entram no fluxo de contratação.

<a id="lgpd-seguranca"></a>
### Segurança e acesso mínimo

- **O que a norma exige:** Medidas técnicas para proteger os dados contra acessos não autorizados, com registro de quem acessou e alterou.
- **Base legal:** LGPD, arts. 46 a 49
- **Situação:** Atendido no sistema
- **No SuperPonto:** Senhas com hash forte, tokens em cookies httpOnly, isolamento por cliente no banco (RLS), permissões por perfil verificadas na API e auditoria imutável.

<a id="lgpd-biometria"></a>
### Digitais (biometria) protegidas

- **O que a norma exige:** Biometria é dado pessoal sensível: guardar só o necessário, com segurança reforçada, acesso restrito e registro de uso.
- **Base legal:** LGPD, arts. 5º, II, 11 e 46
- **Situação:** Atendido no sistema
- **No SuperPonto:** Guarda só o template da digital (nunca a imagem), cifrado com AES-256-GCM e chave própria; o template não volta para as telas nem para a auditoria, e a fila de envio aos REPs leva só a referência. Permissão exclusiva (people.biometrics:manage), isolamento por cliente no banco e template inalterável por gatilho.

<a id="lgpd-titular"></a>
### Direitos do trabalhador (titular)

- **O que a norma exige:** Acesso aos próprios dados, correção e informação sobre compartilhamento, respeitando a guarda obrigatória dos registros de ponto.
- **Base legal:** LGPD, art. 18
- **Situação:** Planejado
- **No SuperPonto:** Área "Meus dados" no app do funcionário, com exportação; exclusão só após o prazo legal de guarda.
