# SuperPonto v2 — imagens da plataforma (build a partir de platform/):
#   docker build --target api   -t superponto/api .
#   docker build --target web   -t superponto/web .
#   docker build --target setup -t superponto/setup .   (migrações + seed; usado na versão local)
#   docker build --target api-dart -t superponto/api-dart .   (mesma API, em Dart: binário nativo)
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY packages/br-docs/package.json packages/br-docs/
COPY packages/database/package.json packages/database/
COPY packages/rep-protocols/package.json packages/rep-protocols/
COPY packages/time-engine/package.json packages/time-engine/
COPY apps/agent/package.json apps/agent/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci --no-audit --no-fund
COPY packages packages
COPY apps apps
COPY scripts scripts
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w @superponto/br-docs \
 && npm run build -w @superponto/time-engine \
 && npm run build -w @superponto/rep-protocols \
 && npm run build -w @superponto/database \
 && npm run build -w @superponto/api \
 && npm run build -w @superponto/web

# Preparação do banco (migrações, papel da API, seed). Mantém as ferramentas de desenvolvimento.
FROM build AS setup
CMD ["node", "scripts/local-setup.mjs"]

# Dependências de produção da API
FROM build AS api-deps
RUN npm prune --omit=dev --no-audit --no-fund

FROM node:22-alpine AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=api-deps /app/node_modules node_modules
COPY --from=api-deps /app/package.json ./
COPY --from=api-deps /app/packages packages
COPY --from=api-deps /app/apps/api/package.json apps/api/
COPY --from=api-deps /app/apps/api/dist apps/api/dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "apps/api/dist/main.js"]

FROM node:22-alpine AS web
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3001 HOSTNAME=0.0.0.0
WORKDIR /app
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static apps/web/.next/static
COPY --from=build /app/apps/web/public apps/web/public
USER node
EXPOSE 3001
CMD ["node", "apps/web/server.js"]

# API em Dart: binário nativo (AOT), validado pelos mesmos testes de contrato da API em Node.
FROM dart:3.14.0 AS dart-build
WORKDIR /src
COPY dart/pubspec.yaml dart/analysis_options.yaml ./
COPY dart/packages/sp_core/pubspec.yaml packages/sp_core/
COPY dart/server/pubspec.yaml server/
RUN dart pub get
COPY dart/packages packages
COPY dart/server server
RUN mkdir -p /out && dart pub get --offline && dart compile exe server/bin/server.dart -o /out/sp_server

FROM debian:bookworm-slim AS api-dart
# libssl3 traz a libcrypto usada no scrypt e no AES-GCM (mesmo formato de senhas e segredos da API em Node).
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates libssl3 tzdata wget && rm -rf /var/lib/apt/lists/* \
 && useradd --system --uid 10001 superponto
COPY --from=dart-build /out/sp_server /usr/local/bin/sp_server
USER superponto
ENV PORT=3000
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --retries=5 CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["sp_server"]
