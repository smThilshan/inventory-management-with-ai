import { Injectable, MessageEvent, OnModuleDestroy } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  interval,
  map,
  merge,
  Observable,
  ReplaySubject,
  share,
  Subject,
  takeUntil,
} from 'rxjs';
import {
  SSE_HEARTBEAT_EVENT,
  SSE_HEARTBEAT_INTERVAL_MS,
} from '../common/constants';
import { INVOICE_CREATED_EVENT } from '../invoices/events/invoice-created.event';
import type { InvoiceCreatedEvent } from '../invoices/events/invoice-created.event';
import type { ProductResponse } from '../products/dto/product.response';
import { PRODUCT_CREATED_EVENT } from '../products/events/product-created.event';
import { STOCK_UPDATED_EVENT } from '../stock-movements/events/stock-updated.event';
import type { StockUpdatedEvent } from '../stock-movements/events/stock-updated.event';

/**
 * Bridges in-process domain events to SSE clients, as named events on one
 * stream (one connection per browser tab): `stock.updated`, `invoice.created`
 * and `product.created`.
 * The Subject is a hot, multicast source: every connected client receives each
 * event once, and events are only ever published after the DB transaction commits.
 *
 * Scope: in-memory, so it reaches clients connected to THIS instance. Running
 * several API instances would need a shared bus (e.g. Redis Pub/Sub).
 */
@Injectable()
export class StockStreamService implements OnModuleDestroy {
  private readonly messages$ = new Subject<MessageEvent>();
  /** Replay so a stream opened during shutdown also completes immediately. */
  private readonly shutdown$ = new ReplaySubject<void>(1);

  // One shared timer for all connections (not one per client); it stops
  // automatically when the last client disconnects.
  private readonly heartbeat$: Observable<MessageEvent> = interval(
    SSE_HEARTBEAT_INTERVAL_MS,
  ).pipe(
    map(() => ({ type: SSE_HEARTBEAT_EVENT, data: '' })),
    share(),
  );

  @OnEvent(STOCK_UPDATED_EVENT)
  publish(event: StockUpdatedEvent): void {
    // The movement id lets clients de-duplicate; UUIDv7 is also time-ordered.
    this.messages$.next({
      type: STOCK_UPDATED_EVENT,
      id: event.movement.id,
      data: event,
    });
  }

  @OnEvent(INVOICE_CREATED_EVENT)
  publishInvoiceCreated(event: InvoiceCreatedEvent): void {
    this.messages$.next({
      type: INVOICE_CREATED_EVENT,
      id: event.id,
      data: event,
    });
  }

  @OnEvent(PRODUCT_CREATED_EVENT)
  publishProductCreated(product: ProductResponse): void {
    this.messages$.next({
      type: PRODUCT_CREATED_EVENT,
      id: product.id,
      data: product,
    });
  }

  /** A per-connection stream of live events plus keep-alive heartbeats. */
  stream(): Observable<MessageEvent> {
    return merge(this.messages$, this.heartbeat$).pipe(
      takeUntil(this.shutdown$),
    );
  }

  // Completing every stream ends the open HTTP responses; otherwise long-lived
  // SSE connections would keep the server from shutting down gracefully.
  onModuleDestroy(): void {
    this.shutdown$.next();
    this.shutdown$.complete();
    this.messages$.complete();
  }
}
