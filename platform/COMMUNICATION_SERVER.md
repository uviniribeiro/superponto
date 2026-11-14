# SuperPonto Communication Server

Produto técnico independente, instalado em servidor próprio (IPv4 público ou domínio próprio),
responsável por toda a comunicação com relógios de ponto, leitores e controladores de acesso.
Status: **projeto (fase 7)**. Substituirá o robô atual em Python (`public/downloads/pontomax-agent.py`).

## Responsabilidades

- Receber conexões dos equipamentos (modo push) e conectar-se a eles (modo pull).
- Interpretar protocolos por **adaptador** (um por fabricante/modelo/firmware).
- Receber marcações e eventos de acesso; enviar funcionários, identificadores, data/hora e configurações.
- Guardar eventos em **fila local persistente** enquanto o servidor principal estiver indisponível.
- Encaminhar tudo à API principal com idempotência e confirmação.
- **Não** hospeda nem acessa o PostgreSQL principal.

## Arquitetura interna

```
 equipamentos ──► listeners (TCP/UDP/HTTP por adaptador) ──► normalizador ──► fila local (SQLite WAL)
                                                                                    │
 API principal ◄── uplink (HTTPS, lotes, retentativa com backoff) ◄─────────────────┘
       │
       └─► downlink: comandos (sincronizar funcionários, acertar hora, coletar) ──► executor ──► adaptador
```

- **Node.js 22 + TypeScript**; serviços NestJS standalone (sem HTTP público além dos listeners).
- **Fila local**: SQLite em modo WAL (sobrevive a reinício e queda de energia; sem dependência
  externa obrigatória). Redis/BullMQ opcional para alto volume.
- **Adaptadores** implementam a interface `DeviceAdapter` (ver DEVICE_INTEGRATIONS.md).
- **Docker** (imagem única), com volume persistente para fila e logs.

## Segurança

1. Cadastro no SuperPonto principal (menu **Servidores de Comunicação**) gera `keyId` + segredo
   (exibido uma vez; o banco guarda só o hash).
2. O servidor assina cada requisição (HMAC-SHA256 de método, caminho, data e corpo) e troca a
   assinatura por um **token de curta duração** (15 min) com escopo nas empresas/unidades autorizadas.
3. TLS obrigatório; certificado de cliente (mTLS) opcional por servidor.
4. A API valida que cada evento pertence a um equipamento associado àquele servidor.
5. Credenciais dos equipamentos chegam cifradas e nunca aparecem no frontend.

## Contrato com a API (resumo)

| Endpoint | Uso |
|---|---|
| `POST /v1/comm/auth/token` | troca assinatura HMAC por token curto |
| `POST /v1/comm/heartbeat` | versão, uptime, equipamentos conectados, tamanho da fila |
| `POST /v1/comm/events` | lote `{ batchId, items[] }` de eventos; resposta por item: `accepted`, `duplicate` ou `rejected` (com motivo) |
| `GET /v1/comm/commands` | comandos pendentes para os equipamentos deste servidor |
| `POST /v1/comm/commands/:id/result` | resultado da execução |
| `GET /v1/comm/devices` | equipamentos associados e configuração |

Idempotência: `UNIQUE(server_id, batch_id)` no lote e `(device_id, kind, nsr, occurred_at)` no evento.
Um lote reenviado após timeout devolve o mesmo resultado, sem duplicar marcações.

## Funcionamento offline

1. Evento recebido → gravado na fila local antes de responder ao equipamento.
2. Sem conexão com a API → acumula; métricas expõem o tamanho da fila.
3. Conexão restabelecida → envio em lotes por ordem de chegada; só remove da fila o item confirmado
   (`accepted` ou `duplicate`). `rejected` vai para quarentena visível no painel, nunca é descartado
   silenciosamente.

## Equipamentos sem acesso direto à internet

O mesmo binário roda em **modo gateway** dentro da rede do cliente, conectando-se para fora (túnel
de saída) ao Communication Server, ou diretamente à API, com sua própria credencial. Alternativas:
VPN site-a-site ou redirecionamento de porta restrito ao IP do servidor.

## Painel no SuperPonto principal

Cadastro (nome, identificador, IP, domínio, porta, protocolo, empresas e unidades autorizadas),
credenciais, equipamentos associados, status, última comunicação, eventos recebidos/pendentes,
falhas, histórico e versão instalada.

## Instalação (planejada)

```bash
docker run -d --name superponto-comm --restart unless-stopped \
  -v /srv/superponto-comm:/data -p 3000:3000 -p 3570:3570 -p 4370:4370/udp \
  -e SUPERPONTO_API_URL=https://api.seu-dominio -e SUPERPONTO_KEY_ID=... -e SUPERPONTO_SECRET=... \
  ghcr.io/superponto/communication-server:VERSAO
```
