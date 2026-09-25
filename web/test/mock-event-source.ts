type Listener = (event: MessageEvent<string>) => void;

/**
 * Test double for the browser EventSource (jsdom has none). Tests drive it
 * explicitly: open(), emit(), fail().
 */
export class MockEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  static instances: MockEventSource[] = [];

  readyState = MockEventSource.CONNECTING;
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  private readonly listeners = new Map<string, Listener[]>();

  constructor(readonly url: string) {
    MockEventSource.instances.push(this);
  }

  static install(): void {
    MockEventSource.instances = [];
    globalThis.EventSource = MockEventSource as unknown as typeof EventSource;
  }

  static latest(): MockEventSource {
    const source = MockEventSource.instances.at(-1);
    if (!source) throw new Error('No EventSource was created');
    return source;
  }

  addEventListener(type: string, listener: Listener): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), listener]);
  }

  close(): void {
    this.readyState = MockEventSource.CLOSED;
  }

  get closed(): boolean {
    return this.readyState === MockEventSource.CLOSED;
  }

  open(): void {
    this.readyState = MockEventSource.OPEN;
    this.onopen?.();
  }

  emit(type: string, payload: unknown): void {
    const event = new MessageEvent(type, { data: JSON.stringify(payload) });
    this.listeners.get(type)?.forEach((listener) => listener(event));
  }

  /** Network drop: the browser keeps retrying (CONNECTING) unless it gave up (CLOSED). */
  fail({ gaveUp = false } = {}): void {
    this.readyState = gaveUp ? MockEventSource.CLOSED : MockEventSource.CONNECTING;
    this.onerror?.();
  }
}
