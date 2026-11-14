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

## LGPD e biometria

- Templates biométricos e imagens faciais ficam **no equipamento**; o SuperPonto guarda só a
  referência (`device_identifiers.type = BIOMETRIC_REFERENCE`).
- Envio de foto para reconhecimento facial exige finalidade registrada, consentimento/base legal
  e política de retenção configurada por empresa.
