/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { ScrollView, StyleSheet, Text } from 'react-native';
import type { SoftbookAppRuntimeConfig } from '../src/learning/learningRuntimeConfig';
import { LearningCard, LearningSession } from '../src/learning/model';
import { createLocalLearningSession } from '../src/learning/session';
import { createSoftbookRemoteRuntimeConfig } from '../src/runtime/appRuntimeConfig';
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

type TestRendererNode =
  | ReactTestRenderer.ReactTestRendererJSON
  | ReactTestRenderer.ReactTestRendererJSON[]
  | string
  | null;

const USER_VISIBLE_METADATA_PATTERN =
  /knowledge_ref|card_id|box_ref|source_id|source_label|card_records|space_metadata|action plane|favorite\b|Peek|SINGLE CARD FLOW|REVIEW FLOW|LEARNING SETUP|SLEEP ZONE|PROFILE PAGE|AUTH GATE|LIGHT STATS|SPACE GATE|SPACE SYNC|SPACE STATUS|OPEN BOX TRAY|EMPTY BOX TRAY|LOADING BOX TRAY|library \/ group \/ box|remove-from-flow|Remote|remoteConfig|authToken|endpoint|MutationQueue|mutation|会员矩阵|卡源|队列|缓存|本机缓存|当前设备|当前卡组|本组第|本轮卡组|这一组学习卡|这组回看卡|这一组已经按学习节奏走完|再练一轮这一组|回看这一组|payload|metadata|runtime|repository|SHELL|FLOW|GATE|SETUP|PROFILE|STATUS|SYNC|占位|快照|离线重试|提示层|真实卡池|跨端同步|复杂状态机|按钮堆|说明页|data\.|\bCET[46]\b|训练轨道|学习馆|知识组|原盒位|顶层|入口|最重要|服务核心价值|账户与会员|壳层|页面内部|最小必要信息|首读路径|低成本|轻量|会员边界|主要任务|复杂设置中心|模块选择|复杂大盘|复杂管理器|承接|权限|主路径|单卡流|学习流|已登录\s+138|第\s+\d+\s+张\s+\/\s+共\s+\d+\s+张|馆\s+\d|组\s+\d|盒\s+\d|当前地址|当前学习卡位于|空间地址架|当前盒位|当前空间路径|收藏标签\s+\d|休眠区\s+\d|0\s+张可展示|（[1-5]\d{2}）|\([1-5]\d{2}\)|product_truth|implementation_hypothesis|design artifact|harness|Agent review|PR 描述/i;

function collectRenderedText(node: TestRendererNode, inText = false): string[] {
  if (node === null) {
    return [];
  }

  if (typeof node === 'string') {
    return inText ? [node] : [];
  }

  if (Array.isArray(node)) {
    return node.flatMap(child => collectRenderedText(child, inText));
  }

  const nextInText = inText || node.type === 'Text';
  return (
    node.children?.flatMap(child => collectRenderedText(child, nextInText)) ??
    []
  );
}

function expectNoUserVisibleMetadataLeakage(
  tree: ReactTestRenderer.ReactTestRenderer,
) {
  expect(collectRenderedText(tree.toJSON()).join(' ')).not.toMatch(
    USER_VISIBLE_METADATA_PATTERN,
  );
}

test('metadata leakage guard catches internal remote error vocabulary', () => {
  [
    'Remote membership mutation failed with 503.',
    'Remote learning source payload.data.source_id is required.',
    'MutationQueue replay failed for authToken endpoint remoteConfig.',
    'space_metadata.box_ref leaked through a status card.',
    '顶层切换留在壳层，页面内部只承接该模块最小必要信息。',
    '统计只用于增强信心和连续性，把今日签到、学习摘要和回看状态收成低成本页面。',
    '学习保持最重要入口，空间保持顶层入口。',
    '购买与恢复入口集中放在这里，学习和空间保持轻量。',
    '首轮里还有 2 张卡待回看，先别把统计做成复杂大盘。',
    '已登录后直接进入单卡学习流；空间、统计和“我的”各自承接清楚的备考任务。',
    '已登录 138****8000',
    '第 1 张 / 共 7 张',
    '这张在：馆 1 / 组 1 / 盒 1',
    '当前学习卡位于 主书架 / 当前分区 / 当前卡盒',
    '收藏标签 1 张。',
    'LEARNING / SHELL',
    '准备完成后会自动回到当前学习流。',
  ].forEach(message => {
    expect(message).toMatch(USER_VISIBLE_METADATA_PATTERN);
  });
});

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

const globalWithFetch = global as Omit<typeof global, 'fetch'> & {
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
  if (originalFetch) {
    globalWithFetch.fetch = originalFetch;
  } else {
    delete globalWithFetch.fetch;
  }
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
  expect(
    findPressableByTestId(root, 'auth-request-code-button').props.disabled,
  ).toBe(false);

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
  session?: LearningSession,
) {
  await authenticateIntoLearningBootstrap(root);
  await resolveLearningBootstrap(session);
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

  const trialButtons = root.findAllByProps({
    testID: 'membership-start-trial-button',
  });

  if (trialButtons.length > 0) {
    await ReactTestRenderer.act(async () => {
      trialButtons[0].props.onPress();
      await flushAsyncEffects();
    });
  }

  if (returnRoute === 'space') {
    await openSpaceCardList(root);
  }

  if (returnRoute !== 'space') {
    await openRoute(root, returnRoute);
  }
}

async function openSpaceCardList(root: ReactTestRenderer.ReactTestInstance) {
  const openButtons = root.findAllByProps({
    testID: 'space-open-card-list',
  });

  if (openButtons.length === 0) {
    return;
  }

  await ReactTestRenderer.act(async () => {
    openButtons[0].props.onPress();
    await flushAsyncEffects();
  });
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
  await new Promise(resolve => setTimeout(() => resolve(undefined), 0));
}

async function rejectLearningBootstrap(message: string) {
  await ReactTestRenderer.act(async () => {
    pendingSession.reject(new Error(message));
    await flushAsyncEffects();
  });
}

