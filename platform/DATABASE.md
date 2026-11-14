# SuperPonto v2 — Banco de dados

Fonte: `packages/database/prisma/schema.prisma` (79 modelos, 32 enums) e
`packages/database/prisma/migrations/`. Validado em PostgreSQL 17 (migrações aplicadas do zero).

## Convenções

- **PK**: UUID técnico em todas as tabelas. Matrícula, CPF, PIS e CRM nunca são chave primária.
- **Nomes**: modelos em camelCase no TypeScript; tabelas/colunas em snake_case no banco
  (`scripts/snake-case.mjs` gera os `@map`).
- **Multi-tenant**: `tenant_id` em toda tabela de dados de cliente, com índice começando por ele.
  Tabelas globais: `plans`, `plan_features`, `device_manufacturers`, `device_models`,
  `device_adapters`, `device_homologations`, `permissions`.
- **Exclusão lógica**: `deleted_at` nos cadastros. Pessoas e vínculos não podem ser excluídos
  fisicamente (gatilho).
- **Datas**: `timestamptz` para instantes; `date` para dias de referência; fuso da empresa/unidade.

## Domínios e tabelas

| Domínio | Tabelas |
|---|---|
| Organização | `tenants`, `companies`, `company_units` (árvore; tipo escola/hospital/UPA...), `departments` (árvore), `sectors`, `operational_teams` |
| Pessoas e vínculos | `people`, `person_documents`, `professional_registrations` (CRM/COREN/RQE), `job_positions`, `professional_specialties`, `employment_relationships`, `employment_history`, `employment_specialties` |
| Jornada | `attendance_rule_sets`, `work_schedules`, `work_schedule_days`, `schedule_assignments` (vigência), `calendars`, `calendar_events` |
| Ponto e apuração | `time_records` (imutável), `time_record_adjustments`, `time_calculations`, `bank_hours`, `bank_hour_transactions`, `attendance_occurrences`, `time_closings` |
| Solicitações | `approval_flows`, `time_requests`, `request_decisions` |
| Educação | `academic_periods`, `courses`, `subjects`, `classes` (turmas), `classrooms`, `teaching_assignments`, `class_schedules`, `class_sessions` |
| Saúde | `medical_shifts`, `medical_shift_assignments`, `shift_substitutions`, `shift_handover_events`, `professional_availability`, `consultation_rooms`, `medical_appointments` (agenda administrativa) |
| Operacional | `operational_activities`, `operational_assignments`, `operational_occurrences`, `operational_events` |
| Equipamentos | `device_manufacturers`, `device_models`, `device_adapters`, `device_homologations`, `devices`, `device_identifiers`, `device_events` (imutável), `device_logs`, `device_sync_jobs`, `access_events` |
| Communication Server | `communication_servers`, `communication_server_credentials`, `communication_events`, `communication_sync_history`, `communication_logs` |
| Acesso | `users`, `sessions`, `mfa_factors`, `password_reset_tokens`, `roles`, `permissions`, `role_permissions`, `user_roles` (com escopo), `audit_logs` (imutável) |
| Notificações | `notifications`, `notification_preferences` |
| SaaS | `plans`, `plan_features`, `subscriptions`, `billing_events` |

## Regras-chave do modelo

### Pessoa × vínculo × usuário
- `people`: identidade (nome, nome social, contato, CPF/PIS protegidos).
- `employment_relationships`: o **vínculo**. Tem matrícula (`registration`), empresa, unidade,
  departamento, cargo, categoria profissional (professor, médico, enfermeiro...), contrato, situação,
  supervisor e conjunto de regras de apuração. **Matrícula única por empresa**
  (`UNIQUE(company_id, registration)`).
- `users`: login. `person_id` opcional (administrador pode não ser funcionário).
- Marcações, apuração, banco de horas, escalas, aulas e plantões referenciam o **vínculo**, nunca a
  pessoa. Relatórios consolidados agrupam por pessoa; saldos de vínculos diferentes não se misturam.

### Ponto
- `time_records` guarda a marcação original com origem, dispositivo, NSR, localização (quando
  autorizada), indicador offline, hash encadeado e `idempotency_key` (único por tenant). Gatilho
  bloqueia UPDATE/DELETE.
- Correções: `time_record_adjustments` (incluir, desconsiderar, reclassificar), sempre com
  justificativa, autor e aprovação.
- `time_calculations`: resultado diário recalculável; grava `engine_version`. Gatilho impede
  alteração em período com `time_closings.status = CLOSED`.

### Equipamentos e acesso
- `device_events` guarda o evento bruto. Se for marcação, gera `time_records`
  (`source = DEVICE/COMMUNICATION_SERVER`); se for acesso, gera `access_events`. Nunca os dois
  automaticamente.
- `device_identifiers` guarda só o identificador do vínculo no equipamento (matrícula, cartão,
  referência biométrica no aparelho). **Templates biométricos e fotos faciais não são armazenados.**
- `device_homologations` é a matriz de compatibilidade; só vale `HOMOLOGATED` após teste real.

### Communication Server
- Credenciais guardam apenas `secret_hash`; rotação por validade e revogação.
- `communication_events` registra cada lote recebido; `UNIQUE(server_id, batch_id)` torna o envio
  idempotente.

### Permissões
- `permissions` (globais) no formato `modulo.recurso:acao`; `roles` de sistema (`tenant_id` nulo) ou
  personalizados por tenant; `user_roles` com escopo (`TENANT`, `COMPANY`, `UNIT`, `DEPARTMENT`,
  `SELF`).

## Segurança no banco (migração `20261115000100_security`)

- Papel `superponto_app` (sem privilégios de dono): é o papel da API em produção.
- **RLS** em 64 tabelas: `tenant_id = current_setting('app.tenant_id')`. Linhas globais
  (`tenant_id` nulo) são legíveis e só alteráveis em modo plataforma (`app.bypass_rls = on`,
  usado por código revisado: login, SuperAdmin, ingestão do Communication Server).
- Gatilhos: `time_records`, `audit_logs` e `device_events` são somente inserção; `people` e
  `employment_relationships` não aceitam DELETE; `time_calculations` respeita fechamentos.

### Testes executados em PostgreSQL 17

| Cenário | Resultado |
|---|---|
| Consulta sem tenant definido | 0 linhas |
| Tenant A lista empresas | só a empresa A |
| Tenant A grava linha com tenant B | bloqueado pela RLS |
| Tenant B lê marcações do A | 0 linhas |
| Alterar marcação original | bloqueado (gatilho) |
| Excluir vínculo | bloqueado (gatilho) |
| Matrícula repetida na mesma empresa | bloqueado (índice único) |

## Backup e recuperação

- Produção: backup diário completo + WAL contínuo (PITR) no provedor; cópia externa diária
  (S3 de outra região/provedor); teste de restauração mensal documentado em DEPLOYMENT.md.

## Migração dos dados da v1

ETL dedicado (fase 10): `companies` → `tenants` + `companies`; `profiles` → `people` +
`employment_relationships` (matrícula = `registration_number`) + `users`; `time_records` →
`time_records` com `source = IMPORT` e hash recalculado; papéis da v1 → perfis de sistema.
