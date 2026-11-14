# App web do PontoMax compilado e servido pelo Caddy (HTTPS automático).
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps --no-audit --no-fund
COPY . .
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_SUPABASE_PROJECT_ID=pontomax
RUN test -n "$VITE_SUPABASE_URL" && test -n "$VITE_SUPABASE_PUBLISHABLE_KEY" \
 && VITE_SUPABASE_URL="$VITE_SUPABASE_URL" \
    VITE_SUPABASE_PUBLISHABLE_KEY="$VITE_SUPABASE_PUBLISHABLE_KEY" \
    VITE_SUPABASE_PROJECT_ID="$VITE_SUPABASE_PROJECT_ID" \
    npm run build

FROM caddy:2-alpine
COPY --from=build /app/dist /srv
COPY deploy/vps/web/Caddyfile /etc/caddy/Caddyfile