function readMetricValue(
  root: ReactTestRenderer.ReactTestInstance,
  testID: string,
) {
  const explicitValue = root.findAllByProps({ testID: `${testID}-value` })[0];

  if (explicitValue) {
    return explicitValue.props.children;
  }

  return root.findByProps({ testID }).findAllByType(Text)[0].props.children;
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

function createRemoteSpaceSession(
  track: 'cet4' | 'cet6' = 'cet4',
): LearningSession {
  const baseSession = createLocalLearningSession(track);
  const mapCard = (card: LearningSession['cards'][number], index: number) => ({
    ...card,
    front: {
      ...card.front,
      prompt: `远端卡片 ${index + 1}`,
    },
    space_metadata: {
      ...card.space_metadata,
      library: '远端空间',
      group: index < 3 ? '远端逻辑组' : '远端词汇组',
      box: `远端盒 ${card.space_metadata.box_ref}`,
    },
  });

  return {
    ...baseSession,
    sourceId: 'remote-space-source',
    sourceLabel: '远端卡源',
    cards: baseSession.cards.map(mapCard),
    catalogCards: baseSession.catalogCards.map(mapCard),
  };
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

function createRemoteCatalogSession(): LearningSession {
  const baseSession = createLocalLearningSession('cet4');
  const remoteCard: LearningCard = {
    ...baseSession.catalogCards[0],
    card_id: '999901',
    front: {
      ...baseSession.catalogCards[0].front,
      prompt: '远端专属题干用于空间地图验证',
    },
    knowledge_ref: '9999',
    space_metadata: {
      box: '远端专属盒',
      box_ref: '9999',
      group: '远端专属组',
      library: '远端专属库',
    },
  };

  return {
    catalogCards: [remoteCard],
    cards: [remoteCard],
    sourceId: 'remote-catalog-source',
    sourceLabel: '远端 catalog 卡源',
    track: 'cet4',
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
  const routeTabTexts = (
    ['learning', 'space', 'statistics', 'mine'] as const
  ).map(
    route =>
      tree!.root.findByProps({ testID: `route-tab-label-${route}` }).props
        .children,
  );
  expect(routeTabTexts).toEqual(['学习', '空间', '统计', '我的']);
  expect(routeTabTexts).not.toEqual(
    expect.arrayContaining(['练', '位', '记', '我']),
  );
  expect(output).toContain('登录后继续学习');
  expect(output).toContain('当前卡 · 四选一');
  expect(output).toContain('已保留');
  expect(output).toContain('原位保留');
  expect(output).toContain('手机号验证');
  expect(output).toContain('输入手机号');
  expect(output).toContain('输入手机号，完成后回到当前卡。');
  expect(output).toContain('待输入');
  const routeObjectScreenStyle = StyleSheet.flatten(
    tree!.root.findByProps({ testID: 'auth-route-object-screen' }).props.style,
  );
  expect(routeObjectScreenStyle.justifyContent).toBe('flex-start');
  expect(routeObjectScreenStyle.paddingTop).toBe(2);
  const routeObjectCardStyle = StyleSheet.flatten(
    tree!.root.findByProps({ testID: 'auth-route-object-card' }).props.style,
  );
  expect(routeObjectCardStyle.justifyContent).toBe('flex-start');
  expect(routeObjectCardStyle.minHeight).toBe(0);
  const requestDockStyle = StyleSheet.flatten(
    tree!.root.findByProps({ testID: 'auth-request-inline-dock' }).props.style,
  );
  expect(requestDockStyle.borderWidth).toBe(1);
  expect(requestDockStyle.borderRadius).toBe(18);
  expect(
    findPressableByTestId(tree!.root, 'auth-request-code-button').props
      .disabled,
  ).toBe(true);
});

test('keeps protected route auth gates attached to the selected object', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;

  expect(JSON.stringify(tree!.toJSON())).toContain('登录后继续学习');
  expect(JSON.stringify(tree!.toJSON())).toContain('当前卡 · 四选一');

  await openRoute(root, 'space');
  let output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('登录后查看空间');
  expect(output).toContain('空间 · 当前位置');
  expect(output).toContain('库组盒');
  expect(output).toContain('登录后同步');
  expect(output).toContain('完成后回到当前位置');
  expect(output).not.toContain('登录后继续学习');
  expect(output).not.toContain('当前学习');

  await openRoute(root, 'statistics');
  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('登录后查看今日进展');
  expect(output).toContain('今日进展 · 待同步');
  expect(output).toContain('完成后回到今日进展');
  expect(output).toContain('回看');
  expect(output).toContain('签到');
  expect(output).not.toContain('登录后查看空间');
  expect(output).not.toContain('当前学习');
});

test('keeps signed-out mine as an account object instead of a learning gate', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await openRoute(root, 'mine');

  const output = JSON.stringify(tree!.toJSON());
  const mineProfileCard = root.findByProps({ testID: 'mine-profile-card' });
  expect(output).toContain('确认账号后继续');
  expect(output).toContain('学习记录、空间位置和会员权益会归到同一账号。');
  expect(output).toContain('账号承接 · 待确认');
  expect(output).toContain('记录');
  expect(output).toContain('空间');
  expect(output).toContain('权益');
  expect(output).toContain('手机验证');
  expect(output).toContain('输入手机号，完成后回到我的。');
  expect(output).not.toContain('确认身份继续学');
  expect(output).not.toContain('当前学习卡');
  expect(collectRenderedText(tree!.toJSON())).not.toEqual(
    expect.arrayContaining(['我']),
  );
  expect(
    mineProfileCard.findByProps({ testID: 'auth-retained-ledger' }),
  ).toBeTruthy();
  expect(
    mineProfileCard.findAllByProps({ testID: 'auth-retained-ledger-row' })
      .length,
  ).toBeGreaterThanOrEqual(3);
  expect(
    mineProfileCard.findByProps({ testID: 'auth-phone-input' }),
  ).toBeTruthy();
  expect(
    mineProfileCard.findByProps({ testID: 'auth-request-inline-dock' }),
  ).toBeTruthy();
  const requestActionRowStyle = StyleSheet.flatten(
    mineProfileCard.findByProps({ testID: 'auth-request-action-row' }).props
      .style,
  );
  expect(requestActionRowStyle.flexDirection).toBe('column');
  const requestButtonStyle = StyleSheet.flatten(
    findPressableByTestId(root, 'auth-request-code-button').props.style,
  );
  expect(requestButtonStyle.width).toBe('100%');
  expect(requestButtonStyle.minWidth).toBe(0);

  await ReactTestRenderer.act(() => {
    root
      .findByProps({ testID: 'auth-phone-input' })
      .props.onChangeText('13800138000');
  });

  const readyOutput = JSON.stringify(tree!.toJSON());
  expect(readyOutput).toContain('手机号已准备好');
  expect(readyOutput).toContain('验证码通过后回到我的。');
  expect(readyOutput).toContain('可发送');
  expect(readyOutput).toContain('发送短码');
  expect(
    mineProfileCard.findByProps({ testID: 'auth-request-readiness-pill' }),
  ).toBeTruthy();
  expect(
    findPressableByTestId(root, 'auth-request-code-button').props.disabled,
  ).toBe(false);
});

test('keeps mine code-sent state attached to the account object', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await openRoute(root, 'mine');

  await ReactTestRenderer.act(() => {
    root
      .findByProps({ testID: 'auth-phone-input' })
      .props.onChangeText('13800138000');
  });

  await ReactTestRenderer.act(async () => {
    root.findByProps({ testID: 'auth-request-code-button' }).props.onPress();
    await flushAsyncEffects();
  });

  const output = JSON.stringify(tree!.toJSON());
  const mineProfileCard = root.findByProps({ testID: 'mine-profile-card' });
  expect(output).toContain('验证码已发');
  expect(output).toContain('输入验证码');
  expect(output).toContain('验证中');
  expect(output).toContain('验证码已发送');
  expect(output).toContain('完成后回到');
  expect(output).toContain('我的');
  expect(
    mineProfileCard.findByProps({ testID: 'auth-code-inline-dock' }),
  ).toBeTruthy();
  expect(
    mineProfileCard.findByProps({ testID: 'auth-code-input' }),
  ).toBeTruthy();
  const inlineDockStyle = StyleSheet.flatten(
    root.findByProps({ testID: 'auth-code-inline-dock' }).props.style,
  );
  expect(inlineDockStyle.borderWidth).toBe(1);
  expect(inlineDockStyle.borderRadius).toBe(20);
  const entryRowStyle = StyleSheet.flatten(
    root.findByProps({ testID: 'auth-code-entry-row' }).props.style,
  );
  expect(entryRowStyle.flexDirection).toBe('column');
  const submitButtonStyle = StyleSheet.flatten(
    findPressableByTestId(root, 'auth-submit-button').props.style,
  );
  expect(submitButtonStyle.width).toBe('100%');
  expect(submitButtonStyle.minWidth).toBe(0);
  expect(findPressableByTestId(root, 'auth-submit-button').props.disabled).toBe(
    true,
  );
  expect(output).not.toContain('未登录');
  expect(output).not.toContain('等待登录');
  expect(output).not.toContain('待登录');
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
  expect(output).toContain('输入手机号，完成后回到当前卡。');
  expect(output).not.toContain('输入验证码即可完成登录。');
});

test('uses native initial remote runtime profile before the shell mounts', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <App
        softbookRemoteRuntimeProfile={{
          baseUrl: 'https://api.softbook.example',
          learningTrack: 'cet6',
        }}
      />,
    );
  });

  const output = JSON.stringify(tree!.toJSON());
  expect(global.__SOFTBOOK_CET_RUNTIME_CONFIG__).toMatchObject({
    auth: {
      mode: 'remote',
      remote: {
        baseUrl: 'https://api.softbook.example',
      },
    },
    learningTrack: 'cet6',
    learningSource: {
      mode: 'remote',
      track: 'cet6',
    },
  });
  expect(output).toContain('输入手机号，完成后回到当前卡。');
  expect(output).not.toContain('输入验证码即可完成登录。');
});

