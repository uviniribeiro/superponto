# Alertas, relatório de jornadas e publicação operacional

## Resultado

- Adicionar ao Controle Operacional uma tela de alertas atualizada em tempo real.
- Adicionar um relatório de jornadas por linha, com exportação para Excel.
- Publicar as funções do backend afetadas e preparar o instalador Windows disponível no sistema.
- Preservar os cadastros existentes de empresas, colaboradores, ponto e usuários.

## Implementação

1. **Alertas operacionais**
   - Consolidar ações bloqueadas registradas na auditoria, permissões inconsistentes, comandos com falha e comunicação de equipamentos/robôs indisponível.
   - Atualizar automaticamente por eventos em tempo real, com filtros por tipo, gravidade e período.
   - Restringir a tela a administradores e gestores e adicioná-la ao menu do Controle Operacional.

2. **Relatório de jornadas por linha**
   - Filtrar por período, linha, motorista e veículo.
   - Exibir horário previsto, início e fim reais, distância percorrida e tempo parado.
   - Calcular distância pela sequência GPS da jornada e tempo parado pelos intervalos de baixa velocidade.
   - Gerar arquivo Excel com os filtros e totais apresentados.

3. **Publicação e validação**
   - Validar as novas telas no computador e celular, executar os testes e gerar a versão de produção.
   - Publicar as funções do backend que forem alteradas.
   - Verificar e disponibilizar o instalador `.exe` existente ou registrar claramente qualquer bloqueio de compilação Windows.

## Dados reais e ambiente físico

- A base atual tem empresas cadastradas, mas ainda não possui linhas nem escalas operacionais.
- Nenhuma empresa será escolhida arbitrariamente e nenhum dado “real” será inventado.
- O cadastro será feito quando forem fornecidos: empresa/CNPJ, linhas e trajetos, motoristas, veículos, datas, horários e registros de ponto.
- A execução do wizard em rede real e o teste com relógio físico exigem acesso a uma máquina Windows e à rede/equipamento do cliente; serão mantidos como pendências externas caso esse acesso não esteja disponível.

## Detalhes técnicos

- Reutilizar `audit_logs`, `op_user_permissions`, `device_commands`, `equipment_communication_logs`, `communication_agents`, `op_schedules`, `op_lines` e `op_gps_positions`.
- Não criar segunda estrutura de empresas, pessoas, autenticação ou registros de ponto.
- Usar as permissões operacionais e o isolamento por empresa já existentes.
- Exportar `.xlsx` no navegador e manter as consultas GPS limitadas ao período selecionado.