# Roadmap

- [ ] Ampliar gestão do SUPER ADMIN para cadastro, edição, exclusão e permissões reais em serviço externo seguro (escolha confirmada; nenhum serviço de autenticação externo acessível nesta sessão). Preservar contas existentes; não substituir por permissões locais.
- [ ] Confirmar login do titular no painel: `/super-admin-auth` abre com o e-mail informado; painel redireciona ao login sem sessão. Cloud pausado impede autenticação e teste com a nova senha; não reutilizar senhas antigas do chat.

- [ ] Reativar Cloud e todos os usuários sem alterar e-mails, senhas ou permissões (01/11/2026: reativação recusada por falta de saldo Cloud; banco indisponível para verificar ou atualizar usuários).
- [x] Adaptar anexo de recuperação com validação segura de PKCE e tokens, sem depender da aba original; 12 testes aprovados e tela sem link validada no navegador. Recuperação real pelo e-mail aguarda Cloud ativo e participação do titular.
- [ ] Manter Cloud disponível: nunca pausar manualmente; suspensão por saldo não pode ser impedida pelo código.

- [x] Criar recuperação de senha segura do SUPER ADMIN: solicitação real aceita pelo backend (HTTP 200), links sem token rejeitados e testes confirmam atualização somente da senha; conclusão pelo link recebido permanece com o titular.
- [x] Aplicar identidade visual da blueprint ao login, marca compartilhada, menu, painel SUPER ADMIN e marca d’água; login verificado visualmente e build automático aprovado. Verificação visual autenticada pendente: sessão de teste redirecionou ao login, sem acesso ao painel.

- [ ] Migrar para destino externo e publicar instalador Windows com dados reais (09/10/2026: origem responde; 11 empresas, 28 perfis, 12 pontos, 0 linhas, 0 escalas e 0 GPS; acesso ao destino e executor Windows não disponíveis).
- [x] Aplicar e verificar proteção dos e-mails, usuários, vínculos de empresa e empresas existentes na origem sem alterar senhas (28 perfis e 11 empresas; tentativas de alteração rejeitadas, desbloqueio permitido em teste revertido).
- [ ] Validar leitura/gravação em tempo real dos painéis no destino externo (aguarda acesso autorizado ao destino e dados operacionais reais; painéis permanecem conectados à origem).

- [x] Consolidar a interface do robô em `/equipment/agents`.
- [x] Adicionar filtros, seleção e reexecução em lote na fila de comandos.
- [x] Adicionar exportação CSV/PDF dos comandos e da auditoria.
- [x] Adicionar alertas de falha, cancelamento e espera prolongada.
- [x] Restringir ações sensíveis por perfil e registrar o operador.
- [x] Adicionar confirmação de adoção e teste simulado de rotação de token.
- [x] Exibir ator, motivo e resultado no histórico de tokens.
- [x] Otimizar carregamento, responsividade e compilação de produção.
- [x] Unificar o terminal do motorista em uma tela operacional.
- [x] Criar supervisão móvel em tempo real com GPS, trajetos e alertas de parada.
- [x] Corrigir avisos do sistema, atualizar a versão e validar a compilação.
- [x] Criar alertas operacionais em tempo real para bloqueios, permissões e comunicação.
- [x] Criar relatório de jornadas por linha com distância, paradas e exportação Excel.
- [ ] Publicar o backend no destino e disponibilizar o instalador Windows validado (origem acessível; acesso ao destino e compilação Windows indisponíveis neste ambiente).
- [ ] Cadastrar empresa, linhas, rotas, escalas e pontos reais (aguarda dados fornecidos).
- [ ] Validar o wizard em rede Windows e relógio físicos (aguarda acesso ao ambiente real).
- [x] Reativar `admin`, `suporte` e `viniciusacacio1@gmail.com`; proteger e-mail/usuário das contas atuais e dados das empresas atuais sem alterar senhas (login com senha permanece na tarefa seguinte).
- [ ] Validar login real e conexões dos agentes sem alterar senhas (09/10/2026: autenticação e banco respondendo; Admin e Suporte inativos reativados, SUPER ADMIN já ativo; validação por senha e agentes físicos ainda pendente).
- [x] Conferir a exportação Excel de jornadas por linha e validar horários, distância e tempo parado.
- [x] Exibir empresa, linha e rota da jornada em andamento no terminal do motorista.
- [ ] Recuperar e migrar integralmente estrutura, contas, dados, arquivos e funções para o Supabase externo, incluindo jornadas, escalas e GPS reais; manter a origem conectada até conferir cópia, contagens e leitura/gravação do aplicativo e instalador (09/10/2026: origem acessível novamente; bloqueado: destino externo sem acesso configurado nesta sessão).
