/** First page loaded into the dashboard (the API maximum). */
export const PRODUCTS_PAGE_SIZE = 100;

/** Mirrors the API's validation so the browser can reject obvious mistakes early. */
export const MOVEMENT_MAX_QUANTITY = 1_000_000;
export const MOVEMENT_NOTE_MAX_LENGTH = 255;

export const STOCK_UPDATED_EVENT = 'stock.updated';
export const INVOICE_CREATED_EVENT = 'invoice.created';
export const PRODUCT_CREATED_EVENT = 'product.created';

/** How long a row stays highlighted after a live update. */
export const CHANGE_HIGHLIGHT_MS = 2_000;
/** How long the form's success message stays visible. */
export const SUCCESS_MESSAGE_MS = 4_000;
/** Retry delay when the browser gives up on an EventSource (e.g. an HTTP error). */
export const STREAM_RETRY_MS = 3_000;

// Invoicing (mirrors the API's validation so the browser can catch mistakes early)
export const INVOICE_MAX_LINES = 50;
export const COUNTERPARTY_NAME_MIN_LENGTH = 2;
export const COUNTERPARTY_NAME_MAX_LENGTH = 120;
export const INVOICES_PAGE_SIZE = 20;

// Products (mirror the API validation)
export const PRODUCT_NAME_MAX_LENGTH = 120;
export const PRODUCT_SKU_MAX_LENGTH = 32;
export const PRODUCT_SKU_PATTERN = '[A-Z0-9]+(-[A-Z0-9]+)*';
