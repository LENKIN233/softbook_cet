/* eslint-env jest */

const listeners = new Set();

const NetInfo = {
  addEventListener: jest.fn(listener => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }),
  configure: jest.fn(),
  fetch: jest.fn(async () => ({
    isConnected: true,
    isInternetReachable: true,
  })),
  useNetInfo: jest.fn(() => ({
    isConnected: true,
    isInternetReachable: true,
  })),
};

function emitNetInfoState(state) {
  listeners.forEach(listener => listener(state));
}

function __reset() {
  listeners.clear();
  NetInfo.addEventListener.mockClear();
  NetInfo.configure.mockClear();
  NetInfo.fetch.mockClear();
  NetInfo.useNetInfo.mockClear();
}

module.exports = {
  __esModule: true,
  __reset,
  default: NetInfo,
  emitNetInfoState,
};
