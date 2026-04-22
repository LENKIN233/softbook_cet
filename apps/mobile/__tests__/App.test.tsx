/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
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

test('can unlock the learning shell after fake sms verification', async () => {
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

  await ReactTestRenderer.act(() => {
    root
      .findByProps({ testID: 'auth-request-code-button' })
      .props.onPress();
  });

  await ReactTestRenderer.act(() => {
    root
      .findByProps({ testID: 'auth-code-input' })
      .props.onChangeText('2468');
  });

  await ReactTestRenderer.act(() => {
    root
      .findByProps({ testID: 'auth-submit-button' })
      .props.onPress();
  });

  const output = JSON.stringify(tree!.toJSON());
  expect(output).toContain('单卡学习流');
  expect(output).toContain('已登录 138****8000');
});
