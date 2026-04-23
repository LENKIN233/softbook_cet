/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import type { SoftbookAppRuntimeConfig } from '../src/learning/learningRuntimeConfig';
import { LearningSession } from '../src/learning/model';
import { createLocalLearningSession } from '../src/learning/session';
import App from '../App';

const mockCreateLearningSessionRepository = jest.fn();
const mockLoadSession = jest.fn();
const mockFetch = jest.fn();

type MockFetchInit = {
  body?: string;
  headers?: Record<string, string>;
  method?: string;
};

type MockFetchCall = {
  init: MockFetchInit | undefined;
  input: string;
};

jest.mock('../src/learning/learningRepository', () => ({
  createLearningSessionRepository: (...args: unknown[]) => {
    mockCreateLearningSessionRepository(...args);

    return {
      loadSession: (...loadArgs: unknown[]) => mockLoadSession(...loadArgs),
    };
  },
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

type Deferred<T> = {
  promise: Promise<T>;
  reject: (error: unknown) => void;
  resolve: (value: T) => void;
};

let pendingSession: Deferred<LearningSession>;
let originalFetch: typeof global.fetch | undefined;

const globalWithFetch = global as typeof global & {
  fetch?: typeof global.fetch;
};

declare global {
  var __SOFTBOOK_CET_RUNTIME_CONFIG__: SoftbookAppRuntimeConfig | undefined;
}

beforeEach(() => {
  pendingSession = createDeferred<LearningSession>();
  mockCreateLearningSessionRepository.mockReset();
  mockLoadSession.mockReset();
  mockLoadSession.mockImplementation(() => pendingSession.promise);
  mockFetch.mockReset();
  mockFetch.mockImplementation(async (input: string) => {
    throw new Error(`Unexpected fetch call in App test: ${input}`);
  });
  originalFetch = globalWithFetch.fetch;
  globalWithFetch.fetch = mockFetch as typeof global.fetch;
});

afterEach(() => {
  globalWithFetch.fetch = originalFetch;
  global.__SOFTBOOK_CET_RUNTIME_CONFIG__ = undefined;
});

async function authenticateIntoLearningBootstrap(
  root: ReactTestRenderer.ReactTestInstance,
) {
  await ReactTestRenderer.act(() => {
    root
      .findByProps({ testID: 'auth-phone-input' })
      .props.onChangeText('13800138000');
  });

  await ReactTestRenderer.act(async () => {
    root.findByProps({ testID: 'auth-request-code-button' }).props.onPress();
    await flushAsyncEffects();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'auth-code-input' }).props.onChangeText('2468');
  });

  await ReactTestRenderer.act(async () => {
    root.findByProps({ testID: 'auth-submit-button' }).props.onPress();
    await flushAsyncEffects();
  });
}

async function loginIntoLearningFlow(
  root: ReactTestRenderer.ReactTestInstance,
) {
  await authenticateIntoLearningBootstrap(root);
  await resolveLearningBootstrap();
  await waitForLearningSurface(root);
}

async function openRoute(
  root: ReactTestRenderer.ReactTestInstance,
  route: 'learning' | 'space' | 'statistics' | 'mine',
) {
  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: `route-tab-${route}` }).props.onPress();
  });
}

async function startTrialFromProtectedEntry(
  root: ReactTestRenderer.ReactTestInstance,
  returnRoute: 'learning' | 'space' | 'mine' = 'learning',
) {
  await openRoute(root, 'space');

  await ReactTestRenderer.act(async () => {
    await flushAsyncEffects();
  });

  if (returnRoute !== 'space') {
    await openRoute(root, returnRoute);
  }
}

async function resolveLearningBootstrap(
  session: LearningSession = createLocalLearningSession('cet4'),
) {
  await ReactTestRenderer.act(async () => {
    pendingSession.resolve(session);
    await flushAsyncEffects();
  });
}

async function waitForLearningSurface(
  root: ReactTestRenderer.ReactTestInstance,
) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await ReactTestRenderer.act(async () => {
      await flushAsyncEffects();
    });

    if (
      root.findAllByProps({ testID: 'learning-favorite-button' }).length > 0
    ) {
      return;
    }
  }

  throw new Error('Learning surface bootstrap did not finish in time.');
}

