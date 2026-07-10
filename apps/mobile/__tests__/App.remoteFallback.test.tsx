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

  await ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'auth-request-code-button' }).props.onPress();
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

test('falls back to local learning cards when remote runtime source fails', async () => {
  const fetchMock = jest
    .fn()
    .mockImplementation(async (input: string) => {
      if (input === 'https://api.softbook.example/v1/auth/request-code') {
        return {
          json: async () => ({}),
          ok: true,
          status: 200,
        };
      }

      if (input === 'https://api.softbook.example/v1/auth/verify-code') {
        return {
          json: async () => ({
            data: {
              auth_token: 'remote-auth-token',
              phone_number: '13800138000',
            },
          }),
          ok: true,
          status: 200,
        };
      }

      return REMOTE_FAILURE;
    });
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
  await waitForLearningSurface(root);

  const output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('本轮学习卡');
  expect(output).toContain('however');
  expect(output).not.toContain('CET4');
  expect(output).not.toContain('学习卡源暂时不可用');
  expect(fetchMock).toHaveBeenCalledWith(
    'https://api.softbook.example/v1/learning/card-source?track=cet4',
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer remote-auth-token',
        'x-softbook-client': 'mobile',
        'x-api-key': 'runtime-key',
      },
    },
  );
});
