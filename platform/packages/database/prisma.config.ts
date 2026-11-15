import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// DATABASE_URL só é necessária para migrar; `prisma generate` funciona sem ela (CI, build de imagem).
// Use ?schema=superponto na URL (padrão do projeto). Migrações rodam com o papel dono do banco.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