async function flushAsyncEffects() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise(resolve => setTimeout(resolve, 0));
}

async function rejectLearningBootstrap(message: string) {
  await ReactTestRenderer.act(async () => {
    pendingSession.reject(new Error(message));
    await flushAsyncEffects();
  });
}

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });

  return {
    promise,
    reject,
    resolve,
  };
}

function createJsonResponse(payload: unknown, status = 200) {
  return {
    json: async () => payload,
    ok: status >= 200 && status < 300,
    status,
  };
}

function createRemoteMembershipPayload(
  stage: 'trial_available' | 'trial' | 'free' | 'premium',
  overrides: Partial<{
    counted_entry_count: number;
    last_experience_ended_by: 'trial' | 'premium' | null;
    recovery_prompt_visible: boolean;
    trial_duration_days: number;
    trial_started_at_entry_count: number | null;
  }> = {},
) {
  return {
    data: {
      entitlement: {
        counted_entry_count: 0,
        last_experience_ended_by: null,
        recovery_prompt_visible: false,
        stage,
        trial_duration_days: 5,
        trial_started_at_entry_count: stage === 'trial' ? 1 : null,
        ...overrides,
      },
    },
  };
}

test('renders correctly', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('学习');
  expect(output).toContain('空间');
  expect(output).toContain('统计');
  expect(output).toContain('我的');
  expect(output).toContain('学习前先登录');
});

test('reads installed runtime config when the app mounts', async () => {
  global.__SOFTBOOK_CET_RUNTIME_CONFIG__ = {
    auth: {
      mode: 'remote',
      remote: {
        baseUrl: 'https://api.softbook.example',
      },
    },
  };

  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('当前认证已切到远端短信合同');
  expect(output).toContain('当前会走远端短信验证码合同。');
  expect(output).not.toContain('当前是本地壳层验证，不会真的发短信。');
});

test('wires remote auth, learning source config, membership, and progress sync through App', async () => {
  const fetchCalls: MockFetchCall[] = [];

  global.__SOFTBOOK_CET_RUNTIME_CONFIG__ = {
    auth: {
      mode: 'remote',
      remote: {
        baseUrl: 'https://api.softbook.example',
      },
    },
    learningSource: {
      mode: 'remote',
      remote: {
        baseUrl: 'https://api.softbook.example',
      },
    },
    membership: {
      mode: 'remote',
      remote: {
        baseUrl: 'https://api.softbook.example',
      },
    },
    progressSync: {
      mode: 'remote',
      remote: {
        baseUrl: 'https://api.softbook.example',
      },
    },
  };

  mockFetch.mockImplementation(
    async (input: string, init?: MockFetchInit) => {
      fetchCalls.push({init, input});

      if (input === 'https://api.softbook.example/v1/auth/request-code') {
        return createJsonResponse({});
      }

      if (input === 'https://api.softbook.example/v1/auth/verify-code') {
        return createJsonResponse({
          data: {
            auth_token: 'remote-auth-token',
            phone_number: '13800138000',
          },
        });
      }

      if (input === 'https://api.softbook.example/v1/membership/entitlement') {
        return createJsonResponse(createRemoteMembershipPayload('free'));
      }

      if (input === 'https://api.softbook.example/v1/progress/daily-sync') {
        return createJsonResponse({});
      }

      throw new Error(`Unexpected remote fetch: ${input}`);
    },
  );

  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const repositoryConfig =
    mockCreateLearningSessionRepository.mock.calls[0]?.[0];
  expect(repositoryConfig).toMatchObject({
    mode: 'remote',
    remoteConfig: {
      endpoint: 'https://api.softbook.example/v1/learning/card-source',
      headers: {
        'x-softbook-client': 'mobile',
      },
    },
  });

  const root = tree!.root;
  await loginIntoLearningFlow(root);

  expect(mockLoadSession).toHaveBeenCalledWith(
    {
      authToken: 'remote-auth-token',
      phoneNumber: '13800138000',
    },
    'cet4',
  );

  await ReactTestRenderer.act(() => {
    root.findByProps({testID: 'learning-flip-button'}).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({testID: 'learning-flip-confident-button'}).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({testID: 'learning-next-button'}).props.onPress();
  });

  await openRoute(root, 'statistics');

  await ReactTestRenderer.act(async () => {
    await flushAsyncEffects();
  });

  const output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('远端已同步');
  expect(output).toContain('今天的学习进展已推送到远端日级同步端点。');

  const membershipRequest = fetchCalls.find(
    call => call.input === 'https://api.softbook.example/v1/membership/entitlement',
  );
  expect(membershipRequest?.init?.headers).toMatchObject({
    Authorization: 'Bearer remote-auth-token',
  });

  const progressSyncRequest = fetchCalls.find(
    call => call.input === 'https://api.softbook.example/v1/progress/daily-sync',
  );
  expect(progressSyncRequest?.init?.headers).toMatchObject({
    Authorization: 'Bearer remote-auth-token',
    'content-type': 'application/json',
  });
  expect(progressSyncRequest?.init?.body).toContain('"day_key"');
  expect(progressSyncRequest?.init?.body).toContain('"learning_completed_count":1');
});

