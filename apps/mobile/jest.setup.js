/* eslint-env jest */

jest.mock('@react-native-async-storage/async-storage');
jest.mock('@react-native-community/netinfo');

beforeEach(async () => {
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  const NetInfo = require('@react-native-community/netinfo');

  if (typeof AsyncStorage.clear === 'function') {
    await AsyncStorage.clear();
  }

  if (typeof NetInfo.__reset === 'function') {
    NetInfo.__reset();
  }
});
