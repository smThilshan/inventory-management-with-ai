import { render, screen } from '@testing-library/react';
import { NavBar } from './NavBar';

let pathname = '/';
jest.mock('next/navigation', () => ({ usePathname: () => pathname }));

describe('NavBar', () => {
  it.each([
    ['/', 'Inventory'],
    ['/purchases', 'Purchases'],
    ['/sales', 'Sales'],
    ['/invoices', 'Invoices'],
  ])('on %s marks "%s" as the current page', (path, label) => {
    pathname = path;
    render(<NavBar />);

    expect(screen.getByRole('link', { name: label })).toHaveAttribute('aria-current', 'page');
    expect(screen.getAllByRole('link').filter((l) => l.hasAttribute('aria-current'))).toHaveLength(1);
  });
});
