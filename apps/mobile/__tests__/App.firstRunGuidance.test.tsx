import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import App from '../App';
import { LearningSurface } from '../src/learning/LearningSurface';
import { createAuthSessionStore } from '../src/persistence/authSessionStore';
import {
  FIRST_RUN_GUIDANCE_KEY,
  createFirstRunGuidanceStore,
} from '../src/onboarding/firstRunGuidanceStore';
import { createLocalLearningSession } from './fixtures/interactionSession';
import { createSoftbookRemoteRuntimeConfig } from '../src/runtime/appRuntimeConfig';
import { MutationQueueManager } from '../src/sync/mutationQueue';
import { createReactNativeMutationQueueStorage } from '../src/sync/mutationQueueStorage.native';
import { getChinaDayKey } from '../src/shared/chinaDay';

const mockLoadSession = jest.fn();
const mockRealRemote = { enabled: false };
jest.mock('../src/learning/learningRepository', () => ({
  createLearningSessionRepository: (config: unknown) =>
    mockRealRemote.enabled
      ? jest
          .requireActual('../src/learning/learningRepository')
          .createLearningSessionRepository(config)
      : { loadSession: mockLoadSession },
}));
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) =>
      mockReact.createElement(View, null, children),
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      mockReact.createElement(View, null, children),
  };
});
async function settle() {
  for (let i = 0; i < 8; i++)
    await act(async () => {
      for (let n = 0; n < 30; n++) await Promise.resolve();
    });
}
async function mount() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });
  await settle();
  return tree;
}
async function press(tree: ReactTestRenderer.ReactTestRenderer, id: string) {
  if (id.startsWith('route-tab-') && !tree.root.findAllByProps({testID:id}).length) {
    await press(tree, 'learning-pause-button');
  }
  await act(async () => {
    tree.root
      .findAllByProps({ testID: id })
      .find(node => typeof node.props.onPress === 'function')!
      .props.onPress();
  });
  await settle();
}
beforeEach(async () => {
  await AsyncStorage.removeItem(FIRST_RUN_GUIDANCE_KEY);
  global.__SOFTBOOK_CET_RUNTIME_CONFIG__ = undefined;
  mockLoadSession.mockReset();
  mockRealRemote.enabled = false;
  mockLoadSession.mockImplementation(async (_context, track) =>
    createLocalLearningSession(track),
  );
});
afterEach(() => {
  jest.restoreAllMocks();
  global.__SOFTBOOK_CET_RUNTIME_CONFIG__ = undefined;
});

test('first open has no default and cannot dismiss the subject choice or enter login', async () => {
  const tree = await mount();
  const root = tree.root;
  expect(
    root.findByProps({ testID: 'first-subject-cet4' }).props.accessibilityState
      .selected,
  ).toBe(false);
  expect(
    root.findByProps({ testID: 'first-subject-cet6' }).props.accessibilityState
      .selected,
  ).toBe(false);
  expect(
    root.findByProps({ testID: 'first-subject-continue' }).props.disabled,
  ).toBe(true);
  expect(root.findAllByProps({ testID: 'auth-phone-input' })).toHaveLength(0);
  expect(
    root.findAllByProps({ testID: 'local-start-learning-button' }),
  ).toHaveLength(0);
  expect(mockLoadSession).not.toHaveBeenCalled();
  await act(() => root.findByType(Modal).props.onRequestClose());
  expect(root.findByProps({ testID: 'first-subject-modal' })).toBeTruthy();
  expect(JSON.stringify(tree.toJSON())).toContain('我的 → 备考科目');
});

test('choosing six applies before learning, short guide appears once and survives restart', async () => {
  let tree = await mount();
  await press(tree, 'first-subject-cet6');
  expect(mockLoadSession).not.toHaveBeenCalled();
  await press(tree, 'first-subject-continue');
  expect(await createFirstRunGuidanceStore().load()).toEqual({
    version: 1,
    selectedTrack: 'cet6',
    learningGuideSeen: false,
  });
  await press(tree, 'local-start-learning-button');
  expect(mockLoadSession).toHaveBeenLastCalledWith(expect.anything(), 'cet6');
  expect(
    tree.root.findByProps({ testID: 'first-learning-guide-modal' }),
  ).toBeTruthy();
  expect(tree.root.findByType(LearningSurface).props.currentCard.track).toBe(
    'cet6',
  );
  await press(tree, 'first-learning-guide-start');
  expect(
    tree.root.findAllByProps({ testID: 'first-learning-guide-modal' }),
  ).toHaveLength(0);
  await act(() => tree.unmount());
  tree = await mount();
  expect(
    tree.root.findAllByProps({ testID: 'first-subject-modal' }),
  ).toHaveLength(0);
  expect(mockLoadSession).toHaveBeenLastCalledWith(expect.anything(), 'cet6');
  expect(
    tree.root.findAllByProps({ testID: 'first-learning-guide-modal' }),
  ).toHaveLength(0);
});

