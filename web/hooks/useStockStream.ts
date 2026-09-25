'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { api } from '@/lib/api';
import { STOCK_UPDATED_EVENT, STREAM_RETRY_MS } from '@/lib/constants';
import type { StockUpdatedEvent } from '@/lib/types';

export type StreamStatus = 'connecting' | 'live' | 'reconnecting';

interface StockStreamHandlers {
  onUpdate: (event: StockUpdatedEvent) => void;
  /** Called every time the stream (re)opens: events may have been missed while it was down. */
  onOpen: () => void;
}

/**
 * One EventSource for the whole dashboard. Each open EventSource holds an HTTP
 * connection, and browsers allow only ~6 per origin on HTTP/1.1.
 */
export function useStockStream({ onUpdate, onOpen }: StockStreamHandlers): StreamStatus {
  const [status, setStatus] = useState<StreamStatus>('connecting');

  // Latest handlers without re-running the effect (which would reconnect).
  const handleUpdate = useEffectEvent(onUpdate);
  const handleOpen = useEffectEvent(onOpen);

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
    };

    connect();
    return () => {
      clearTimeout(retryTimer);
      source.close();
    };
  }, []);

  return status;
}
