import { INestApplication } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { rm } from 'node:fs/promises';
import { Server } from 'node:http';
import { AddressInfo } from 'node:net';
import { basename, resolve } from 'node:path';
import { App } from 'supertest/types';
import { AppModule } from '../../src/app.module';
import { configureApp } from '../../src/app.setup';
import { InvoiceSettings } from '../../src/invoices/invoice-settings';
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
  configureApp(app);
  await app.init();

  return {
    app,
    prisma: app.get(PrismaService),
    redis: app.get(RedisService),
  };
}

/** Starts a real listener (needed for streaming clients) and returns its base URL. */
export async function listen({ app }: TestContext): Promise<string> {
  await app.listen(0);
  const { port } = (app.getHttpServer() as Server).address() as AddressInfo;
  return `http://127.0.0.1:${port}`;
}

/** Only a directory with this name is ever deleted by tests. */
const TEST_STORAGE_DIR_NAME = 'invoices-test';

/** Clears Postgres test data, the test Redis DB (never the dev DB 0) and test PDFs. */
export async function resetState({
  app,
  prisma,
  redis,
}: TestContext): Promise<void> {
  // Listed explicitly: CASCADE only follows FKs *into* truncated tables, so
  // Invoice/InvoiceSequence would otherwise survive between tests.
  await prisma.$executeRaw`TRUNCATE TABLE "StockMovement", "InvoiceLine", "Invoice", "InvoiceSequence", "Product" CASCADE`;
  if (redis.status === 'ready') {
    await redis.flushdb();
  }
  // Guarded: a misconfigured env must never make a test delete real invoice PDFs.
  const storageDir = resolve(app.get(InvoiceSettings).storageDir);
  if (basename(storageDir) === TEST_STORAGE_DIR_NAME) {
    await rm(storageDir, { recursive: true, force: true });
  }
}
