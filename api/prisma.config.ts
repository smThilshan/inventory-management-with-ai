import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Plain process.env (not Prisma's env()) so `prisma generate` still works
    // in CI/postinstall where no database URL is configured.
    url: process.env.DATABASE_URL,
  },
});
