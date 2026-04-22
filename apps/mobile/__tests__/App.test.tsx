/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { LearningSession } from '../src/learning/model';
import { createLocalLearningSession } from '../src/learning/session';
import App from '../App';

const mockLoadSession = jest.fn();

jest.mock('../src/learning/learningRepository', () => ({
  createLearningSessionRepository: () => ({
    loadSession: (...args: unknown[]) => mockLoadSession(...args),
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

type Deferred<T> = {
  promise: Promise<T>;
  reject: (error: unknown) => void;
  resolve: (value: T) => void;
};

let pendingSession: Deferred<LearningSession>;

beforeEach(() => {
  pendingSession = createDeferred<LearningSession>();
  mockLoadSession.mockReset();
  mockLoadSession.mockImplementation(() => pendingSession.promise);
});

async function authenticateIntoLearningBootstrap(
  root: ReactTestRenderer.ReactTestInstance,
) {
  await ReactTestRenderer.act(() => {
    root
      .findByProps({ testID: 'auth-phone-input' })
      .props.onChangeText('13800138000');
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'auth-request-code-button' }).props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'auth-code-input' }).props.onChangeText('2468');
  });

  await ReactTestRenderer.act(async () => {
    root.findByProps({ testID: 'auth-submit-button' }).props.onPress();
    await Promise.resolve();
  });
}

async function loginIntoLearningFlow(
  root: ReactTestRenderer.ReactTestInstance,
) {
  await authenticateIntoLearningBootstrap(root);
  await resolveLearningBootstrap();
  await waitForLearningSurface(root);
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

  let output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('今日可签到');
  expect(output).toContain('今天已经产生有效学习进展，可以把连续性落成一次轻量签到。');

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'statistics-checkin-button' }).props.onPress();
  });

  output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('今日已签到');
});

test('can browse the seeded knowledge map after login', async () => {
  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await loginIntoLearningFlow(root);

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'route-tab-space' }).props.onPress();
  });

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

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'route-tab-space' }).props.onPress();
  });

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

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'route-tab-space' }).props.onPress();
  });

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
