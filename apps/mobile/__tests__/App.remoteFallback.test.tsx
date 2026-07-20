/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import { installSoftbookAppRuntimeConfig } from '../src/runtime/installRuntimeConfig';
import App from '../App';

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

const REMOTE_FAILURE = {
  json: async () => ({}),
  ok: false,
  status: 503,
};

let originalFetch: typeof globalThis.fetch | undefined;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  installSoftbookAppRuntimeConfig({
    auth: {
      mode: 'remote',
      remote: {
        apiKey: 'auth-key',
        baseUrl: 'https://api.softbook.example/',
      },
    },
    learningSource: {
      mode: 'remote',
      remote: {
        apiKey: 'runtime-key',
        baseUrl: 'https://api.softbook.example/',
      },
    },
  });
});

afterEach(() => {
  globalThis.__SOFTBOOK_CET_RUNTIME_CONFIG__ = undefined;

  if (originalFetch === undefined) {
    Object.defineProperty(globalThis, 'fetch', {
      configurable: true,
      value: undefined,
      writable: true,
    });
    return;
  }

  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: originalFetch,
    writable: true,
  });
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

async function flushAsyncEffects() {
  await Promise.resolve();
  await Promise.resolve();
  await new Promise<void>(resolve => {
    setTimeout(() => resolve(), 0);
  });
}

async function waitForLearningFailure(
  root: ReactTestRenderer.ReactTestInstance,
) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await ReactTestRenderer.act(async () => {
      await flushAsyncEffects();
    });

    if (
      root.findAllByProps({ testID: 'learning-bootstrap-retry-button' }).length >
      0
    ) {
      return;
    }
  }

  throw new Error('Learning failure state did not finish in time.');
}

test('fails closed when the remote runtime source is unavailable', async () => {
  const fetchMock = jest
    .fn()
    .mockImplementation(
      async (
        input: string,
        _init?: {headers?: ConstructorParameters<typeof Headers>[0]},
      ) => {
      if (input === 'https://api.softbook.example/v2/auth/request-code') {
        return {
          json: async () => ({
            data: {
              challenge_id: 'challenge-123',
              expires_at: '2099-07-20T00:05:00.000Z',
              retry_after_seconds: 60,
            },
          }),
          ok: true,
          status: 200,
        };
      }

      if (input === 'https://api.softbook.example/v2/auth/verify-code') {
        return {
          json: async () => ({
            data: {
              access_token: 'remote-auth-token',
              expires_in: 900,
              phone_number: '13800138000',
              refresh_expires_at: '2099-08-19T00:00:00.000Z',
              refresh_token: 'remote-refresh-token',
              session_id: 'session-123',
              token_type: 'Bearer',
            },
          }),
          ok: true,
          status: 200,
        };
      }

        return REMOTE_FAILURE;
      },
    );
  Object.defineProperty(globalThis, 'fetch', {
    configurable: true,
    value: fetchMock as typeof fetch,
    writable: true,
  });

  let tree: ReactTestRenderer.ReactTestRenderer;

  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });

  const root = tree!.root;
  await authenticateIntoLearningBootstrap(root);
  await waitForLearningFailure(root);

  const output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('本轮学习暂时不可用');
  expect(output).toContain('重新加载本轮卡片');
  expect(output).not.toContain('however');
  expect(fetchMock).toHaveBeenCalledWith(
    'https://api.softbook.example/v1/learning/card-source?track=cet4',
    expect.objectContaining({method: 'GET'}),
  );
  const cardSourceCall = fetchMock.mock.calls.find(
    ([input]) =>
      input ===
      'https://api.softbook.example/v1/learning/card-source?track=cet4',
  );
  expect(new Headers(cardSourceCall?.[1]?.headers).get('authorization')).toBe(
    'Bearer remote-auth-token',
  );
});