test('shows remote request-code failure inside the auth gate', async () => {
  global.__SOFTBOOK_CET_RUNTIME_CONFIG__ = {
    auth: {
      mode: 'remote',
      remote: {
        baseUrl: 'https://api.softbook.example',
      },
    },
  };

  mockFetch.mockImplementation(async input => {
    if (input === 'https://api.softbook.example/v1/auth/request-code') {
      return createJsonResponse({}, 503);
    }

    throw new Error(`Unexpected remote fetch: ${input}`);
  });

  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;

  await ReactTestRenderer.act(() => {
    root
      .findByProps({ testID: 'auth-phone-input' })
      .props.onChangeText('13800138000');
  });

  await ReactTestRenderer.act(async () => {
    root.findByProps({ testID: 'auth-request-code-button' }).props.onPress();
    await flushAsyncEffects();
  });

  const output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('验证码暂时没发出。');
  expect(output).not.toContain('验证码发送暂时失败（503）。');
  expect(output).not.toContain('（503）');
  expect(output).toContain('短码暂时没发出');
  expect(output).toContain('检查手机号后再试，当前位置仍保留。');
  expect(output).toContain('可重试');
  expect(output).toContain('验证码通过后回到当前卡。');
  expect(root.findByProps({ testID: 'auth-error-dock' })).toBeTruthy();
  expect(root.findByProps({ testID: 'auth-error-title' })).toBeTruthy();
  expect(root.findByProps({ testID: 'auth-error-detail' })).toBeTruthy();
  expect(root.findByProps({ testID: 'auth-error-retry-pill' })).toBeTruthy();
  expectNoUserVisibleMetadataLeakage(tree!);
});

test('shows remote verify-code failure inside the auth gate', async () => {
  global.__SOFTBOOK_CET_RUNTIME_CONFIG__ = {
    auth: {
      mode: 'remote',
      remote: {
        baseUrl: 'https://api.softbook.example',
      },
    },
  };

  mockFetch.mockImplementation(async input => {
    if (input === 'https://api.softbook.example/v1/auth/request-code') {
      return createJsonResponse({});
    }

    if (input === 'https://api.softbook.example/v1/auth/verify-code') {
      return createJsonResponse({}, 401);
    }

    throw new Error(`Unexpected remote fetch: ${input}`);
  });

  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;

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

  let output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('验证码已发送');
  expect(output).toContain('已发送到');
  expect(output).toContain('138****8000');
  expect(output).toContain('验证');
  expect(output).toContain('待输入');
  expect(output).toContain('完成后回到当前卡。');
  expect(output).toContain('重新发送');
  expect(output).not.toContain('等待登录');

  await ReactTestRenderer.act(async () => {
    root.findByProps({ testID: 'auth-submit-button' }).props.onPress();
    await flushAsyncEffects();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('验证码暂时没通过。');
  expect(output).not.toContain('验证码校验暂时失败（401）。');
  expect(output).not.toContain('（401）');
  expect(output).toContain('验证码暂时没通过');
  expect(output).toContain('验证码待确认');
  expect(output).toContain('检查短码后再试，当前位置仍保留。');
  expect(output).toContain('重新验证');
  expect(output).toContain('可重试');
  expect(output).toContain('4-6 位短码，完成后回到当前卡。');
  expect(root.findByProps({ testID: 'auth-error-dock' })).toBeTruthy();
  expect(root.findByProps({ testID: 'auth-error-title' })).toBeTruthy();
  expect(root.findByProps({ testID: 'auth-error-detail' })).toBeTruthy();
  expect(root.findByProps({ testID: 'auth-error-retry-pill' })).toBeTruthy();
  const codeCellsFrameStyle = StyleSheet.flatten(
    root.findByProps({ testID: 'auth-code-cells-frame' }).props.style,
  );
  expect(codeCellsFrameStyle.borderColor).toBe('rgba(201, 133, 36, 0.42)');
  expect(codeCellsFrameStyle.backgroundColor).toBe('rgba(201, 133, 36, 0.08)');
  const submitButtonStyle = StyleSheet.flatten(
    findPressableByTestId(root, 'auth-submit-button').props.style,
  );
  expect(submitButtonStyle.backgroundColor).toBe('#C98524');
  expect(submitButtonStyle.borderColor).toBe('#C98524');
  expectNoUserVisibleMetadataLeakage(tree!);
});

test('keeps verified remote auth when entitlement bootstrap is unavailable', async () => {
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

  mockFetch.mockImplementation(async (input: string, init?: MockFetchInit) => {
    fetchCalls.push({ init, input });

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
      return createJsonResponse({}, 503);
    }

    throw new Error(`Unexpected remote fetch: ${input}`);
  });

  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await authenticateIntoLearningBootstrap(root);
  await resolveLearningBootstrap();
  await waitForLearningSurface(root);
  await openRoute(root, 'mine');

  await ReactTestRenderer.act(async () => {
    await flushAsyncEffects();
  });

  const output = JSON.stringify(tree!.toJSON());
  expect(output).not.toContain('学习前先登录');
  expect(output).not.toContain('登录暂时失败。');
  expect(output).toContain('当前是基础学习态');
  expect(output).toContain('网络恢复后会自动再试。');
  expectNoUserVisibleMetadataLeakage(tree!);
  expect(
    fetchCalls.filter(
      call =>
        call.input === 'https://api.softbook.example/v1/membership/entitlement',
    ).length,
  ).toBeGreaterThanOrEqual(1);
});

test('wires remote auth, learning source config, membership, progress sync, and space sync through App', async () => {
  const fetchCalls: MockFetchCall[] = [];

  global.__SOFTBOOK_CET_RUNTIME_CONFIG__ = createSoftbookRemoteRuntimeConfig({
    apiKey: 'profile-key',
    baseUrl: 'https://api.softbook.example',
  });

  mockFetch.mockImplementation(async (input: string, init?: MockFetchInit) => {
    fetchCalls.push({ init, input });

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

    if (input === 'https://api.softbook.example/v1/learning/state-sync') {
      return createJsonResponse({});
    }

    if (input === 'https://api.softbook.example/v1/space/state-sync') {
      return createJsonResponse({});
    }

    throw new Error(`Unexpected remote fetch: ${input}`);
  });

  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const repositoryConfig =
    mockCreateLearningSessionRepository.mock.calls[0]?.[0];
  expect(repositoryConfig).toMatchObject({
    fallbackToLocalOnRemoteError: true,
    mode: 'remote',
    remoteConfig: {
      apiKey: 'profile-key',
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
    root.findByProps({ testID: 'learning-favorite-button' }).props.onPress();
  });

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

  await openRoute(root, 'statistics');

  await ReactTestRenderer.act(async () => {
    await flushAsyncEffects();
  });

  const output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('已同步');
  expect(output).toContain('今天的学习进展已推送到云端。');

  const membershipRequest = fetchCalls.find(
    call =>
      call.input === 'https://api.softbook.example/v1/membership/entitlement',
  );
  expect(membershipRequest?.init?.headers).toMatchObject({
    Authorization: 'Bearer remote-auth-token',
    'x-api-key': 'profile-key',
  });

  const progressSyncRequest = fetchCalls.find(
    call =>
      call.input === 'https://api.softbook.example/v1/progress/daily-sync',
  );
  expect(progressSyncRequest?.init?.headers).toMatchObject({
    Authorization: 'Bearer remote-auth-token',
    'content-type': 'application/json',
    'x-api-key': 'profile-key',
  });
  expect(progressSyncRequest?.init?.body).toContain('"day_key"');
  expect(progressSyncRequest?.init?.body).toContain(
    '"learning_completed_count":1',
  );

  const learningStateRequest = fetchCalls.find(
    call =>
      call.input === 'https://api.softbook.example/v1/learning/state-sync',
  );
  expect(learningStateRequest?.init?.headers).toMatchObject({
    Authorization: 'Bearer remote-auth-token',
    'content-type': 'application/json',
    'x-api-key': 'profile-key',
  });
  expect(learningStateRequest?.init?.body).toContain('"events"');
  expect(learningStateRequest?.init?.body).toContain('"phase":"learning"');
  expect(learningStateRequest?.init?.body).toContain('"completed_at"');

  const spaceSyncRequest = fetchCalls.find(
    call => call.input === 'https://api.softbook.example/v1/space/state-sync',
  );
  expect(spaceSyncRequest?.init?.headers).toMatchObject({
    Authorization: 'Bearer remote-auth-token',
    'content-type': 'application/json',
    'x-api-key': 'profile-key',
  });
  expect(spaceSyncRequest?.init?.body).toContain('"states"');
  expect(spaceSyncRequest?.init?.body).toContain('"is_favorited":true');
});

test('space map uses the active learning session catalog', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await loginIntoLearningFlow(root, createRemoteCatalogSession());
  await openRoute(root, 'space');

  await ReactTestRenderer.act(async () => {
    await flushAsyncEffects();
  });

  const renderedText = collectRenderedText(tree!.toJSON()).join(' ');
  expect(renderedText).toContain('远端专属题干用于空间地图验证');
  expect(renderedText).not.toContain('远端专属库');
  expect(renderedText).not.toContain('远端专属组');
  expect(renderedText).not.toContain('远端专属盒');
});

test('queues failed remote daily progress sync for later replay', async () => {
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

  mockFetch.mockImplementation(async (input: string) => {
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
      return createJsonResponse({}, 503);
    }

    throw new Error(`Unexpected remote fetch: ${input}`);
  });

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
    root
      .findByProps({ testID: 'learning-flip-confident-button' })
      .props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-next-button' }).props.onPress();
  });

  await openRoute(root, 'statistics');

  await ReactTestRenderer.act(async () => {
    await flushAsyncEffects();
  });

  const output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('待重试');
  expect(output).toContain('网络恢复后会自动再试');
  expectNoUserVisibleMetadataLeakage(tree!);
});

