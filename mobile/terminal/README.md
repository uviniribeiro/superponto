# Terminal de ponto Android (APK em tela cheia)

O app do terminal roda em um tablet ou celular fixo na empresa. O APK é gerado pelo GitHub Actions
(workflow **APK do terminal**) a cada alteração na main, ou manualmente em *Actions › APK do terminal ›
Run workflow*. Baixe em *Artifacts › superponto-terminal-apk*.

## Um app para ponto e refeitório

Na ativação (CNPJ da empresa) escolha o que o aparelho registra: **Ponto** ou **Refeitório**. O app
descobre sozinho se a empresa usa a v1 ou a v2. No refeitório, a tela de espera mostra a refeição aberta
agora (ou a próxima) e a identificação — rosto com prova de vida, QR Code, código de barras, PIN, matrícula
ou CPF — registra a refeição do horário, respeitando o limite por dia. Sem internet, guarda e envia depois.
A finalidade também pode ser trocada depois, pelo sistema (Refeitório › Terminais).

## O que o APK faz sozinho

- Abre **sempre em tela cheia**, sem a barra de status e sem os botões do Android. Se as barras aparecerem
  (deslize da borda, teclado, aviso do sistema), o app esconde de novo em seguida e reforça a cada 1,5 s.
- Mantém a **tela sempre ligada** enquanto o terminal está aberto.
- O botão **voltar não fecha** o terminal.
- **Abre sozinho quando o aparelho liga.**
- Pode ser escolhido como **tela inicial** do aparelho (ao apertar o botão início, o Android pergunta
  qual app usar: escolha *SuperPonto Terminal* e *Sempre*).

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
   Na próxima abertura o terminal trava o aparelho nele, desliga a barra de notificações, a tela de
   bloqueio e os botões de início e recentes. Para desfazer:
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
