'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { api } from '@/lib/api';
import {
  INVOICE_CREATED_EVENT,
  PRODUCT_CREATED_EVENT,
  STOCK_UPDATED_EVENT,
  STREAM_RETRY_MS,
} from '@/lib/constants';
import type { InvoiceCreatedEvent, Product, StockUpdatedEvent } from '@/lib/types';

export type StreamStatus = 'connecting' | 'live' | 'reconnecting';

interface StockStreamHandlers {
  onUpdate?: (event: StockUpdatedEvent) => void;
  onInvoiceCreated?: (event: InvoiceCreatedEvent) => void;
  onProductCreated?: (product: Product) => void;
  /** Called every time the stream (re)opens: events may have been missed while it was down. */
  onOpen?: () => void;
}

/**
 * One EventSource per page for all live events (`stock.updated`,
 * `invoice.created`). Each open EventSource holds an HTTP connection, and
 * browsers allow only ~6 per origin on HTTP/1.1.
 */
export function useStockStream({
  onUpdate,
  onInvoiceCreated,
  onProductCreated,
  onOpen,
}: StockStreamHandlers): StreamStatus {
  const [status, setStatus] = useState<StreamStatus>('connecting');

  // Latest handlers without re-running the effect (which would reconnect).
  const handleUpdate = useEffectEvent((event: StockUpdatedEvent) => onUpdate?.(event));
  const handleInvoiceCreated = useEffectEvent((event: InvoiceCreatedEvent) =>
    onInvoiceCreated?.(event),
  );
  const handleProductCreated = useEffectEvent((product: Product) => onProductCreated?.(product));
  const handleOpen = useEffectEvent(() => onOpen?.());

  useEffect(() => {
    let source: EventSource;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    const connect = (): void => {
      source = new EventSource(api.stockEventsUrl());

      source.onopen = () => {
        setStatus('live');
        handleOpen();
      };

      source.onerror = () => {
        setStatus('reconnecting');
        // The browser retries network errors by itself (readyState CONNECTING),
        // but gives up for good on HTTP errors (CLOSED), so retry those manually.
        if (source.readyState === EventSource.CLOSED) {
          retryTimer = setTimeout(connect, STREAM_RETRY_MS);
        }
      };

      source.addEventListener(STOCK_UPDATED_EVENT, (message) => {
        handleUpdate(JSON.parse((message as MessageEvent<string>).data) as StockUpdatedEvent);
      });
      source.addEventListener(PRODUCT_CREATED_EVENT, (message) => {
        handleProductCreated(JSON.parse((message as MessageEvent<string>).data) as Product);
      });
      source.addEventListener(INVOICE_CREATED_EVENT, (message) => {
        handleInvoiceCreated(
          JSON.parse((message as MessageEvent<string>).data) as InvoiceCreatedEvent,
        );
      });
    };

    connect();
    return () => {
      clearTimeout(retryTimer);
      source.close();
    };
  }, []);

  return status;
}
