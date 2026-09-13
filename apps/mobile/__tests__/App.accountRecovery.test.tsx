import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { AppState, AccessibilityInfo } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';

import App from '../App';
import {
  ACCOUNT_LOGOUT_CLEANUP_STORAGE_KEY,
  createAccountLogoutCleanupStore,
} from '../src/account/accountDeletionCleanupStore';
import {
  ACCOUNT_DELETION_RECOVERY_STORAGE_KEY,
  createAccountDeletionRecoveryStore,
} from '../src/account/accountDeletionRecoveryStore';
import { USER_STATE_STORAGE_KEY } from '../src/persistence/userStateStore';
import { createSoftbookRemoteRuntimeConfig } from '../src/runtime/appRuntimeConfig';
import { LearningEventOutbox, LEARNING_EVENT_OUTBOX_STORAGE_KEY } from '../src/sync/learningEventOutbox';
import { createReactNativeLearningEventOutboxStorage } from '../src/sync/learningEventOutboxStorage.native';

jest.mock('../src/learning/learningRepository', () => ({
  createLearningSessionRepository: () => ({
    loadSession: async () =>
      require('../src/learning/session').createLocalLearningSession('cet4'),
  }),
}));
jest.mock('react-native-safe-area-context', () => {
  const mockReact = require('react');
  const { View } = require('react-native');
  return {
    SafeAreaView: ({ children }: { children: React.ReactNode }) =>
      mockReact.createElement(View, null, children),
    SafeAreaProvider: ({ children }: { children: React.ReactNode }) =>
      mockReact.createElement(View, null, children),
  };
});

// This suite includes real service integration. Resolve its locked dependencies
// before any tests or fake-clock setup so missing fixtures fail the suite early.
const {createMemoryStore, createSoftbookApi} =
  require('../../../infra/cloudbase/functions/softbook-api/index.js');

const PHONE = '13800138000';
const AUTH_SERVICE = 'com.softbook.cet.auth-session.v2';
type FetchInit = {
  body?: string;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};
const mockFetch = jest.fn();
let originalFetch: typeof global.fetch;

function response(data: unknown, status = 200) {
  return { json: async () => data, ok: status >= 200 && status < 300, status };
}
function challenge(id = 'challenge_first', retryAfterSeconds = 120) {
  return response({
    data: {
      challenge_id: id,
      expires_at: new Date(Date.now() + 300_000).toISOString(),
      retry_after_seconds: retryAfterSeconds,
    },
  });
}
function session() {
  return response({
    data: {
      access_token: 'account-recovery-access',
      expires_in: 900,
      phone_number: PHONE,
      refresh_expires_at: new Date(Date.now() + 86_400_000).toISOString(),
      refresh_token: 'account-recovery-refresh',
      session_id: 'account-recovery-session',
      token_type: 'Bearer',
    },
  });
}
function deletionAccepted() {
  return response(
    {
      data: {
        deletion_request: {
          id: 'delete_account_recovery_12345',
          requested_at: new Date().toISOString(),
          status: 'queued',
        },
      },
    },
    202,
  );
}
async function settle() {
  for (let i = 0; i < 60; i += 1) await Promise.resolve();
}
function button(root: ReactTestRenderer.ReactTestInstance, testID: string) {
  const found = root
    .findAllByProps({ testID })
    .find(node => typeof node.props.onPress === 'function');
  if (!found) throw new Error(`Missing ${testID}`);
  return found;
}
async function press(
  root: ReactTestRenderer.ReactTestInstance,
  testID: string,
) {
  await ReactTestRenderer.act(async () => {
    button(root, testID).props.onPress();
    await settle();
  });
}
async function mount() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
    await settle();
  });
  return tree;
}
async function enterPhone(
  root: ReactTestRenderer.ReactTestInstance,
  phone = PHONE,
) {
  await ReactTestRenderer.act(async () => {
    root.findByProps({ testID: 'auth-phone-input' }).props.onChangeText(phone);
    await settle();
  });
}
async function enterCode(root: ReactTestRenderer.ReactTestInstance) {
  await ReactTestRenderer.act(() => {
    root
      .findByProps({ testID: 'auth-code-input' })
      .props.onChangeText('654321');
  });
}
async function login(root: ReactTestRenderer.ReactTestInstance) {
  await enterPhone(root);
  await press(root, 'auth-request-code-button');
  await enterCode(root);
  await press(root, 'auth-submit-button');
  await press(root, 'route-tab-mine');
}
function requestCalls() {
  return mockFetch.mock.calls.filter(([url]) =>
    url.endsWith('/auth/request-code'),
  );
}

