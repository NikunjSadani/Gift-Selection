import type { Config } from 'jest';

const config: Config = {
  projects: [
    // ── Client: component + hook tests (jsdom, Next.js Babel transform) ───
    {
      displayName: 'client',
      preset: 'ts-jest',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/__tests__/client/**/*.test.{ts,tsx}'],
      setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '\\.(css|scss|png|jpg|jpeg|gif|svg|webp)$':
          '<rootDir>/__tests__/__mocks__/fileMock.ts',
      },
      transform: {
        '^.+\\.(ts|tsx)$': ['ts-jest', { tsconfig: { jsx: 'react-jsx' } }],
      },
    },
    // ── Server: API route + lib unit tests (node, ts-jest) ───────────────
    {
      displayName: 'server',
      preset: 'ts-jest',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/__tests__/server/**/*.test.ts'],
      moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
      },
      transform: {
        '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', useESM: true }],
        // Transform ESM-only node_modules (jose, etc.) through ts-jest/babel
        '^.+\\.js$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json', useESM: true }],
      },
      // Allow Jest to transform ESM packages that are not transpiled to CJS
      transformIgnorePatterns: [
        '/node_modules/(?!(jose|@panva|oidc-token-hash)/)',
      ],
      extensionsToTreatAsEsm: ['.ts'],
    },
  ],
};

export default config;
