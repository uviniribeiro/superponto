# API

Base: `/v1`. Documentação interativa gerada pelo Swagger em `/docs` (OpenAPI 3).

## Convenções

- JSON; datas em ISO 8601 com fuso; IDs UUID.
- Autenticação: `Authorization: Bearer <access token>` (15 min) + refresh token rotativo.
- Tenant: definido pelo token; super administradores escolhem com o cabeçalho `X-Tenant-Id`.
- Paginação: `?page=1&pageSize=50` → `{ data, page, pageSize, total }`.
- Erros: `{ statusCode, error, message, details?, requestId }`.
- Idempotência em criações sensíveis: cabeçalho `Idempotency-Key`.

## Módulos (atualizado conforme implementação)

| Módulo | Situação |
|---|---|
| `auth`: `POST /v1/auth/sign-in` (sessão), `POST /v1/auth/token`, `POST /v1/auth/token/refresh`, `POST /v1/auth/sign-out`, `GET /v1/auth/me`, `POST /v1/auth/password/forgot`, `POST /v1/auth/password/reset` | **pronto** (MFA: próximo passo) |
| `companies`: `GET/POST /v1/companies`, `GET/PATCH/DELETE /v1/companies/:id` | **pronto** |
| `platform`: `GET/POST /v1/platform/tenants` | **pronto** |
| `health`: `GET /health` | **pronto** |
| `units`, `departments`, `users`, `roles` | fase 2/3 |
| `audit` (consulta) | fase 3 (gravação já ativa) |
| `people`, `employments` | fase 3 |
| `schedules`, `time`, `bank-hours`, `requests` | fases 3 e 5 |
| `education`, `health`, `operational` | fase 4 |
| `devices`, `comm` (Communication Server) | fases 6 e 7 |
| `plans`, `subscriptions`, `billing` | fase 8 (SaaS) |
| `live`: `GET /v1/live?companyId=` (situação de cada funcionário agora) | **pronto** |
| `notification-schedules`: CRUD, `GET :id/preview`, `POST :id/send` (agendador a cada minuto) | **pronto** |
| `announcements`: CRUD, `GET active`, `POST :id/read`, `GET :id/reads` | **pronto** |
| `app-devices`: `POST request`, `POST :id/confirm`, `GET mine`, `POST mine/:id/revoke`, `GET /`, `POST :id/revoke` | **pronto** |
| `custom-texts`: `GET /`, `PUT :key` | **pronto** |
| `timesheet/me/ack` (`GET`/`POST`) e `GET /v1/mirror-acks` (ciência eletrônica do espelho) | **pronto** |
| `payroll-layouts`: `GET items`, CRUD, `POST :id/export` (arquivo para a folha) | **pronto** |
| `time-records/import-csv` (importação de marcações, com `dryRun`) | **pronto** |
| `agent`: `POST heartbeat` (devolve leiaute, endereço e intervalo), `GET jobs`, `POST jobs/:id/result`, `POST afd` | **pronto** |