beforeEach(() => {
  originalFetch = global.fetch;
  global.fetch = mockFetch;
  mockFetch.mockReset();
  mockFetch.mockImplementation(async (url: string) => {
    if (url.endsWith('/auth/request-code')) return challenge();
    if (url.endsWith('/auth/verify-code')) return session();
    if (url.endsWith('/auth/logout')) return response(null, 204);
    if (url.endsWith('/account/deletion')) return deletionAccepted();
    throw new Error(`Unexpected request: ${url}`);
  });
  global.__SOFTBOOK_CET_RUNTIME_CONFIG__ = createSoftbookRemoteRuntimeConfig({
    baseUrl: 'https://api.softbook.example',
    featureModes: {
      accountBootstrap: 'local',
      contentManifest: 'local',
      learningSource: 'local',
      learningState: 'local',
      membership: 'local',
      progressSync: 'local',
      spaceState: 'local',
    },
  });
});
// jest.setup owns tree disposal before this suite restores timers and globals.
afterEach(() => {
  global.fetch = originalFetch;
  global.__SOFTBOOK_CET_RUNTIME_CONFIG__ = undefined;
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('closing an unknown deletion retains its original credentials and safe retry', async () => {
  let calls = 0;
  const ordinaryFetch = mockFetch.getMockImplementation()!;
  mockFetch.mockImplementation(async (url: string, init?: FetchInit) => {
    if (url.endsWith('/account/deletion')) {
      calls += 1;
      if (calls === 1)
        throw new Error('Response lost after request reached server');
      expect(init?.headers?.Authorization).toBe(
        'Bearer account-recovery-access',
      );
      return deletionAccepted();
    }
    return ordinaryFetch(url, init);
  });
  const tree = await mount();
  await login(tree.root);
  await press(tree.root, 'mine-account-delete-button');
  await press(tree.root, 'account-deletion-submit-button');
  expect(
    tree.root.findByProps({ testID: 'account-deletion-recoverable_unknown' }),
  ).toBeTruthy();
  await press(tree.root, 'account-deletion-cancel-button');
  expect(
    tree.root.findByProps({ testID: 'account-deletion-unknown-screen' }),
  ).toBeTruthy();
  expect(tree.root.findAllByProps({ testID: 'auth-phone-input' })).toHaveLength(
    0,
  );
  expect(
    tree.root.findAllByProps({ testID: 'mine-account-logout-button' }),
  ).toHaveLength(0);
  expect(await Keychain.getGenericPassword({ service: AUTH_SERVICE })).not.toBe(
    false,
  );
  await press(tree.root, 'account-deletion-unknown-retry-button');
  await press(tree.root, 'account-deletion-submit-button');
  expect(calls).toBe(2);
  expect(
    tree.root.findByProps({ testID: 'account-deletion-accepted-screen' }),
  ).toBeTruthy();
  expect(
    mockFetch.mock.calls.some(([url]) => url.endsWith('/auth/refresh')),
  ).toBe(false);
});

test.each(['user_state', 'outbox', 'mutation_queue', 'auth'] as const)(
  'logout keeps a durable retry after %s cleanup fails, then completes after restart',
  async target => {
    const tree = await mount();
    await login(tree.root);
    const remove = jest.mocked(AsyncStorage.removeItem);
    const removeImplementation = remove.getMockImplementation()!;
    const set = jest.mocked(AsyncStorage.setItem);
    const setImplementation = set.getMockImplementation()!;
    const reset = jest.mocked(Keychain.resetGenericPassword);
    const resetImplementation = reset.getMockImplementation()!;
    let fail = true;
    remove.mockImplementation(key => {
      if (fail && target === 'user_state' && key === USER_STATE_STORAGE_KEY) {
        return Promise.reject(new Error('Storage unavailable'));
      }
      return removeImplementation(key);
    });
    set.mockImplementation((key, value) => {
      if (
        fail &&
        ((target === 'outbox' && key === LEARNING_EVENT_OUTBOX_STORAGE_KEY) ||
          (target === 'mutation_queue' &&
            key.startsWith('__softbook_mutation_queue')))
      ) {
        return Promise.reject(new Error('Storage unavailable'));
      }
      return setImplementation(key, value);
    });
    reset.mockImplementation(options =>
      fail && target === 'auth'
        ? Promise.reject(new Error('Keychain unavailable'))
        : resetImplementation(options),
    );
    try {
      await press(tree.root, 'mine-account-logout-button');
      expect(
        tree.root.findByProps({ testID: 'account-logout-cleanup-screen' }),
      ).toBeTruthy();
      expect(
        tree.root.findAllByProps({ testID: 'auth-phone-input' }),
      ).toHaveLength(0);
      expect(
        await AsyncStorage.getItem(ACCOUNT_LOGOUT_CLEANUP_STORAGE_KEY),
      ).toContain(PHONE);
      expect(JSON.stringify(tree.toJSON())).not.toContain('删除申请已接收');
      await ReactTestRenderer.act(() => tree.unmount());
      const restored = await mount();
      expect(
        restored.root.findByProps({ testID: 'account-logout-cleanup-screen' }),
      ).toBeTruthy();
      expect(
        restored.root.findAllByProps({ testID: 'auth-phone-input' }),
      ).toHaveLength(0);
      fail = false;
      await press(restored.root, 'account-logout-cleanup-retry-button');
      expect(
        restored.root.findByProps({ testID: 'auth-phone-input' }),
      ).toBeTruthy();
      expect(
        await AsyncStorage.getItem(ACCOUNT_LOGOUT_CLEANUP_STORAGE_KEY),
      ).toBeNull();
      expect(await AsyncStorage.getItem(USER_STATE_STORAGE_KEY)).toBeNull();
      expect(await Keychain.getGenericPassword({ service: AUTH_SERVICE })).toBe(
        false,
      );
    } finally {
      remove.mockImplementation(removeImplementation);
      set.mockImplementation(setImplementation);
      reset.mockImplementation(resetImplementation);
    }
  },
);

test('late logout from an unmounted App cannot clear a newly authenticated same-phone account', async () => {
  const oldTree = await mount();
  await login(oldTree.root);
  let resolveLogout!: (value: ReturnType<typeof response>) => void;
  const delayed = new Promise<ReturnType<typeof response>>(resolve => {resolveLogout = resolve;});
  const ordinary = mockFetch.getMockImplementation()!;
  mockFetch.mockImplementation((url: string, init?: FetchInit) =>
    url.endsWith('/auth/logout') ? delayed : ordinary(url, init),
  );
  await press(oldTree.root, 'mine-account-logout-button');
  expect(await createAccountLogoutCleanupStore().load()).toEqual({phoneNumber: PHONE});
  expect(mockFetch.mock.calls.some(([url]) => url.endsWith('/auth/logout'))).toBe(true);
  await ReactTestRenderer.act(() => oldTree.unmount());
  mockFetch.mockImplementation(async (url: string, init?: FetchInit) => {
    if (url.endsWith('/auth/verify-code')) {
      const value = await session().json() as {data: Record<string, unknown>};
      return response({data: {...value.data, access_token: 'new-lifecycle-access', refresh_token: 'new-lifecycle-refresh', session_id: 'new-lifecycle-session'}});
    }
    return ordinary(url, init);
  });
  const restored = await mount();
  // Native cleanup already owns IO: the next mount stays in recovery until
  // that owner settles instead of logging in ahead of an outstanding erase.
  expect(restored.root.findAllByProps({testID: 'auth-phone-input'})).toHaveLength(0);
  expect(await createAccountLogoutCleanupStore().load()).toEqual({phoneNumber: PHONE});
  await ReactTestRenderer.act(async () => {
    resolveLogout(response(null, 204));
    await settle();
  });
  expect(await createAccountLogoutCleanupStore().load()).toBeNull();
  await login(restored.root);
  const outbox = new LearningEventOutbox({
    storage: createReactNativeLearningEventOutboxStorage(),
    createDeviceId: () => 'same_phone_new_lifecycle',
  });
  await outbox.enqueueCompletion({
    accountPhoneNumber: PHONE, track: 'cet4', phase: 'learning',
    contentVersion: `sha256:${'12'.repeat(32)}`, selectionId: 'sel_new_lifecycle_12345678',
    result: {cardId: '000001', completedAt: new Date().toISOString(), interactionId: 'flip', outcome: 'confident', usedHint: false, usedPeek: false, isFavorited: false},
  });
  const credentials = await Keychain.getGenericPassword({service: AUTH_SERVICE});
  expect(credentials).not.toBe(false);
  const accountState = await AsyncStorage.getItem(USER_STATE_STORAGE_KEY);
  const pendingEvents = await AsyncStorage.getItem(LEARNING_EVENT_OUTBOX_STORAGE_KEY);
  expect(await outbox.getPendingCount(PHONE)).toBe(1);
  await ReactTestRenderer.act(async () => {
    await settle();
  });
  expect({
    credentials: await Keychain.getGenericPassword({service: AUTH_SERVICE}),
    accountState: await AsyncStorage.getItem(USER_STATE_STORAGE_KEY),
    pendingEvents: await AsyncStorage.getItem(LEARNING_EVENT_OUTBOX_STORAGE_KEY),
  }).toEqual({credentials, accountState, pendingEvents});
});

test('unreadable cleanup authority on logout preserves the account and opens a retry surface', async () => {
  const tree = await mount();
  await login(tree.root);
  const get = jest.mocked(AsyncStorage.getItem);
  const original = get.getMockImplementation()!;
  const credentials = await Keychain.getGenericPassword({service: AUTH_SERVICE});
  get.mockImplementation(key => key === ACCOUNT_DELETION_RECOVERY_STORAGE_KEY
    ? Promise.reject(new Error('Recovery authority unavailable'))
    : original(key));
  try {
    await press(tree.root, 'mine-account-logout-button');
    expect(tree.root.findByProps({testID: 'account-logout-cleanup-screen'})).toBeTruthy();
    expect(await Keychain.getGenericPassword({service: AUTH_SERVICE})).toEqual(credentials);
    expect(mockFetch.mock.calls.some(([url]) => url.endsWith('/auth/logout'))).toBe(false);
  } finally {
    get.mockImplementation(original);
  }
  await press(tree.root, 'account-logout-cleanup-retry-button');
  expect(tree.root.findByProps({testID: 'auth-phone-input'})).toBeTruthy();
  expect(await Keychain.getGenericPassword({service: AUTH_SERVICE})).toBe(false);
});

test('failed logout marker performs no destructive cleanup and can be retried', async () => {
  const tree = await mount();
  await login(tree.root);
  const set = jest.mocked(AsyncStorage.setItem);
  const original = set.getMockImplementation()!;
  const cleanupCount = jest.mocked(Keychain.resetGenericPassword).mock.calls
    .length;
  set.mockImplementation((key, value) =>
    key === ACCOUNT_LOGOUT_CLEANUP_STORAGE_KEY
      ? Promise.reject(new Error('Marker unavailable'))
      : original(key, value),
  );
  try {
    await press(tree.root, 'mine-account-logout-button');
    expect(
      tree.root.findByProps({ testID: 'account-logout-cleanup-screen' }),
    ).toBeTruthy();
    expect(
      await Keychain.getGenericPassword({ service: AUTH_SERVICE }),
    ).not.toBe(false);
    expect(jest.mocked(Keychain.resetGenericPassword).mock.calls.length).toBe(
      cleanupCount,
    );
    expect(
      mockFetch.mock.calls.some(([url]) => url.endsWith('/auth/logout')),
    ).toBe(false);
  } finally {
    set.mockImplementation(original);
  }
  await press(tree.root, 'account-logout-cleanup-retry-button');
  expect(tree.root.findByProps({ testID: 'auth-phone-input' })).toBeTruthy();
});

test('silently dropped logout marker preserves account stores until exact readback succeeds', async () => {
  const tree = await mount();
  await login(tree.root);
  const savedUserState = await AsyncStorage.getItem(USER_STATE_STORAGE_KEY);
  const set = jest.mocked(AsyncStorage.setItem);
  const original = set.getMockImplementation()!;
  set.mockImplementation((key, value) =>
    key === ACCOUNT_LOGOUT_CLEANUP_STORAGE_KEY
      ? Promise.resolve()
      : original(key, value),
  );
  try {
    await press(tree.root, 'mine-account-logout-button');
    expect(
      tree.root.findByProps({ testID: 'account-logout-cleanup-screen' }),
    ).toBeTruthy();
    expect(await AsyncStorage.getItem(USER_STATE_STORAGE_KEY)).toBe(
      savedUserState,
    );
    expect(
      await Keychain.getGenericPassword({ service: AUTH_SERVICE }),
    ).not.toBe(false);
    expect(
      mockFetch.mock.calls.some(([url]) => url.endsWith('/auth/logout')),
    ).toBe(false);
  } finally {
    set.mockImplementation(original);
  }
  await press(tree.root, 'account-logout-cleanup-retry-button');
  expect(tree.root.findByProps({ testID: 'auth-phone-input' })).toBeTruthy();
});

test('an unreadable logout marker blocks ordinary login until its read can be retried', async () => {
  await createAccountLogoutCleanupStore().markPending(PHONE);
  const get = jest.mocked(AsyncStorage.getItem);
  const original = get.getMockImplementation()!;
  get.mockImplementation(key =>
    key === ACCOUNT_LOGOUT_CLEANUP_STORAGE_KEY
      ? Promise.reject(new Error('Marker read unavailable'))
      : original(key),
  );
  const tree = await mount();
  expect(
    tree.root.findByProps({ testID: 'account-logout-cleanup-screen' }),
  ).toBeTruthy();
  expect(requestCalls()).toHaveLength(0);
  get.mockImplementation(original);
  await press(tree.root, 'account-logout-cleanup-retry-button');
  expect(tree.root.findByProps({ testID: 'auth-phone-input' })).toBeTruthy();
});

test('resend waits through its exact boundary and survives changing away from the phone', async () => {
  jest.useFakeTimers();
  const announcements = jest.spyOn(
    AccessibilityInfo,
    'announceForAccessibility',
  );
  const tree = await mount();
  await enterPhone(tree.root);
  await press(tree.root, 'auth-request-code-button');
  expect(button(tree.root, 'auth-request-code-button').props.disabled).toBe(
    true,
  );
  await enterCode(tree.root);
  expect(button(tree.root, 'auth-submit-button').props.disabled).toBe(false);
  await press(tree.root, 'auth-change-phone-button');
  await enterPhone(tree.root);
  expect(tree.root.findByProps({ testID: 'auth-code-input' })).toBeTruthy();
  expect(button(tree.root, 'auth-request-code-button').props.disabled).toBe(
    true,
  );
  const announcedBefore = announcements.mock.calls.length;
  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(119_999);
    await settle();
  });
  expect(button(tree.root, 'auth-request-code-button').props.disabled).toBe(
    true,
  );
  await ReactTestRenderer.act(async () => {
    jest.advanceTimersByTime(1);
    await settle();
  });
  expect(button(tree.root, 'auth-request-code-button').props.disabled).toBe(
    false,
  );
  expect(announcements.mock.calls.length).toBe(announcedBefore);
  await press(tree.root, 'auth-request-code-button');
  expect(requestCalls()).toHaveLength(2);
});

