# SuperPonto - Sistema de Ponto Eletrônico

## Visão Geral

Sistema completo de gestão de ponto eletrônico desenvolvido com React, TypeScript e Supabase/PostgreSQL.

## Tecnologias

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, shadcn/ui
- **Backend**: Supabase de código aberto auto-hospedado (Auth, PostgREST, Realtime, Storage, Edge Functions)
- **Banco de Dados**: PostgreSQL 17
- **Apps**: Capacitor (app do funcionário e app do terminal)

## Documentação

- [Implantação em servidores próprios](deploy/README.md) — VPS principal, servidor de comunicação e apps
- [Servidor de comunicação](deploy/comm/README.md)

## Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev              # Inicia servidor de desenvolvimento

# Produção
npm run build            # Compila para produção
npm run preview          # Visualiza build de produção

# Scripts personalizados
./scripts/build-mobile.sh funcionario|terminal   # APKs dos apps
./scripts/run-migrations.sh     # Executar migrações do banco
./scripts/export-project.sh     # Exportar projeto para ZIP
```

## Estrutura do Projeto

```
├── docs/                    # Documentação
├── public/                  # Assets públicos
├── scripts/                 # Scripts de automação
├── server/                  # Backend alternativo (Express)
├── src/
│   ├── components/         # Componentes React
│   ├── contexts/           # Contextos (Auth, etc)
│   ├── hooks/              # Custom hooks
│   ├── integrations/       # Integrações (Supabase)
│   ├── lib/                # Utilitários
│   └── pages/              # Páginas da aplicação
└── supabase/
    ├── functions/          # Edge Functions
    └── migrations/         # Migrações SQL
```

## Configuração Rápida

1. Clone o repositório
2. Crie `.env.local` com `VITE_SUPABASE_URL=https://SEU_DOMINIO` e `VITE_SUPABASE_PUBLISHABLE_KEY=<ANON_KEY do deploy/vps/.env>`
3. Execute `npm install --legacy-peer-deps`
4. Execute `npm run dev`

## Módulos

- **Ponto Eletrônico**: Registro de ponto com foto e geolocalização
- **Gestão de Funcionários**: Cadastro, importação CSV, organograma
- **Escalas e Horários**: Horários fixos e rotativos
- **Banco de Horas**: Controle de horas extras e compensações
- **Espelho de Ponto**: Visualização e exportação
- **Módulo Professor**: Gestão de aulas e hora-aula (opcional)
- **Módulo Médico**: Plantões e escalas médicas (opcional)
- **Folha de Pagamento**: Cálculos e exportações (opcional)
- **Equipamentos REP**: Integração com relógios de ponto

## Deploy

Tudo roda em servidores próprios, sem Lovable e sem Supabase Cloud:

```bash
cd deploy/vps && sudo ./install.sh
```

Detalhes, migração dos dados do Cloud, servidor de comunicação e apps: [deploy/README.md](deploy/README.md).

## Credenciais Iniciais

Nenhuma senha padrão é publicada. Na instalação local, `scripts/setup-database.sql` gera uma senha aleatória para o Super Admin e a exibe uma única vez no log. Contas de Admin e Suporte de cada empresa são criadas pelo painel do Super Admin.

## Licença

Proprietário - Todos os direitos reservados.
