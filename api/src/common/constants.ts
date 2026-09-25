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