test('queues failed remote learning state sync for later replay', async () => {
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
    learningState: {
      mode: 'remote',
      remote: {
        baseUrl: 'https://api.softbook.example',
      },
    },
  };

  mockFetch.mockImplementation(async (input: string) => {
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

    if (input === 'https://api.softbook.example/v1/learning/state-sync') {
      return createJsonResponse({}, 503);
    }

    throw new Error(`Unexpected remote fetch: ${input}`);
  });

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
    root
      .findByProps({ testID: 'learning-flip-confident-button' })
      .props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-next-button' }).props.onPress();
  });

  await openRoute(root, 'mine');

  await ReactTestRenderer.act(async () => {
    await flushAsyncEffects();
  });

  const output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('记录待重试');
  expectNoUserVisibleMetadataLeakage(tree!);
});

test('replays queued daily progress after network reconnect', async () => {
  const { emitNetInfoState } = jest.requireMock(
    '@react-native-community/netinfo',
  );
  let shouldFailProgressSync = true;
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

  mockFetch.mockImplementation(async (input: string, init?: MockFetchInit) => {
    fetchCalls.push({ init, input });

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
      return shouldFailProgressSync
        ? createJsonResponse({}, 503)
        : createJsonResponse({});
    }

    throw new Error(`Unexpected remote fetch: ${input}`);
  });

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
    root
      .findByProps({ testID: 'learning-flip-confident-button' })
      .props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-next-button' }).props.onPress();
  });

  await openRoute(root, 'statistics');

  await ReactTestRenderer.act(async () => {
    await flushAsyncEffects();
  });

  expect(JSON.stringify(tree!.toJSON())).toContain('待重试');

  shouldFailProgressSync = false;

  await ReactTestRenderer.act(async () => {
    emitNetInfoState({ isConnected: true, isInternetReachable: true });
    await flushAsyncEffects();
  });

  const output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('已同步');
  expect(output).toContain('网络恢复后，今天的学习进展已同步。');
  expect(
    fetchCalls.filter(
      call =>
        call.input === 'https://api.softbook.example/v1/progress/daily-sync',
    ).length,
  ).toBeGreaterThanOrEqual(2);
});

test('replays queued learning state after network reconnect', async () => {
  const { emitNetInfoState } = jest.requireMock(
    '@react-native-community/netinfo',
  );
  let shouldFailLearningStateSync = true;
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
    learningState: {
      mode: 'remote',
      remote: {
        baseUrl: 'https://api.softbook.example',
      },
    },
  };

  mockFetch.mockImplementation(async (input: string, init?: MockFetchInit) => {
    fetchCalls.push({ init, input });

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

    if (input === 'https://api.softbook.example/v1/learning/state-sync') {
      return shouldFailLearningStateSync
        ? createJsonResponse({}, 503)
        : createJsonResponse({});
    }

    throw new Error(`Unexpected remote fetch: ${input}`);
  });

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
    root
      .findByProps({ testID: 'learning-flip-confident-button' })
      .props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-next-button' }).props.onPress();
  });

  await openRoute(root, 'mine');

  await ReactTestRenderer.act(async () => {
    await flushAsyncEffects();
  });

  expect(JSON.stringify(tree!.toJSON())).toContain('记录待重试');

  shouldFailLearningStateSync = false;

  await ReactTestRenderer.act(async () => {
    emitNetInfoState({ isConnected: true, isInternetReachable: true });
    await flushAsyncEffects();
  });

  const output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('记录已保存');
  expect(
    fetchCalls.filter(
      call =>
        call.input === 'https://api.softbook.example/v1/learning/state-sync',
    ).length,
  ).toBeGreaterThanOrEqual(2);
});

test('replays queued space state after network reconnect', async () => {
  const { emitNetInfoState } = jest.requireMock(
    '@react-native-community/netinfo',
  );
  let shouldFailSpaceSync = true;
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
    spaceState: {
      mode: 'remote',
      remote: {
        baseUrl: 'https://api.softbook.example',
      },
    },
  };

  mockFetch.mockImplementation(async (input: string, init?: MockFetchInit) => {
    fetchCalls.push({ init, input });

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

    if (input === 'https://api.softbook.example/v1/space/state-sync') {
      return shouldFailSpaceSync
        ? createJsonResponse({}, 503)
        : createJsonResponse({});
    }

    throw new Error(`Unexpected remote fetch: ${input}`);
  });

  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await loginIntoLearningFlow(root);

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-favorite-button' }).props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    await flushAsyncEffects();
  });

  await openRoute(root, 'space');

  let output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('空间状态待重试');
  expect(output).toContain('当前空间仍可继续使用');
  expect(
    root.findAllByProps({ testID: 'space-sync-rail' }).length,
  ).toBeGreaterThan(0);
  expectNoUserVisibleMetadataLeakage(tree!);

  shouldFailSpaceSync = false;

  await ReactTestRenderer.act(async () => {
    emitNetInfoState({ isConnected: true, isInternetReachable: true });
    await flushAsyncEffects();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('空间状态已同步');
  expect(output).toContain('网络恢复后，空间收藏和休眠状态已同步。');

  expect(
    fetchCalls.filter(
      call => call.input === 'https://api.softbook.example/v1/space/state-sync',
    ).length,
  ).toBeGreaterThanOrEqual(2);
});

