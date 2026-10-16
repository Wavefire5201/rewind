// A fixed zone west of UTC (this machine's), so a UTC-vs-local date mixup fails on every
// run. CI runners are UTC, where such a bug can't show. A test can't switch zones itself:
// each test file gets its own copy of process.env.
process.env.TZ = 'America/Chicago';

module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['**/__tests__/**/*.test.[jt]s?(x)'],
  collectCoverageFrom: [
    'utils/**/*.ts',
    'hooks/**/*.ts',
    '!**/node_modules/**',
    '!**/__tests__/**',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 65,
      lines: 70,
      statements: 70,
    },
  },
};
