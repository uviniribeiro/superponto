# Servidor de comunicação de equipamentos

A comunicação com relógios de ponto e catracas é um **produto separado**, no repositório
[`superponto-communication-server`](https://github.com/uviniribeiro/superponto-communication-server),
e roda em um **servidor diferente** do sistema SuperPonto.

```
 rede do cliente                 servidor de comunicação                 sistema SuperPonto
 relógios ── agente local ──HTTPS──► sp-comm (fila em disco) ──HTTPS + X-Comm-Token──► API + banco
```

| Peça | Onde | O que faz |
|---|---|---|
| Agente local | rede do cliente | fala com os relógios (Control iD, Henry 8x, simulador); só conexões de saída |
| Servidor de comunicação | VPS própria | recebe os agentes, repassa ao sistema, guarda em fila quando o sistema cai |
| Sistema (este repositório) | VPS principal | cadastro, comandos, importação de AFD, telas; não fala com relógios |

O servidor de comunicação **não acessa o banco de dados**: conversa com o sistema só pelas rotas
`/v1/agent/*` da API.

## Ligando os dois servidores

1. Gere um segredo: `openssl rand -base64 48`.
2. No sistema: defina `COMM_SERVER_TOKEN=<segredo>` (API Dart ou Node). A partir daí `/v1/agent/*`
   recusa (401) qualquer chamada sem o cabeçalho `X-Comm-Token` igual.
3. No servidor de comunicação: `SYSTEM_URL=https://<sistema>` e o mesmo `COMM_SERVER_TOKEN`.
4. Nos agentes: `commUrl` (ou `SUPERPONTO_COMM_URL`) com o endereço do servidor de comunicação.

Sem `COMM_SERVER_TOKEN` no sistema, o agente pode falar direto com a API (instalação local e testes).

## Contrato (rotas que o servidor de comunicação repassa)

| Rota | Autenticação | Uso |
|---|---|---|
| `POST /v1/agent/heartbeat` | `X-Device-Key` + `X-Comm-Token` | batimento; devolve leiaute, fuso, endereço e intervalo de coleta |
| `GET /v1/agent/jobs` | idem | até 50 comandos da fila, já com os dados prontos para o relógio |
| `POST /v1/agent/jobs/:id/result` | idem | resultado do comando (com dados lidos do relógio, quando houver) |
| `POST /v1/agent/afd` | idem | AFD coletado; NSR repetido é ignorado (idempotente) |

Comando que ficou "em execução" por mais de 15 minutos volta para a fila; um resultado atrasado
entregue depois recebe 409 e é descartado pelo servidor de comunicação.

## Funcionamento com o sistema fora do ar

- Batimento: responde com a última configuração conhecida (`degraded: true`).
- Fila de comandos: vazia.
- Resultados e AFD: gravados em disco (um arquivo por item, escrita atômica) e entregues na ordem de
  chegada quando o sistema volta. Só equipamentos já aceitos pelo sistema usam a fila; há limite de
  tamanho; itens recusados vão para a quarentena com o motivo.

Instalação, variáveis e publicação: ver o README do repositório de comunicação.
