import type {
  ApiErrorBody,
  CreateProductInput,
  CreatePurchaseInput,
  CreateSaleInput,
  CreateStockMovementInput,
  Invoice,
  InvoiceFilters,
  InvoicePage,
  InvoicingSettings,
  LowStockList,
  Product,
  ProductPage,
  StockMovementResult,
  StockShortage,
} from './types';

// Must be referenced literally: Next.js inlines NEXT_PUBLIC_* at build time
// and cannot inline a dynamic lookup such as process.env[name].
const API_URL = process.env.NEXT_PUBLIC_API_URL;

/** Structured details some errors carry, so forms can point at the failing lines. */
export interface ApiErrorDetails {
  /** 409 on a sale: every line that lacks stock. */
  shortages?: StockShortage[];
  /** 404 on a purchase/sale: every unknown product id. */
  productIds?: string[];
}

/** An HTTP error from the API, carrying its user-facing message and details. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details: ApiErrorDetails = {},
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
async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as Partial<ApiErrorBody> & ApiErrorDetails;
    const message = Array.isArray(body.message)
      ? body.message.join('. ')
      : typeof body.message === 'string'
        ? body.message
        : `Request failed (${response.status})`;
    return new ApiError(response.status, message, {
      shortages: body.shortages,
      productIds: body.productIds,
    });
  } catch {
    // Not JSON (e.g. a proxy error page).
    return new ApiError(response.status, `Request failed (${response.status})`);
  }
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
    throw await toApiError(response);
  }
  return (await response.json()) as T;
}

const post = <T>(path: string, body: unknown) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) });

function query(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : '';
}

export const api = {
  listProducts: (limit: number) =>
    request<ProductPage>(`/products${query({ limit })}`),

  createProduct: (input: CreateProductInput) => post<Product>('/products', input),

  listLowStock: () => request<LowStockList>('/products/low-stock'),

  createStockMovement: (input: CreateStockMovementInput) =>
    post<StockMovementResult>('/stock-movements', input),

  getInvoicingSettings: () => request<InvoicingSettings>('/invoicing/settings'),

  createPurchase: (input: CreatePurchaseInput) =>
    post<Invoice>('/purchases', input),

  createSale: (input: CreateSaleInput) => post<Invoice>('/sales', input),

  listInvoices: (
    filters: InvoiceFilters & { limit?: number; cursor?: string } = {},
  ) => request<InvoicePage>(`/invoices${query({ ...filters })}`),

  /** Opened directly by the browser (new tab), so it is a URL, not a fetch. */
  invoicePdfUrl: (id: string) => apiUrl(`/invoices/${id}/pdf`),

  stockEventsUrl: () => apiUrl('/events/stock'),
};