test('foreground refresh releases an elapsed resend wait without waiting for suspended timer ticks', async () => {
  jest.useFakeTimers();
  const subscriptions = jest.spyOn(AppState, 'addEventListener');
  const tree = await mount();
  await enterPhone(tree.root);
  await press(tree.root, 'auth-request-code-button');
  expect(button(tree.root, 'auth-request-code-button').props.disabled).toBe(
    true,
  );
  await ReactTestRenderer.act(async () => {
    jest.setSystemTime(Date.now() + 120_000);
    for (const [event, listener] of subscriptions.mock.calls) {
      if (event === 'change') listener('active');
    }
    await settle();
  });
  expect(button(tree.root, 'auth-request-code-button').props.disabled).toBe(
    false,
  );
});

test.each([429, 'transport'] as const)(
  'failed resend %s preserves the code and previous challenge for verification',
  async failure => {
    jest.useFakeTimers();
    let requestCount = 0;
    const ordinaryFetch = mockFetch.getMockImplementation()!;
    mockFetch.mockImplementation(async (url: string, init?: FetchInit) => {
      if (url.endsWith('/auth/request-code') && ++requestCount > 1) {
        if (failure === 'transport') throw new Error('Offline');
        return response({ error: { code: 'sms_rate_limited' } }, 429);
      }
      if (url.endsWith('/auth/verify-code')) {
        expect(JSON.parse(init!.body!)).toMatchObject({
          challenge_id: 'challenge_first',
          sms_code: '654321',
        });
      }
      return ordinaryFetch(url, init);
    });
    const tree = await mount();
    await enterPhone(tree.root);
    await press(tree.root, 'auth-request-code-button');
    await enterCode(tree.root);
    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(120_000);
      await settle();
    });
    await press(tree.root, 'auth-request-code-button');
    expect(
      tree.root.findByProps({ testID: 'auth-code-input' }).props.value,
    ).toBe('654321');
    expect(JSON.stringify(tree.toJSON())).not.toContain('验证码不正确');
    await press(tree.root, 'auth-submit-button');
    expect(
      tree.root.findByProps({ testID: 'route-tab-learning' }),
    ).toBeTruthy();
  },
);

