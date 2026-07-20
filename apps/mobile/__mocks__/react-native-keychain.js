/* eslint-env jest */

let credentialsByService = new Map();

function resolveService(options = {}) {
  return options.service ?? '__default__';
}

const keychain = {
  ACCESSIBLE: {
    AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY:
      'AccessibleAfterFirstUnlockThisDeviceOnly',
  },
  __reset: jest.fn(() => {
    credentialsByService = new Map();
  }),
  __setCredentials: jest.fn(value => {
    const service = value && value.service ? value.service : '__default__';
    credentialsByService.set(service, value);
  }),
  getGenericPassword: jest.fn(async options => {
    return credentialsByService.get(resolveService(options)) ?? false;
  }),
  resetGenericPassword: jest.fn(async options => {
    credentialsByService.delete(resolveService(options));
    return true;
  }),
  setGenericPassword: jest.fn(async (username, password, options = {}) => {
    const credentials = {
      password,
      service: options.service,
      username,
    };
    credentialsByService.set(resolveService(options), credentials);

    return {
      service: options.service,
      storage: 'mock',
    };
  }),
};

module.exports = keychain;