test('auto-starts remote trial when first entering space', async () => {
  const fetchCalls: MockFetchCall[] = [];

  global.__SOFTBOOK_CET_RUNTIME_CONFIG__ = {
    auth: {
      mode: 'remote',
      remote: {
        baseUrl: 'https://api.softbook.example',
      },
    },
    membership: {
      mode: 'remote',
      remote: {
        baseUrl: 'https://api.softbook.example',
      },
    },
  };

  mockFetch.mockImplementation(
    async (input: string, init?: MockFetchInit) => {
      fetchCalls.push({init, input});

      if (input === 'https://api.softbook.example/v1/auth/request-code') {
        return createJsonResponse({});
      }

      if (input === 'https://api.softbook.example/v1/auth/verify-code') {
        return createJsonResponse({
          data: {
            auth_token: 'remote-auth-token',
            phone_number: '13800138000',
          },
        });
      }

      if (input === 'https://api.softbook.example/v1/membership/entitlement') {
        return createJsonResponse(createRemoteMembershipPayload('trial_available'));
      }

      if (input === 'https://api.softbook.example/v1/membership/start-trial') {
        return createJsonResponse(createRemoteMembershipPayload('trial'));
      }

      throw new Error(`Unexpected remote fetch: ${input}`);
    },
  );

  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await loginIntoLearningFlow(root);
  await openRoute(root, 'space');

  await ReactTestRenderer.act(async () => {
    await flushAsyncEffects();
  });

  const output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('已接入卡片的物理空间');
  expect(output).toContain('知识地图浏览');

  const startTrialRequest = fetchCalls.find(
    call => call.input === 'https://api.softbook.example/v1/membership/start-trial',
  );
  expect(startTrialRequest?.init?.headers).toMatchObject({
    Authorization: 'Bearer remote-auth-token',
  });
});

