# Migração integral para Supabase externo

## Objetivo

Migrar estrutura, contas, dados, arquivos e funções do banco atual para o projeto Supabase já criado, sem deixar o aplicativo, o backend ou o instalador sem dados. A desconexão da Lovable Cloud ocorrerá somente depois da validação do destino.

## Ordem segura

1. Solicitar ao suporte a reativação temporária do banco atual e confirmar que consultas, autenticação e arquivos voltaram a responder.
2. Produzir backup completo e verificável da origem: estrutura, dados públicos, usuários de autenticação, arquivos dos buckets e configurações necessárias às funções.
3. Aplicar no destino as migrações existentes em ordem, incluindo extensões, permissões, políticas, gatilhos e a proteção imutável dos logins e empresas atuais, sem alterar senhas.
4. Importar usuários preservando identificadores e credenciais compatíveis; depois importar empresas, colaboradores, pontos, escalas, linhas, veículos, GPS, telemetria, alertas e demais dados respeitando dependências.
5. Recriar buckets privados, copiar arquivos e configurar os segredos das funções no destino.
6. Publicar e testar todas as funções, com prioridade para `agent-gateway`, terminal, autenticação, relógios e notificações.
7. Tornar o agente e o wizard configuráveis pelo endereço do novo backend, eliminando dependência do endereço antigo; gerar e validar o `.exe` pelo fluxo Windows existente.
8. Validar em paralelo no destino: Admin, Suporte e SUPER ADMIN; Controle Operacional; jornadas; alertas; GPS; cronômetro; comandos do agente; arquivos e atualizações.
9. Somente após conferência de contagens e testes, desconectar a Lovable Cloud, vincular o projeto ao Supabase externo, atualizar as variáveis do aplicativo e publicar a versão final.

## Critérios de conferência

- Totais por tabela e amostras críticas idênticos entre origem e destino.
- Usuários mantêm os mesmos identificadores e acessam sem troca de senha.
- Empresas e identificadores de login existentes ficam protegidos por gatilhos.
- Arquivos privados continuam acessíveis apenas por autorização ou links temporários.
- GPS, cronômetro, escalas, jornadas, alertas e agente gravam no destino.
- Instalador aponta ao novo backend e o serviço Windows inicia corretamente.

## Bloqueios atuais

- O banco de origem está pausado, e a reativação automática foi desabilitada; o suporte precisa restaurar o acesso.
- O Supabase externo não pode ser vinculado enquanto este projeto ainda estiver ligado à Lovable Cloud.
- O `.exe` só pode ser compilado e testado no executor Windows já configurado; a validação em rede real exige a máquina do gestor.
- Não desconectar nem apagar a origem antes do backup, da importação e da validação do destino.
