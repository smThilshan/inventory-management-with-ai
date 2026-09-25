import type {
  ApiErrorBody,
  CreateStockMovementInput,
  LowStockList,
  ProductPage,
  StockMovementResult,
} from './types';

// Must be referenced literally: Next.js inlines NEXT_PUBLIC_* at build time
// and cannot inline a dynamic lookup such as process.env[name].
const API_URL = process.env.NEXT_PUBLIC_API_URL;

/** An HTTP error from the API, carrying its user-facing message. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function apiUrl(path: string): string {
  if (!API_URL) {
    throw new Error('NEXT_PUBLIC_API_URL is not set (see web/.env.example)');
  }
  return `${API_URL}${path}`;
}

/** Validation errors arrive as a list; show them as one readable sentence. */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const { message } = (await response.json()) as Partial<ApiErrorBody>;
    if (Array.isArray(message)) return message.join('. ');
    if (typeof message === 'string') return message;
  } catch {
    // Not JSON (e.g. a proxy error page): fall through to a generic message.
  }
  return `Request failed (${response.status})`;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(apiUrl(path), {
    ...init,
    // Inventory data is live: never serve it from an HTTP or Next.js cache.
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  });
  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }
  return (await response.json()) as T;
}

export const api = {
  listProducts: (limit: number) =>
    request<ProductPage>(`/products?limit=${limit}`),

  listLowStock: () => request<LowStockList>('/products/low-stock'),

  createStockMovement: (input: CreateStockMovementInput) =>
    request<StockMovementResult>('/stock-movements', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  stockEventsUrl: () => apiUrl('/events/stock'),
};