test('can unlock gated space after remote purchase', async () => {
  const fetchCalls: MockFetchCall[] = [];

  global.__SOFTBOOK_CET_RUNTIME_CONFIG__ = {
    auth: {
      mode: 'remote',
      remote: {
        baseUrl: 'https://api.softbook.example',
      },
    },
    membership: {
      mode: 'remote',
      remote: {
        baseUrl: 'https://api.softbook.example',
      },
    },
  };

  mockFetch.mockImplementation(
    async (input: string, init?: MockFetchInit) => {
      fetchCalls.push({init, input});

      if (input === 'https://api.softbook.example/v1/auth/request-code') {
        return createJsonResponse({});
      }

      if (input === 'https://api.softbook.example/v1/auth/verify-code') {
        return createJsonResponse({
          data: {
            auth_token: 'remote-auth-token',
            phone_number: '13800138000',
          },
        });
      }

      if (input === 'https://api.softbook.example/v1/membership/entitlement') {
        return createJsonResponse(createRemoteMembershipPayload('free'));
      }

      if (input === 'https://api.softbook.example/v1/membership/purchase') {
        return createJsonResponse(createRemoteMembershipPayload('premium'));
      }

      throw new Error(`Unexpected remote fetch: ${input}`);
    },
  );

  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await loginIntoLearningFlow(root);
  await openRoute(root, 'space');

  let output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('完整物理空间需要试用或会员');

  await ReactTestRenderer.act(async () => {
    root.findByProps({testID: 'membership-purchase-button'}).props.onPress();
    await flushAsyncEffects();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('已接入卡片的物理空间');
  expect(output).toContain('知识地图浏览');

  const purchaseRequest = fetchCalls.find(
    call => call.input === 'https://api.softbook.example/v1/membership/purchase',
  );
  expect(purchaseRequest?.init?.headers).toMatchObject({
    Authorization: 'Bearer remote-auth-token',
  });
});

test('can dismiss remote recovery reminder from mine', async () => {
  const fetchCalls: MockFetchCall[] = [];

  global.__SOFTBOOK_CET_RUNTIME_CONFIG__ = {
    auth: {
      mode: 'remote',
      remote: {
        baseUrl: 'https://api.softbook.example',
      },
    },
    membership: {
      mode: 'remote',
      remote: {
        baseUrl: 'https://api.softbook.example',
      },
    },
  };

  mockFetch.mockImplementation(
    async (input: string, init?: MockFetchInit) => {
      fetchCalls.push({init, input});

      if (input === 'https://api.softbook.example/v1/auth/request-code') {
        return createJsonResponse({});
      }

      if (input === 'https://api.softbook.example/v1/auth/verify-code') {
        return createJsonResponse({
          data: {
            auth_token: 'remote-auth-token',
            phone_number: '13800138000',
          },
        });
      }

      if (input === 'https://api.softbook.example/v1/membership/entitlement') {
        return createJsonResponse(
          createRemoteMembershipPayload('free', {
            last_experience_ended_by: 'trial',
            recovery_prompt_visible: true,
          }),
        );
      }

      if (
        input === 'https://api.softbook.example/v1/membership/dismiss-recovery'
      ) {
        return createJsonResponse(
          createRemoteMembershipPayload('free', {
            last_experience_ended_by: 'trial',
            recovery_prompt_visible: false,
          }),
        );
      }

      throw new Error(`Unexpected remote fetch: ${input}`);
    },
  );

  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await loginIntoLearningFlow(root);
  await openRoute(root, 'mine');

  let output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('恢复购买提醒');
  expect(
    root.findAllByProps({testID: 'membership-dismiss-recovery-button'}).length,
  ).toBeGreaterThan(0);

  await ReactTestRenderer.act(async () => {
    root
      .findByProps({testID: 'membership-dismiss-recovery-button'})
      .props.onPress();
    await flushAsyncEffects();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(output).not.toContain('恢复购买提醒');
  expect(
    root.findAllByProps({testID: 'membership-dismiss-recovery-button'}).length,
  ).toBe(0);

  const dismissRecoveryRequest = fetchCalls.find(
    call =>
      call.input === 'https://api.softbook.example/v1/membership/dismiss-recovery',
  );
  expect(dismissRecoveryRequest?.init?.headers).toMatchObject({
    Authorization: 'Bearer remote-auth-token',
  });
});

test('can unlock the learning flow after fake sms verification', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await loginIntoLearningFlow(root);

  const output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('单卡推进，不把学习入口做成按钮堆');
  expect(output).toContain('已登录 138****8000');
  expect(output).toContain('however');
});

test('keeps source bootstrap errors inside learning and can retry', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await authenticateIntoLearningBootstrap(root);
  await rejectLearningBootstrap('学习卡源暂时不可达。');

  let output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('学习卡源暂时不可用');
  expect(output).toContain('学习卡源暂时不可达。');
  expect(output).toContain('重新加载学习卡源');

  pendingSession = createDeferred<LearningSession>();

  await ReactTestRenderer.act(async () => {
    root.findByProps({ testID: 'learning-bootstrap-retry-button' }).props.onPress();
    await flushAsyncEffects();
  });

  await resolveLearningBootstrap();
  await waitForLearningSurface(root);

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('however');
});

test('can complete the local single-card deck and restart it', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await loginIntoLearningFlow(root);
  await startTrialFromProtectedEntry(root);

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-favorite-button' }).props.onPress();
    root.findByProps({ testID: 'learning-peek-button' }).props.onPress();
    root.findByProps({ testID: 'learning-hint-button' }).props.onPress();
  });

  let output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('knowledge_ref');
  expect(output).toContain('给出真正立场');

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-flip-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root
      .findByProps({ testID: 'learning-flip-confident-button' })
      .props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-next-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-option-unclear' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-submit-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-next-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root
      .findByProps({ testID: 'learning-lock-subject-the-policy' })
      .props.onPress();
    root.findByProps({ testID: 'learning-lock-verb-reduces' }).props.onPress();
    root
      .findByProps({ testID: 'learning-lock-object-test-anxiety' })
      .props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-submit-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-next-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root
      .findByProps({ testID: 'learning-elimination-relative_clause' })
      .props.onPress();
    root.findByProps({ testID: 'learning-elimination-adverb' }).props.onPress();
    root
      .findByProps({ testID: 'learning-elimination-time_phrase' })
      .props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-submit-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-next-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-swipe-safe' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-submit-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-next-button' }).props.onPress();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('本轮卡源已走完');
  expect(output).toContain('完成明细');
  expect(output).toContain('再跑一轮当前卡源');

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-restart-button' }).props.onPress();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('however');
});

