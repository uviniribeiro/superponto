import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// DATABASE_URL só é necessária para migrar; `prisma generate` funciona sem ela (CI, build de imagem).
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
