# Virada da v1 para a v2

Roteiro para colocar a v2 em produção e trazer os dados da v1 (Lovable Cloud/Supabase). A v1 continua
no ar até o último passo; nada é apagado nela.

## 1. Antes do dia

| Item | Como conferir |
| --- | --- |
| Servidor da v2 com Docker, domínio e HTTPS | `DEPLOYMENT.md`; `curl https://api.SEU-DOMINIO/health` responde `status: ok` |
| Banco da v2 com as migrações aplicadas | `npm run db:migrate` (usuário dono do banco) |
| Variáveis da API preenchidas | `JWT_SECRET`, `MFA_ENCRYPTION_KEY`, `BIOMETRIC_ENCRYPTION_KEY`, `SECRETS_ENCRYPTION_KEY`, SMTP (`MAIL_TRANSPORT=smtp`), `APP_URL`, `API_URL`, `REP_P_DEVELOPER_CNPJ` |
| Backup novo da v1 | exportar o JSON das tabelas (`auth` e `public`) e o storage, como em 15/11/2026 |
| Administrador da plataforma | só `viniciusacacio1@gmail.com`; ative a verificação em duas etapas em Minha conta |

## 2. Conferir a migração (não grava nada)

```bash
cd platform/apps/api && npm run build
DATABASE_URL='postgresql://DONO:SENHA@HOST:5432/BANCO?schema=superponto' node dist/migrate-v1.js /caminho/lovable-backup.json
```

A saída mostra os clientes que serão criados, as contagens (empresas, unidades, funcionários,
usuários, marcações, equipamentos…) e os avisos (CPF/PIS inválido, contas repetidas, tabelas sem
equivalente). Corrija na v1 o que for preciso e confira de novo.

## 3. Importar

```bash
DATABASE_URL='...' node dist/migrate-v1.js /caminho/lovable-backup.json --apply
```

- Cada organização raiz da v1 vira um cliente; secretarias/setores com o mesmo CNPJ viram unidades.
- Os usuários entram com o mesmo e-mail e **a mesma senha** (o hash da v1 é aceito e trocado pelo
  formato novo no primeiro login). O papel `super_admin` da v1 não é migrado.
- As contas de suporte sintéticas da v1 não entram: a v2 cria o "Suporte SuperPonto" de cada cliente
  quando a API sobe.
- Rodar de novo pula os clientes já importados (não duplica).

## 4. Completar na v2 (o que não tem equivalente direto)

- **Jornadas**: recriar os horários em Jornada › Horários e atribuir aos funcionários (a v1 tinha 2).
- **Feriados**: a v2 gera os nacionais, estaduais e municipais sozinha; cadastre só os da empresa.
- **Planos**: definir o plano de cada cliente em Plataforma › Clientes › Plano (as licenças da v1 não migram).
- **Equipamentos**: gerar a chave do agente em cada relógio e instalar o agente local (`apps/agent`).
- **REP-P**: informar o número do programa no INPI em Ponto › Fechamento.
- **Fotos e logos**: reenviar o logo da empresa em Empresas (as fotos de marcação da v1 ficam no backup).

## 5. Conferência depois da importação

Para cada cliente: entrar com um usuário de cada perfil, abrir Funcionários (quantidade igual à
conferência), o espelho de um funcionário com marcações antigas, Relatórios › Marcações do período
e Equipamentos. Comparar com a v1.

## 6. Virada

1. Avisar os clientes do horário.
2. Gerar o backup final da v1 e repetir os passos 2 e 3 (só entram os clientes que ainda não estavam
   importados; para reimportar um cliente, apague-o na v2 antes).
3. Apontar o domínio do sistema para a v2.
4. Manter a v1 somente leitura por 30 dias para consulta; depois, desligar.

## Pendências que dependem de terceiros

- Homologação dos drivers Control iD e Henry em equipamentos reais.
- Assinatura ICP-Brasil (CAdES/.p7s) do AFD, AEJ e espelho com o certificado da empresa.
- Cobrança automática (integração com o meio de pagamento escolhido).
- Publicação do app do funcionário nas lojas.
