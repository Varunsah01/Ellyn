const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const integrationJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  moduleNameMapper: {
    '^@/components/(.*)$': '<rootDir>/components/$1',
    '^@/lib/(.*)$': '<rootDir>/lib/$1',
    '^@/app/(.*)$': '<rootDir>/app/$1',
    '^@/hooks/(.*)$': '<rootDir>/hooks/$1',
  },
  testMatch: ['<rootDir>/tests/integration/**/*.test.{js,jsx,ts,tsx}'],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  collectCoverageFrom: [
    'app/api/contacts/route.ts',
    'app/api/contacts/*/route.ts',
    'app/api/leads/route.ts',
    'app/api/leads/*/route.ts',
    'app/api/auth/signup/route.ts',
    'app/api/auth/change-password/route.ts',
    'app/api/ai/generate-template/route.ts',
    '!**/*.d.ts',
  ],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

module.exports = createJestConfig(integrationJestConfig);
