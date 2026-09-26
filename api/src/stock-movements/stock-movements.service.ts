import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { MOVEMENT_HISTORY_LIMIT } from '../common/constants';
import { MovementReason, StockMovement } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStockMovementDto } from './dto/create-stock-movement.dto';
import {
  STOCK_UPDATED_EVENT,
  toStockUpdatedEvent,
} from './events/stock-updated.event';
import {
  StockLedgerService,
  StockMovementResult,
} from './stock-ledger.service';

/** Manual stock adjustments (damage, corrections): a movement with no invoice. */
@Injectable()
export class StockMovementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: StockLedgerService,
    private readonly events: EventEmitter2,
  ) {}

  async record(dto: CreateStockMovementDto): Promise<StockMovementResult> {
    const result = await this.prisma.$transaction((tx) =>
      this.ledger.applyMovement(tx, {
        productId: dto.productId,
        type: dto.type,
        quantity: dto.quantity,
        note: dto.note,
        reason: MovementReason.ADJUSTMENT,
      }),
    );

    // Only reached once the transaction has committed. Awaiting listeners
    // (e.g. cache invalidation) gives the caller read-your-writes consistency;
    // listener errors are suppressed by @OnEvent, so a failing listener can
    // never turn an already-committed movement into an error response.
    await this.events.emitAsync(
      STOCK_UPDATED_EVENT,
      toStockUpdatedEvent(result),
    );
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
}