test('replays queued membership refresh after network reconnect', async () => {
  const { emitNetInfoState } = jest.requireMock(
    '@react-native-community/netinfo',
  );
  let entitlementRequestCount = 0;
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

  mockFetch.mockImplementation(async (input: string, init?: MockFetchInit) => {
    fetchCalls.push({ init, input });

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
      entitlementRequestCount += 1;

      if (entitlementRequestCount === 2) {
        return createJsonResponse({}, 503);
      }

      return createJsonResponse(
        createRemoteMembershipPayload(
          entitlementRequestCount >= 3 ? 'premium' : 'free',
        ),
      );
    }

    throw new Error(`Unexpected remote fetch: ${input}`);
  });

  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await loginIntoLearningFlow(root);
  await openRoute(root, 'mine');

  await ReactTestRenderer.act(async () => {
    await flushAsyncEffects();
  });

  expect(JSON.stringify(tree!.toJSON())).toContain('网络恢复后会自动再试');

  await ReactTestRenderer.act(async () => {
    emitNetInfoState({ isConnected: true, isInternetReachable: true });
    await flushAsyncEffects();
  });

  const output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('当前是会员态');
  expect(output).not.toContain('网络恢复后会自动再试');
  expect(
    fetchCalls.filter(
      call =>
        call.input === 'https://api.softbook.example/v1/membership/entitlement',
    ).length,
  ).toBeGreaterThanOrEqual(2);
});

test('requires explicit remote trial start from protected space', async () => {
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

  mockFetch.mockImplementation(async (input: string, init?: MockFetchInit) => {
    fetchCalls.push({ init, input });

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
        createRemoteMembershipPayload('trial_available'),
      );
    }

    if (input === 'https://api.softbook.example/v1/membership/start-trial') {
      return createJsonResponse(createRemoteMembershipPayload('trial'));
    }

    throw new Error(`Unexpected remote fetch: ${input}`);
  });

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
  expect(output).toContain('当前卡盒');
  expect(output).toContain('完整物理空间需要试用或会员');

  expect(
    fetchCalls.find(
      call =>
        call.input === 'https://api.softbook.example/v1/membership/start-trial',
    ),
  ).toBeUndefined();

  await ReactTestRenderer.act(async () => {
    root
      .findByProps({ testID: 'membership-start-trial-button' })
      .props.onPress();
    await flushAsyncEffects();
  });

  const startTrialRequest = fetchCalls.find(
    call =>
      call.input === 'https://api.softbook.example/v1/membership/start-trial',
  );
  expect(startTrialRequest?.init?.headers).toMatchObject({
    Authorization: 'Bearer remote-auth-token',
  });

  const unlockedSpaceText = JSON.stringify(tree!.toJSON());
  expect(unlockedSpaceText).toContain('当前盒桌');
  expect(unlockedSpaceText).toContain('盒内对象');
  expect(unlockedSpaceText).toContain('回学习');
});

test('falls back to local trial unlock and replays remote trial start later', async () => {
  const fetchCalls: MockFetchCall[] = [];
  let startTrialRequestCount = 0;

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

  mockFetch.mockImplementation(async (input: string, init?: MockFetchInit) => {
    fetchCalls.push({ init, input });

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
        createRemoteMembershipPayload(
          startTrialRequestCount >= 2 ? 'trial' : 'trial_available',
        ),
      );
    }

    if (input === 'https://api.softbook.example/v1/membership/start-trial') {
      startTrialRequestCount += 1;

      if (startTrialRequestCount === 1) {
        return createJsonResponse({}, 503);
      }

      return createJsonResponse(createRemoteMembershipPayload('trial'));
    }

    throw new Error(`Unexpected remote fetch: ${input}`);
  });

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

  let output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('当前卡盒');
  expect(output).toContain('完整物理空间需要试用或会员');
  expect(startTrialRequestCount).toBe(0);

  await ReactTestRenderer.act(async () => {
    root
      .findByProps({ testID: 'membership-start-trial-button' })
      .props.onPress();
    await flushAsyncEffects();
  });

  expect(startTrialRequestCount).toBe(1);

  await openRoute(root, 'statistics');

  await ReactTestRenderer.act(async () => {
    await flushAsyncEffects();
  });

  expect(startTrialRequestCount).toBe(2);

  await openRoute(root, 'mine');

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('完整试用进行中');
  expect(output).not.toContain('试用待开始');

  const startTrialRequests = fetchCalls.filter(
    call =>
      call.input === 'https://api.softbook.example/v1/membership/start-trial',
  );
  expect(startTrialRequests).toHaveLength(2);
});

test('space surface follows the loaded session catalog instead of local fixtures', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await authenticateIntoLearningBootstrap(root);
  await resolveLearningBootstrap(createRemoteSpaceSession());
  await waitForLearningSurface(root);
  await startTrialFromProtectedEntry(root, 'space');

  const renderedText = collectRenderedText(tree!.toJSON()).join(' ');
  expect(renderedText).toContain('远端卡片 1');
  expect(renderedText).not.toContain('远端空间');
  expect(renderedText).not.toContain('远端逻辑组');
  expect(renderedText).not.toContain('远端词汇组');
  expect(renderedText).not.toContain('远端盒 0020');
  expect(renderedText).not.toContain('听力');
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

  mockFetch.mockImplementation(async (input: string, init?: MockFetchInit) => {
    fetchCalls.push({ init, input });

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
  });

  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await loginIntoLearningFlow(root);
  await openRoute(root, 'space');

  let output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('完整物理空间需要试用或会员');
  expect(output).toContain('当前卡盒');
  expect(
    root.findAllByProps({ testID: 'space-gate-rail' }).length,
  ).toBeGreaterThan(0);
  expect(
    root.findAllByProps({ testID: 'membership-paywall-space' }),
  ).toHaveLength(0);

  await ReactTestRenderer.act(async () => {
    root.findByProps({ testID: 'membership-purchase-button' }).props.onPress();
    await flushAsyncEffects();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('当前卡盒');
  expect(output).toContain('当前盒桌');
  expect(output).toContain('盒内对象');
  expect(output).toContain('回学习');
  expect(root.findAllByProps({ testID: 'space-gate-rail' })).toHaveLength(0);
  expect(
    root.findAllByProps({ testID: 'space-open-box-lid' }).length,
  ).toBeGreaterThan(0);
  expect(
    root.findAllByProps({ testID: 'space-sleep-alcove' }).length,
  ).toBeGreaterThan(0);

  const purchaseRequest = fetchCalls.find(
    call =>
      call.input === 'https://api.softbook.example/v1/membership/purchase',
  );
  expect(purchaseRequest?.init?.headers).toMatchObject({
    Authorization: 'Bearer remote-auth-token',
  });
});

test('keeps remote purchase failure copy user-facing', async () => {
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

  mockFetch.mockImplementation(async (input: string) => {
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
      return createJsonResponse({}, 503);
    }

    throw new Error(`Unexpected remote fetch: ${input}`);
  });

  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await loginIntoLearningFlow(root);
  await openRoute(root, 'space');

  await ReactTestRenderer.act(async () => {
    root.findByProps({ testID: 'membership-purchase-button' }).props.onPress();
    await flushAsyncEffects();
  });

  const output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('会员状态更新暂时失败。');
  expect(output).not.toContain('会员状态更新暂时失败（503）。');
  expect(output).not.toContain('（503）');
  expectNoUserVisibleMetadataLeakage(tree!);
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

  mockFetch.mockImplementation(async (input: string, init?: MockFetchInit) => {
    fetchCalls.push({ init, input });

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
  });

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
    root.findAllByProps({ testID: 'membership-dismiss-recovery-button' })
      .length,
  ).toBeGreaterThan(0);

  await ReactTestRenderer.act(async () => {
    root
      .findByProps({ testID: 'membership-dismiss-recovery-button' })
      .props.onPress();
    await flushAsyncEffects();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(output).not.toContain('恢复购买提醒');
  expect(
    root.findAllByProps({ testID: 'membership-dismiss-recovery-button' })
      .length,
  ).toBe(0);

  const dismissRecoveryRequest = fetchCalls.find(
    call =>
      call.input ===
      'https://api.softbook.example/v1/membership/dismiss-recovery',
  );
  expect(dismissRecoveryRequest?.init?.headers).toMatchObject({
    Authorization: 'Bearer remote-auth-token',
  });
});

test('keeps remote recovery-dismiss failure copy user-facing', async () => {
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

  mockFetch.mockImplementation(async (input: string) => {
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
      return createJsonResponse({}, 503);
    }

    throw new Error(`Unexpected remote fetch: ${input}`);
  });

  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await loginIntoLearningFlow(root);
  await openRoute(root, 'mine');

  await ReactTestRenderer.act(async () => {
    root
      .findByProps({ testID: 'membership-dismiss-recovery-button' })
      .props.onPress();
    await flushAsyncEffects();
  });

  const output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('会员状态更新暂时失败。');
  expect(output).not.toContain('会员状态更新暂时失败（503）。');
  expect(output).not.toContain('（503）');
  expectNoUserVisibleMetadataLeakage(tree!);
});

