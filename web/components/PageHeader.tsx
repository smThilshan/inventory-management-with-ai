import type { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description: string;
  /** Right-aligned slot, e.g. the live connection status. */
  aside?: ReactNode;
}

export function PageHeader({ title, description, aside }: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      {aside}
    </header>
  );
}
