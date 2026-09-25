import nextJest from 'next/jest.js';

// next/jest wires up the SWC transform, CSS/asset mocks and next.config.
const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/test/env.ts'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
};

export default createJestConfig(config);
