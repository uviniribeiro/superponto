# ===========================================
# Dockerfile para Backend Express
# ===========================================
FROM node:20-alpine AS base

WORKDIR /app

# Instalar dependências de build
RUN apk add --no-cache python3 make g++

# ===========================================
# Estágio de dependências
# ===========================================
FROM base AS deps

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# ===========================================
# Estágio de build
# ===========================================
FROM base AS builder

COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

COPY . .
RUN npm run build

# ===========================================
# Estágio de produção
# ===========================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Criar usuário não-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 expressjs

# Copiar arquivos necessários
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

USER expressjs

EXPOSE 3001

CMD ["node", "dist/index.js"]
