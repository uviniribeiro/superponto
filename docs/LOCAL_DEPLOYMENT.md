# Deploy Local - Sistema de Ponto Eletrônico

Este documento descreve como configurar e executar o sistema localmente em seu servidor com PostgreSQL.

## Requisitos

- **Node.js** 20.x ou superior
- **PostgreSQL** 14+ ou superior
- **npm** ou **bun** como gerenciador de pacotes
- **Deno** 1.40+ (para edge functions locais)

## 1. Configuração do Banco de Dados PostgreSQL

### 1.1. Criar o Banco de Dados

```sql
-- Conecte ao PostgreSQL como superusuário
sudo -u postgres psql

-- Criar usuário e banco de dados
CREATE USER superponto_user WITH PASSWORD 'sua_senha_segura';
CREATE DATABASE superponto OWNER superponto_user;

-- Conectar ao banco
\c superponto

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

### 1.2. Executar as Migrações

Execute todos os arquivos SQL da pasta `supabase/migrations/` em ordem numérica:

```bash
cd supabase/migrations
for file in $(ls *.sql | sort); do
  echo "Executando: $file"
  psql -U superponto_user -d superponto -f "$file"
done
```

Ou execute manualmente um script que execute todas as migrações. Veja `scripts/run-migrations.sh`.

## 2. Configuração do Ambiente

### 2.1. Variáveis de Ambiente

Crie um arquivo `.env.local` na raiz do projeto:

```env
# Conexão com o banco de dados PostgreSQL
VITE_SUPABASE_URL=http://localhost:3001
VITE_SUPABASE_PUBLISHABLE_KEY=sua_chave_anonima
VITE_SUPABASE_PROJECT_ID=local

# Para backend (edge functions)
SUPABASE_URL=http://localhost:3001
SUPABASE_SERVICE_ROLE_KEY=sua_service_role_key
SUPABASE_ANON_KEY=sua_chave_anonima
SUPABASE_DB_URL=postgresql://superponto_user:sua_senha_segura@localhost:5432/superponto

# APIs externas (opcional)
LOVABLE_API_KEY=sua_chave_lovable_ai
RESEND_API_KEY=sua_chave_resend
ZAPI_TOKEN=seu_token_zapi
ZAPI_INSTANCE_ID=seu_instance_id
```

### 2.2. Gerar Chaves de Segurança

Para gerar JWT secrets (caso não use Supabase Auth):

```bash
# Gerar chave aleatória
openssl rand -base64 32
```

## 3. Instalação das Dependências

```bash
# Usar Node.js 20
nvm use 20

# Instalar dependências (use --legacy-peer-deps para resolver conflitos)
npm install --legacy-peer-deps

# OU com bun (mais rápido)
bun install
```

## 4. Compilação para Produção

### 4.1. Build do Frontend

```bash
# Build de produção
npm run build

# Os arquivos estarão em ./dist
```

### 4.2. Servir com Servidor Web

**Usando Nginx:**

```nginx
server {
    listen 80;
    server_name seu-dominio.com;
    root /var/www/superponto/dist;
    index index.html;

    # SPA routing
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache para assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

**Usando Apache (.htaccess):**

```apache
<IfModule mod_rewrite.c>
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]
</IfModule>
```

## 5. Backend API (Edge Functions)

### 5.1. Opção A: Converter para Express/Node.js

Se você não quer usar Deno, converta as edge functions para Express.js. Veja a pasta `server/` com a implementação alternativa.

### 5.2. Opção B: Usar Deno Deploy Local

```bash
# Instalar Deno
curl -fsSL https://deno.land/install.sh | sh

# Executar uma função localmente
cd supabase/functions/nome-da-funcao
deno run --allow-net --allow-env index.ts
```

### 5.3. Opção C: Usar Supabase Local (recomendado)

```bash
# Instalar Supabase CLI
npm install -g supabase

# Inicializar e iniciar localmente
supabase init
supabase start

# As funções estarão disponíveis em http://localhost:54321/functions/v1/
```

## 6. Autenticação sem Supabase Auth

Se você não usa Supabase Auth, implemente um servidor de autenticação local:

1. Use a tabela `auth_users` para armazenar credenciais
2. Implemente JWT localmente
3. Use middleware de autenticação no backend

Veja `server/auth.ts` para uma implementação de referência.

## 7. Scripts Úteis

### Backup do Banco

```bash
pg_dump -U superponto_user -d superponto -F c -b -v -f backup_$(date +%Y%m%d_%H%M%S).dump
```

### Restore do Banco

```bash
pg_restore -U superponto_user -d superponto -v backup_file.dump
```

### Atualizar Tipos TypeScript do Banco

```bash
# Se estiver usando Supabase CLI
supabase gen types typescript --local > src/integrations/supabase/types.ts
```

## 8. Estrutura de Pastas

```
├── dist/                    # Build de produção
├── docs/                    # Documentação
├── public/                  # Assets públicos
├── scripts/                 # Scripts de automação
├── server/                  # Backend alternativo (Node.js)
├── src/                     # Código fonte React
├── supabase/
│   ├── functions/          # Edge functions (Deno)
│   └── migrations/         # Migrações SQL
└── .env.local              # Variáveis de ambiente locais
```

## 9. Troubleshooting

### Erro: "CORS blocked"
- Configure os headers CORS no seu servidor web/API
- Verifique se o domínio está na whitelist

### Erro: "Database connection refused"
- Verifique se PostgreSQL está rodando: `sudo systemctl status postgresql`
- Verifique as credenciais no `.env.local`
- Verifique se o usuário tem permissões

### Erro: "Module not found"
- Execute `npm install --legacy-peer-deps`
- Verifique a versão do Node.js com `node -v`

### Erro: "Build failed"
- Limpe o cache: `rm -rf node_modules/.vite`
- Reinstale dependências: `rm -rf node_modules && npm install --legacy-peer-deps`

## 10. Suporte

Para suporte técnico:
- Email: suporte@sistema.com.br
- Documentação: https://docs.superponto.com
