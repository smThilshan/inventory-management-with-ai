import { ApiError } from '@/lib/api';
import type { Product } from '@/lib/types';

interface SubmitErrorProps {
  error: unknown;
  products: Product[];
}

/**
 * Turns an API error into something the user can act on: for a stock
 * shortage (409) or unknown products (404) it names exactly which products
 * failed, instead of a generic message.
 */
export function SubmitError({ error, products }: SubmitErrorProps) {
  const nameOf = (id: string) => products.find((p) => p.id === id)?.name;

  return (
    <div
      role="alert"
      className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-inset ring-red-200"
    >
      {!(error instanceof ApiError) ? (
        <p>Could not reach the server. Please try again.</p>
      ) : error.details.shortages?.length ? (
        <>
          <p className="font-semibold">Not enough stock. Nothing was saved.</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5">
            {error.details.shortages.map((shortage) => (
              <li key={shortage.productId}>
                {nameOf(shortage.productId) ?? shortage.sku} ({shortage.sku}): requested{' '}
                {shortage.requested}, only {shortage.available} available
              </li>
            ))}
          </ul>
        </>
      ) : error.details.productIds?.length ? (
        <>
          <p className="font-semibold">Some products no longer exist. Nothing was saved.</p>
          <ul className="mt-1 list-disc pl-5">
            {error.details.productIds.map((id) => (
              <li key={id}>{nameOf(id) ?? id}</li>
            ))}
          </ul>
        </>
      ) : (
        <p>{error.message}</p>
      )}
    </div>
  );
}
