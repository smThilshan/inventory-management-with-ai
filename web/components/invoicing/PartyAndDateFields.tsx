import { useId } from 'react';
import {
  COUNTERPARTY_NAME_MAX_LENGTH,
  COUNTERPARTY_NAME_MIN_LENGTH,
} from '@/lib/constants';
import { inputClass, labelClass } from '@/lib/ui';

interface PartyAndDateFieldsProps {
  /** "Supplier" or "Customer". */
  partyLabel: string;
  partyName: string;
  onPartyNameChange: (value: string) => void;
  date: string;
  onDateChange: (value: string) => void;
  /** Business "today" from the server: invoices cannot be dated in the future. */
  maxDate: string;
}

export function PartyAndDateFields({
  partyLabel,
  partyName,
  onPartyNameChange,
  date,
  onDateChange,
  maxDate,
}: PartyAndDateFieldsProps) {
  const ids = useId();
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="space-y-1.5 sm:col-span-2">
        <label htmlFor={`${ids}-party`} className={labelClass}>
          {partyLabel}
        </label>
        <input
          id={`${ids}-party`}
          type="text"
          required
          minLength={COUNTERPARTY_NAME_MIN_LENGTH}
          maxLength={COUNTERPARTY_NAME_MAX_LENGTH}
          value={partyName}
          onChange={(e) => onPartyNameChange(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="space-y-1.5">
        <label htmlFor={`${ids}-date`} className={labelClass}>
          Invoice date
        </label>
        <input
          id={`${ids}-date`}
          type="date"
          required
          max={maxDate}
          value={date}
          onChange={(e) => onDateChange(e.target.value)}
          className={inputClass}
        />
      </div>
    </div>
  );
}
