import { ConflictException, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Test } from '@nestjs/testing';
import {
  MOVEMENT_HISTORY_LIMIT,
  STOCK_QUANTITY_MAX,
} from '../common/constants';
import {
  MovementType,
  Prisma,
  Product,
  StockMovement,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { STOCK_UPDATED_EVENT } from './events/stock-updated.event';
import { StockMovementsService } from './stock-movements.service';

const PRODUCT_ID = '01990000-0000-7000-8000-000000000001';

const product = (quantity: number): Product => ({
  id: PRODUCT_ID,
  name: 'Keyboard',
  sku: 'KB-001',
  quantity,
  price: new Prisma.Decimal('10.00'),
  createdAt: new Date(),
  updatedAt: new Date(),
});

const movement = (type: MovementType, quantity: number): StockMovement => ({
  id: '01990000-0000-7000-8000-0000000000aa',
  productId: PRODUCT_ID,
  type,
  quantity,
  note: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
});

describe('StockMovementsService', () => {
  let service: StockMovementsService;

  const tx = {
    product: {
      updateManyAndReturn: jest.fn<
        Promise<Product[]>,
        [Prisma.ProductUpdateManyAndReturnArgs]
      >(),
      count: jest.fn<Promise<number>, [Prisma.ProductCountArgs]>(),
    },
    stockMovement: {
      create: jest.fn<
        Promise<StockMovement>,
        [Prisma.StockMovementCreateArgs]
      >(),
    },
  };
  type Tx = typeof tx;
  const prisma = {
    $transaction: jest.fn<
      Promise<unknown>,
      [(client: Tx) => Promise<unknown>]
    >(),
    product: {
      findUnique: jest.fn<Promise<unknown>, [Prisma.ProductFindUniqueArgs]>(),
    },
  };
  const events = { emit: jest.fn<boolean, [string, unknown]>() };

  beforeEach(async () => {
    jest.resetAllMocks();
    prisma.$transaction.mockImplementation((work) => work(tx));

    const moduleRef = await Test.createTestingModule({
      providers: [
        StockMovementsService,
        { provide: PrismaService, useValue: prisma },
        { provide: EventEmitter2, useValue: events },
      ],
    }).compile();
    service = moduleRef.get(StockMovementsService);
  });

  const updateArgs = () => tx.product.updateManyAndReturn.mock.calls[0][0];

  describe('record', () => {
    it('IN increments with an overflow guard and writes a ledger row', async () => {
      tx.product.updateManyAndReturn.mockResolvedValue([product(15)]);
      tx.stockMovement.create.mockResolvedValue(movement(MovementType.IN, 5));

      const result = await service.record({
        productId: PRODUCT_ID,
        type: MovementType.IN,
        quantity: 5,
      });

      expect(updateArgs()).toEqual({
        where: { id: PRODUCT_ID, quantity: { lte: STOCK_QUANTITY_MAX - 5 } },
        data: { quantity: { increment: 5 } },
      });
      expect(tx.stockMovement.create).toHaveBeenCalledWith({
        data: {
          productId: PRODUCT_ID,
          type: MovementType.IN,
          quantity: 5,
          note: undefined,
        },
      });
      expect(result.product.quantity).toBe(15);
    });

    it('OUT decrements only when enough stock remains (conditional update)', async () => {
      tx.product.updateManyAndReturn.mockResolvedValue([product(7)]);
      tx.stockMovement.create.mockResolvedValue(movement(MovementType.OUT, 3));

      await service.record({
        productId: PRODUCT_ID,
        type: MovementType.OUT,
        quantity: 3,
      });

      expect(updateArgs()).toEqual({
        where: { id: PRODUCT_ID, quantity: { gte: 3 } },
        data: { quantity: { decrement: 3 } },
      });
    });

    it('emits stock.updated with the new quantity after success', async () => {
      tx.product.updateManyAndReturn.mockResolvedValue([product(7)]);
      tx.stockMovement.create.mockResolvedValue(movement(MovementType.OUT, 3));

      await service.record({
        productId: PRODUCT_ID,
        type: MovementType.OUT,
        quantity: 3,
      });

      expect(events.emit).toHaveBeenCalledTimes(1);
      expect(events.emit).toHaveBeenCalledWith(STOCK_UPDATED_EVENT, {
        productId: PRODUCT_ID,
        sku: 'KB-001',
        quantity: 7,
        movement: expect.objectContaining({
          type: MovementType.OUT,
          quantity: 3,
        }) as unknown,
      });
    });

    it('throws 409 "Insufficient stock" and writes nothing when OUT exceeds stock', async () => {
      tx.product.updateManyAndReturn.mockResolvedValue([]);
      tx.product.count.mockResolvedValue(1);

      const attempt = service.record({
        productId: PRODUCT_ID,
        type: MovementType.OUT,
        quantity: 99,
      });

      await expect(attempt).rejects.toThrow(
        new ConflictException('Insufficient stock'),
      );
      expect(tx.stockMovement.create).not.toHaveBeenCalled();
      expect(events.emit).not.toHaveBeenCalled();
    });

    it('throws 409 when IN would overflow the quantity column', async () => {
      tx.product.updateManyAndReturn.mockResolvedValue([]);
      tx.product.count.mockResolvedValue(1);

      await expect(
        service.record({
          productId: PRODUCT_ID,
          type: MovementType.IN,
          quantity: 5,
        }),
      ).rejects.toThrow(new ConflictException('Stock quantity limit exceeded'));
    });

    it.each([MovementType.IN, MovementType.OUT])(
      'throws 404 for an unknown product (%s)',
      async (type) => {
        tx.product.updateManyAndReturn.mockResolvedValue([]);
        tx.product.count.mockResolvedValue(0);

        await expect(
          service.record({ productId: PRODUCT_ID, type, quantity: 1 }),
        ).rejects.toThrow(NotFoundException);
        expect(events.emit).not.toHaveBeenCalled();
      },
    );

    it('does not emit if the transaction fails to commit', async () => {
      tx.product.updateManyAndReturn.mockResolvedValue([product(7)]);
      tx.stockMovement.create.mockResolvedValue(movement(MovementType.OUT, 3));
      prisma.$transaction.mockImplementation(async (work) => {
        await work(tx);
        throw new Error('commit failed');
      });

      await expect(
        service.record({
          productId: PRODUCT_ID,
          type: MovementType.OUT,
          quantity: 3,
        }),
      ).rejects.toThrow('commit failed');
      expect(events.emit).not.toHaveBeenCalled();
    });
  });

  describe('findRecentForProduct', () => {
    it('returns the latest movements, newest first, capped at the limit', async () => {
      const movements = [movement(MovementType.IN, 1)];
      prisma.product.findUnique.mockResolvedValue({ movements });

      await expect(service.findRecentForProduct(PRODUCT_ID)).resolves.toBe(
        movements,
      );
      expect(prisma.product.findUnique).toHaveBeenCalledWith({
        where: { id: PRODUCT_ID },
        select: {
          movements: {
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            take: MOVEMENT_HISTORY_LIMIT,
          },
        },
      });
    });

    it('throws 404 when the product does not exist', async () => {
      prisma.product.findUnique.mockResolvedValue(null);

      await expect(service.findRecentForProduct(PRODUCT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
