#!/bin/sh
# Backup diário: banco completo (formato custom do pg_dump) + arquivos do Storage.
# Mantém os últimos BACKUP_KEEP_DAYS dias em deploy/vps/backups.
set -e
umask 077
stamp=$(date +%Y%m%d-%H%M)
mkdir -p /backups
pg_dump -Fc --no-owner -f "/backups/db-$stamp.dump"
if [ -d /storage ]; then
  tar -czf "/backups/storage-$stamp.tar.gz" -C /storage .
fi
find /backups -name 'db-*.dump' -mtime +"${BACKUP_KEEP_DAYS:-14}" -delete
find /backups -name 'storage-*.tar.gz' -mtime +"${BACKUP_KEEP_DAYS:-14}" -delete
echo "$(date '+%F %T') backup concluído: $stamp"
