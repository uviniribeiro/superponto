# Presença Viva

Sua experiência continua trabalhando, mesmo quando você está vivendo.

App autônomo (um único arquivo HTML, sem build e sem dependências), separado do PontoMax.
Abra `index.html` no navegador. Os dados ficam no `localStorage` do aparelho; use **Memória da marca → Backup** para copiar e restaurar.

`presenca-viva.html` é a mesma página sem o esqueleto `<html>`, usada para publicar como Artifact.

## O que já funciona

| Parte | No app |
|---|---|
| Caixa de entrada | Áudio (transcrição), foto, vídeo, dúvida de cliente, trabalho realizado. Marcar como privado impede o uso. |
| Memória da marca | Voz, estética, pilares, ofertas, preços aprovados, link de pagamento, vagas, nomes protegidos, temas proibidos, desconto máximo, respostas confirmadas. |
| Redação e produção | Detecta o pilar, troca nomes protegidos por “meu filho”, gera roteiro, stories, ponte para o kit e legenda. Aprovação, edição, reaproveitamento do acervo e programação da semana. |
| Atendimento | Apresenta-se como assistente da marca. Responde só com preço, link e respostas confirmados. Desconto fora da regra, reclamação e dúvida sem resposta viram exceção. |
| Venda e encaminhamento | Produto: envia link de pagamento. Serviço: briefing se houver vaga, senão lista de interesse. |
| Operação | Exceções, vendas, capacidade, registro e o **Teste das 72 horas** (minutos seus, resolvidas sozinho, exceções, pendências inesperadas, links, vendas confirmadas). |

## Modos

- **Presença**: material novo vira rascunho; serviços abrem briefing até o limite de vagas.
- **Reserva**: material novo fica guardado; produção usa só o acervo aprovado; serviço só com vaga.
- **Proteção**: só atendimento e venda de produtos com entrega automática; todo pedido personalizado vai para a lista de interesse.

## Primeira jornada

Conteúdo de memória afetiva → Kit Celular na Mão → pagamento → entrega → suporte básico.
Para ativá-la: preencha preço aprovado e link de pagamento do kit e confirme as respostas frequentes.

## O que ainda falta para operar 24 horas

A redação hoje é por regras (sem IA) e nada sai do aparelho. Próximos passos:

1. Backend (Supabase) para guardar dados fora do navegador.
2. Redação com modelo de linguagem, preso à Memória da marca.
3. Integrações: Instagram (publicação e Direct), WhatsApp Business, checkout com webhook de pagamento, e-mail de entrega do kit.
4. Transcrição automática de áudio.

## App Android (.apk)

`PresencaViva.apk` é o app pronto para instalar (Android 7 ou mais novo). Ele leva o `index.html` dentro e funciona sem internet; com internet, carrega as fontes da marca.

Instalar: copie o APK para o celular, abra e permita “instalar apps desta fonte”.

Gerar de novo depois de mudar `index.html` (precisa de Java 17+ e Android SDK em `android/local.properties`):

```bash
cd presenca-viva/android && ./gradlew assembleRelease && cp app/build/outputs/apk/release/app-release.apk ../PresencaViva.apk
```

A assinatura usa `android/debug.keystore`, uma chave de teste versionada para que cada versão nova instale por cima da anterior sem perder dados. Para publicar na Play Store, crie uma chave de release e guarde-a fora do repositório.