test('can start a review round from cards that need revisiting', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await loginIntoLearningFlow(root);
  await startTrialFromProtectedEntry(root);

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-flip-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-flip-review-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-next-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-option-unclear' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-submit-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-next-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root
      .findByProps({ testID: 'learning-lock-subject-the-policy' })
      .props.onPress();
    root.findByProps({ testID: 'learning-lock-verb-reduces' }).props.onPress();
    root
      .findByProps({ testID: 'learning-lock-object-test-anxiety' })
      .props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-submit-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-next-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root
      .findByProps({ testID: 'learning-elimination-relative_clause' })
      .props.onPress();
    root.findByProps({ testID: 'learning-elimination-adverb' }).props.onPress();
    root
      .findByProps({ testID: 'learning-elimination-time_phrase' })
      .props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-submit-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-next-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-swipe-safe' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-submit-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-next-button' }).props.onPress();
  });

  expect(root.findByProps({ testID: 'learning-start-review-button' })).toBeTruthy();

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-start-review-button' }).props.onPress();
  });

  let output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('回看队列');
  expect(output).toContain('把需要回看的卡单独再刷一轮');
  expect(output).toContain('however');

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-flip-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-flip-confident-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-next-button' }).props.onPress();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('本轮回看已走完');
  expect(output).toContain('回到首轮重新开始');

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'route-tab-statistics' }).props.onPress();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('已完成 1 张回看卡，当前还剩 0 张待回看。');
});

test('can check in from statistics after making learning progress', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await loginIntoLearningFlow(root);

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-flip-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-flip-confident-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-next-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'route-tab-statistics' }).props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    await flushAsyncEffects();
  });

  let output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('今日可签到');
  expect(output).toContain('今天已经产生有效学习进展，可以把连续性落成一次轻量签到。');
  expect(output).toContain('本地已记录');

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'statistics-checkin-button' }).props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    await flushAsyncEffects();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('今日已签到');
  expect(output).toContain('今天的学习进展已在本地记录；远端同步将在配置接通后启用。');
});

test('mine page shows profile, learning, and space summaries after login', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await loginIntoLearningFlow(root);

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-favorite-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-flip-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-flip-confident-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-next-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'route-tab-statistics' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'statistics-checkin-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'route-tab-mine' }).props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    await flushAsyncEffects();
  });

  const output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('个人主页已经接进当前模块');
  expect(output).toContain('手机号：138****8000');
  expect(output).toContain('今日签到：已完成');
  expect(output).toContain('日级同步：本地已记录');
  expect(output).toContain('今日已完成 1 张卡，其中首轮 1 张、回看 0 张。');
  expect(output).toContain('同步说明：今天的学习进展已在本地记录；远端同步将在配置接通后启用。');
  expect(output).toContain('收藏标签 1 张。');
});

