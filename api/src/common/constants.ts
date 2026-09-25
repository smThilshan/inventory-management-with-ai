// Environment defaults
export const DEFAULT_PORT = 3001;
export const DEFAULT_CORS_ORIGIN = 'http://localhost:3000';
export const DEFAULT_LOW_STOCK_THRESHOLD = 10;
export const DEFAULT_LOW_STOCK_CACHE_TTL_SECONDS = 30;

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
export const CACHE_STATUS_HEADER = 'X-Cache';
