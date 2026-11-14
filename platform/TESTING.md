# Testes

| Camada | Ferramenta | Onde |
|---|---|---|
| Motor de jornada | Vitest | `packages/time-engine/test` |
| API (unidade e integração) | Vitest + Supertest, PostgreSQL real em contêiner | `apps/api/test` |
| Isolamento multi-tenant e RLS | testes de integração com dois tenants | `apps/api/test/tenancy.e2e.test.ts` |
| Banco (RLS, gatilhos, unicidade) | SQL contra PostgreSQL 17 | registrado em DATABASE.md |
| Communication Server | Vitest + simuladores de equipamento | fase 7 |
| Web | Vitest + Testing Library; Playwright para fluxos | fase 3 em diante |

Regra: toda funcionalidade entra com teste de regra de negócio e de permissão. Cálculos de jornada
têm casos para cada tipo de escala e para virada de dia.

## Como rodar

```bash
cd platform && npm install
docker run -d --name sp2-pg -e POSTGRES_PASSWORD=dev -e POSTGRES_DB=superponto -p 127.0.0.1:55432:5432 postgres:17-alpine
npm run db:migrate && npm test
```
