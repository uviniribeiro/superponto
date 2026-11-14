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
| `auth` (login, refresh, logout, recuperação de senha, MFA) | fase 2 |
| `tenants`, `companies`, `units`, `departments` | fase 2/3 |
| `users`, `roles`, `permissions` | fase 2 |
| `audit` | fase 2 |
| `people`, `employments` | fase 3 |
| `schedules`, `time`, `bank-hours`, `requests` | fases 3 e 5 |
| `education`, `health`, `operational` | fase 4 |
| `devices`, `comm` (Communication Server) | fases 6 e 7 |
| `plans`, `subscriptions`, `billing` | fase 8 |
