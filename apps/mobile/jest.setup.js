/* eslint-env jest */

// React 19 act reads this module to schedule its async drain. Under Node 22
// and Jest's clock switching, native Immediate callbacks can remain live but
// never execute. Use a captured real timer for that scheduler only; application
// globals still use Jest's fake clock and must be advanced explicitly in tests.
jest.mock('timers', () => {
  const nativeTimers = jest.requireActual('timers');
  const schedule = nativeTimers.setTimeout;
  const cancel = nativeTimers.clearTimeout;
  return {
    ...nativeTimers,
    setImmediate: (callback, ...args) => schedule(callback, 0, ...args),
    clearImmediate: handle => cancel(handle),
  };
});

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

// Capture the real renderer once. A failed cleanup must never make a later
// beforeEach wrap the previous tracking spy as though it were the renderer.
const ReactTestRenderer = require('react-test-renderer');
const createRenderer = ReactTestRenderer.create;
const {setImmediate: scheduleRealTurn} = require('timers');
let renderedTrees = [];
let rendererCreateSpy;
beforeEach(() => {
  rendererCreateSpy?.mockRestore();
  rendererCreateSpy = jest
    .spyOn(ReactTestRenderer, 'create')
    .mockImplementation((...args) => {
      const tree = createRenderer(...args);
      renderedTrees.push(tree);
      return tree;
    });
});
afterEach(async () => {
  const trees = renderedTrees;
  renderedTrees = [];
  try {
    // Unmount and effect disposal are synchronous. Awaiting this act thenable
    // adds a scheduler turn that can hang under a test's fake clock. Empty
    // suites have nothing to flush and must not open an act scope at all.
    if (trees.length > 0) {
      ReactTestRenderer.act(() => trees.forEach(tree => tree.unmount()));
    }
  } finally {
    rendererCreateSpy?.mockRestore();
    rendererCreateSpy = undefined;
  }
  // Drain cancellation promises on the real event loop, even if the test's
  // global clock is fake. No suspended act scope is retained across cases.
  if (trees.length > 0) await new Promise(resolve => scheduleRealTurn(resolve));
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

// Small explicit fixtures keep behavior regressions independent of content updates.
jest.mock('./src/learning/localCardSource', () => jest.requireActual('./__tests__/fixtures/interactionSource'));
