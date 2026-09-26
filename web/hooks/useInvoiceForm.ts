'use client';

import { useState } from 'react';
import type { Invoice, InvoicingSettings } from '@/lib/types';

/** State shared by the purchase and sale forms: party, date and the submit lifecycle. */
export function useInvoiceForm(settings: InvoicingSettings) {
  const [partyName, setPartyName] = useState('');
  const [date, setDateValue] = useState(settings.today);
  const [dateTouched, setDateTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [created, setCreated] = useState<Invoice | null>(null);

  const setDate = (value: string) => {
    setDateValue(value);
    setDateTouched(true);
  };

  /**
   * Submits once (the form is disabled meanwhile, so no double invoices).
   * On success the form resets; on failure the input is kept for correction.
   */
  async function submit(
    create: (input: { partyName: string; date: string | undefined }) => Promise<Invoice>,
    onSuccess: () => void,
  ): Promise<void> {
    setSubmitting(true);
    setError(null);
    setCreated(null);
    try {
      const invoice = await create({
        partyName: partyName.trim(),
        // Only a date the user picked: if the page stayed open past midnight,
        // the default would silently backdate the invoice; the server knows "today".
        date: dateTouched ? date : undefined,
      });
      setCreated(invoice);
      setPartyName('');
      setDateValue(settings.today);
      setDateTouched(false);
      onSuccess();
    } catch (caught: unknown) {
      setError(caught);
    } finally {
      setSubmitting(false);
    }
  }

  return { partyName, setPartyName, date, setDate, submitting, error, created, submit };
}
