# Agente local do SuperPonto

Programa pequeno instalado **na rede do cliente**, perto dos relógios de ponto. Ele:

1. avisa a API que está vivo (a cada 30 s) e recebe o endereço, o leiaute (1510/671) e o intervalo de coleta do equipamento;
2. busca a fila de comandos (acertar hora, empregador, enviar/remover funcionários e digitais, ler a lista do relógio, coletar marcações) e devolve o resultado;
3. coleta o AFD no intervalo cadastrado e envia **só o que é novo** (guarda o último NSR em um arquivo de estado).

Só faz conexões **de saída**: para o relógio (rede local) e para a API do SuperPonto (HTTPS). Não abre porta, não fala com nenhum outro sistema.

## Fabricantes

| Driver | Situação |
| --- | --- |
| `controlid` — Control iD (REP iDClass e linha iDAccess/iDFlex/iDFace) pela API local `*.fcgi` | Hora, coleta de AFD e cadastro de usuários seguem a documentação pública da Control iD. **Empregador, cadastro/lista de usuários no REP iDClass e digitais no REP estão com homologação pendente** (precisam ser validados em um equipamento real antes de produção). |
| `simulator` — relógio simulado | Para testar a instalação sem equipamento. |

Henry (protocolo 8x), Topdata, Biomtech, Dahua e RW **não estão implementados**: cada um exige a documentação oficial do fabricante e um equipamento para homologar. A estrutura de drivers (`src/drivers/types.ts`) já está pronta para recebê-los.

## Instalação

Requer Node.js 22 ou mais novo.

1. Na tela **Equipamentos**, cadastre o relógio (endereço IP, porta, intervalo de coleta) e gere a **chave do agente** (`spd_...`, aparece uma vez).
2. Copie esta pasta (`dist/`, `package.json`) para o computador da rede do cliente e rode `npm install --omit=dev`.
3. Crie o arquivo de configuração a partir de `deploy/agent.example.json`. O endereço da API é informado aqui, na instalação. Usuário e senha do relógio ficam **só neste arquivo** (nunca vão para a nuvem): proteja o arquivo.
4. Teste: `SUPERPONTO_AGENT_CONFIG=agent.json node dist/main.js`.

### Windows (serviço)

Com o [NSSM](https://nssm.cc) instalado, no PowerShell como Administrador:

```powershell
.\deploy\instalar-servico-windows.ps1 -Pasta C:\SuperPonto\agente -Config C:\SuperPonto\agente\agent.json
```

### Linux (systemd)

```bash
sudo useradd --system --home /var/lib/superponto superponto
sudo mkdir -p /opt/superponto-agent /etc/superponto /var/lib/superponto && sudo chown superponto /var/lib/superponto
sudo cp -r dist package.json /opt/superponto-agent/ && (cd /opt/superponto-agent && sudo npm install --omit=dev)
sudo cp deploy/agent.example.json /etc/superponto/agent.json && sudo chmod 600 /etc/superponto/agent.json && sudo chown superponto /etc/superponto/agent.json
sudo cp deploy/superponto-agent.service /etc/systemd/system/ && sudo systemctl enable --now superponto-agent
```

Use `"stateFile": "/var/lib/superponto/estado.json"` no arquivo de configuração.

### Só um relógio, sem arquivo

Variáveis de ambiente: `SUPERPONTO_API_URL`, `SUPERPONTO_DEVICE_KEY`, `SUPERPONTO_DRIVER` (`controlid`/`simulator`), `SUPERPONTO_DEVICE_HOST`, `SUPERPONTO_DEVICE_PORT`, `SUPERPONTO_DEVICE_LOGIN`, `SUPERPONTO_DEVICE_PASSWORD`, `SUPERPONTO_DEVICE_FAMILY` (`rep`/`access`), `SUPERPONTO_DEVICE_HTTPS` e `SUPERPONTO_DEVICE_INSECURE_TLS` (`false` para desligar), `SUPERPONTO_AGENT_STATE`.

## Segurança

- A API exige HTTPS (http só para `localhost`). A chave do equipamento vai no cabeçalho `X-Device-Key`; a API guarda só o hash dela.
- `insecureTls` aceita o certificado autoassinado **do relógio** (comum nos REPs); não afeta a conexão com a API.
- Em falhas de rede o agente espera 15 s, 30 s, 1 min… até 5 min entre tentativas; comandos não concluídos voltam para a fila sozinhos depois de 15 minutos.
