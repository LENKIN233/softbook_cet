module.exports = {
  preset: '@react-native/jest-preset',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/ios/Pods/'],
  transformIgnorePatterns: [
    // The App recovery integration exercises the untranspiled Node service.
    '/infra/cloudbase/functions/softbook-api/',
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|@noble/(ed25519|hashes))/)',
  ],
};
