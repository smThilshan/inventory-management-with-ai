import { config } from 'dotenv';
import { resolve } from 'node:path';

/**
 * Forces e2e runs onto the isolated test database. `override` wins over any
 * DATABASE_URL already exported in the shell, so tests can never hit dev data.
 */
export function loadTestEnv(): void {
  config({
    path: resolve(__dirname, '../.env.test'),
    override: true,
    quiet: true,
  });
}
