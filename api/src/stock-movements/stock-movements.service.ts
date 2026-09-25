import {
  ConflictException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
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
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import { toStockMovementResponse } from './dto/stock-movement.response';
import {
  STOCK_UPDATED_EVENT,
  StockUpdatedEvent,
} from './events/stock-updated.event';

export interface StockMovementResult {
  product: Product;
  movement: StockMovement;
}

interface QuantityChange {
  /** Precondition on the current quantity; the UPDATE only matches if it holds. */
  guard: Prisma.IntFilter;
  update: Prisma.IntFieldUpdateOperationsInput;
  conflictMessage: string;
}

function toQuantityChange(
  type: MovementType,
  quantity: number,
): QuantityChange {
  return type === MovementType.OUT
    ? {
        guard: { gte: quantity },
        update: { decrement: quantity },
        conflictMessage: 'Insufficient stock',
      }
    : {
        guard: { lte: STOCK_QUANTITY_MAX - quantity },
        update: { increment: quantity },
        conflictMessage: 'Stock quantity limit exceeded',
      };
}

@Injectable()
export class StockMovementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
  ) {}

  async record(dto: CreateStockMovementDto): Promise<StockMovementResult> {
    const result = await this.prisma.$transaction(async (tx) => {
      const product = await this.applyQuantityChange(tx, dto);
      const movement = await tx.stockMovement.create({
        data: {
          productId: dto.productId,
          type: dto.type,
          quantity: dto.quantity,
          note: dto.note,
        },
      });
      return { product, movement };
    });

    // Only reached once the transaction has committed.
    await this.publishStockUpdated(result);
    return result;
  }

  async findRecentForProduct(productId: string): Promise<StockMovement[]> {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: {
        movements: {
          orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
          take: MOVEMENT_HISTORY_LIMIT,
        },
      },
    });

    if (!product) {
      throw new NotFoundException('Product not found');
    }
    return product.movements;
  }

  /**
   * Check and write in ONE statement: UPDATE ... WHERE id = $1 AND quantity >= $2.
   * Postgres row-locks the product and re-evaluates the WHERE against the latest
   * committed value, so concurrent OUTs can never oversell (no read-then-write race).
   * The CHECK (quantity >= 0) constraint is the backstop if this were ever bypassed.
   */
  private async applyQuantityChange(
    tx: Prisma.TransactionClient,
    { productId, type, quantity }: CreateStockMovementDto,
  ): Promise<Product> {
    const change = toQuantityChange(type, quantity);

    const [product] = await tx.product.updateManyAndReturn({
      where: { id: productId, quantity: change.guard },
      data: { quantity: change.update },
    });
    if (product) {
      return product;
    }

    throw await this.explainRejectedChange(tx, productId, change);
  }

  // Zero rows updated means either the product is missing or the guard failed;
  // only on this (rare) failure path do we pay for an extra lookup.
  private async explainRejectedChange(
    tx: Prisma.TransactionClient,
    productId: string,
    change: QuantityChange,
  ): Promise<HttpException> {
    const exists = (await tx.product.count({ where: { id: productId } })) > 0;
    return exists
      ? new ConflictException(change.conflictMessage)
      : new NotFoundException('Product not found');
  }

  private async publishStockUpdated({
    product,
    movement,
  }: StockMovementResult): Promise<void> {
    const event: StockUpdatedEvent = {
      productId: product.id,
      sku: product.sku,
      quantity: product.quantity,
      movement: toStockMovementResponse(movement),
    };
    // Awaiting listeners (e.g. cache invalidation) gives the caller read-your-writes
    // consistency. Listener errors are suppressed by @OnEvent, so a failing
    // listener can never turn an already-committed movement into an error response.
    await this.events.emitAsync(STOCK_UPDATED_EVENT, event);
  }
}
