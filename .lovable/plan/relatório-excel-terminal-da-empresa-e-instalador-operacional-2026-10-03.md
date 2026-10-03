# Relatório Excel, terminal da empresa e instalador operacional

## Objetivo

- Conferir e reforçar a exportação Excel do relatório de jornadas por linha, mantendo horário previsto, horário real, distância e tempo de parada.
- Mostrar no terminal do motorista a empresa vinculada, a linha e a rota da jornada em andamento.
- Publicar o sistema e tentar publicar o backend e o instalador Windows com o assistente já existente.

## Implementação

1. Ajustar o relatório para gerar uma planilha profissional, com título, empresa, período, filtros, cabeçalhos, unidades e dados das jornadas.
2. Validar o arquivo gerado abrindo-o e conferindo colunas, valores, tipos e ausência de erros.
3. Ampliar os dados operacionais do terminal com origem e destino da linha e exibir uma área de empresa e rota para a jornada ativa.
4. Validar o terminal em tela móvel e conferir o relatório no navegador.
5. Verificar o backend, publicar a função do agente e republicar o aplicativo quando o ambiente estiver disponível.
6. Verificar se o instalador Windows pode ser produzido neste ambiente; caso contrário, manter o fluxo automatizado pronto e registrar claramente o bloqueio externo.

## Dependências externas

- A versão com dados reais depende de empresa, linhas, veículos, motoristas, escalas e pontos já existentes no banco ou fornecidos pelo responsável; nenhum dado será inventado.
- O teste do assistente em rede real exige uma máquina Windows conectada à rede e aos relógios do cliente.
- Se o banco hospedado continuar pausado, publicação do backend e consultas reais permanecem bloqueadas até sua reativação.

## Entrega

- Exportação Excel conferida.
- Terminal do motorista com empresa, linha e rota da jornada atual.
- Aplicativo republicado.
- Instalador e backend publicados quando a infraestrutura permitir, ou bloqueios documentados sem alegar validação física inexistente.