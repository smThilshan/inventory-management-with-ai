import { execSync } from 'node:child_process';
import { resolve } from 'node:path';
import { loadTestEnv } from './load-test-env';

/** Runs once before all e2e suites: brings the test DB schema up to date. */
export default function globalSetup(): void {
  loadTestEnv();
  execSync('npx prisma migrate deploy', {
    cwd: resolve(__dirname, '..'),
    env: process.env,
    stdio: 'pipe',
  });
}