function recoveryChallenge() {
  return response({
    data: {
      challenge_id: 'challenge_recovery_1234567890',
      delivery: 'sms',
      expires_at: new Date(Date.now() + 300_000).toISOString(),
      purpose: 'account_deletion_recovery',
      retry_after_seconds: 0,
    },
  });
}
function recoveryResult(state: 'pending' | 'none') {
  return response({
    data: {
      schema_version: 'account-deletion-recovery.v1',
      state,
      safe_to_register: state === 'none',
      deletion_request:
        state === 'none'
          ? null
          : {
              id: 'delete_account_recovery_12345',
              requested_at: new Date().toISOString(),
              status: 'processing',
            },
    },
  });
}
function mockRecovery(state: 'pending' | 'none') {
  const ordinary = mockFetch.getMockImplementation()!;
  mockFetch.mockImplementation(async (url: string, init?: FetchInit) => {
    if (url.includes('/deletion/recovery/')) {
      expect(init?.headers).not.toHaveProperty('Authorization');
      expect(init?.headers?.['x-softbook-client']).toBe('mobile');
      expect(JSON.parse(init!.body!).phone_number).toBe(PHONE);
      return url.endsWith('/request-code')
        ? recoveryChallenge()
        : recoveryResult(state);
    }
    return ordinary(url, init);
  });
}
async function recover(root: ReactTestRenderer.ReactTestInstance) {
  await press(root, 'account-deletion-recovery-request-button');
  await ReactTestRenderer.act(() => {
    root
      .findByProps({ testID: 'account-deletion-recovery-code-input' })
      .props.onChangeText('654321');
  });
  await press(root, 'account-deletion-recovery-verify-button');
}
async function beginUnknownDeletion() {
  const ordinary = mockFetch.getMockImplementation()!;
  mockFetch.mockImplementation(async (url: string, init?: FetchInit) => {
    if (url.endsWith('/account/deletion')) throw new Error('Response lost');
    return ordinary(url, init);
  });
  const tree = await mount();
  await login(tree.root);
  await press(tree.root, 'mine-account-delete-button');
  await press(tree.root, 'account-deletion-submit-button');
  await ReactTestRenderer.act(() => tree.unmount());
  return createAccountDeletionRecoveryStore().load();
}

