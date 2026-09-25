import { ProductResponse } from '../src/products/dto/product.response';
import { StockMovementResultResponse } from '../src/stock-movements/dto/stock-movement.response';
import {
  STOCK_UPDATED_EVENT,
  StockUpdatedEvent,
} from '../src/stock-movements/events/stock-updated.event';
import { SseTestClient } from './utils/sse-client';
import {
  createTestApp,
  listen,
  resetState,
  TestContext,
} from './utils/test-app';

const ALLOWED_ORIGIN = 'http://localhost:3000';

describe('Stock events SSE (e2e)', () => {
  let ctx: TestContext;
  let baseUrl: string;
  let clients: SseTestClient[];

  beforeAll(async () => {
    ctx = await createTestApp();
    baseUrl = await listen(ctx);
  });

  beforeEach(async () => {
    await resetState(ctx);
    clients = [];
  });

  afterEach(() => {
    clients.forEach((client) => client.close());
  });

  afterAll(async () => {
    await ctx.app.close();
  });

  const openStream = async (
    headers: Record<string, string> = {},
  ): Promise<SseTestClient> => {
    const client = await SseTestClient.connect(
      `${baseUrl}/events/stock`,
      headers,
    );
    clients.push(client);
    return client;
  };

  const post = async <T>(path: string, body: object, status: number) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    expect(res.status).toBe(status);
    return (await res.json()) as T;
  };

  const createProduct = (quantity: number) =>
    post<ProductResponse>(
      '/products',
      { name: 'Widget', sku: 'WG-001', quantity, price: 5 },
      201,
    );

  const payloadOf = (data: string) => JSON.parse(data) as StockUpdatedEvent;

  it('opens an event stream with CORS for the web origin', async () => {
    const client = await openStream({ Origin: ALLOWED_ORIGIN });

    expect(client.response.status).toBe(200);
    expect(client.response.headers.get('content-type')).toContain(
      'text/event-stream',
    );
    expect(client.response.headers.get('access-control-allow-origin')).toBe(
      ALLOWED_ORIGIN,
    );
  });

  it('pushes stock.updated with the committed quantity when a movement is posted', async () => {
    const product = await createProduct(10);
    const client = await openStream();

    const { movement } = await post<StockMovementResultResponse>(
      '/stock-movements',
      { productId: product.id, type: 'OUT', quantity: 4 },
      201,
    );

    const message = await client.next(STOCK_UPDATED_EVENT);
    expect(message.id).toBe(movement.id);
    expect(payloadOf(message.data)).toEqual({
      productId: product.id,
      sku: 'WG-001',
      quantity: 6,
      movement,
    });
  });

  it('does not push rejected movements', async () => {
    const product = await createProduct(2);
    const client = await openStream();

    await post(
      '/stock-movements',
      { productId: product.id, type: 'OUT', quantity: 5 },
      409,
    );
    await post(
      '/stock-movements',
      { productId: product.id, type: 'IN', quantity: 1 },
      201,
    );

    // The first event received must be the successful IN, not the rejected OUT.
    const message = await client.next(STOCK_UPDATED_EVENT);
    expect(payloadOf(message.data)).toMatchObject({
      quantity: 3,
      movement: { type: 'IN', quantity: 1 },
    });
  });

  it('broadcasts every update to all connected clients', async () => {
    const product = await createProduct(10);
    const first = await openStream();
    const second = await openStream();

    await post(
      '/stock-movements',
      { productId: product.id, type: 'IN', quantity: 2 },
      201,
    );

    const [a, b] = await Promise.all([
      first.next(STOCK_UPDATED_EVENT),
      second.next(STOCK_UPDATED_EVENT),
    ]);
    expect(payloadOf(a.data).quantity).toBe(12);
    expect(b.data).toBe(a.data);
  });
});

describe('Stock events SSE shutdown (e2e)', () => {
  it('ends open streams when the app shuts down instead of hanging', async () => {
    const ctx = await createTestApp();
    const baseUrl = await listen(ctx);
    const client = await SseTestClient.connect(`${baseUrl}/events/stock`);

    await ctx.app.close();

    await expect(client.closed).resolves.toBeUndefined();
  });
});
