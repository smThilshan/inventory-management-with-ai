/** First page loaded into the dashboard (the API maximum). */
export const PRODUCTS_PAGE_SIZE = 100;

/** Mirrors the API's validation so the browser can reject obvious mistakes early. */
export const MOVEMENT_MAX_QUANTITY = 1_000_000;
export const MOVEMENT_NOTE_MAX_LENGTH = 255;

export const STOCK_UPDATED_EVENT = 'stock.updated';

/** How long a row stays highlighted after a live update. */
export const CHANGE_HIGHLIGHT_MS = 2_000;
/** How long the form's success message stays visible. */
export const SUCCESS_MESSAGE_MS = 4_000;
/** Retry delay when the browser gives up on an EventSource (e.g. an HTTP error). */
export const STREAM_RETRY_MS = 3_000;