test.each(['reject', 'drop'] as const)(
  'deletion marker %s failure sends no POST and preserves old data until retry',
  async failure => {
    const tree = await mount();
    await login(tree.root);
    const savedUserState = await AsyncStorage.getItem(USER_STATE_STORAGE_KEY);
    const set = jest.mocked(AsyncStorage.setItem);
    const original = set.getMockImplementation()!;
    set.mockImplementation((key, value) =>
      key === ACCOUNT_DELETION_RECOVERY_STORAGE_KEY
        ? failure === 'reject'
          ? Promise.reject(new Error('Unavailable'))
          : Promise.resolve()
        : original(key, value),
    );
    try {
      await press(tree.root, 'mine-account-delete-button');
      await press(tree.root, 'account-deletion-submit-button');
      expect(
        mockFetch.mock.calls.filter(([url]) =>
          url.endsWith('/account/deletion'),
        ),
      ).toHaveLength(0);
      expect(await AsyncStorage.getItem(USER_STATE_STORAGE_KEY)).toBe(
        savedUserState,
      );
      expect(
        await Keychain.getGenericPassword({ service: AUTH_SERVICE }),
      ).not.toBe(false);
      expect(JSON.stringify(tree.toJSON())).toContain('删除申请尚未发送');
    } finally {
      set.mockImplementation(original);
    }
    await press(tree.root, 'account-deletion-submit-button');
    expect(
      mockFetch.mock.calls.filter(([url]) => url.endsWith('/account/deletion')),
    ).toHaveLength(1);
    expect(
      tree.root.findByProps({ testID: 'account-deletion-accepted-screen' }),
    ).toBeTruthy();
  },
);

test('lost deletion response survives restart, pending remains recovery-only, and exact none permits fresh login', async () => {
  const first = await beginUnknownDeletion();
  expect(first).toEqual({
    revision: 1,
    state: { phoneNumber: PHONE, phase: 'requesting' },
  });
  expect(
    JSON.parse(
      (await AsyncStorage.getItem(ACCOUNT_DELETION_RECOVERY_STORAGE_KEY))!,
    ),
  ).toEqual({
    schema_version: 'account-deletion-recovery-state.v1',
    revision: 1,
    state: { owner_phone_number: PHONE, phase: 'requesting' },
  });
  mockFetch.mockClear();
  mockRecovery('pending');
  const tree = await mount();
  expect(mockFetch).not.toHaveBeenCalled();
  expect(tree.root.findAllByProps({ testID: 'auth-phone-input' })).toHaveLength(
    0,
  );
  await recover(tree.root);
  expect(
    tree.root.findByProps({ testID: 'account-deletion-recovery-screen' }),
  ).toBeTruthy();
  expect(JSON.stringify(tree.toJSON())).toContain('账户仍在清理');
  expect(tree.root.findAllByProps({ testID: 'auth-phone-input' })).toHaveLength(
    0,
  );
  expect(await Keychain.getGenericPassword({ service: AUTH_SERVICE })).toBe(
    false,
  );
  expect(await AsyncStorage.getItem(USER_STATE_STORAGE_KEY)).toBeNull();
  expect(await createAccountDeletionRecoveryStore().load()).toMatchObject({
    revision: 2,
    state: { phase: 'accepted' },
  });
  await ReactTestRenderer.act(() => tree.unmount());
  const restored = await mount();
  expect(
    restored.root.findByProps({ testID: 'account-deletion-recovery-screen' }),
  ).toBeTruthy();
  mockRecovery('none');
  await recover(restored.root);
  expect(
    restored.root.findByProps({ testID: 'auth-phone-input' }),
  ).toBeTruthy();
  expect(JSON.stringify(restored.toJSON())).not.toContain('删除完成');
  expect(await createAccountDeletionRecoveryStore().load()).toEqual({
    revision: 4,
    state: null,
  });
  expect(
    mockFetch.mock.calls.every(([url]) => url.includes('/deletion/recovery/')),
  ).toBe(true);
  await login(restored.root);
  expect(
    restored.root.findByProps({ testID: 'mine-account-delete-button' }),
  ).toBeTruthy();
});

