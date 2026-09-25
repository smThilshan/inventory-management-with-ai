import { Test } from '@nestjs/testing';
import { OPENING_STOCK_NOTE } from '../common/constants';
import { MovementType, Prisma, Product } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from './products.service';

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

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(ProductsService);
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
