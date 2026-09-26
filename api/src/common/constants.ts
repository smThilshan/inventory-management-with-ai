// Environment defaults
export const DEFAULT_PORT = 3001;
export const DEFAULT_CORS_ORIGIN = 'http://localhost:3000';
export const DEFAULT_LOW_STOCK_THRESHOLD = 10;
export const DEFAULT_LOW_STOCK_CACHE_TTL_SECONDS = 30;
export const DEFAULT_SWAGGER_ENABLED = true;
export const DEFAULT_TAX_RATE = '0';
export const DEFAULT_CURRENCY = 'AED';
export const DEFAULT_INVOICE_DUE_DAYS = 30;
export const DEFAULT_INVOICE_STORAGE_DIR = './storage/invoices';
/** Defines "today" for invoice dates (UAE business, AED currency). */
export const DEFAULT_BUSINESS_TIMEZONE = 'Asia/Dubai';

// API documentation (OpenAPI)
export const SWAGGER_PATH = 'docs';
export const SWAGGER_JSON_PATH = 'docs-json';

// Pagination
export const PAGINATION_DEFAULT_LIMIT = 20;
export const PAGINATION_MAX_LIMIT = 100;

// Product field limits (mirror the column sizes in schema.prisma)
export const PRODUCT_NAME_MAX_LENGTH = 120;
export const PRODUCT_SKU_MAX_LENGTH = 32;
export const PRODUCT_SKU_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)*$/;
/** Largest value a Decimal(10,2) column can hold. */
export const PRODUCT_PRICE_MAX = 99_999_999.99;
export const PRICE_DECIMAL_PLACES = 2;

// Stock ledger
export const OPENING_STOCK_NOTE = 'Opening stock';
export const MOVEMENT_MAX_QUANTITY = 1_000_000;
export const MOVEMENT_NOTE_MAX_LENGTH = 255;
export const MOVEMENT_HISTORY_LIMIT = 50;
/** Upper bound of Product.quantity (Postgres INTEGER). */
export const STOCK_QUANTITY_MAX = 2_147_483_647;

// Low-stock cache (Redis)
export const LOW_STOCK_CACHE_KEY_PREFIX = 'low-stock:';
/** Keeps the response bounded; items are ordered most-urgent first. */
export const LOW_STOCK_MAX_ITEMS = 100;
/** SCAN batch size for invalidation: small enough never to block Redis. */
export const CACHE_SCAN_BATCH_SIZE = 100;
/** A slow Redis must not slow the API: give up and fall back to the DB. */
export const REDIS_COMMAND_TIMEOUT_MS = 500;
export const REDIS_CONNECT_TIMEOUT_MS = 2_000;
/**
 * ioredis arms this timer on disconnect and only clears it on the socket's
 * 'close' event, which never comes if the socket already died (Redis down):
 * shutdown would stall for the full default of 2s. A cache has nothing to flush.
 */
export const REDIS_DISCONNECT_TIMEOUT_MS = 100;
export const CACHE_STATUS_HEADER = 'X-Cache';

// Server-Sent Events
/** Below the ~30-60s idle timeout of common proxies/load balancers. */
export const SSE_HEARTBEAT_INTERVAL_MS = 25_000;
export const SSE_HEARTBEAT_EVENT = 'heartbeat';

// Invoicing
export const INVOICE_MAX_LINES = 50;
export const COUNTERPARTY_NAME_MIN_LENGTH = 2;
export const COUNTERPARTY_NAME_MAX_LENGTH = 120;
/** Per-unit cap, mirroring the product price column. */
export const INVOICE_UNIT_PRICE_MAX = 99_999_999.99;
/** Largest amount a Decimal(12,2) invoice column can hold. */
export const INVOICE_AMOUNT_MAX = '9999999999.99';
/** Calendar date as sent by clients: YYYY-MM-DD. */
export const CALENDAR_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
/** Up to 50 lines, each an UPDATE + INSERT, possibly waiting on row locks. */
export const INVOICE_TRANSACTION_TIMEOUT_MS = 15_000;
