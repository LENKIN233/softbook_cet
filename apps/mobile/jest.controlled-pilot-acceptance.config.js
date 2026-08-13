const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  testMatch: ['<rootDir>/acceptance/**/*.acceptance.tsx'],
  watchman: false,
};
