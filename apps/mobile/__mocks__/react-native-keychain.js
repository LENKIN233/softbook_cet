/* eslint-env jest */

let credentials = false;

const keychain = {
  ACCESSIBLE: {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY:
      'AccessibleAfterFirstUnlockThisDeviceOnly',
  },
  __reset: jest.fn(() => {
    credentials = false;
  }),
  __setCredentials: jest.fn(value => {
    credentials = value;
  }),
  getGenericPassword: jest.fn(async () => credentials),
  resetGenericPassword: jest.fn(async () => {
    credentials = false;
    return true;
  }),
  setGenericPassword: jest.fn(async (username, password, options = {}) => {
    credentials = {
      password,
      service: options.service,
      username,
    };

    return {
      service: options.service,
      storage: 'mock',
    };
  }),
};

module.exports = keychain;
