# Terminal de ponto Android (APK em tela cheia)

O app do terminal roda em um tablet ou celular fixo na empresa. O APK é gerado pelo GitHub Actions
(workflow **APK do terminal**) a cada alteração na main, ou manualmente em *Actions › APK do terminal ›
Run workflow*. Baixe em *Artifacts › superponto-terminal-apk*.

## O que o APK faz sozinho

- Abre em **tela cheia** (sem barra de status e de navegação; um deslize da borda mostra as barras por
  um instante e elas somem de novo).
- Mantém a **tela sempre ligada** enquanto o terminal está aberto.
- O botão **voltar não fecha** o terminal.
- **Abre sozinho quando o aparelho liga.**
- Pode ser escolhido como **tela inicial** do aparelho (ao apertar o botão início, o Android pergunta
  qual app usar: escolha *PontoMax Terminal* e *Sempre*).

## Modo quiosque completo (aparelho dedicado)

Para travar o aparelho só no terminal (sem acesso a outros apps, configurações ou notificações), o
Android exige que o app seja autorizado como dispositivo dedicado. Duas opções:

1. **Com MDM** (Google Workspace, Intune, Hexnode, Scalefusion etc.): cadastre o app como quiosque
   (*single app / lock task*) para o pacote `br.com.pontomax.terminal`.
2. **Sem MDM**, num aparelho recém-restaurado de fábrica e sem contas Google:
   ```bash
   adb install pontomax-terminal.apk
   adb shell dpm set-device-owner br.com.pontomax.terminal/.KioskAdminReceiver
   ```
   Na próxima abertura o terminal trava o aparelho nele. Para desfazer:
   `adb shell dpm remove-active-admin br.com.pontomax.terminal/.KioskAdminReceiver` (em aparelhos de
   teste) ou restaure de fábrica.

Sem nenhuma das duas, o terminal funciona em tela cheia normal. A **fixação de tela** do Android
(*Configurações › Segurança › Fixação de app*) também prende o aparelho no terminal.

## Como funciona no código

O projeto `android-terminal/` é gerado pelo Capacitor a cada build e não fica no Git. A personalização
fica em `mobile/terminal/android/` e é aplicada por `scripts/mobile/patch-terminal.mjs`, chamado por
`scripts/build-mobile.sh terminal`.

## Assinatura para distribuição

Sem chave, o APK sai como versão de teste (instalável manualmente). Para APK assinado, cadastre nos
secrets do GitHub: `TERMINAL_KEYSTORE_B64` (arquivo .jks em base64), `TERMINAL_KEYSTORE_PASS`,
`TERMINAL_KEY_ALIAS` e `TERMINAL_KEY_PASS`.
