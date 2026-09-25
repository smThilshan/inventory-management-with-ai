export interface SseMessage {
  event: string;
  data: string;
  id?: string;
}

interface Waiter {
  event: string;
  resolve: (message: SseMessage) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
}

const DEFAULT_WAIT_MS = 3_000;

/**
 * Minimal SSE client for tests, built on fetch. A background pump reads the
 * body continuously into a queue, so no message is lost between waits.
 */
export class SseTestClient {
  private buffer = '';
  private readonly queue: SseMessage[] = [];
  private readonly waiters: Waiter[] = [];
  private ended = false;
  /** Resolves when the server ends the stream (or the client closes it). */
  readonly closed: Promise<void>;

  private constructor(
    readonly response: Response,
    private readonly abortController: AbortController,
  ) {
    this.closed = this.pump();
  }

  static async connect(
    url: string,
    headers: Record<string, string> = {},
  ): Promise<SseTestClient> {
    const abortController = new AbortController();
    const response = await fetch(url, {
      headers: { Accept: 'text/event-stream', ...headers },
      signal: abortController.signal,
    });
    return new SseTestClient(response, abortController);
  }

  /** Resolves with the next message of the given event type (earlier queued ones first). */
  next(event: string, timeoutMs = DEFAULT_WAIT_MS): Promise<SseMessage> {
    const index = this.queue.findIndex((m) => m.event === event);
    if (index >= 0) {
      return Promise.resolve(this.queue.splice(index, 1)[0]);
    }
    if (this.ended) {
      return Promise.reject(new Error(`Stream ended before "${event}"`));
    }
    return new Promise((resolve, reject) => {
      const waiter: Waiter = {
        event,
        resolve,
        reject,
        timer: setTimeout(() => {
          this.removeWaiter(waiter);
          reject(new Error(`Timed out waiting for "${event}"`));
        }, timeoutMs),
      };
      this.waiters.push(waiter);
    });
  }

  close(): void {
    this.abortController.abort();
  }

  private async pump(): Promise<void> {
    const reader = this.response
      .body!.pipeThrough(new TextDecoderStream())
      .getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        this.ingest(value);
      }
    } catch {
      // Aborted by close(): a normal end for a test client.
    } finally {
      this.ended = true;
      for (const waiter of this.waiters.splice(0)) {
        clearTimeout(waiter.timer);
        waiter.reject(new Error(`Stream ended before "${waiter.event}"`));
      }
    }
  }

  private ingest(chunk: string): void {
    this.buffer += chunk;
    let boundary: number;
    while ((boundary = this.buffer.indexOf('\n\n')) >= 0) {
      const frame = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);
      this.dispatch(parseFrame(frame));
    }
  }

  private dispatch(message: SseMessage): void {
    const waiter = this.waiters.find((w) => w.event === message.event);
    if (!waiter) {
      this.queue.push(message);
      return;
    }
    this.removeWaiter(waiter);
    clearTimeout(waiter.timer);
    waiter.resolve(message);
  }

  private removeWaiter(waiter: Waiter): void {
    this.waiters.splice(this.waiters.indexOf(waiter), 1);
  }
}

function parseFrame(frame: string): SseMessage {
  const message: SseMessage = { event: 'message', data: '' };
  const data: string[] = [];
  for (const line of frame.split('\n')) {
    const separator = line.indexOf(':');
    if (separator <= 0) continue; // blank line or ":comment"
    const field = line.slice(0, separator);
    const value = line.slice(separator + 1).replace(/^ /, '');
    if (field === 'event') message.event = value;
    else if (field === 'data') data.push(value);
    else if (field === 'id') message.id = value;
  }
  message.data = data.join('\n');
  return message;
}
