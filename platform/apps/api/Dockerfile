# SuperPonto API — imagem de produção. Build a partir de platform/:
#   docker build -f apps/api/Dockerfile -t superponto/api .
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
COPY packages/database/package.json packages/database/
COPY packages/time-engine/package.json packages/time-engine/
COPY apps/api/package.json apps/api/
RUN npm ci --no-audit --no-fund
COPY packages packages
COPY apps/api apps/api
RUN npm run build -w @superponto/time-engine \
 && npm run build -w @superponto/database \
 && npm run build -w @superponto/api \
 && npm prune --omit=dev --no-audit --no-fund

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/packages/database/package.json /app/packages/database/prisma.config.ts packages/database/
COPY --from=build /app/packages/database/dist packages/database/dist
COPY --from=build /app/packages/database/prisma packages/database/prisma
COPY --from=build /app/packages/time-engine/package.json packages/time-engine/
COPY --from=build /app/packages/time-engine/dist packages/time-engine/dist
COPY --from=build /app/apps/api/package.json apps/api/
COPY --from=build /app/apps/api/dist apps/api/dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["node", "apps/api/dist/main.js"]