test('can browse the seeded knowledge map after login', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await loginIntoLearningFlow(root);
  await startTrialFromProtectedEntry(root, 'space');

  let output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('已接入卡片的物理空间');
  expect(output).toContain('当前学习卡位于 ');
  expect(output).toContain('逻辑关系');
  expect(output).toContain('转折关系');
  expect(output).toContain('词汇');

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'space-library-2' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'space-group-1' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'space-box-0521' }).props.onPress();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('阅读高频词');
  expect(output).toContain('The article offers a ____ explanation');
  expect(output).toContain('052102');
});

test('can move a card into sleep zone and remove it from learning flow', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await loginIntoLearningFlow(root);
  await startTrialFromProtectedEntry(root, 'space');

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'space-sleep-002001' }).props.onPress();
  });

  let output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('休眠区');
  expect(output).toContain('移出休眠');
  expect(output).toContain('002001');

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'route-tab-learning' }).props.onPress();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('The committee postponed the vote');
  expect(output).not.toContain('短对话里听到 however');
});

test('can favorite a card from space and reflect it in learning flow', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await loginIntoLearningFlow(root);
  await startTrialFromProtectedEntry(root, 'space');

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'space-favorite-002001' }).props.onPress();
  });

  let output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('收藏标签');
  expect(output).toContain('取消收藏');

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'route-tab-learning' }).props.onPress();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('已收藏');
});

test('auto-starts local trial when first entering space', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await loginIntoLearningFlow(root);
  await openRoute(root, 'space');

  await ReactTestRenderer.act(async () => {
    await flushAsyncEffects();
  });

  const output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('已接入卡片的物理空间');
  expect(output).toContain('知识地图浏览');
});

test('auto-starts trial from the first gated review entry', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await loginIntoLearningFlow(root);

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-flip-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-flip-review-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-next-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-option-unclear' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-submit-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-next-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root
      .findByProps({ testID: 'learning-lock-subject-the-policy' })
      .props.onPress();
    root.findByProps({ testID: 'learning-lock-verb-reduces' }).props.onPress();
    root
      .findByProps({ testID: 'learning-lock-object-test-anxiety' })
      .props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-submit-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-next-button' }).props.onPress();
  });

  let output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('首轮抽出 3 张卡');
  expect(root.findByProps({ testID: 'learning-start-review-button' })).toBeTruthy();

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-start-review-button' }).props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    await flushAsyncEffects();
  });

  await openRoute(root, 'mine');

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('完整试用进行中');
  expect(output).not.toContain('试用待开始');
});

test('shows recovery reminder after local trial ends and clears it after purchase', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await loginIntoLearningFlow(root);
  await startTrialFromProtectedEntry(root, 'mine');

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'membership-expire-trial-button' }).props.onPress();
  });

  let output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('恢复购买提醒');
  expect(output).toContain('当前是基础学习态');

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'membership-purchase-button' }).props.onPress();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('当前是会员态');
  expect(
    root.findAllByProps({ testID: 'membership-dismiss-recovery-button' }).length,
  ).toBe(0);
});

test('keeps basic learning recoverable when free cards all enter sleep zone', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await loginIntoLearningFlow(root);
  await startTrialFromProtectedEntry(root, 'space');

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'space-sleep-002001' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'space-library-2' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'space-group-1' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'space-box-0521' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'space-sleep-052101' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'space-library-1' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'space-box-0121' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'space-sleep-012101' }).props.onPress();
  });

  await openRoute(root, 'mine');

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'membership-expire-trial-button' }).props.onPress();
  });

  await openRoute(root, 'learning');

  let output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('当前免费态还不能进入完整空间');
  expect(output).toContain('恢复一张可学习卡');
  expect(output).toContain('下一张可恢复卡：短对话里听到 however');

  await ReactTestRenderer.act(() => {
    root
      .findByProps({ testID: 'learning-recover-sleeping-card-button' })
      .props.onPress();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('however');
  expect(output).not.toContain('当前学习卡都已进入休眠区');
});