test('old signed-in installations choose once without clearing their session or retained outbox', async () => {
  await createAuthSessionStore().save({
    mode: 'local',
    phoneNumber: '00000000000',
  });
  await AsyncStorage.setItem(
    '__softbook_learning_event_outbox_v2',
    'retained-before-onboarding',
  );
  const readsBefore = jest.mocked(Keychain.getGenericPassword).mock.calls
    .length;
  const tree = await mount();
  expect(jest.mocked(Keychain.getGenericPassword).mock.calls).toHaveLength(
    readsBefore,
  );
  expect(mockLoadSession).not.toHaveBeenCalled();
  await press(tree, 'first-subject-cet6');
  await press(tree, 'first-subject-continue');
  expect(mockLoadSession).toHaveBeenLastCalledWith(expect.anything(), 'cet6');
  expect(
    await AsyncStorage.getItem('__softbook_learning_event_outbox_v2'),
  ).toBe('retained-before-onboarding');
  expect(await createAuthSessionStore().load()).toEqual({
    mode: 'local',
    phoneNumber: '00000000000',
  });
});

test('failed preference read blocks and offers retry without guessing a subject', async () => {
  const read = jest.mocked(AsyncStorage.getItem);
  const original = read.getMockImplementation()!;
  read.mockImplementation(async key => {
    if (key === FIRST_RUN_GUIDANCE_KEY) throw new Error('unreadable');
    return original(key);
  });
  const tree = await mount();
  expect(tree.root.findByProps({ testID: 'first-subject-error' })).toBeTruthy();
  expect(mockLoadSession).not.toHaveBeenCalled();
  read.mockImplementation(original);
  await press(tree, 'first-subject-retry');
  expect(
    tree.root.findByProps({ testID: 'first-subject-continue' }).props.disabled,
  ).toBe(true);
  await press(tree, 'first-subject-cet4');
  await press(tree, 'first-subject-continue');
  expect(
    tree.root.findByProps({ testID: 'local-start-learning-button' }),
  ).toBeTruthy();
});

test('failed preference save retains choice and modal until retry succeeds', async () => {
  const tree = await mount();
  const write = jest.mocked(AsyncStorage.setItem);
  const original = write.getMockImplementation()!;
  write.mockImplementation(async (key, value) => {
    if (key === FIRST_RUN_GUIDANCE_KEY) throw new Error('no space');
    return original(key, value);
  });
  await press(tree, 'first-subject-cet6');
  await press(tree, 'first-subject-continue');
  expect(
    tree.root.findByProps({ testID: 'first-subject-cet6' }).props
      .accessibilityState.selected,
  ).toBe(true);
  expect(tree.root.findByProps({ testID: 'first-subject-error' })).toBeTruthy();
  expect(mockLoadSession).not.toHaveBeenCalled();
  write.mockImplementation(original);
  await press(tree, 'first-subject-continue');
  expect(await createFirstRunGuidanceStore().load()).toMatchObject({
    selectedTrack: 'cet6',
  });
});

test('corrupt or unverified preferences remain recoverable and are never overwritten by a default', async () => {
  await AsyncStorage.setItem(FIRST_RUN_GUIDANCE_KEY, '{unreadable');
  const tree = await mount();
  expect(tree.root.findByProps({ testID: 'first-subject-retry' })).toBeTruthy();
  expect(await AsyncStorage.getItem(FIRST_RUN_GUIDANCE_KEY)).toBe(
    '{unreadable',
  );
  expect(mockLoadSession).not.toHaveBeenCalled();
});

