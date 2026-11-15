# Integrações com equipamentos

Status: **projeto (fases 6 e 7)**. Nenhum equipamento está homologado na v2 ainda.

## Interface de adaptador

```ts
interface DeviceAdapter {
  key: string;                 // 'controlid-rest', 'henry-tcp', 'zkteco-udp'...
  version: string;
  transports: ('tcp' | 'udp' | 'http' | 'https' | 'serial-gateway')[];
  capabilities: {
    pullRecords: boolean; pushRecords: boolean; syncEmployees: boolean;
    syncCards: boolean; biometricReference: boolean; setClock: boolean;
    accessControl: boolean; status: boolean;
  };
  connect(target: DeviceTarget, credentials: DeviceCredentials): Promise<DeviceSession>;
  fetchRecords(session: DeviceSession, sinceNsr?: bigint): AsyncIterable<NormalizedEvent>;
  pushEmployees?(session: DeviceSession, people: DeviceEmployee[]): Promise<SyncResult>;
  setClock?(session: DeviceSession, now: Date): Promise<void>;
  status(session: DeviceSession): Promise<DeviceStatusReport>;
  diagnose(target: DeviceTarget): Promise<DiagnosticReport>;
}
```

Todo adaptador produz `NormalizedEvent` (tipo, instante com fuso, NSR, identificador, payload
bruto). A conversão para marcação ou evento de acesso acontece na API, por regra configurada.

## Fabricantes previstos

| Fabricante | Protocolo conhecido (v1) | Adaptador v2 | Situação |
|---|---|---|---|
| Control iD (iDClass, iDFlex, REP iDX) | REST JSON (`/login.fcgi`, `/load_objects.fcgi`) | `controlid-rest` | a portar do robô Python |
| Henry (Hexa, Prisma, Orion) | TCP ASCII STX/ETX + checksum XOR, porta 3000 | `henry-tcp` | a portar |
| ZKTeco / Rep iX | TCP/UDP 4370 | `zkteco` | a portar |
| Topdata (Inner Rep) | TCP binário STX/ETX, porta 3570 | `topdata-tcp` | a portar |
| Dimep (PrintPoint/MiniPrint) | TCP ASCII, porta 3000 | `dimep-tcp` | a portar |
| Madis | TCP ASCII compatível Henry | `henry-tcp` (variante) | a portar |
| Ahgora, Secullum, Hikvision, Intelbras | a levantar com documentação do fabricante | — | não iniciado |

## Matriz de homologação

Armazenada em `device_homologations` (modelo × firmware × adaptador × versão). Um modelo só pode ser
comercializado como **homologado** após teste com equipamento real ou ambiente do fabricante,
registrando data, recursos testados e limitações. Não há compatibilidade universal.

## Portarias 1.510/2009, 373/2011 e 671/2021

Cada equipamento é cadastrado com a portaria que o rege (`devices.ordinance`) e o seu fuso
(`devices.timezone`). O pacote `packages/rep-protocols` concentra as regras:

| | Portaria 1.510/2009 | Portaria 373/2011 (REP-A) | Portaria 671/2021 |
|---|---|---|---|
| Leiaute do AFD | registros 1, 2, 3, 4, 5, 9 | o do sistema (1.510 ou 671, detectado) | registros 1 a 7 e 9 |
| Data e hora | ddmmaaaa hhmm, **sem fuso** (usa o fuso do equipamento) | conforme o leiaute | ISO 8601 com fuso |
| Trabalhador | **PIS** | conforme o leiaute | **CPF** |
| Empregador | CNPJ numérico ou CPF | conforme o leiaute | CNPJ (inclusive alfanumérico) ou CPF |

**Recebimento** — `POST /v1/devices/:id/afd` lê o arquivo (detecção automática do leiaute), grava cada
evento bruto em `device_events` e cria `time_records` dos trabalhadores identificados, com hash
encadeado por vínculo. Reimportar não duplica (chave `afd:<equipamento>:<NSR>`). Lacunas de NSR, linhas
inválidas e PIS/CPF desconhecidos voltam no resumo. AFD de outro CNPJ é recusado.

**Envio** — `POST /v1/devices/:id/sync` agenda em `device_sync_jobs`: empregador (`SET_EMPLOYER`),
funcionários ativos (`UPSERT_EMPLOYEE`) e digitais (`UPSERT_FINGERPRINT`). Quem não tem o documento
exigido pela portaria volta em `skipped`. REP da 1.510 não recebe CNPJ alfanumérico (o campo dele
só tem 14 dígitos). O adaptador Control iD (`controlIdRequests`) traduz cada comando para a API
`*.fcgi`; comandos de REP iDClass estão marcados `homologationPending` até o teste em equipamento real.

> A Portaria MTP nº 672/2021 trata de segurança e saúde no trabalho (EPI e equipamentos), não de
> registro de ponto; por isso não há leiaute de equipamento associado a ela.

## LGPD e biometria

- **Digitais**: o SuperPonto guarda só o **template** (nunca a imagem) em `biometric_templates`,
  cifrado com AES-256-GCM (`BIOMETRIC_ENCRYPTION_KEY`, separada das demais chaves). O template não volta
  nas respostas da API nem na auditoria; a fila de envio guarda só a referência e ele é decifrado no
  momento do envio ao equipamento. Uma nova captura revoga a anterior; o template gravado não pode ser
  alterado (gatilho no banco). Acesso pela permissão `people.biometrics:manage`.
- Envio de foto para reconhecimento facial exige finalidade registrada, consentimento/base legal
  e política de retenção configurada por empresa.
