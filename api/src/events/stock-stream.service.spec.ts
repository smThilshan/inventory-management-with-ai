import { MessageEvent } from '@nestjs/common';
import { Subscription } from 'rxjs';
import {
  SSE_HEARTBEAT_EVENT,
  SSE_HEARTBEAT_INTERVAL_MS,
} from '../common/constants';
import {
  INVOICE_CREATED_EVENT,
  InvoiceCreatedEvent,
} from '../invoices/events/invoice-created.event';
import {
  STOCK_UPDATED_EVENT,
  StockUpdatedEvent,
} from '../stock-movements/events/stock-updated.event';
import { StockStreamService } from './stock-stream.service';

const event: StockUpdatedEvent = {
  productId: 'product-1',
  sku: 'KB-001',
  quantity: 7,
  movement: {
    id: 'movement-1',
    productId: 'product-1',
    type: 'OUT',
    quantity: 3,
    reason: 'ADJUSTMENT',
    invoiceId: null,
    note: null,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
};

describe('StockStreamService', () => {
  let service: StockStreamService;
  let subscriptions: Subscription[];

  const collect = (): {
    messages: MessageEvent[];
    completed: () => boolean;
  } => {
    const messages: MessageEvent[] = [];
    let completed = false;
    subscriptions.push(
      service.stream().subscribe({
        next: (message) => messages.push(message),
        complete: () => (completed = true),
      }),
    );
    return { messages, completed: () => completed };
  };

  beforeEach(() => {
    jest.useFakeTimers();
    service = new StockStreamService();
    subscriptions = [];
  });

  afterEach(() => {
    subscriptions.forEach((s) => s.unsubscribe());
    jest.useRealTimers();
  });

  it('forwards stock.updated as an SSE message with the movement id', () => {
    const client = collect();

    service.publish(event);

    expect(client.messages).toEqual([
      { type: STOCK_UPDATED_EVENT, id: 'movement-1', data: event },
    ]);
  });

  it('forwards invoice.created as a second named event, in order with stock updates', () => {
    const client = collect();
    const invoiceEvent: InvoiceCreatedEvent = {
      id: 'invoice-1',
      invoiceNumber: 'SAL-2026-0001',
      type: 'SALE',
      counterpartyName: 'Buyer',
      date: '2026-09-25',
      currency: 'AED',
      total: '10.00',
      status: 'NOT_SENT',
    };

    service.publish(event);
    service.publishInvoiceCreated(invoiceEvent);

    expect(client.messages).toEqual([
      { type: STOCK_UPDATED_EVENT, id: 'movement-1', data: event },
      { type: INVOICE_CREATED_EVENT, id: 'invoice-1', data: invoiceEvent },
    ]);
  });

  it('broadcasts each update to every connected client', () => {
    const first = collect();
    const second = collect();

    service.publish(event);

    expect(first.messages).toHaveLength(1);
    expect(second.messages).toHaveLength(1);
  });

  it('does not replay past updates to clients that connect later', () => {
    service.publish(event);

    const late = collect();

    expect(late.messages).toHaveLength(0);
  });

  it('sends a heartbeat every interval so idle connections stay open', () => {
    const client = collect();

    jest.advanceTimersByTime(SSE_HEARTBEAT_INTERVAL_MS - 1);
    expect(client.messages).toHaveLength(0);

    jest.advanceTimersByTime(1);
    expect(client.messages).toEqual([{ type: SSE_HEARTBEAT_EVENT, data: '' }]);

    jest.advanceTimersByTime(SSE_HEARTBEAT_INTERVAL_MS);
    expect(client.messages).toHaveLength(2);
  });

  it('shares one heartbeat timer across all clients', () => {
    collect();
    collect();
    collect();

    expect(jest.getTimerCount()).toBe(1);
  });

  it('stops the heartbeat timer when the last client disconnects', () => {
    collect();
    subscriptions.forEach((s) => s.unsubscribe());

    expect(jest.getTimerCount()).toBe(0);
  });

  it('completes all open streams on shutdown so the server can close', () => {
    const client = collect();

    service.onModuleDestroy();

    expect(client.completed()).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });

  it('completes streams opened after shutdown immediately', () => {
    service.onModuleDestroy();

    expect(collect().completed()).toBe(true);
  });
});
