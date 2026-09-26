import {
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { STOCK_QUANTITY_MAX } from '../common/constants';
import {
  MovementReason,
  MovementType,
  Prisma,
  Product,
  StockMovement,
} from '../generated/prisma/client';
import { InsufficientStockException } from './errors/insufficient-stock.exception';

export interface ApplyMovementInput {
  productId: string;
  type: MovementType;
  quantity: number;
  reason: MovementReason;
  /** Required for PURCHASE/SALE, absent for ADJUSTMENT (enforced by a DB CHECK). */
  invoiceId?: string;
  note?: string;
}

export interface StockMovementResult {
  product: Product;
  movement: StockMovement;
}

interface QuantityChange {
  /** Precondition on the current quantity; the UPDATE only matches if it holds. */
  guard: Prisma.IntFilter;
  update: Prisma.IntFieldUpdateOperationsInput;
}

function toQuantityChange(
  type: MovementType,
  quantity: number,
): QuantityChange {
  return type === MovementType.OUT
    ? { guard: { gte: quantity }, update: { decrement: quantity } }
    : {
        guard: { lte: STOCK_QUANTITY_MAX - quantity },
        update: { increment: quantity },
      };
}

/**
 * The single place where Product.quantity changes, always together with its
 * ledger row. It runs inside the CALLER's transaction, so an adjustment, a
 * purchase or a sale commits (or rolls back) all its movements atomically.
 *
 * Deliberately has no PrismaService or EventEmitter dependency: it cannot open
 * its own transaction or publish events. Callers emit only after commit.
 */
@Injectable()
export class StockLedgerService {
  async applyMovement(
    tx: Prisma.TransactionClient,
    input: ApplyMovementInput,
  ): Promise<StockMovementResult> {
    const product = await this.changeQuantity(tx, input);
    const movement = await tx.stockMovement.create({
      data: {
        productId: input.productId,
        type: input.type,
        quantity: input.quantity,
        reason: input.reason,
        invoiceId: input.invoiceId,
        note: input.note,
      },
    });
    return { product, movement };
  }

  /**
   * Check and write in ONE statement: UPDATE ... WHERE id = $1 AND quantity >= $2.
   * Postgres row-locks the product and re-evaluates the WHERE against the latest
   * committed value, so concurrent OUTs can never oversell (no read-then-write race).
   * The CHECK (quantity >= 0) constraint is the backstop if this were ever bypassed.
   */
  private async changeQuantity(
    tx: Prisma.TransactionClient,
    input: ApplyMovementInput,
  ): Promise<Product> {
    const change = toQuantityChange(input.type, input.quantity);

    const [product] = await tx.product.updateManyAndReturn({
      where: { id: input.productId, quantity: change.guard },
      data: { quantity: change.update },
    });
    if (product) {
      return product;
    }

    throw await this.explainRejectedChange(tx, input);
  }

  // Zero rows updated means either the product is missing or the guard failed;
  // only on this (rare) failure path do we pay for an extra lookup.
  private async explainRejectedChange(
    tx: Prisma.TransactionClient,
    { productId, type, quantity }: ApplyMovementInput,
  ): Promise<HttpException> {
    const current = await tx.product.findUnique({
      where: { id: productId },
      select: { sku: true, quantity: true },
    });
    if (!current) {
      return new NotFoundException('Product not found');
    }
    return type === MovementType.OUT
      ? new InsufficientStockException(current.sku, quantity, current.quantity)
      : new ConflictException('Stock quantity limit exceeded');
  }
}
