import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { MovementType, PrismaClient } from '../src/generated/prisma/client';

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

const OPENING_STOCK_NOTE = 'Opening stock (seed)';

async function seed(prisma: PrismaClient): Promise<void> {
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
}

async function main(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  try {
    await seed(prisma);
    const count = await prisma.product.count();
    console.log(`Seed complete: ${count} products in database`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('Seed failed:', error);
  process.exit(1);
});
