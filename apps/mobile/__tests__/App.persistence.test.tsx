/**
 * @format
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import { createLocalLearningSession } from '../src/learning/session';
import { createAuthSessionStore } from '../src/persistence/authSessionStore';
import {
  createUserStateStore,
  USER_STATE_STORAGE_KEY,
} from '../src/persistence/userStateStore';

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

async function flushAsyncEffects() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise<void>(resolve => {
    setTimeout(() => resolve(), 0);
  });
}

async function renderAppAndWaitForLearning(
  element: React.ReactElement = <App />,
) {
  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(element);
    await flushAsyncEffects();
  });

  for (let attempt = 0; attempt < 12; attempt += 1) {
    await ReactTestRenderer.act(async () => {
      await flushAsyncEffects();
    });

    if (
      tree!.root.findAllByProps({ testID: 'learning-favorite-button' }).length >
      0
    ) {
      return tree!;
    }
  }

  throw new Error('Persisted app bootstrap did not finish in time.');
}

function findPressableByTestId(
  root: ReactTestRenderer.ReactTestInstance,
  testID: string,
) {
  const pressable = root
    .findAllByProps({ testID })
    .find(node => typeof node.props.onPress === 'function');

  if (!pressable) {
    throw new Error(`No pressable node found for ${testID}.`);
  }

  return pressable;
}

async function openRoute(
  root: ReactTestRenderer.ReactTestInstance,
  route: 'learning' | 'space' | 'statistics' | 'mine',
) {
  await ReactTestRenderer.act(async () => {
    root.findByProps({ testID: `route-tab-${route}` }).props.onPress();
    await flushAsyncEffects();
  });
}

async function login(root: ReactTestRenderer.ReactTestInstance) {
  await ReactTestRenderer.act(() => {
    root
      .findByProps({ testID: 'auth-phone-input' })
      .props.onChangeText('13800138000');
  });
  await ReactTestRenderer.act(async () => {
    findPressableByTestId(root, 'auth-request-code-button').props.onPress();
    await flushAsyncEffects();
  });
  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'auth-code-input' }).props.onChangeText('2468');
  });
  await ReactTestRenderer.act(async () => {
    findPressableByTestId(root, 'auth-submit-button').props.onPress();
    await flushAsyncEffects();
  });
}

function createRemoteSession(
  overrides: Partial<ReturnType<typeof createRemoteSessionFixture>> = {},
) {
  return {
    ...createRemoteSessionFixture(),
    ...overrides,
  };
}

function createRemoteSessionFixture() {
  return {
    accessToken: 'secure-access-token',
    accessTokenExpiresAt: '2099-07-20T00:15:00.000Z',
    mode: 'remote' as const,
    phoneNumber: '13800138000',
    refreshExpiresAt: '2099-08-19T00:00:00.000Z',
    refreshToken: 'secure-refresh-token',
    sessionId: 'session-123',
    tokenType: 'Bearer' as const,
  };
}

test('persists a successful login and restores it after relaunch', async () => {
  let firstTree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(async () => {
    firstTree = ReactTestRenderer.create(<App />);
    await flushAsyncEffects();
  });
  await login(firstTree!.root);

  await expect(createAuthSessionStore().load()).resolves.toEqual({
    mode: 'local',
    phoneNumber: '13800138000',
  });

  await ReactTestRenderer.act(() => {
    firstTree!.unmount();
  });

  const restoredTree = await renderAppAndWaitForLearning();
  await openRoute(restoredTree.root, 'mine');

  expect(JSON.stringify(restoredTree.toJSON())).toContain('138****8000');
});

test('restores check-in, learning cursor, favorite, and sleep state', async () => {
  const session = createLocalLearningSession('cet4');
  const sleepingFavoriteCard = session.cards[0];
  const cursorCard = session.cards[1];

  await createAuthSessionStore().save({
    mode: 'local',
    phoneNumber: '13800138000',
  });
  await createUserStateStore().save('13800138000', {
    checkedInDayKey: new Date().toISOString().slice(0, 10),
    learningCursor: {
      cardId: cursorCard.card_id,
      sourceId: session.sourceId,
      track: session.track,
    },
    spaceCardStateById: {
      [sleepingFavoriteCard.card_id]: {
        isFavorited: true,
        isSleeping: true,
        lastModifiedAt: '2026-07-10T10:00:00.000Z',
      },
    },
  });

  const tree = await renderAppAndWaitForLearning();
  expect(JSON.stringify(tree.toJSON())).toContain(cursorCard.front.prompt);

  await openRoute(tree.root, 'statistics');
  expect(
    tree.root.findByProps({ testID: 'statistics-checkin-complete-label' }),
  ).toBeTruthy();

  await openRoute(tree.root, 'mine');
  expect(
    tree.root.findByProps({ testID: 'mine-metric-favorites-value' }).props
      .children,
  ).toBe('1');
  expect(
    tree.root.findByProps({ testID: 'mine-metric-sleeping-value' }).props
      .children,
  ).toBe('1');
});

test('degrades corrupt user state and clears persistence on logout', async () => {
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);

  await createAuthSessionStore().save({
    mode: 'local',
    phoneNumber: '13800138000',
  });
  await AsyncStorage.setItem(USER_STATE_STORAGE_KEY, '{not-json');

  const tree = await renderAppAndWaitForLearning();
  const repairedUserState = await AsyncStorage.getItem(USER_STATE_STORAGE_KEY);
  expect(repairedUserState).not.toBeNull();
  expect(JSON.parse(repairedUserState!)).toMatchObject({
    owner_phone_number: '13800138000',
    schema_version: 'user-state.v2',
  });

  await openRoute(tree.root, 'mine');
  const mineSurface = tree.root.findByProps({ testID: 'mine-surface' }).parent;
  expect(mineSurface?.props.handlers.onLogout).toEqual(expect.any(Function));
  await ReactTestRenderer.act(async () => {
    await mineSurface!.props.handlers.onLogout();
    await flushAsyncEffects();
  });

  await expect(createAuthSessionStore().load()).resolves.toBeNull();
  await expect(
    AsyncStorage.getItem(USER_STATE_STORAGE_KEY),
  ).resolves.toBeNull();
  expect(tree.root.findByProps({ testID: 'auth-phone-input' })).toBeTruthy();

  warn.mockRestore();
});

test('remote logout clears local persistence when server revocation is unavailable', async () => {
  const originalFetch = globalThis.fetch;
  const fetchMock = jest.fn(async () => ({
    json: async () => ({}),
    ok: false,
    status: 503,
  }));
  const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: fetchMock,
    writable: true,
  });

  try {
    await createAuthSessionStore().save(createRemoteSession());
    const tree = await renderAppAndWaitForLearning(
      <App
        softbookRemoteRuntimeProfile={{
          baseUrl: 'https://api.softbook.example/',
          featureModes: {
            learningSource: 'local',
            learningState: 'local',
            membership: 'local',
            progressSync: 'local',
            spaceState: 'local',
          },
        }}
      />,
    );
    await openRoute(tree.root, 'mine');
    const mineSurface = tree.root.findByProps({testID: 'mine-surface'}).parent;

    await ReactTestRenderer.act(async () => {
      await mineSurface!.props.handlers.onLogout();
      await flushAsyncEffects();
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.softbook.example/v2/auth/logout',
      expect.objectContaining({method: 'POST'}),
    );
    await expect(createAuthSessionStore().load()).resolves.toBeNull();
    expect(tree.root.findByProps({testID: 'auth-phone-input'})).toBeTruthy();
  } finally {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: originalFetch,
      writable: true,
    });
    warn.mockRestore();
  }
});

test('reloads remote membership authority when restoring an auth session', async () => {
  const originalFetch = globalThis.fetch;
  const fetchMock = jest.fn(
    async (
      input: string,
      _init?: {
        headers?: ConstructorParameters<typeof Headers>[0];
        method?: string;
      },
    ) => {
    if (input === 'https://api.softbook.example/v1/membership/entitlement') {
      return {
        json: async () => ({
          data: {
            entitlement: {
              counted_entry_count: 3,
              last_experience_ended_by: null,
              recovery_prompt_visible: false,
              stage: 'premium',
              trial_duration_days: 5,
              trial_started_at_entry_count: 1,
            },
          },
        }),
        ok: true,
        status: 200,
      };
    }

      throw new Error(`Unexpected fetch call: ${input}`);
    },
  );
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: fetchMock,
    writable: true,
  });

  try {
    await createAuthSessionStore().save(createRemoteSession());

    const tree = await renderAppAndWaitForLearning(
      <App
        softbookRemoteRuntimeProfile={{
          apiKey: 'runtime-key',
          baseUrl: 'https://api.softbook.example/',
          featureModes: {
            learningSource: 'local',
            learningState: 'local',
            membership: 'remote',
            progressSync: 'local',
            spaceState: 'local',
          },
        }}
      />,
    );
    await openRoute(tree.root, 'mine');

    expect(
      tree.root.findByProps({ testID: 'mine-membership-stage' }).props.children,
    ).toBe('当前是会员态');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.softbook.example/v1/membership/entitlement',
      expect.objectContaining({method: 'GET'}),
    );
    const requestHeaders = new Headers(fetchMock.mock.calls[0]?.[1]?.headers);
    expect(requestHeaders.get('authorization')).toBe(
      'Bearer secure-access-token',
    );
    expect(requestHeaders.get('x-api-key')).toBe('runtime-key');
  } finally {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: originalFetch,
      writable: true,
    });
  }
});

test('loads server canonical space state before pushing restored local state', async () => {
  const originalFetch = globalThis.fetch;
  const canonicalPayload = {
    data: {
      space_state: {
        day_key: new Date().toISOString().slice(0, 10),
        states: [
          {
            card_id: '002001',
            is_favorited: true,
            is_sleeping: false,
            last_modified_at: '2026-07-10T11:00:00.000Z',
          },
        ],
      },
    },
  };
  const fetchMock = jest.fn(
    async (
      _input: string,
      _init?: {body?: string; headers?: Record<string, string>; method?: string},
    ) => ({
      json: async () => canonicalPayload,
      ok: true,
      status: 200,
    }),
  );
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: fetchMock,
    writable: true,
  });

  try {
    await createAuthSessionStore().save(createRemoteSession());
    await createUserStateStore().save('13800138000', {
      checkedInDayKey: null,
      learningCursor: null,
      spaceCardStateById: {
        '002001': {
          isFavorited: false,
          isSleeping: false,
          lastModifiedAt: '2026-07-10T10:00:00.000Z',
        },
      },
    });

    const tree = await renderAppAndWaitForLearning(
      <App
        softbookRemoteRuntimeProfile={{
          baseUrl: 'https://api.softbook.example/',
          featureModes: {
            learningSource: 'local',
            learningState: 'local',
            membership: 'local',
            progressSync: 'local',
            spaceState: 'remote',
          },
        }}
      />,
    );
    await openRoute(tree.root, 'mine');

    expect(
      tree.root.findByProps({testID: 'mine-metric-favorites-value'}).props
        .children,
    ).toBe('1');
    const calls = fetchMock.mock.calls.map(([input, init]) => ({input, init}));
    expect(calls[0].input).toContain('/v1/space/state-sync?day_key=');
    expect(calls[0].init).toMatchObject({method: 'GET'});
    const postCall = calls.find(call => call.init?.method === 'POST');
    expect(JSON.parse(String(postCall?.init?.body))).toMatchObject({
      states: [
        {
          card_id: '002001',
          is_favorited: true,
          last_modified_at: '2026-07-10T11:00:00.000Z',
        },
      ],
    });
  } finally {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: originalFetch,
      writable: true,
    });
  }
});

test('expired restored session clears account state instead of authenticating offline', async () => {
  const originalFetch = globalThis.fetch;
  const fetchMock = jest.fn(async () => ({
    json: async () => ({error: {code: 'expired_auth_token'}}),
    ok: false,
    status: 401,
  }));
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: fetchMock,
    writable: true,
  });

  try {
    await createAuthSessionStore().save(
      createRemoteSession({
        accessToken: 'expired-token',
        accessTokenExpiresAt: '2020-07-20T00:15:00.000Z',
      }),
    );
    await createUserStateStore().save(
      '13800138000',
      createUserStateStoreFixture(),
    );
    await AsyncStorage.setItem(
      '__softbook_mutation_queue',
      JSON.stringify([
        {
          id: 'stale-refresh',
          payload: {
            context: {
              authToken: 'expired-token',
              phoneNumber: '13800138000',
            },
          },
          retryCount: 0,
          timestamp: '2026-07-10T10:00:00.000Z',
          type: 'refresh_membership',
        },
      ]),
    );

    let tree: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = ReactTestRenderer.create(
        <App
          softbookRemoteRuntimeProfile={{
            baseUrl: 'https://api.softbook.example/',
            featureModes: {
              learningSource: 'local',
              learningState: 'local',
              membership: 'remote',
              progressSync: 'local',
              spaceState: 'local',
            },
          }}
        />,
      );
      await flushAsyncEffects();
      await flushAsyncEffects();
    });

    expect(tree!.root.findByProps({testID: 'auth-phone-input'})).toBeTruthy();
    await expect(createAuthSessionStore().load()).resolves.toBeNull();
    await expect(AsyncStorage.getItem(USER_STATE_STORAGE_KEY)).resolves.toBeNull();
    await expect(
      AsyncStorage.getItem('__softbook_mutation_queue'),
    ).resolves.toBe('[]');
  } finally {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: originalFetch,
      writable: true,
    });
  }
});

function createUserStateStoreFixture() {
  return {
    checkedInDayKey: '2026-07-10',
    learningCursor: null,
    spaceCardStateById: {},
  };
}
