import { Transform } from 'class-transformer';

/** Trims string input before validation, so "   " fails @IsNotEmpty. */
export const Trim = (): PropertyDecorator =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
