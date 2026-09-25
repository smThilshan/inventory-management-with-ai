import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { LOW_STOCK_MAX_ITEMS, OPENING_STOCK_NOTE } from '../common/constants';
import { MovementType, Prisma, Product } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProductResponse, toProductResponse } from './dto/product.response';
import { LowStockCache } from './low-stock.cache';
import { ProductsService } from './products.service';

const DEFAULT_THRESHOLD = 10;

const productRow = (overrides: Partial<Product> = {}): Product => ({
  id: '01990000-0000-7000-8000-000000000001',
  name: 'Keyboard',
  sku: 'KB-001',
  quantity: 0,
  price: new Prisma.Decimal('19.99'),
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

describe('ProductsService', () => {
  let service: ProductsService;
  const prisma = {
    product: {
      create: jest.fn<Promise<Product>, [Prisma.ProductCreateArgs]>(),
      findMany: jest.fn<Promise<Product[]>, [Prisma.ProductFindManyArgs]>(),
    },
  };
  const lowStockCache = {
    get: jest.fn<Promise<ProductResponse[] | null>, [number]>(),
    set: jest.fn<Promise<void>, [number, ProductResponse[]]>(),
    invalidateAll: jest.fn<Promise<void>, []>(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: prisma },
        { provide: LowStockCache, useValue: lowStockCache },
        {
          provide: ConfigService,
          useValue: { get: () => DEFAULT_THRESHOLD },
        },
      ],
    }).compile();
    service = moduleRef.get(ProductsService);
  });

  describe('findLowStock', () => {
    it('HIT: serves from cache without touching the database', async () => {
      const cached = [toProductResponse(productRow({ quantity: 2 }))];
      lowStockCache.get.mockResolvedValue(cached);

      const result = await service.findLowStock(5);

      expect(result).toEqual({
        threshold: 5,
        items: cached,
        cacheStatus: 'HIT',
      });
      expect(prisma.product.findMany).not.toHaveBeenCalled();
    });

    it('MISS: queries below the threshold, most urgent first, and fills the cache', async () => {
      lowStockCache.get.mockResolvedValue(null);
      prisma.product.findMany.mockResolvedValue([productRow({ quantity: 2 })]);

      const result = await service.findLowStock(5);

      expect(prisma.product.findMany).toHaveBeenCalledWith({
        where: { quantity: { lt: 5 } },
        orderBy: [{ quantity: 'asc' }, { id: 'asc' }],
        take: LOW_STOCK_MAX_ITEMS,
      });
      expect(result.cacheStatus).toBe('MISS');
      expect(result.items[0].price).toBe('19.99');
      expect(lowStockCache.set).toHaveBeenCalledWith(5, result.items);
    });

    it('uses the configured default threshold when none is given', async () => {
      lowStockCache.get.mockResolvedValue(null);
      prisma.product.findMany.mockResolvedValue([]);

      const result = await service.findLowStock();

      expect(result.threshold).toBe(DEFAULT_THRESHOLD);
      expect(lowStockCache.get).toHaveBeenCalledWith(DEFAULT_THRESHOLD);
    });
  });

  describe('create', () => {
    it('stores price as an exact 2-dp decimal string', async () => {
      prisma.product.create.mockResolvedValue(productRow());

      await service.create({ name: 'Keyboard', sku: 'KB-001', price: 19.9 });

      const { data } = prisma.product.create.mock.calls[0][0];
      expect(data.price).toBe('19.90');
    });

    it('records opening stock as an IN movement in the same write', async () => {
      prisma.product.create.mockResolvedValue(productRow({ quantity: 5 }));

      await service.create({
        name: 'Keyboard',
        sku: 'KB-001',
        price: 10,
        quantity: 5,
      });

      const { data } = prisma.product.create.mock.calls[0][0];
      expect(data.quantity).toBe(5);
      expect(data.movements).toEqual({
        create: {
          type: MovementType.IN,
          quantity: 5,
          note: OPENING_STOCK_NOTE,
        },
      });
    });

    it('creates no movement when opening stock is zero or omitted', async () => {
      prisma.product.create.mockResolvedValue(productRow());

      await service.create({ name: 'Keyboard', sku: 'KB-001', price: 10 });

      const { data } = prisma.product.create.mock.calls[0][0];
      expect(data.quantity).toBe(0);
      expect(data.movements).toBeUndefined();
    });

    it('invalidates the low-stock cache after the product is stored', async () => {
      prisma.product.create.mockResolvedValue(productRow());

      await service.create({ name: 'Keyboard', sku: 'KB-001', price: 10 });

      expect(lowStockCache.invalidateAll).toHaveBeenCalledTimes(1);
      expect(prisma.product.create.mock.invocationCallOrder[0]).toBeLessThan(
        lowStockCache.invalidateAll.mock.invocationCallOrder[0],
      );
    });
  });

  describe('findPage', () => {
    const rows = [
      productRow({ id: 'id-1' }),
      productRow({ id: 'id-2' }),
      productRow({ id: 'id-3' }),
    ];

    it('fetches one extra row and returns nextCursor when more exist', async () => {
      prisma.product.findMany.mockResolvedValue(rows);

      const page = await service.findPage({ limit: 2 });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 3, orderBy: { id: 'asc' } }),
      );
      expect(page.items.map((p) => p.id)).toEqual(['id-1', 'id-2']);
      expect(page.nextCursor).toBe('id-2');
    });

    it('returns a null nextCursor on the last page', async () => {
      prisma.product.findMany.mockResolvedValue(rows.slice(0, 2));

      const page = await service.findPage({ limit: 2 });

      expect(page.items).toHaveLength(2);
      expect(page.nextCursor).toBeNull();
    });

    it('continues after the cursor using keyset pagination', async () => {
      prisma.product.findMany.mockResolvedValue([]);

      await service.findPage({ limit: 2, cursor: 'id-2' });

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: { gt: 'id-2' } } }),
      );
    });
  });
});
