import React, {useEffect} from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {Text} from 'react-native';

let cleanupCount = 0;
let timerCountAfterCleanup: number | null = null;
let previousTree: ReactTestRenderer.ReactTestRenderer;
const tick = jest.fn();
const awaitCleanupContinuation = jest.fn(() => {
  throw new Error('Synchronous tree disposal must not await the act scheduler.');
});

function TimerProbe() {
  useEffect(() => {
    const timer = setInterval(tick, 1000);
    return () => {
      clearInterval(timer);
      timerCountAfterCleanup = jest.getTimerCount();
      cleanupCount += 1;
    };
  }, []);
  return <Text>Mounted probe</Text>;
}

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

test('tracks a tree whose first act uses fake timers and whose test restores its spies', () => {
  jest.useFakeTimers();
  ReactTestRenderer.act(() => {
    previousTree = ReactTestRenderer.create(<TimerProbe />);
  });
  expect(jest.getTimerCount()).toBe(1);
  expect(cleanupCount).toBe(0);
  jest.restoreAllMocks();
  const act = ReactTestRenderer.act;
  jest.spyOn(ReactTestRenderer, 'act').mockImplementation(callback => {
    act(callback as () => void);
    // Model an unavailable post-flush scheduler turn. Effect cleanup itself
    // is already complete; teardown must not depend on awaiting this thenable.
    return {then: awaitCleanupContinuation} as unknown as ReturnType<typeof act>;
  });
  // Global cleanup must still unmount this tree before switching clocks.
});

test('previous-test cleanup cancelled its timer and a new renderer does not wrap a stale spy', () => {
  expect(cleanupCount).toBe(1);
  expect(awaitCleanupContinuation).not.toHaveBeenCalled();
  expect(timerCountAfterCleanup).toBe(0);
  expect(previousTree.toJSON()).toBeNull();
  expect(tick).not.toHaveBeenCalled();
  let next!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    next = ReactTestRenderer.create(<Text>New lifecycle</Text>);
  });
  expect(JSON.stringify(next.toJSON())).toContain('New lifecycle');
});


test('async act drains under fake time without advancing application timers', async () => {
  jest.useFakeTimers();
  const applicationTimer = jest.fn();
  setTimeout(applicationTimer, 0);
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    await Promise.resolve();
    tree = ReactTestRenderer.create(<Text>Async lifecycle</Text>);
  });
  expect(JSON.stringify(tree.toJSON())).toContain('Async lifecycle');
  expect(applicationTimer).not.toHaveBeenCalled();
  jest.advanceTimersByTime(0);
  expect(applicationTimer).toHaveBeenCalledTimes(1);
});
