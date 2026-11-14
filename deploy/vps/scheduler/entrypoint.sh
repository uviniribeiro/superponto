#!/bin/sh
# Agendador do PontoMax (horário de Brasília). Substitui os agendamentos do Supabase Cloud.
set -e
mkdir -p /etc/crontabs
cat > /etc/crontabs/root <<CRON
# min hora dia mes semana  tarefa
0    3    *   *   *       /scheduler/run-function.sh system-robot
30   2    *   *   *       /scheduler/backup.sh
0    7    *   *   *       /scheduler/run-function.sh check-overtime
0    7    *   *   1       /scheduler/run-function.sh send-weekly-report
0    1    1   *   *       /scheduler/run-function.sh sync-national-holidays
0    1    31  12  *       /scheduler/run-function.sh sync-national-holidays
CRON
echo "Agendador iniciado. Tarefas:"
grep -v '^#' /etc/crontabs/root
exec crond -f -l 6 -L /dev/stdout