test('refreshes remote entitlement when opening mine and keeps later gates in sync', async () => {
  const fetchCalls: MockFetchCall[] = [];
  let entitlementRequestCount = 0;

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

  mockFetch.mockImplementation(async (input: string, init?: MockFetchInit) => {
    fetchCalls.push({ init, input });

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
      entitlementRequestCount += 1;

      return createJsonResponse(
        createRemoteMembershipPayload(
          entitlementRequestCount === 1 ? 'free' : 'premium',
        ),
      );
    }

    throw new Error(`Unexpected remote fetch: ${input}`);
  });

  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await loginIntoLearningFlow(root);
  await openRoute(root, 'mine');

  await ReactTestRenderer.act(async () => {
    await flushAsyncEffects();
  });

  let output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('当前是会员态');
  await openRoute(root, 'space');

  await ReactTestRenderer.act(async () => {
    await flushAsyncEffects();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('当前卡盒');
  expect(output).toContain('当前盒桌');
  expect(output).toContain('盒内对象');
  expect(output).toContain('回学习');
  expect(
    fetchCalls.filter(
      call =>
        call.input === 'https://api.softbook.example/v1/membership/entitlement',
    ),
  ).toHaveLength(2);
});

test('refreshes remote entitlement again after leaving mine and reopening it', async () => {
  let entitlementRequestCount = 0;

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

  mockFetch.mockImplementation(async (input: string) => {
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
      entitlementRequestCount += 1;

      return createJsonResponse(
        createRemoteMembershipPayload(
          entitlementRequestCount >= 3 ? 'premium' : 'free',
        ),
      );
    }

    throw new Error(`Unexpected remote fetch: ${input}`);
  });

  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await loginIntoLearningFlow(root);
  await openRoute(root, 'mine');

  await ReactTestRenderer.act(async () => {
    await flushAsyncEffects();
  });

  let output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('当前是基础学习态');

  await openRoute(root, 'learning');

  await ReactTestRenderer.act(async () => {
    await flushAsyncEffects();
  });

  await openRoute(root, 'mine');

  await ReactTestRenderer.act(async () => {
    await flushAsyncEffects();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('当前是会员态');
  expect(entitlementRequestCount).toBe(3);
});

test('can unlock the learning flow after fake sms verification', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await loginIntoLearningFlow(root);

  const output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('位置已保持');
  expect(output).toContain('先判断，再确认解析');
  expect(output).toContain('账户');
  expect(output).toContain('已确认');
  expect(output).not.toContain('已登录 138****8000');
  expect(output).toContain('however');
  const addressAperture = root.findByProps({
    testID: 'learning-address-aperture',
  });
  const addressText = addressAperture.findByType(Text).props.children;
  expect(addressText).toBe('同盒位置已保持');
  expect(
    root.findByProps({ testID: 'learning-card-address-shelf' }),
  ).toBeTruthy();
  expect(
    root.findByProps({ testID: 'learning-card-location-strip' }),
  ).toBeTruthy();
  expect(output).not.toContain('这张在：馆 1 / 组 1 / 盒 1');
  expect(output).toContain('当前卡 · ');
  expect(output).not.toContain('这张练习 · ');
  expect(output).not.toContain('当前卡 · 002001');
  expect(output).not.toContain('CET4');
  expect(output).not.toContain('训练轨道');
  expect(output).not.toContain('现在做');
  expect(output).not.toContain('答题区');
  expect(output).toContain('收藏');
  expect(output).toContain('查看提示');
  expect(output).not.toContain('要一点线索');
  expect(output).not.toContain('收起这点线索');
  expectNoUserVisibleMetadataLeakage(tree!);

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'shell-account-chip' }).props.onPress();
  });

  const accountOutput = JSON.stringify(tree!.toJSON());
  expect(accountOutput).toContain('我的');
  expect(accountOutput).toContain('学习账户');
  expect(root.findByProps({ testID: 'mine-profile-card' })).toBeTruthy();
});

test('does not expose internal metadata copy on primary surfaces', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await loginIntoLearningFlow(root);

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-peek-button' }).props.onPress();
  });
  expectNoUserVisibleMetadataLeakage(tree!);

  await openRoute(root, 'space');
  expectNoUserVisibleMetadataLeakage(tree!);

  await openRoute(root, 'statistics');
  expectNoUserVisibleMetadataLeakage(tree!);

  await openRoute(root, 'mine');
  expectNoUserVisibleMetadataLeakage(tree!);
});

test('keeps phone primary surfaces inside one-screen app panels', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  expect(root.findAllByType(ScrollView)).toHaveLength(0);

  await loginIntoLearningFlow(root);
  expect(root.findAllByType(ScrollView)).toHaveLength(0);

  await openRoute(root, 'space');
  expect(root.findAllByType(ScrollView)).toHaveLength(0);

  await openRoute(root, 'statistics');
  expect(root.findAllByType(ScrollView)).toHaveLength(0);

  await openRoute(root, 'mine');
  expect(root.findAllByType(ScrollView)).toHaveLength(0);
});

test('can boot the app into cet6 through runtime config', async () => {
  global.__SOFTBOOK_CET_RUNTIME_CONFIG__ = {
    learningTrack: 'cet6',
  };

  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await authenticateIntoLearningBootstrap(root);
  await resolveLearningBootstrap(createLocalLearningSession('cet6'));
  await waitForLearningSurface(root);

  expect(mockLoadSession).toHaveBeenLastCalledWith(
    expect.objectContaining({
      phoneNumber: '13800138000',
    }),
    'cet6',
  );
  const output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('本轮学习卡');
  expect(output).not.toContain('CET6');
  expectNoUserVisibleMetadataLeakage(tree!);
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
  expect(output).toContain('本轮学习暂时不可用');
  expect(output).toContain('本轮卡片加载失败。');
  expect(output).toContain('重新加载本轮卡片');

  pendingSession = createDeferred<LearningSession>();

  await ReactTestRenderer.act(async () => {
    root
      .findByProps({ testID: 'learning-bootstrap-retry-button' })
      .props.onPress();
    await flushAsyncEffects();
  });

  await resolveLearningBootstrap();
  await waitForLearningSurface(root);

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('however');
});

