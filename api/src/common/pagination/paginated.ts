export interface Paginated<T> {
  items: T[];
  nextCursor: string | null;
}

/**
 * Builds a page from rows fetched with `take: limit + 1`. The extra row only
 * signals that another page exists, which avoids a separate COUNT query.
 */
export function toPage<T extends { id: string }>(
  rows: T[],
  limit: number,
): Paginated<T> {
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return {
    items,
    nextCursor: hasMore ? items[items.length - 1].id : null,
  };
}
