# SuperPonto - Sistema de Ponto Eletrônico

## Visão Geral

Sistema completo de gestão de ponto eletrônico desenvolvido com React, TypeScript e Supabase/PostgreSQL.

## Tecnologias

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS, shadcn/ui
- **Backend**: Supabase (Edge Functions) ou Express.js (alternativo)
- **Banco de Dados**: PostgreSQL
- **Autenticação**: Supabase Auth ou JWT local

## Documentação

- [Deploy Local](docs/LOCAL_DEPLOYMENT.md) - Guia completo para deploy em servidor próprio

## Scripts Disponíveis

```bash
# Desenvolvimento
npm run dev              # Inicia servidor de desenvolvimento

# Produção
npm run build            # Compila para produção
npm run preview          # Visualiza build de produção

# Scripts personalizados
./scripts/build-production.sh   # Build completo com verificações
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
2. Copie `.env.local.example` para `.env.local` e configure
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

### Lovable/Vercel
Acesse [Lovable](https://lovable.dev) e clique em Share → Publish.

### Servidor Local
Consulte a [documentação de deploy local](docs/LOCAL_DEPLOYMENT.md).

## Credenciais Padrão

- **Super Admin**: superadmin@superponto.local / Super@Admin2024
- **Suporte**: suporte@{company_code}.pontomax.local / Super@26
- **Admin**: admin@{company_code}.pontomax.local / Admin@26

## Licença

Proprietário - Todos os direitos reservados.
