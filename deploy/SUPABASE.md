# PontoMax no seu próprio Supabase (sem Lovable)

A partir de agora, cada alteração enviada para a `main` publica tudo sozinha pelo GitHub Actions
(workflow **Publicar sistema**):
1. aplica as migrações no banco do **seu** projeto Supabase;
2. publica o site na **Vercel**, já apontando para esse projeto;
3. publica as Edge Functions;
4. configura o **Esqueci minha senha**;
5. garante o Super Admin único.

Nada passa pelo Lovable.

## Configuração única (cerca de 10 minutos)

### 1. Crie o projeto no Supabase

Em <https://supabase.com/dashboard>, use **New project**, de preferência na região São Paulo
(`sa-east-1`). Anote a **senha do banco** que você definir. Depois pegue:
- **Project ref**: o código no endereço do painel (`https://supabase.com/dashboard/project/<ref>`).
- **Access token**: em <https://supabase.com/dashboard/account/tokens>, use **Generate new token**.
- Confirme que as chaves legadas estão ativas: **Project Settings → API Keys → Legacy API keys**.

### 2. Crie a conta na Vercel

Em <https://vercel.com> (o plano gratuito serve), vá em **Account Settings → Tokens → Create**.

### 3. Cadastre os secrets no GitHub

No repositório: **Settings → Secrets and variables → Actions → New repository secret**.

| Secret | Valor |
|---|---|
| `SUPABASE_PROJECT_REF` | ref do projeto |
| `SUPABASE_ACCESS_TOKEN` | token da conta Supabase |
| `SUPABASE_DB_PASSWORD` | senha do banco |
| `VERCEL_TOKEN` | token da Vercel |
| `LOVABLE_MIGRATION_TOKEN` | token de migração (enviado no chat; só é usado uma vez) |

Opcionais, para e-mail próprio e integrações:

| Secret | Para quê |
|---|---|
| `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | E-mails de "Esqueci minha senha" sem o limite do e-mail padrão do Supabase |
| `AI_API_KEY` | Reconhecimento facial e assistente (Google Gemini por padrão) |
| `RESEND_API_KEY` | Relatórios e alertas por e-mail |
| `ZAPI_INSTANCE_ID`, `ZAPI_TOKEN` | WhatsApp |

Variáveis opcionais (aba **Variables**):
- `SITE_URL`: domínio próprio, ex.: `https://maxponto.srv.br`.
- `SMTP_PORT`, `SMTP_SENDER_EMAIL`, `SMTP_SENDER_NAME`: complementos do SMTP.
- `SUPER_ADMIN_EMAIL`: outro e-mail de Super Admin.
- `SUPER_ADMIN_ONLY=false`: permite mais de um Super Admin.

### 4. Publique e migre

1. Em **Actions → Publicar sistema → Run workflow**, crie o banco, o site e as funções. Ao
   terminar, o resumo mostra o endereço do site.
2. Com o Lovable Cloud ainda ativo, vá em **Actions → Migrar dados do Lovable Cloud → Run
   workflow** e digite `MIGRAR`. O workflow copia as contas (com as senhas atuais), empresas,
   funcionários, marcações e todos os arquivos.
3. Entre no site com o seu e-mail na aba **Admin**.
4. Depois de conferir, desative o Lovable Cloud.

## Esqueci minha senha

Na tela **Admin**, use **Esqueci minha senha** e informe o e-mail. Chega um link que abre
`/reset-password` no seu site, e lá você define a nova senha. O workflow configura no Supabase:
- o endereço do site;
- os links de retorno permitidos;
- o SMTP, quando os secrets `SMTP_*` existirem.

Sem SMTP próprio, o Supabase envia poucos e-mails por hora, e só para membros da equipe do
projeto. Para produção, use um SMTP próprio (Gmail com senha de app, Zoho, SendGrid, Resend etc.).

## Super Admin

O único Super Admin é **viniciusacacio1@gmail.com**. A cada publicação, o workflow garante essa
conta e remove o papel de Super Admin de qualquer outra (desative com `SUPER_ADMIN_ONLY=false`).
Se a conta ainda não existir no projeto, ela é criada e um e-mail para definir a senha é enviado.

## Tarefas agendadas

O workflow **Tarefas agendadas** roda o robô diário, o alerta de horas extras, o relatório
semanal e a atualização de feriados, nos mesmos horários de antes.
