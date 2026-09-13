/* eslint-env jest */

jest.mock('@react-native-async-storage/async-storage');
jest.mock('@react-native-community/netinfo');
jest.mock('react-native-keychain');
jest.mock('react-native-blob-util', () => ({
  __esModule: true,
  default: {
    config: jest.fn(),
    fs: {
      dirs: { CacheDir: '/tmp/softbook-test-cache' },
      exists: jest.fn(),
      hash: jest.fn(),
      mkdir: jest.fn(),
      mv: jest.fn(),
      stat: jest.fn(),
      unlink: jest.fn(),
    },
  },
}));

// Every rendered tree owns subscriptions and timers. Dispose them after each
// case so authentication countdowns and native listeners cannot outlive tests.
let renderedTrees = [];
let rendererCreateSpy;
beforeEach(() => {
  const ReactTestRenderer = require('react-test-renderer');
  const create = ReactTestRenderer.create;
  rendererCreateSpy = jest
    .spyOn(ReactTestRenderer, 'create')
    .mockImplementation((...args) => {
      const tree = create(...args);
      renderedTrees.push(tree);
      return tree;
    });
});
afterEach(async () => {
  const ReactTestRenderer = require('react-test-renderer');
  const trees = renderedTrees;
  renderedTrees = [];
  await ReactTestRenderer.act(() => trees.forEach(tree => tree.unmount()));
  rendererCreateSpy.mockRestore();
});

beforeEach(async () => {
  const { AccessibilityInfo, Dimensions } = require('react-native');
  // Domain regressions use the direct reduced-motion path. Normal-motion
  // cancellation and single-commit behavior are exercised in NativeMotion.test.
  jest
    .spyOn(AccessibilityInfo, 'isReduceMotionEnabled')
    .mockResolvedValue(true);
  const AsyncStorage =
    require('@react-native-async-storage/async-storage').default;
  const NetInfo = require('@react-native-community/netinfo');
  const Keychain = require('react-native-keychain');

  Dimensions.set({
    screen: { fontScale: 1, height: 852, scale: 1, width: 393 },
    window: { fontScale: 1, height: 852, scale: 1, width: 393 },
  });

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
