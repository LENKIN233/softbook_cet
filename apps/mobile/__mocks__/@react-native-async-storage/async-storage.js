/* eslint-env jest */

let store = {};

const AsyncStorage = {
  clear: jest.fn(async () => {
    store = {};
  }),
  getAllKeys: jest.fn(async () => Object.keys(store)),
  getItem: jest.fn(async key => (key in store ? store[key] : null)),
  removeItem: jest.fn(async key => {
    delete store[key];
  }),
  setItem: jest.fn(async (key, value) => {
    store[key] = value;
  }),
};

module.exports = {
  __esModule: true,
  default: AsyncStorage,
};
