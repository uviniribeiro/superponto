# Terminal de ponto Android (APK em tela cheia)

O app do terminal roda em um tablet ou celular fixo na empresa. O APK é gerado pelo GitHub Actions
(workflow **APK do terminal**) a cada alteração na main, ou manualmente em *Actions › APK do terminal ›
Run workflow*. Baixe em *Artifacts › superponto-terminal-apk*.

## Configuração do terminal

Logo após a ativação (e depois, segurando o relógio da tela de espera por 3 segundos + senha do
administrador do terminal) abre a **Configuração do terminal**:

- **Registro de ponto** (como sempre), **Controle de refeitório** ou **Controle de portaria**.
- Refeitório e portaria: **catraca** com **busca automática na rede local** (o terminal varre a rede e
  lista as catracas Control iD e equipamentos HTTP encontrados; toque para escolher), usuário/senha,
  sentido da entrada, botão de saída livre, liberação sem internet e **Testar liberação**.
- Portaria: sentido **automático** (entrada e saída alternadas) ou fixo (só entrada / só saída).
- **Cartão NFC (MIFARE / ISO 14443)**: em aparelhos com NFC, o funcionário aproxima o cartão. No ponto o
  rosto é conferido em seguida; no refeitório e na portaria dá para liberar só com o cartão, como numa
  catraca convencional. Os cartões são vinculados em *Crachás, cartões e códigos de barras* (leitor NFC
  USB no computador) ou em *Cadastros › Métodos de identificação* (tipo RFID).
- Senha do administrador, atalhos para Wi-Fi e Configurações do Android, sair do modo quiosque e
  desativar o terminal.

O terminal funciona como o "sistema" do aparelho: abre ao ligar, pode ser a tela inicial, fica em tela
cheia sem as barras do Android e, como dono do dispositivo, trava o aparelho só nele. Requer
**Android 7.0 ou superior** (o motor de navegador atual não roda no Android 5/6).

## Um app para ponto e refeitório

Na ativação (CNPJ da empresa) escolha o que o aparelho registra: **Ponto** ou **Refeitório**. O app
descobre sozinho se a empresa usa a v1 ou a v2. No refeitório, a tela de espera mostra a refeição aberta
agora (ou a próxima) e a identificação — rosto com prova de vida, QR Code, código de barras, PIN, matrícula
ou CPF — registra a refeição do horário, respeitando o limite por dia. Sem internet, guarda e envia depois.
A finalidade também pode ser trocada depois, pelo sistema (Refeitório › Terminais).

## Catraca (liberação instantânea)

Em *Refeitório › Terminais › Catraca* (v1) ou *Ponto › Refeitório › Terminais* (v2) configure a catraca
ligada ao terminal: **Control iD** (iDBlock, iDFlex…: IP, usuário, senha e sentido da entrada) ou **HTTP
genérico** (placas de relé e controladoras que liberam por uma URL). Assim que a identificação é aceita,
o próprio terminal envia o comando para a catraca pela rede local — sem passar pela nuvem, em
milissegundos. Opções: botão "Liberar saída" na tela, liberar sem internet (a refeição é conferida
depois) e liberar também no registro de ponto. O terminal confere a catraca a cada minuto e o estado
(online / sem resposta) aparece para o administrador. Terminal e catraca precisam estar na mesma rede;
use IP fixo na catraca.

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
