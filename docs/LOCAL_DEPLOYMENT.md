# Deploy em servidor próprio

O guia atualizado está em [deploy/README.md](../deploy/README.md): VPS principal (sistema + banco),
servidor de comunicação dedicado e apps do funcionário e do terminal.

O `docker-compose.yml` da raiz e o backend Express em `server/` são de uma tentativa anterior
e não atendem o app atual (que usa Auth, RLS, Realtime e Edge Functions do Supabase).
Use `deploy/vps/install.sh`.