test.each(['read_error', 'invalid'] as const)(
  'startup blocks ordinary auth when recovery marker has %s until exact read retries',
  async failure => {
    const receipt = await createAccountDeletionRecoveryStore().begin(PHONE, 0);
    const raw = (await AsyncStorage.getItem(
      ACCOUNT_DELETION_RECOVERY_STORAGE_KEY,
    ))!;
    const get = jest.mocked(AsyncStorage.getItem);
    const original = get.getMockImplementation()!;
    if (failure === 'invalid')
      await AsyncStorage.setItem(
        ACCOUNT_DELETION_RECOVERY_STORAGE_KEY,
        '{"schema_version":"wrong"}',
      );
    else
      get.mockImplementation(key =>
        key === ACCOUNT_DELETION_RECOVERY_STORAGE_KEY
          ? Promise.reject(new Error('Unreadable'))
          : original(key),
      );
    const tree = await mount();
    expect(
      tree.root.findByProps({ testID: 'account-deletion-recovery-screen' }),
    ).toBeTruthy();
    expect(
      tree.root.findAllByProps({ testID: 'auth-phone-input' }),
    ).toHaveLength(0);
    expect(mockFetch).not.toHaveBeenCalled();
    get.mockImplementation(original);
    await AsyncStorage.setItem(ACCOUNT_DELETION_RECOVERY_STORAGE_KEY, raw);
    await press(tree.root, 'account-deletion-recovery-retry-button');
    expect(
      tree.root.findByProps({
        testID: 'account-deletion-recovery-request-button',
      }),
    ).toBeTruthy();
    expect(await createAccountDeletionRecoveryStore().load()).toEqual(receipt);
  },
);

test.each([
  'user_state',
  'outbox',
  'mutation_queue',
  'auth',
  'clear_epoch',
] as const)(
  'none recovery keeps registration cleanup durable after %s failure and finishes after restart',
  async target => {
    await beginUnknownDeletion();
    mockRecovery('none');
    const tree = await mount();
    const remove = jest.mocked(AsyncStorage.removeItem);
    const originalRemove = remove.getMockImplementation()!;
    const set = jest.mocked(AsyncStorage.setItem);
    const originalSet = set.getMockImplementation()!;
    const reset = jest.mocked(Keychain.resetGenericPassword);
    const originalReset = reset.getMockImplementation()!;
    remove.mockImplementation(key =>
      target === 'user_state' && key === USER_STATE_STORAGE_KEY
        ? Promise.reject(new Error('Unavailable'))
        : originalRemove(key),
    );
    set.mockImplementation((key, value) =>
      (target === 'outbox' && key === LEARNING_EVENT_OUTBOX_STORAGE_KEY) ||
      (target === 'mutation_queue' &&
        key.startsWith('__softbook_mutation_queue')) ||
      (target === 'clear_epoch' &&
        key === ACCOUNT_DELETION_RECOVERY_STORAGE_KEY &&
        JSON.parse(value).state === null)
        ? Promise.reject(new Error('Unavailable'))
        : originalSet(key, value),
    );
    reset.mockImplementation(options =>
      target === 'auth'
        ? Promise.reject(new Error('Unavailable'))
        : originalReset(options),
    );
    try {
      await recover(tree.root);
      expect(
        tree.root.findByProps({ testID: 'account-deletion-cleanup-screen' }),
      ).toBeTruthy();
      expect(
        tree.root.findAllByProps({ testID: 'auth-phone-input' }),
      ).toHaveLength(0);
      expect(JSON.stringify(tree.toJSON())).not.toContain('删除申请已接收');
      expect(await createAccountDeletionRecoveryStore().load()).toMatchObject({
        state: { phase: 'registration_ready' },
      });
      await ReactTestRenderer.act(() => tree.unmount());
    } finally {
      remove.mockImplementation(originalRemove);
      set.mockImplementation(originalSet);
      reset.mockImplementation(originalReset);
    }
    const restored = await mount();
    expect(
      restored.root.findByProps({ testID: 'auth-phone-input' }),
    ).toBeTruthy();
    expect(await createAccountDeletionRecoveryStore().load()).toMatchObject({
      state: null,
    });
    expect(await Keychain.getGenericPassword({ service: AUTH_SERVICE })).toBe(
      false,
    );
    expect(await AsyncStorage.getItem(USER_STATE_STORAGE_KEY)).toBeNull();
  },
);

test.each(['deletion', 'recovery'] as const)(
  'late %s response from an unmounted origin cannot touch a later same-phone lifecycle',
  async operation => {
    let resolveOld!: (value: ReturnType<typeof response>) => void;
    const delayed = new Promise<ReturnType<typeof response>>(resolve => {
      resolveOld = resolve;
    });
    const ordinary = mockFetch.getMockImplementation()!;
    let oldTree: ReactTestRenderer.ReactTestRenderer;
    if (operation === 'deletion') {
      mockFetch.mockImplementation((url: string, init?: FetchInit) =>
        url.endsWith('/account/deletion') ? delayed : ordinary(url, init),
      );
      oldTree = await mount();
      await login(oldTree.root);
      await press(oldTree.root, 'mine-account-delete-button');
      await press(oldTree.root, 'account-deletion-submit-button');
    } else {
      await beginUnknownDeletion();
      mockRecovery('none');
      const recoveryFetch = mockFetch.getMockImplementation()!;
      mockFetch.mockImplementation((url: string, init?: FetchInit) =>
        url.endsWith('/deletion/recovery/verify-code')
          ? delayed
          : recoveryFetch(url, init),
      );
      oldTree = await mount();
      await recover(oldTree.root);
    }
    await ReactTestRenderer.act(() => oldTree.unmount());
    mockFetch.mockImplementation(ordinary);
    mockRecovery('none');
    const restored = await mount();
    await recover(restored.root);
    await login(restored.root);
    const before = await AsyncStorage.getItem(USER_STATE_STORAGE_KEY);
    const credentials = await Keychain.getGenericPassword({
      service: AUTH_SERVICE,
    });
    const marker = await AsyncStorage.getItem(
      ACCOUNT_DELETION_RECOVERY_STORAGE_KEY,
    );
    await ReactTestRenderer.act(async () => {
      resolveOld(
        operation === 'deletion'
          ? deletionAccepted()
          : recoveryResult('pending'),
      );
      await settle();
    });
    expect(
      await AsyncStorage.getItem(ACCOUNT_DELETION_RECOVERY_STORAGE_KEY),
    ).toBe(marker);
    expect(await AsyncStorage.getItem(USER_STATE_STORAGE_KEY)).toBe(before);
    expect(
      await Keychain.getGenericPassword({ service: AUTH_SERVICE }),
    ).toEqual(credentials);
    expect(
      restored.root.findByProps({ testID: 'mine-account-delete-button' }),
    ).toBeTruthy();
  },
);

