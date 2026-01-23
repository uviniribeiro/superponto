# SuperPonto - Scripts de Instalação

Este diretório contém scripts para instalação e configuração do SuperPonto.

## Scripts Disponíveis

### Instalação de Banco de Dados

#### Linux/macOS
```bash
chmod +x scripts/install-unix.sh
./scripts/install-unix.sh
```

#### Windows
```batch
scripts\install-windows.bat
```

#### Python (Multi-plataforma)
```bash
python3 scripts/install-database.py --db postgresql
```

### Opções do Instalador Python

```bash
python3 scripts/install-database.py --help

Options:
  --db {postgresql,sqlserver,oracle}  Tipo de banco de dados
  --host HOST                         Host do banco (default: localhost)
  --port PORT                         Porta do banco
  --user USER                         Usuário do banco (default: superponto)
  --password PASSWORD                 Senha do banco
  --database DATABASE                 Nome do banco (default: superponto)
  --migrations DIR                    Diretório das migrations
  --skip-install                      Pular instalação do banco
  --skip-migrations                   Pular execução das migrations
```

### Bancos de Dados Suportados

| Banco | Porta Padrão | Status |
|-------|--------------|--------|
| PostgreSQL | 5432 | ✅ Completo |
| SQL Server | 1433 | ⚠️ Requer conversão de migrations |
| Oracle | 1521 | ⚠️ Requer conversão de migrations |

## Criação de Executável

Para criar um instalador executável:

```bash
python3 scripts/build-installer.py
```

### Opções

- `--platform`: windows, linux, macos, all
- `--inno`: Criar script Inno Setup para Windows
- `--appimage`: Criar script AppImage para Linux

## Docker

Use Docker Compose para ambiente completo:

```bash
# Iniciar todos os serviços
docker-compose up -d

# Com pgAdmin (gerenciador de banco)
docker-compose --profile tools up -d

# Com Redis (cache)
docker-compose --profile cache up -d
```

## Após Instalação

1. Verifique o arquivo `.env.local` gerado
2. Inicie o backend: `cd server && npm run dev`
3. Inicie o frontend: `npm run dev`
4. Acesse: http://localhost:5173

## Troubleshooting

### PostgreSQL não conecta
```bash
# Verificar se está rodando
sudo systemctl status postgresql

# Verificar logs
sudo tail -f /var/log/postgresql/postgresql-*-main.log
```

### Migrations falham
```bash
# Executar manualmente
psql -h localhost -U superponto -d superponto -f supabase/migrations/XXXXX.sql
```

### Erro de permissão
```bash
# Dar permissão ao usuário
sudo -u postgres psql -c "ALTER USER superponto WITH SUPERUSER;"
```