test('keeps source bootstrap loading and errors attached to space', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await authenticateIntoLearningBootstrap(root);
  await openRoute(root, 'space');

  let output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('正在整理空间内容');
  expect(output).toContain('空间当前位置会先保留在原位');
  expect(
    root.findAllByProps({ testID: 'space-status-rail' }).length,
  ).toBeGreaterThan(0);
  expect(
    root.findAllByProps({ testID: 'space-current-box-tray' }).length,
  ).toBeGreaterThan(0);

  await rejectLearningBootstrap('空间卡源暂时不可达。');

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('空间内容暂时不可用');
  expect(output).toContain('本轮卡片加载失败。');
  expect(output).toContain('重新加载空间内容');
  expect(
    root.findAllByProps({ testID: 'space-status-rail' }).length,
  ).toBeGreaterThan(0);

  pendingSession = createDeferred<LearningSession>();

  await ReactTestRenderer.act(async () => {
    root
      .findByProps({ testID: 'space-bootstrap-retry-button' })
      .props.onPress();
    await flushAsyncEffects();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('正在整理空间内容');

  await resolveLearningBootstrap();

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('当前卡盒');
  expect(root.findAllByProps({ testID: 'space-status-rail' })).toHaveLength(0);
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
  expect(output).toContain('先看这张卡的关键点');
  expect(output).not.toContain('knowledge_ref');
  expect(output).toContain('给出真正立场');

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-flip-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root
      .findByProps({ testID: 'learning-flip-confident-button' })
      .props.onPress();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('已记录本次结果');
  expect(output).toContain('继续下一张');
  expectNoUserVisibleMetadataLeakage(tree!);

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
    root
      .findByProps({ testID: 'learning-open-result-detail-button' })
      .props.onPress();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(
    root.findByProps({
      testID: 'learning-result-detail-screen',
    }),
  ).toBeTruthy();
  expect(output).toContain('当前卡');
  expect(output).toContain('结果在当前卡');
  expect(output).toContain('选择、答案和解释都在当前卡里');
  expect(output).toContain('你的选择');
  expect(output).toContain('正确答案');
  expect(output).toContain('已作答 · 答对');
  expectNoUserVisibleMetadataLeakage(tree!);

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
  expect(output).toContain('本轮学习已走完');
  expect(output).toContain('下一步');
  expect(output).toContain('这一轮已经完成，可以重新练这轮卡。');
  expect(output).toContain('重新练这轮卡');
  expect(output).not.toContain('当前卡组');
  expect(output).not.toContain('系统顺序');
  expect(output).not.toContain('系统顺序学习');
  expectNoUserVisibleMetadataLeakage(tree!);

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

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'route-tab-statistics' }).props.onPress();
  });

  let output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('先处理回看');
  expect(output).toContain('开始回看');
  expect(output).toContain('统计只提醒。');
  expect(
    findPressableByTestId(root, 'statistics-start-review-button'),
  ).toBeTruthy();

  await ReactTestRenderer.act(() => {
    root
      .findByProps({ testID: 'statistics-start-review-button' })
      .props.onPress();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('本轮回看');
  expect(output).toContain('需要再看的卡已放到眼前');
  expect(output).toContain('however');
  expectNoUserVisibleMetadataLeakage(tree!);

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

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('本轮回看已走完');
  expect(output).toContain('回到首轮重新开始');

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'route-tab-statistics' }).props.onPress();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('已回看 1 · 待回看 0');
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
    root
      .findByProps({ testID: 'learning-flip-confident-button' })
      .props.onPress();
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
  expect(output).toContain('学习手感保持中');
  expect(output).toContain('今日节奏');
  expect(output).toContain('可以记录今天');
  expect(output).toContain('下一步');
  expect(output).toContain('继续下一张');
  expect(output).toContain('继续学习');
  expect(output).toContain('今日可签到');
  expect(output).toContain('已有有效学习进展，可以记录今天。');
  expect(output).toContain('已记录');
  expect(output).not.toContain('今日统计与签到');
  expect(output).not.toContain('练习信号');
  const progressDock = root.findByProps({
    testID: 'statistics-progress-dock',
  });
  expect(progressDock).toBeTruthy();
  expect(
    root.findByProps({ testID: 'statistics-progress-ratio' }).props.children,
  ).toBe('1/1');
  const progressFillStyle = StyleSheet.flatten(
    root.findByProps({ testID: 'statistics-progress-fill' }).props.style,
  );
  expect(progressFillStyle.width).toBe('100%');
  const actionDock = root.findByProps({ testID: 'statistics-action-dock' });
  expect(
    actionDock.findAllByProps({ testID: 'statistics-next-step-card' }).length,
  ).toBeGreaterThan(0);
  expect(
    actionDock.findAllByProps({ testID: 'statistics-go-learning-button' })
      .length,
  ).toBeGreaterThan(0);
  expect(
    actionDock.findAllByProps({ testID: 'statistics-checkin-card' }).length,
  ).toBeGreaterThan(0);
  expect(
    actionDock.findAllByProps({ testID: 'statistics-checkin-button' }).length,
  ).toBeGreaterThan(0);

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'statistics-checkin-button' }).props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    await flushAsyncEffects();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(
    root.findAllByProps({ testID: 'statistics-checkin-complete-label' }).length,
  ).toBeGreaterThan(0);
  expect(output).toContain('今日已签到');
  expect(output).toContain('今天已经收好');
  expect(output).toContain('今天的学习进展已记录。');
  const statusLedger = root.findByProps({
    testID: 'statistics-status-ledger',
  });
  expect(statusLedger).toBeTruthy();
  const ledgerRailStyle = StyleSheet.flatten(
    root.findByProps({ testID: 'statistics-ledger-rail' }).props.style,
  );
  expect(ledgerRailStyle.flexDirection).toBe('row');

  await ReactTestRenderer.act(() => {
    root
      .findByProps({ testID: 'statistics-go-learning-button' })
      .props.onPress();
  });

  expect(
    root.findAllByProps({ testID: 'learning-current-card' }).length,
  ).toBeGreaterThan(0);
});

test('keeps completed progress when first gated space entry starts trial', async () => {
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
    root
      .findByProps({ testID: 'learning-flip-confident-button' })
      .props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-next-button' }).props.onPress();
  });

  await openRoute(root, 'statistics');

  expect(readMetricValue(root, 'statistics-metric-completed')).toBe('1');

  await openRoute(root, 'space');

  await ReactTestRenderer.act(async () => {
    await flushAsyncEffects();
  });

  await openRoute(root, 'statistics');

  expect(readMetricValue(root, 'statistics-metric-completed')).toBe('1');
});