test.each(['restart', 'same_process'] as const)(
  'real auth backend recovers a lost 202 through %s without a session and registers a new account instance',
  async flow => {
    jest.useFakeTimers();
    const backendStore = createMemoryStore();
    const deliveries: unknown[] = [];
    const api = createSoftbookApi({
      authV2AcknowledgementSleeper: async () => undefined,
      authV2CodeGenerator: () => '654321',
      authV2IndexSecret: 'softbook-cloudbase-dev-secret',
      now: () => new Date(Date.now()),
      runtimeMode: 'development',
      store: backendStore,
      tokenSecret: 'account-recovery-isolated-auth-secret',
      smsProvider: {
        delivery: 'isolated_test_sms',
        kind: 'test',
        sendCode: async (value: unknown) => {
          deliveries.push(value);
        },
      },
    });
    const deletionStatuses: number[] = [];
    mockFetch.mockImplementation(async (input: string, init?: FetchInit) => {
      const path = new URL(input).pathname;
      const result = await api.handleHttpRequest({
        body: init?.body ? JSON.parse(init.body) : undefined,
        clientIp: '203.0.113.90',
        headers: init?.headers ?? {},
        method: 'POST',
        path,
      });
      if (path === '/v2/account/deletion') {
        deletionStatuses.push(result.statusCode);
        if (deletionStatuses.length === 1) {
          expect(result.statusCode).toBe(202);
          // The real service committed the deletion; only the client reply is lost.
          throw new Error('Accepted response lost');
        }
      }
      return response(result.body, result.statusCode);
    });
    const tree = await mount();
    await login(tree.root);
    const oldInstance = [...backendStore.snapshot().accounts.values()][0] as {
      account_instance_id: string;
    };
    await press(tree.root, 'mine-account-delete-button');
    await press(tree.root, 'account-deletion-submit-button');
    expect(
      tree.root.findByProps({ testID: 'account-deletion-recoverable_unknown' }),
    ).toBeTruthy();
    let restored = tree;
    if (flow === 'restart') {
      await ReactTestRenderer.act(() => tree.unmount());
      mockFetch.mockClear();
      restored = await mount();
      expect(mockFetch).not.toHaveBeenCalled();
    } else {
      const worker = await backendStore.runAccountDeletionWorkerForTest();
      expect(worker.completed_count).toBe(1);
      await press(tree.root, 'account-deletion-submit-button');
      expect(deletionStatuses).toEqual([202, 401]);
      const marker = await createAccountDeletionRecoveryStore().load();
      await press(tree.root, 'account-deletion-cancel-button');
      await press(tree.root, 'account-deletion-unknown-sms-button');
      expect(await createAccountDeletionRecoveryStore().load()).toEqual(marker);
      mockFetch.mockClear();
    }
    expect(
      restored.root.findAllByProps({ testID: 'auth-phone-input' }),
    ).toHaveLength(0);
    await recover(restored.root);
    if (flow === 'restart')
      expect(JSON.stringify(restored.toJSON())).toContain('账户仍在清理');
    expect(deliveries).toHaveLength(2);
    expect(
      [...backendStore.snapshot().authSessions.values()].filter(
        value => (value as { status: string }).status === 'active',
      ),
    ).toHaveLength(0);
    expect(
      mockFetch.mock.calls.every(([url]) =>
        url.includes('/deletion/recovery/'),
      ),
    ).toBe(true);
    if (flow === 'restart') {
      const worker = await backendStore.runAccountDeletionWorkerForTest();
      expect(worker.completed_count).toBe(1);
      await ReactTestRenderer.act(async () => {
        jest.advanceTimersByTime(121_000);
        await settle();
      });
      await recover(restored.root);
    }
    expect(
      restored.root.findByProps({ testID: 'auth-phone-input' }),
    ).toBeTruthy();
    expect(JSON.stringify(restored.toJSON())).not.toContain('删除完成');
    expect([...backendStore.snapshot().authSessions.values()]).toHaveLength(0);
    // In-process recovery retains the existing phone-scoped SMS resend wait.
    if (flow === 'same_process') {
      await ReactTestRenderer.act(async () => {
        jest.advanceTimersByTime(121_000);
        await settle();
      });
    }
    await login(restored.root);
    const newInstance = [...backendStore.snapshot().accounts.values()][0] as {
      account_instance_id: string;
    };
    expect(newInstance.account_instance_id).not.toBe(
      oldInstance.account_instance_id,
    );
    expect(
      restored.root.findByProps({ testID: 'mine-account-delete-button' }),
    ).toBeTruthy();
  },
);

test.each(['finalizing', 'contradictory_none'] as const)(
  'recovery %s never grants cleanup or ordinary authentication',
  async outcome => {
    await beginUnknownDeletion();
    mockRecovery('none');
    const ordinary = mockFetch.getMockImplementation()!;
    mockFetch.mockImplementation((url: string, init?: FetchInit) =>
      url.endsWith('/deletion/recovery/verify-code')
        ? Promise.resolve(
            outcome === 'finalizing'
              ? response(
                  { error: { code: 'account_deletion_finalizing' } },
                  409,
                )
              : response({
                  data: {
                    schema_version: 'account-deletion-recovery.v1',
                    state: 'none',
                    safe_to_register: false,
                    deletion_request: null,
                  },
                }),
          )
        : ordinary(url, init),
    );
    const oldState = await AsyncStorage.getItem(USER_STATE_STORAGE_KEY);
    const tree = await mount();
    await recover(tree.root);
    expect(
      tree.root.findByProps({ testID: 'account-deletion-recovery-error' }),
    ).toBeTruthy();
    expect(
      tree.root.findAllByProps({ testID: 'auth-phone-input' }),
    ).toHaveLength(0);
    expect(await AsyncStorage.getItem(USER_STATE_STORAGE_KEY)).toBe(oldState);
    expect(
      await Keychain.getGenericPassword({ service: AUTH_SERVICE }),
    ).not.toBe(false);
    expect(await createAccountDeletionRecoveryStore().load()).toMatchObject({
      revision: 1,
      state: { phase: 'requesting' },
    });
  },
);

