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
import { STOCK_UPDATED_EVENT } from '../stock-movements/events/stock-updated.event';
import type { StockUpdatedEvent } from '../stock-movements/events/stock-updated.event';

/**
 * Bridges in-process domain events to SSE clients. The Subject is a hot,
 * multicast source: every connected client receives each update once, and
 * events are only ever published after the DB transaction has committed.
 *
 * Scope: in-memory, so it reaches clients connected to THIS instance. Running
 * several API instances would need a shared bus (e.g. Redis Pub/Sub).
 */
@Injectable()
export class StockStreamService implements OnModuleDestroy {
  private readonly updates$ = new Subject<StockUpdatedEvent>();
  /** Replay so a stream opened during shutdown also completes immediately. */
  private readonly shutdown$ = new ReplaySubject<void>(1);

  private readonly updateMessages$: Observable<MessageEvent> =
    this.updates$.pipe(
      map((event) => ({
        type: STOCK_UPDATED_EVENT,
        // Lets clients de-duplicate; UUIDv7 is also time-ordered.
        id: event.movement.id,
        data: event,
      })),
    );

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
    this.updates$.next(event);
  }

  /** A per-connection stream of live updates plus keep-alive heartbeats. */
  stream(): Observable<MessageEvent> {
    return merge(this.updateMessages$, this.heartbeat$).pipe(
      takeUntil(this.shutdown$),
    );
  }

  // Completing every stream ends the open HTTP responses; otherwise long-lived
  // SSE connections would keep the server from shutting down gracefully.
  onModuleDestroy(): void {
    this.shutdown$.next();
    this.shutdown$.complete();
    this.updates$.complete();
  }
}
