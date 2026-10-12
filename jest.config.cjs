/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  setupFiles: ['<rootDir>/src/tests/setup-env.cjs'],
  transform: {
    '^.+\\.js$': 'babel-jest'
  },
  transformIgnorePatterns: []
};