test('a persisted requesting marker with failed readback sends no deletion until exact retry verifies it', async () => {
  const tree = await mount();
  await login(tree.root);
  const originalState = await AsyncStorage.getItem(USER_STATE_STORAGE_KEY);
  const get = jest.mocked(AsyncStorage.getItem);
  const originalGet = get.getMockImplementation()!;
  const set = jest.mocked(AsyncStorage.setItem);
  const originalSet = set.getMockImplementation()!;
  let failReadback = false;
  get.mockImplementation(key => {
    if (key === ACCOUNT_DELETION_RECOVERY_STORAGE_KEY && failReadback) {
      failReadback = false;
      return Promise.reject(new Error('Readback unavailable'));
    }
    return originalGet(key);
  });
  set.mockImplementation(async (key, value) => {
    await originalSet(key, value);
    if (key === ACCOUNT_DELETION_RECOVERY_STORAGE_KEY) failReadback = true;
  });
  try {
    await press(tree.root, 'mine-account-delete-button');
    await press(tree.root, 'account-deletion-submit-button');
    expect(
      mockFetch.mock.calls.filter(([url]) => url.endsWith('/account/deletion')),
    ).toHaveLength(0);
    expect(await AsyncStorage.getItem(USER_STATE_STORAGE_KEY)).toBe(
      originalState,
    );
    expect(await createAccountDeletionRecoveryStore().load()).toMatchObject({
      revision: 1,
      state: { phase: 'requesting' },
    });
  } finally {
    get.mockImplementation(originalGet);
    set.mockImplementation(originalSet);
  }
  await press(tree.root, 'account-deletion-submit-button');
  expect(
    mockFetch.mock.calls.filter(([url]) => url.endsWith('/account/deletion')),
  ).toHaveLength(1);
  expect(
    tree.root.findByProps({ testID: 'account-deletion-accepted-screen' }),
  ).toBeTruthy();
});

test.each(['reject', 'false'] as const)(
  'credential save %s reports device storage failure and requires a fresh challenge after the resend deadline',
  async failure => {
    jest.useFakeTimers();
    const save = jest.mocked(Keychain.setGenericPassword);
    if (failure === 'reject')
      save.mockRejectedValueOnce(
        new Error('RNKeychain native entitlement failure'),
      );
    else save.mockResolvedValueOnce(false);
    let requestCount = 0;
    const verifiedChallenges: string[] = [];
    const ordinary = mockFetch.getMockImplementation()!;
    mockFetch.mockImplementation(async (url: string, init?: FetchInit) => {
      if (url.endsWith('/auth/request-code'))
        return challenge(`challenge_${++requestCount}`);
      if (url.endsWith('/auth/verify-code')) {
        verifiedChallenges.push(JSON.parse(init!.body!).challenge_id);
      }
      return ordinary(url, init);
    });
    const tree = await mount();
    await enterPhone(tree.root);
    await press(tree.root, 'auth-request-code-button');
    await enterCode(tree.root);
    await press(tree.root, 'auth-submit-button');
    expect(
      tree.root.findByProps({ testID: 'auth-error-title' }).props.children,
    ).toBe('本机暂时无法保存登录状态');
    const output = JSON.stringify(tree.toJSON());
    expect(output).toContain('重新获取验证码登录');
    expect(output).not.toContain('验证码不正确');
    expect(output).not.toContain('RNKeychain');
    expect(output).not.toContain('entitlement');
    expect(
      tree.root.findByProps({ testID: 'auth-phone-input' }).props.value,
    ).toBe(PHONE);
    expect(
      tree.root.findAllByProps({ testID: 'auth-code-input' }),
    ).toHaveLength(0);
    expect(
      tree.root.findAllByProps({ testID: 'auth-submit-button' }),
    ).toHaveLength(0);
    expect(
      tree.root.findAllByProps({ testID: 'route-tab-learning' }),
    ).toHaveLength(0);
    expect(await Keychain.getGenericPassword({ service: AUTH_SERVICE })).toBe(
      false,
    );
    expect(button(tree.root, 'auth-request-code-button').props.disabled).toBe(
      true,
    );
    expect(verifiedChallenges).toEqual(['challenge_1']);
    // Returning to this phone cannot restore its consumed challenge or bypass
    // the original phone-specific resend deadline.
    await enterPhone(tree.root, '13900139000');
    await enterPhone(tree.root);
    expect(
      tree.root.findAllByProps({ testID: 'auth-code-input' }),
    ).toHaveLength(0);
    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(119_999);
      await settle();
    });
    await press(tree.root, 'auth-request-code-button');
    expect(requestCount).toBe(1);
    await ReactTestRenderer.act(async () => {
      jest.advanceTimersByTime(1);
      await settle();
    });
    await press(tree.root, 'auth-request-code-button');
    expect(requestCount).toBe(2);
    expect(
      tree.root.findByProps({ testID: 'auth-code-input' }).props.value,
    ).toBe('');
    await enterCode(tree.root);
    await press(tree.root, 'auth-submit-button');
    expect(verifiedChallenges).toEqual(['challenge_1', 'challenge_2']);
    expect(
      tree.root.findByProps({ testID: 'route-tab-learning' }),
    ).toBeTruthy();
  },
);
