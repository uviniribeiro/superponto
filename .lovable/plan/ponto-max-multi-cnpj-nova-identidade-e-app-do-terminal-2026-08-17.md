# Ponto Max — Multi-CNPJ, nova identidade e app do Terminal

## 1. Multi-CNPJ (Matriz e Filial)
- Nova estrutura na base de empresas: cada cadastro passa a aceitar vários CNPJs.
  - Campo **Tipo de unidade**: Matriz ou Filial (obrigatório).
  - Campo **Matriz vinculada** (aparece só quando for Filial).
  - Regra: apenas uma Matriz por base de cadastro; filiais herdam configurações da matriz quando não preenchidas.
- Tela de cadastro da empresa ganha aba "Unidades / Filiais" com lista, criação, edição e inativação.
- Filtros do sistema (funcionários, relatórios, ponto) passam a permitir filtrar por unidade (matriz + filiais).
- Auditoria de CNPJ já existente passa a registrar também a unidade alterada.

## 2. Validações (pente fino em todo o sistema)
Padronizar um conjunto único de validadores usados por admin e usuário, no formulário e no backend:
- CNPJ numérico e alfanumérico (regra Receita Federal 2026), CPF, PIS/PASEP.
- E-mail, telefone/celular, CEP (com preenchimento automático), UF/cidade coerentes.
- Data de nascimento/admissão (limites e datas futuras), CTPS, RG, matrícula única.
- Endereço completo: obrigatoriedade de logradouro, número (ou "S/N"), bairro, cidade, UF, CEP.
- Mensagens de erro padronizadas: causa + como corrigir, com destaque no campo.
- Bloqueio de gravação inválida também nas funções de backend e por regras no banco.

## 3. Nova identidade visual "Ponto Max"
- Nova logo (marca gráfica + versão monocromática) gerada e aplicada em: login, menu, marca d'água, relatórios PDF, terminal.
- Novo favicon e ícones do app (web e celular), nome do site e do aplicativo alterados para **Ponto Max**.
- Renomeação total de "PontoMax/SuperPonto" para "Ponto Max" em textos, metadados, manifest, documentos e exportações.

## 4. Remodelagem da interface (moderna e minimalista)
- Refino do design system: paleta reduzida, mais respiro, cantos suaves, sombras discretas, tipografia única.
- Componentes revistos: cabeçalho, menu lateral/hub de categorias, cards, tabelas, formulários, diálogos e estados vazios.
- Foco em legibilidade e desempenho: menos efeitos pesados, marca d'água mais sutil, responsivo em celular e 1920x1080.
- Mantidos: navegação hub-and-spoke, botões voltar/início, posicionamento configurável do menu, temas de feriado.

## 5. Correção de erros
- Varredura de erros de deploy (build, lint, tipos, funções de nuvem) e correção.
- Varredura funcional das telas listadas no menu: itens quebrados, permissões, chamadas com erro.
- Correções aplicadas com verificação de build e testes existentes.

## 6. App do Terminal (APK)
- Nova entrada dedicada do Terminal: aplicativo separado, com **apenas o login do terminal** (CNPJ + senha do terminal), sem acesso ao restante do sistema.
- Empacotamento Android via Capacitor com id, nome e ícones próprios ("Ponto Max Terminal").
- Tela no sistema (área do admin) para **baixar o .apk** do terminal, com versão e data.
- Observação: o arquivo .apk precisa ser compilado com o SDK Android (não é possível compilar aqui dentro). Vou deixar o projeto Android pronto, o script de build e a tela de download já ligada ao arquivo; ao subir o .apk gerado, o download passa a funcionar imediatamente.

## Detalhes técnicos
- Banco: tabela de unidades (`company_units`) com `company_id`, `cnpj`, `unit_type` (matriz/filial), `parent_unit_id`, endereço próprio, CEI/CAEPF, status; GRANTs + RLS por empresa; migração dos CNPJs atuais como Matriz.
- Validadores centralizados em `src/lib/validators.ts` + hook de formulário compartilhado; espelho em `supabase/functions/_shared`.
- Design tokens em `index.css` e variantes shadcn; nenhuma cor fixa em componentes.
- Capacitor: segundo alvo de build apontando para a rota `/terminal`, ícones e splash próprios.

## Ordem de execução
1. Banco + cadastro Matriz/Filial
2. Validações unificadas (frontend + backend)
3. Identidade visual (logo, favicon, nomes)
4. Remodelagem da interface
5. Correção de erros e verificação de build
6. App do Terminal e tela de download