test('mine page keeps profile status and route actions in one screen after login', async () => {
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
    root
      .findByProps({ testID: 'learning-flip-confident-button' })
      .props.onPress();
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
  const mineProfileCard = root.findByProps({ testID: 'mine-profile-card' });
  const mineProfileStyle = StyleSheet.flatten(mineProfileCard.props.style);
  expect(output).toContain('学习账户');
  expect(output).toContain('今天继续这一轮');
  expect(output).toContain('138****8000');
  expect(output).toContain('已签到 · 1 张完成');
  expect(output).toContain('记录已保存');
  expect(output).not.toContain('继续用完整路线备考');
  expect(mineProfileStyle.minHeight).toBeGreaterThanOrEqual(430);
  expect(root.findByProps({ testID: 'mine-passport-stack' })).toBeTruthy();
  expect(root.findByProps({ testID: 'mine-route-dock' })).toBeTruthy();
  expect(readMetricValue(root, 'mine-metric-completed')).toBe('1');
  expect(readMetricValue(root, 'mine-metric-review')).toBe('0');
  expect(readMetricValue(root, 'mine-metric-favorites')).toBe('1');
  expect(readMetricValue(root, 'mine-metric-sleeping')).toBe('0');
  expect(findPressableByTestId(root, 'mine-go-learning')).toBeTruthy();
  expect(findPressableByTestId(root, 'mine-go-space')).toBeTruthy();
  expect(findPressableByTestId(root, 'mine-go-statistics')).toBeTruthy();
  expect(root.findByProps({ testID: 'mine-action-rail' })).toBeTruthy();
  expect(
    root.findByProps({ testID: 'mine-secondary-action-row' }),
  ).toBeTruthy();
  expect(collectRenderedText(tree!.toJSON())).not.toEqual(
    expect.arrayContaining(['练', '位', '记', '我']),
  );
  expect(root.findByProps({ testID: 'membership-host-card' })).toBeTruthy();
  expect(root.findByProps({ testID: 'membership-access-strip' })).toBeTruthy();
  expect(
    root.findAllByProps({ testID: 'membership-access-step' }),
  ).toHaveLength(0);
  expect(output).toContain('权益通行证');
  expect(output).toContain('基础可用');
  expect(output).toContain('试用从首次计入学习开始');
  expect(output).toContain('完整卡库');
  expect(output).toContain('完整空间');
  expect(output).toContain('智能回看');
  expect(output).toContain('开始试用');
  expect(output).toContain('开会员');
  const purchaseButtonStyle = StyleSheet.flatten(
    findPressableByTestId(root, 'membership-purchase-button').props.style,
  );
  expect(purchaseButtonStyle.minHeight).toBeGreaterThanOrEqual(32);
  expect(purchaseButtonStyle.backgroundColor).not.toBe('transparent');
  expect(purchaseButtonStyle.borderColor).not.toBe('transparent');
  expect(
    findPressableByTestId(root, 'membership-start-trial-button'),
  ).toBeTruthy();
  expect(
    findPressableByTestId(root, 'membership-purchase-button'),
  ).toBeTruthy();
  expect(output).not.toContain('1/4');
  expect(output).not.toContain('账号概览');
  expect(output).not.toContain('权益状态');
  expect(output).not.toContain('今日已完成 1 张卡，其中首轮 1 张、回看 0 张。');
  expect(output).not.toContain('收藏标签 1 张。');
  expect(output).not.toContain(
    '试用不会在注册时自动起算，而是在第一次计入学习时开始。开始后可以查看完整卡库、完整空间和更完整的回看能力。',
  );

  await ReactTestRenderer.act(() => {
    findPressableByTestId(root, 'mine-go-space').props.onPress();
  });

  expect(JSON.stringify(tree!.toJSON())).toContain('当前卡盒');

  await openRoute(root, 'mine');

  await ReactTestRenderer.act(() => {
    findPressableByTestId(root, 'mine-go-statistics').props.onPress();
  });

  expect(
    root.findAllByProps({ testID: 'statistics-metric-completed' }).length,
  ).toBeGreaterThan(0);

  await openRoute(root, 'mine');

  await ReactTestRenderer.act(() => {
    findPressableByTestId(root, 'mine-go-learning').props.onPress();
  });

  const learningOutput = JSON.stringify(tree!.toJSON());
  expect(root.findAllByProps({ testID: 'mine-profile-card' })).toHaveLength(0);
  expect(learningOutput).toContain('继续当前卡');
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
  expect(output).toContain('当前卡盒');
  expect(
    root.findAllByProps({ testID: 'space-shelf-desk' }).length,
  ).toBeGreaterThan(0);
  expect(
    root.findAllByProps({ testID: 'space-address-shelf' }).length,
  ).toBeGreaterThan(0);
  expect(
    root.findAllByProps({ testID: 'space-current-box-tray' }).length,
  ).toBeGreaterThan(0);
  expect(
    root.findAllByProps({ testID: 'space-contained-card-strip' }).length,
  ).toBeGreaterThan(0);
  expect(
    root.findAllByProps({ testID: 'space-return-learning' }).length,
  ).toBeGreaterThan(0);
  expect(output).toContain('当前学习卡在这里');
  expect(output).toContain('当前卡盒');
  expect(output).not.toContain('当前学习卡位于 ');
  expectNoUserVisibleMetadataLeakage(tree!);
  expect(findPressableByTestId(root, 'space-card-prev').props.disabled).toBe(
    true,
  );
  expect(findPressableByTestId(root, 'space-card-next').props.disabled).toBe(
    false,
  );

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'space-card-next' }).props.onPress();
  });

  expect(findPressableByTestId(root, 'space-card-prev').props.disabled).toBe(
    false,
  );
  expect(findPressableByTestId(root, 'space-card-next').props.disabled).toBe(
    true,
  );

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'space-card-prev' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'space-library-3' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'space-group-2' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'space-box-1' }).props.onPress();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('The committee postponed the vote');
  expect(output).toContain('盒内查看');
  expect(output).toContain('贴卡标签');
  expect(output).toContain('休眠');
  expect(output).not.toContain('收藏标签');
  expect(output).not.toContain('卡片列表');
  expectNoUserVisibleMetadataLeakage(tree!);

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'space-return-learning' }).props.onPress();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(
    root.findAllByProps({ testID: 'learning-current-card' }).length,
  ).toBeGreaterThan(0);
  expect(output).toContain('短对话里听到 however');
  expect(output).not.toContain('卡片的物理空间');
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
    root.findByProps({ testID: 'space-sleep-1' }).props.onPress();
  });

  let output = JSON.stringify(tree!.toJSON());
  expect(
    root.findAllByProps({ testID: 'space-sleep-1' }).length,
  ).toBeGreaterThan(0);
  expect(output).toContain('移出休眠');
  expect(output).not.toContain('box_ref');
  expect(output).not.toContain('002001');

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'route-tab-learning' }).props.onPress();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('The committee postponed the vote');
  expect(output).not.toContain('短对话里听到 however');
});

test('keeps completed progress after changing sleep state', async () => {
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
    root
      .findByProps({ testID: 'learning-flip-confident-button' })
      .props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'learning-next-button' }).props.onPress();
  });

  await openRoute(root, 'space');
  await openSpaceCardList(root);

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'space-sleep-1' }).props.onPress();
  });

  await openRoute(root, 'statistics');

  expect(readMetricValue(root, 'statistics-metric-completed')).toBe('1');
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
    root.findByProps({ testID: 'space-favorite-1' }).props.onPress();
  });

  let output = JSON.stringify(tree!.toJSON());
  expect(
    root.findAllByProps({ testID: 'space-favorite-active-1' }).length,
  ).toBeGreaterThan(0);
  expect(output).toContain('1 张收藏');
  expect(output).not.toContain('可收藏');
  expect(output).not.toContain('收藏标签');
  expect(output).toContain('取消收藏');

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'route-tab-learning' }).props.onPress();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('已收藏');
});

test('requires explicit local trial start from protected space', async () => {
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
  expect(output).toContain('当前卡盒');
  expect(output).toContain('完整物理空间需要试用或会员');

  await ReactTestRenderer.act(async () => {
    root
      .findByProps({ testID: 'membership-start-trial-button' })
      .props.onPress();
    await flushAsyncEffects();
  });

  const unlockedOutput = JSON.stringify(tree!.toJSON());
  expect(unlockedOutput).toContain('当前卡盒');
  expect(unlockedOutput).toContain('当前盒桌');
  expect(unlockedOutput).toContain('盒内对象');
  expect(unlockedOutput).toContain('回学习');
});

test('shows trial gate from the first gated review entry', async () => {
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
  expect(output).toContain('完成了 3 张卡');
  expect(
    root.findByProps({ testID: 'learning-start-review-button' }),
  ).toBeTruthy();

  await ReactTestRenderer.act(() => {
    root
      .findByProps({ testID: 'learning-start-review-button' })
      .props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    await flushAsyncEffects();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('试用待开始');
  expect(output).toContain('开始试用');

  await ReactTestRenderer.act(async () => {
    root
      .findByProps({ testID: 'membership-start-trial-button' })
      .props.onPress();
    await flushAsyncEffects();
  });

  await openRoute(root, 'mine');

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('完整试用进行中');
});

test('starts review after membership is already unlocked', async () => {
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

  let output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('完成了 5 张卡');
  expect(
    root.findByProps({ testID: 'learning-start-review-button' }),
  ).toBeTruthy();

  await ReactTestRenderer.act(() => {
    root
      .findByProps({ testID: 'learning-start-review-button' })
      .props.onPress();
  });

  await ReactTestRenderer.act(async () => {
    await flushAsyncEffects();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('本轮回看');
  expect(output).toContain('需要再看的卡已放到眼前');
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
    root
      .findByProps({ testID: 'membership-expire-trial-button' })
      .props.onPress();
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
    root.findAllByProps({ testID: 'membership-dismiss-recovery-button' })
      .length,
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
    root.findByProps({ testID: 'space-sleep-1' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'space-library-3' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'space-group-2' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'space-box-1' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'space-sleep-1' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'space-library-2' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'space-box-1' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'space-sleep-1' }).props.onPress();
  });

  await openRoute(root, 'mine');

  await ReactTestRenderer.act(() => {
    root
      .findByProps({ testID: 'membership-expire-trial-button' })
      .props.onPress();
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
