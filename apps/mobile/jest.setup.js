/* eslint-env jest */

jest.mock('@react-native-async-storage/async-storage');
jest.mock('@react-native-community/netinfo');
jest.mock('react-native-keychain');
jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    config: jest.fn(),
    fs: {
      dirs: {CacheDir: '/tmp/softbook-test-cache'},
      exists: jest.fn(),
      hash: jest.fn(),
      mkdir: jest.fn(),
      mv: jest.fn(),
      stat: jest.fn(),
      unlink: jest.fn(),
    },
  },
}));

beforeEach(async () => {
  const AsyncStorage =
    require('@react-native-async-storage/async-storage').default;
  const NetInfo = require('@react-native-community/netinfo');
  const Keychain = require('react-native-keychain');

  if (typeof AsyncStorage.clear === 'function') {
    await AsyncStorage.clear();
  }

  if (typeof NetInfo.__reset === 'function') {
    NetInfo.__reset();
  }

  if (typeof Keychain.__reset === 'function') {
    Keychain.__reset();
  }
});