test.each([false, true])(
  'normal authenticated runtime restores six and explicit invalid-marker recovery=%s',
  async invalidMarker => {
    const {
      createMemoryStore,
      createSoftbookApi,
    } = require('../../../infra/cloudbase/functions/softbook-api/test/fixtures/api.js');
    const api = createSoftbookApi({
      authV2AcknowledgementSleeper: async () => undefined,
      authV2IndexSecret: 'softbook-cloudbase-dev-secret',
      runtimeMode: 'development',
      store: createMemoryStore(),
      tokenSecret: 'isolated-first-run-auth-secret',
    });
    const originalFetch = global.fetch;
    const requests = jest.fn(async (input: string, init?: RequestInit) => {
      const url = new URL(input);
      const result = await api.handleHttpRequest({
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
        clientIp: '203.0.113.89',
        headers: Object.fromEntries(new Headers(init?.headers)),
        method: init?.method ?? 'GET',
        path: url.pathname,
        query: Object.fromEntries(url.searchParams),
      });
      return {
        json: async () => result.body,
        ok: result.statusCode < 400,
        status: result.statusCode,
      } as Response;
    });
    global.fetch = requests as typeof fetch;
    mockRealRemote.enabled = true;
    global.__SOFTBOOK_CET_RUNTIME_CONFIG__ = createSoftbookRemoteRuntimeConfig({
      baseUrl: 'https://api.softbook.example',
      featureModes: { contentManifest: 'local' },
    });
    try {
      if (invalidMarker)
        await AsyncStorage.setItem(FIRST_RUN_GUIDANCE_KEY, '{unreadable');
      let tree = await mount();
      expect(requests).not.toHaveBeenCalled();
      if (invalidMarker) {
        expect(await AsyncStorage.getItem(FIRST_RUN_GUIDANCE_KEY)).toBe(
          '{unreadable',
        );
        await press(tree, 'first-subject-retry');
        expect(
          tree.root.findByProps({ testID: 'first-subject-continue' }).props
            .disabled,
        ).toBe(true);
        expect(await AsyncStorage.getItem(FIRST_RUN_GUIDANCE_KEY)).toBe(
          '{unreadable',
        );
      }
      await press(tree, 'first-subject-cet6');
      await press(tree, 'first-subject-continue');
      await act(() =>
        tree.root
          .findByProps({ testID: 'auth-phone-input' })
          .props.onChangeText('13800138000'),
      );
      await press(tree, 'auth-request-code-button');
      await act(() =>
        tree.root
          .findByProps({ testID: 'auth-code-input' })
          .props.onChangeText('2468'),
      );
      await press(tree, 'auth-submit-button');
      expect(
        tree.root.findByType(LearningSurface).props.currentCard.track,
      ).toBe('cet6');
      expect(
        requests.mock.calls.some(
          ([url]) =>
            url.includes('/v2/bootstrap?') &&
            new URL(url).searchParams.get('track') === 'cet6',
        ),
      ).toBe(true);
      await press(tree, 'first-learning-guide-start');
      await act(() => tree.unmount());
      requests.mockClear();
      tree = await mount();
      expect(
        tree.root.findAllByProps({ testID: 'first-subject-modal' }),
      ).toHaveLength(0);
      expect(
        tree.root.findByType(LearningSurface).props.currentCard.track,
      ).toBe('cet6');
      expect(
        requests.mock.calls.some(([url]) =>
          url.includes('/v2/auth/verify-code'),
        ),
      ).toBe(false);
      expect(
        tree.root.findAllByProps({ testID: 'first-learning-guide-modal' }),
      ).toHaveLength(0);
      // An older installation may already have a valid account but no new marker.
      // It chooses once before any canonical reads and retains that account.
      await act(() => tree.unmount());
      await AsyncStorage.removeItem(FIRST_RUN_GUIDANCE_KEY);
      const savedSession = await createAuthSessionStore().load();
      if (savedSession?.mode !== 'remote')
        throw new Error('Expected retained account');
      const queue = new MutationQueueManager({
        storage: createReactNativeMutationQueueStorage(),
      });
      await queue.enqueue(
        'check_in_daily_progress',
        {
          context: {
            phoneNumber: savedSession.phoneNumber,
            authToken: savedSession.accessToken,
          },
          dayKey: getChinaDayKey(),
        },
        'pending_before_onboarding',
      );
      const retainedQueue = await AsyncStorage.getItem(
        '__softbook_mutation_queue',
      );
      requests.mockClear();
      tree = await mount();
      expect(requests).not.toHaveBeenCalled();
      expect(
        tree.root.findByProps({ testID: 'first-subject-modal' }),
      ).toBeTruthy();
      await press(tree, 'first-subject-cet4');
      await press(tree, 'first-subject-continue');
      expect(
        tree.root.findByProps({ testID: 'first-subject-modal' }),
      ).toBeTruthy();
      expect(JSON.stringify(tree.toJSON())).toContain('六级记录等待同步');
      expect(await AsyncStorage.getItem('__softbook_mutation_queue')).toBe(
        retainedQueue,
      );
      expect(await AsyncStorage.getItem(FIRST_RUN_GUIDANCE_KEY)).toBeNull();
      expect(requests).not.toHaveBeenCalled();
      await press(tree, 'first-subject-cet6');
      await press(tree, 'first-subject-continue');
      expect(
        tree.root.findByType(LearningSurface).props.currentCard.track,
      ).toBe('cet6');
      expect(
        requests.mock.calls.some(([url]) =>
          url.includes('/v2/auth/verify-code'),
        ),
      ).toBe(false);
      await press(tree, 'first-learning-guide-start');
      await press(tree, 'route-tab-mine');
      await press(tree, 'mine-account-logout-button');
      expect(await createFirstRunGuidanceStore().load()).toMatchObject({
        selectedTrack: 'cet6',
        learningGuideSeen: true,
      });
    } finally {
      global.fetch = originalFetch;
    }
  },
);
