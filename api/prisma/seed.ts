import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import {
  addDays,
  formatCalendarDate,
  parseCalendarDate,
  todayIn,
} from '../src/common/calendar-date';
import { OPENING_STOCK_NOTE } from '../src/common/constants';
import { InvoiceType, MovementType } from '../src/generated/prisma/client';
import { InvoiceIssuerService } from '../src/invoices/invoice-issuer.service';
import { InvoiceSettings } from '../src/invoices/invoice-settings';
import { PrismaService } from '../src/prisma/prisma.service';

/*
 * Seeds demo data through the REAL application code: the Nest app is booted
 * (same config validation, same services), so seeded invoices get genuine
 * numbers, totals, ledger movements and PDFs; nothing is hand-inserted.
 * Compiled with tsc (see tsconfig.seed.json) because Nest DI needs decorator
 * metadata, which esbuild-based runners such as tsx do not emit.
 */

interface SeedProduct {
  name: string;
  sku: string;
  quantity: number;
  price: string;
}

// Mix of healthy and low stock (default threshold is 10) so every feature has data to show.
const PRODUCTS: readonly SeedProduct[] = [
  {
    name: 'Mechanical Keyboard',
    sku: 'KB-MECH-001',
    quantity: 45,
    price: '89.99',
  },
  { name: 'Wireless Mouse', sku: 'MS-WL-002', quantity: 120, price: '24.50' },
  { name: '27" 4K Monitor', sku: 'MN-4K-027', quantity: 8, price: '329.00' },
  {
    name: 'USB-C Docking Station',
    sku: 'DK-USBC-004',
    quantity: 3,
    price: '149.95',
  },
  { name: '1TB NVMe SSD', sku: 'SSD-NVME-1TB', quantity: 0, price: '79.99' },
  { name: 'HD Webcam', sku: 'CAM-HD-006', quantity: 22, price: '59.00' },
];

async function seedProducts(
  prisma: PrismaService,
): Promise<Map<string, string>> {
  for (const { quantity, ...product } of PRODUCTS) {
    // Upsert on SKU keeps the seed idempotent: re-running never duplicates data.
    // The opening IN movement keeps the ledger consistent with Product.quantity.
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {},
      create: {
        ...product,
        quantity,
        movements:
          quantity > 0
            ? {
                create: {
                  type: MovementType.IN,
                  quantity,
                  note: OPENING_STOCK_NOTE,
                },
              }
            : undefined,
      },
    });
  }
  const products = await prisma.product.findMany({
    select: { id: true, sku: true },
  });
  return new Map(products.map((p) => [p.sku, p.id]));
}

/** 2 purchases and 1 sale, dated in the recent past so the invoice list is not empty. */
async function seedInvoices(
  issuer: InvoiceIssuerService,
  idOf: (sku: string) => string,
  daysAgo: (days: number) => string,
): Promise<void> {
  await issuer.issue({
    type: InvoiceType.PURCHASE,
    counterpartyName: 'Gulf Tech Distributors',
    date: daysAgo(7),
    lines: [
      { productId: idOf('KB-MECH-001'), quantity: 10, unitPrice: '45.00' },
      { productId: idOf('MS-WL-002'), quantity: 25, unitPrice: '12.50' },
    ],
  });
  await issuer.issue({
    type: InvoiceType.PURCHASE,
    counterpartyName: 'Emirates Office Supplies',
    date: daysAgo(3),
    lines: [
      { productId: idOf('CAM-HD-006'), quantity: 10, unitPrice: '38.00' },
      { productId: idOf('DK-USBC-004'), quantity: 2, unitPrice: '110.00' },
    ],
  });
  await issuer.issue({
    type: InvoiceType.SALE,
    counterpartyName: 'Al Noor Trading',
    date: daysAgo(1),
    lines: [
      { productId: idOf('KB-MECH-001'), quantity: 2 },
      { productId: idOf('MS-WL-002'), quantity: 4 },
    ],
  });
}

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error', 'warn'],
  });
  try {
    const prisma = app.get(PrismaService);
    const ids = await seedProducts(prisma);

    // Only when there are no invoices yet, so re-running the seed never duplicates them.
    if ((await prisma.invoice.count()) === 0) {
      const today = parseCalendarDate(
        todayIn(app.get(InvoiceSettings).timeZone),
      );
      const idOf = (sku: string): string => {
        const id = ids.get(sku);
        if (!id) throw new Error(`Seed product ${sku} is missing`);
        return id;
      };
      await seedInvoices(app.get(InvoiceIssuerService), idOf, (days) =>
        formatCalendarDate(addDays(today, -days)),
      );
    }

    const [products, invoices] = await Promise.all([
      prisma.product.count(),
      prisma.invoice.count(),
    ]);
    console.log(`Seed complete: ${products} products, ${invoices} invoices`);
  } finally {
    // Also waits for the PDFs being generated for the new invoices.
    await app.close();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
