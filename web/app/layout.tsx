import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { NavBar } from '@/components/NavBar';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Inventory · Stock Tracker', template: '%s · Stock Tracker' },
  description: 'Live stock levels, purchases, sales and invoices',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
        <NavBar />
        {children}
      </body>
    </html>
  );
}
