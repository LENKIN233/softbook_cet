const baseConfig = require('./jest.config');

module.exports = {
  ...baseConfig,
  testMatch: [
    '<rootDir>/acceptance/audioBundleCandidate.mobileAcceptance.tsx',
  ],
  watchman: false,
};
