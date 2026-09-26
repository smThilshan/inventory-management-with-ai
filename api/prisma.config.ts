import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    // Seeding runs via `npm run db:seed`: it is compiled with tsc (tsconfig.seed.json)
    // because it boots the Nest app, which needs decorator metadata.
  },
  datasource: {
    // Plain process.env (not Prisma's env()) so `prisma generate` still works
    // in CI/postinstall where no database URL is configured.
    url: process.env.DATABASE_URL,
  },
});
