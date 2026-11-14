# Servidor de comunicação do PontoMax

Servidor Linux dedicado, com IPv4 público próprio, separado do domínio do sistema. Ele roda o
**robô de comunicação**: conversa com os relógios de ponto (REP) e envia as marcações para a VPS
principal por HTTPS. A VPS nunca precisa alcançar os relógios.

```
relógios REP  ◄── IP/porta ──  servidor de comunicação  ── HTTPS ──►  https://SEU_DOMINIO/functions/v1/agent-gateway
                               (uma instância por empresa)              (aceita só o IP deste servidor)
```

## Instalação

**Requisitos:** Ubuntu 22.04/24.04 ou Debian 12, 1 vCPU e 1 GB de RAM.

```bash
git clone https://github.com/uviniribeiro/superponto.git /opt/pontomax-src
```

```bash
cd /opt/pontomax-src/deploy/comm && sudo ./install.sh --domain ponto.suaempresa.com.br
```

O instalador:
- instala o Python;
- sincroniza o relógio do servidor (chrony, fuso America/Sao_Paulo);
- cria o usuário de serviço `pontomax`;
- registra o serviço `pontomax-agent@.service`;
- fecha o firewall para entrada (só SSH);
- mostra o IPv4 público do servidor.

**Na VPS principal**, autorize esse IP:

```bash
cd /opt/pontomax/deploy/vps && sudo sed -i 's/^COMM_SERVER_IPS=.*/COMM_SERVER_IPS=IP_DO_SERVIDOR/' .env
```

```bash
sudo ./pontomax up -d functions
```

De volta ao servidor de comunicação, confirme:

```bash
pontomax-comm test
```

## Uma instância por empresa

Cada empresa tem o próprio token, gerado no sistema em **Equipamentos → Robô de Comunicação**.

```bash
sudo pontomax-comm add prefeitura-x --token TOKEN --empresa "Prefeitura X" --cnpj 12345678000190
```

| Comando | Ação |
|---|---|
| `pontomax-comm list` | instâncias e estado |
| `pontomax-comm status <nome>` | detalhes do serviço |
| `pontomax-comm logs <nome>` | log ao vivo |
| `pontomax-comm restart <nome>` | reinicia |
| `pontomax-comm remove <nome>` | remove a instância |

Neste servidor a **varredura de rede fica desligada**, porque varrer a rede de um datacenter
pode gerar denúncia de abuso. O robô gerencia os relógios **cadastrados no sistema** pelo IP e
porta de cada um.

## Como os relógios ficam alcançáveis

Escolha por cliente:

1. **IP público + redirecionamento de porta** no roteador do cliente, liberado só para o IP deste
   servidor. Cadastre o relógio com o IP público e a porta (Henry/Dimep/Madis 3000, Control iD 80/443,
   ZKTeco 4370, Topdata 3570).
2. **VPN** (WireGuard, por exemplo) entre este servidor e a rede do cliente. Cadastre o relógio
   com o IP interno.
3. **Robô local no cliente**: o instalador Windows/Linux do robô roda numa máquina da rede do
   cliente e fala direto com a VPS. Nesse caso, deixe `COMM_SERVER_IPS` vazio na VPS ou inclua o
   IP de saída do cliente.

## GPS e telemetria da frota (opcional)

Rastreadores que enviam JSON por UDP precisam de uma porta por instância:

```bash
sudo pontomax-comm add frota-x --token TOKEN --gps-porta 5515
```

Essa porta UDP é aberta no firewall. Ela aceita pacotes de qualquer origem, então restrinja ao
IP das operadoras dos rastreadores sempre que possível:

```bash
sudo ufw allow from IP_DA_OPERADORA to any port 5515 proto udp
```
