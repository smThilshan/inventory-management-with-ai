import { ConflictException, HttpStatus } from '@nestjs/common';
import {
  MovementReason,
  MovementType,
  Prisma,
  Product,
  StockMovement,
} from '../generated/prisma/client';
import { InsufficientStockException } from './errors/insufficient-stock.exception';
import { StockLedgerService } from './stock-ledger.service';

const PRODUCT_ID = '01990000-0000-7000-8000-000000000001';
const INVOICE_ID = '01990000-0000-7000-8000-0000000000ff';

const product = (quantity: number): Product => ({
  id: PRODUCT_ID,
  name: 'Keyboard',
  sku: 'KB-001',
  quantity,
  price: new Prisma.Decimal('10.00'),
  createdAt: new Date(),
  updatedAt: new Date(),
});

describe('StockLedgerService', () => {
  // The ledger takes no constructor dependencies: it can only act through the
  // transaction a caller hands it, and it has no way to emit events.
  const ledger = new StockLedgerService();

  const tx = {
    product: {
      updateManyAndReturn: jest.fn<
        Promise<Product[]>,
        [Prisma.ProductUpdateManyAndReturnArgs]
      >(),
      findUnique: jest.fn<
        Promise<{ sku: string; quantity: number } | null>,
        [Prisma.ProductFindUniqueArgs]
      >(),
    },
    stockMovement: {
      create: jest.fn<
        Promise<StockMovement>,
        [Prisma.StockMovementCreateArgs]
      >(),
    },
  };
  const txClient = tx as unknown as Prisma.TransactionClient;

  beforeEach(() => jest.resetAllMocks());

  it('records the reason and invoice link on the ledger row', async () => {
    tx.product.updateManyAndReturn.mockResolvedValue([product(20)]);

    await ledger.applyMovement(txClient, {
      productId: PRODUCT_ID,
      type: MovementType.IN,
      quantity: 10,
      reason: MovementReason.PURCHASE,
      invoiceId: INVOICE_ID,
    });

    expect(tx.stockMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reason: MovementReason.PURCHASE,
        invoiceId: INVOICE_ID,
      }) as unknown,
    });
  });

  it('reports sku, requested and available when an OUT exceeds stock', async () => {
    tx.product.updateManyAndReturn.mockResolvedValue([]);
    tx.product.findUnique.mockResolvedValue({ sku: 'KB-001', quantity: 2 });

    const attempt = ledger.applyMovement(txClient, {
      productId: PRODUCT_ID,
      type: MovementType.OUT,
      quantity: 5,
      reason: MovementReason.SALE,
      invoiceId: INVOICE_ID,
    });

    await expect(attempt).rejects.toBeInstanceOf(InsufficientStockException);
    await expect(attempt).rejects.toMatchObject({
      sku: 'KB-001',
      requested: 5,
      available: 2,
    });
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it('keeps the stable 409 body: message unchanged, details added', () => {
    const error = new InsufficientStockException('KB-001', 5, 2);

    expect(error).toBeInstanceOf(ConflictException);
    expect(error.getStatus()).toBe(HttpStatus.CONFLICT);
    expect(error.message).toBe('Insufficient stock');
    expect(error.getResponse()).toEqual({
      statusCode: 409,
      error: 'Conflict',
      message: 'Insufficient stock',
      sku: 'KB-001',
      requested: 5,
      available: 2,
    });
  });
});
