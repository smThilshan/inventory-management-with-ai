'use client';

import { type FormEvent, useEffect, useId, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import {
  MOVEMENT_MAX_QUANTITY,
  MOVEMENT_NOTE_MAX_LENGTH,
  SUCCESS_MESSAGE_MS,
} from '@/lib/constants';
import type { MovementType, Product } from '@/lib/types';
import { inputClass } from '@/lib/ui';

type Feedback = { kind: 'success' | 'error'; message: string } | null;

const MOVEMENT_TYPES: { value: MovementType; label: string }[] = [
  { value: 'IN', label: 'IN (add)' },
  { value: 'OUT', label: 'OUT (remove)' },
];

/**
 * Stock adjustment (damage, recounts, corrections): a movement with NO invoice.
 * Purchases and sales have their own pages because they create invoices.
 * It deliberately does NOT update the table: the change
 * arrives via the SSE stream like it does for every other open window, so
 * there is a single update path and no optimistic state to reconcile.
 */
export function MovementForm({ products }: { products: Product[] }) {
  const ids = useId();
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [type, setType] = useState<MovementType>('OUT');
  const [quantity, setQuantity] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    if (feedback?.kind !== 'success') return;
    const timer = setTimeout(() => setFeedback(null), SUCCESS_MESSAGE_MS);
    return () => clearTimeout(timer);
  }, [feedback]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitting(true);
    setFeedback(null);
    try {
      const { product, movement } = await api.createStockMovement({
        productId,
        type,
        quantity: Number(quantity),
        note: note.trim() || undefined,
      });
      // Keep product and type selected so repeated movements are quick.
      setQuantity('');
      setNote('');
      setFeedback({
        kind: 'success',
        message: `Recorded ${movement.type} ${movement.quantity} × ${product.sku}. Stock is now ${product.quantity}.`,
      });
    } catch (error: unknown) {
      setFeedback({
        kind: 'error',
        message:
          error instanceof ApiError
            ? error.message
            : 'Could not reach the server. Please try again.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      aria-labelledby={`${ids}-heading`}
      className="rounded-xl border border-slate-200 bg-white shadow-sm"
    >
      <header className="border-b border-slate-200 px-5 py-4">
        <h2 id={`${ids}-heading`} className="text-base font-semibold text-slate-900">
          Stock adjustment
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Damage, recounts and corrections. No invoice is created; use Purchases or Sales for
          those.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="px-5 py-4">
        {/* A disabled fieldset disables every control inside it while submitting. */}
        <fieldset disabled={submitting || products.length === 0} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor={`${ids}-product`} className="text-sm font-medium text-slate-700">
              Product
            </label>
            <select
              id={`${ids}-product`}
              required
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              className={inputClass}
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.sku}) · {p.quantity} in stock
                </option>
              ))}
            </select>
          </div>

          <fieldset className="space-y-1.5">
            <legend className="text-sm font-medium text-slate-700">Type</legend>
            <div className="grid grid-cols-2 gap-2">
              {MOVEMENT_TYPES.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center justify-center rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 has-checked:border-indigo-500 has-checked:bg-indigo-50 has-checked:text-indigo-700"
                >
                  <input
                    type="radio"
                    name="type"
                    value={option.value}
                    checked={type === option.value}
                    onChange={() => setType(option.value)}
                    className="sr-only"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <div className="space-y-1.5">
            <label htmlFor={`${ids}-quantity`} className="text-sm font-medium text-slate-700">
              Quantity
            </label>
            <input
              id={`${ids}-quantity`}
              type="number"
              inputMode="numeric"
              required
              min={1}
              max={MOVEMENT_MAX_QUANTITY}
              step={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className={inputClass}
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor={`${ids}-note`} className="text-sm font-medium text-slate-700">
              Note <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id={`${ids}-note`}
              type="text"
              maxLength={MOVEMENT_NOTE_MAX_LENGTH}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Order #1042"
              className={inputClass}
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Recording…' : 'Record adjustment'}
          </button>
        </fieldset>

        {feedback?.kind === 'error' && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 ring-1 ring-inset ring-red-200">
            {feedback.message}
          </p>
        )}
        {feedback?.kind === 'success' && (
          <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 ring-1 ring-inset ring-emerald-200">
            {feedback.message}
          </p>
        )}
      </form>
    </section>
  );
}
