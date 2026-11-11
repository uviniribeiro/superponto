# CamCentral — câmeras Hikvision, Intelbras e Positivo em um só app (Android)

App Android que junta as câmeras de vários gravadores (DVR/NVR) de marcas diferentes
numa única tela, funcionando **no Wi-Fi de casa, no 4G/5G ou em qualquer outro Wi-Fi**.

## Como funciona

- Cada gravador tem dois endereços: **IP local** (em casa) e **endereço externo** (fora de casa).
- O app testa o IP local primeiro; se não responder, usa o externo. Ao trocar de rede
  (ex.: saiu de casa e caiu no 4G), ele refaz essa escolha sozinho.
- O vídeo vem direto do gravador por **RTSP** (padrão que as três marcas suportam),
  sem depender do Hik-Connect, Intelbras Cloud/ISIC ou XMEye.
- Mosaico com 1, 4 ou 9 câmeras por página usando o fluxo leve (economiza dados);
  toque numa câmera para ver em tela cheia em alta qualidade (botão HD/SD alterna).

## URLs usadas por marca

| Marca | URL RTSP (canal 1, principal) |
|---|---|
| Hikvision | `rtsp://usuario:senha@host:554/Streaming/Channels/101` (extra: `102`) |
| Intelbras | `rtsp://usuario:senha@host:554/cam/realmonitor?channel=1&subtype=0` (extra: `subtype=1`) |
| Positivo (firmware XMEye) | `rtsp://host:554/user=usuario&password=senha&channel=1&stream=0.sdp?real_stream` |
| Personalizado | modelo livre com `{user} {pass} {host} {port} {channel} {stream}` |

Se o seu Positivo não abrir, teste a URL no VLC (Mídia → Abrir fluxo de rede) e, achando a
correta, cadastre-o como **Personalizado**.

## Acesso de fora de casa (escolha UMA opção)

1. **Tailscale (recomendado, mais seguro, não precisa mexer no roteador)**
   Instale o Tailscale num aparelho que fica ligado em casa (PC, Raspberry Pi, TV box Android
   ou roteador compatível) e ative *subnet router* anunciando a rede de casa
   (ex.: `192.168.0.0/24`). Instale o Tailscale no celular. Pronto: use o **próprio IP local**
   do gravador também no campo "Fora de casa" — funciona de qualquer internet.
2. **Redirecionamento de porta + DDNS**
   No roteador, redirecione uma porta externa (ex.: 5541, 5542, 5543 — uma por gravador) para a
   porta 554 de cada gravador. Use o DDNS do próprio gravador (Hik-Connect DDNS,
   `ddns-intelbras.com.br`, No-IP etc.) no campo "Fora de casa" com a porta externa.
   ⚠️ Use senha forte e firmware atualizado: o gravador fica exposto na internet.
   Não funciona se a operadora usar CGNAT (comum em fibra/4G) — nesse caso, use o Tailscale.

## Dicas

- Ative o RTSP no gravador se estiver desligado (Hikvision: Configuração → Rede → Avançado;
  Intelbras: Rede → Conexão).
- Para o mosaico ficar fluido no 4G, configure o **fluxo extra** do gravador em H.264,
  resolução baixa (D1/VGA) e ~512 kbps.
- Senhas com `@`, `#`, `:` são tratadas automaticamente.
- Os dados ficam só no celular (armazenamento privado do app, sem backup na nuvem).

## Compilar

Requer JDK 17+ e Android SDK (ou Android Studio):

```bash
./gradlew assembleRelease
```

O APK sai em `app/build/outputs/apk/release/app-release.apk`. A cada push que altera esta
pasta, o GitHub Actions (`.github/workflows/camcentral-android.yml`) também gera o APK como
artefato para download.
