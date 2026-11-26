# Servidor de comunicação (igual à v2)

A v1 usa o mesmo servidor de comunicação e o mesmo agente local da v2
([superponto-communication-server](https://github.com/uviniribeiro/superponto-communication-server)),
com o mesmo contrato `/v1/agent/*`, implementado na Edge Function `agent` do Supabase.

```
relógios ── agente local ──HTTPS──► servidor de comunicação ──HTTPS + X-Comm-Token──► Supabase (função agent)
```

| Rota | Uso |
|---|---|
| `POST /functions/v1/agent/heartbeat` | batimento; devolve nome, fabricante, endereço, leiaute (1510/671), fuso e intervalo de coleta |
| `GET /functions/v1/agent/jobs` | até 50 comandos da fila (`device_commands`): data/hora, empregador, funcionários, coleta |
| `POST /functions/v1/agent/jobs/:id/result` | resultado do comando (coleta traz o AFD) |
| `POST /functions/v1/agent/afd` | AFD enviado pelo agente na coleta agendada; NSR repetido é ignorado |

## Ligando

1. Equipamentos › Lista › botão da chave: gera a chave `spd_…` do relógio (aparece uma vez; o banco
   guarda só o SHA-256). Configure-a no agente local.
2. No servidor de comunicação: `SYSTEM_URL=https://<projeto>.supabase.co/functions` (ele chama
   `<SYSTEM_URL>/v1/agent/...`).
3. Recomendado: gere um segredo (`openssl rand -base64 48`) e defina `COMM_SERVER_TOKEN` igual nos
   dois lados (no Supabase: `supabase secrets set COMM_SERVER_TOKEN=...`). Com ele, só o servidor de
   comunicação fala com a função.

Comandos da tela (`device_commands.command`) e ação no protocolo: `sync_time` → SET_DATETIME,
`collect_records` → COLLECT_RECORDS (a partir do último NSR), `set_employer` → SET_EMPLOYER,
`push_employees` → um UPSERT_EMPLOYEE por funcionário ativo (PIS na Portaria 1.510, CPF na 671),
`receive_employees` e `receive_employer`. As marcações do AFD entram em
`equipment_pending_records` e seguem o processamento já existente.
