import { INestApplication } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { RedisService } from '../../src/redis/redis.service';

export interface TestContext {
  app: INestApplication<App>;
  prisma: PrismaService;
  redis: RedisService;
}

/**
 * Boots the real AppModule (same pipes, filters, DB, Redis) against the test
 * database. `customize` allows swapping a provider, e.g. an unreachable Redis.
 */
export async function createTestApp(
  customize: (builder: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
): Promise<TestContext> {
  const moduleRef = await customize(
    Test.createTestingModule({ imports: [AppModule] }),
  ).compile();

  const app = moduleRef.createNestApplication<INestApplication<App>>();
  await app.init();

  return {
    app,
    prisma: app.get(PrismaService),
    redis: app.get(RedisService),
  };
}

/** Clears Postgres test data and the test Redis DB (never the dev DB 0). */
export async function resetState({
  prisma,
  redis,
}: TestContext): Promise<void> {
  await prisma.$executeRaw`TRUNCATE TABLE "StockMovement", "Product" CASCADE`;
  if (redis.status === 'ready') {
    await redis.flushdb();
  }
}
