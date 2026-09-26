'use client';

import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { SubmitError } from '@/components/invoicing/SubmitError';
import { api } from '@/lib/api';
import {
  PRODUCT_NAME_MAX_LENGTH,
  PRODUCT_SKU_MAX_LENGTH,
  PRODUCT_SKU_PATTERN,
} from '@/lib/constants';
import type { Product } from '@/lib/types';
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from '@/lib/ui';

const EMPTY = { name: '', sku: '', price: '', quantity: '' };

/**
 * "+ Add product" button and dialog. The new product reaches the table through
 * the live `product.created` event, like every other open window.
 */
export function AddProductDialog({ onCreated }: { onCreated?: (product: Product) => void }) {
  const ids = useId();
  const nameInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    if (!open) return;
    nameInput.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && close();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  function close() {
    setOpen(false);
    setFields(EMPTY);
    setError(null);
  }

  const set = (key: keyof typeof EMPTY) => (value: string) =>
    setFields((current) => ({ ...current, [key]: value }));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const product = await api.createProduct({
        name: fields.name.trim(),
        sku: fields.sku.trim(),
        price: Number(fields.price),
        quantity: fields.quantity ? Number(fields.quantity) : undefined,
      });
      onCreated?.(product);
      close();
    } catch (caught: unknown) {
      setError(caught); // e.g. "SKU already exists": keep the input for correction
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={primaryButtonClass}>
        + Add product
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onMouseDown={(e) => e.target === e.currentTarget && close()}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={`${ids}-title`}
            className="w-full max-w-md rounded-xl bg-white shadow-xl"
          >
            <header className="border-b border-slate-200 px-5 py-4">
              <h2 id={`${ids}-title`} className="text-base font-semibold text-slate-900">
                Add product
              </h2>
            </header>

            <form onSubmit={handleSubmit} className="space-y-4 px-5 py-4">
              <fieldset disabled={submitting} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor={`${ids}-name`} className={labelClass}>Name</label>
                  <input
                    ref={nameInput}
                    id={`${ids}-name`}
                    required
                    maxLength={PRODUCT_NAME_MAX_LENGTH}
                    value={fields.name}
                    onChange={(e) => set('name')(e.target.value)}
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor={`${ids}-sku`} className={labelClass}>SKU</label>
                  <input
                    id={`${ids}-sku`}
                    required
                    maxLength={PRODUCT_SKU_MAX_LENGTH}
                    pattern={PRODUCT_SKU_PATTERN}
                    title="Uppercase letters, digits and single dashes, e.g. KB-MECH-001"
                    placeholder="e.g. KB-MECH-001"
                    value={fields.sku}
                    // SKUs are uppercase by rule; typing lowercase is harmless.
                    onChange={(e) => set('sku')(e.target.value.toUpperCase())}
                    className={`${inputClass} font-mono`}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor={`${ids}-price`} className={labelClass}>Price</label>
                    <input
                      id={`${ids}-price`}
                      type="number"
                      inputMode="decimal"
                      required
                      min={0.01}
                      step={0.01}
                      value={fields.price}
                      onChange={(e) => set('price')(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor={`${ids}-quantity`} className={labelClass}>
                      Opening stock <span className="font-normal text-slate-400">(optional)</span>
                    </label>
                    <input
                      id={`${ids}-quantity`}
                      type="number"
                      inputMode="numeric"
                      min={0}
                      step={1}
                      placeholder="0"
                      value={fields.quantity}
                      onChange={(e) => set('quantity')(e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Opening stock is for a stock take. Stock you buy later should be received
                  through Purchases, so it gets an invoice.
                </p>

                {error !== null && <SubmitError error={error} products={[]} />}

                <div className="flex justify-end gap-2">
                  <button type="button" onClick={close} className={secondaryButtonClass}>
                    Cancel
                  </button>
                  <button type="submit" className={primaryButtonClass}>
                    {submitting ? 'Adding…' : 'Add product'}
                  </button>
                </div>
              </fieldset>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
