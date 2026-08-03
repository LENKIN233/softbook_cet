import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import {
  ControlledPilotReviewSurface,
  ControlledPilotRoundCompletionSurface,
} from '../src/learning/ControlledPilotRoundCompletionSurface';
import { createLocalLearningSession } from '../src/learning/session';

const palette = {
  accent: '#7C8BFF',
  accentSoft: '#EEEEFF',
  accentStrong: '#3847B8',
  background: '#F1F0F6',
  border: '#DDDEE6',
  danger: '#D94C5C',
  panel: '#FFFFFF',
  panelStrong: '#F3F4F8',
  primaryActionSurface: '#12131A',
  primaryActionText: '#FFFFFC',
  success: '#1E9B63',
  tabIdle: '#BBBBCC',
  text: '#1E1F2A',
  textMuted: '#686B7A',
  warning: '#B77900',
};

test('offers exactly review, Space, and server-gated continue actions', () => {
  let tree: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <ControlledPilotRoundCompletionSurface
        completedCount={10}
        error={null}
        onContinue={jest.fn()}
        onOpenSpace={jest.fn()}
        onReview={jest.fn()}
        palette={palette}
        pending={false}
        spaceAddress="听力 · 短对话 · 转折盒"
      />,
    );
  });

  const actionTestIDs = tree!.root
    .findAll(node =>
      [
        'controlled-pilot-round-review',
        'controlled-pilot-round-space',
        'controlled-pilot-round-continue',
      ].includes(node.props.testID),
    )
    .map(node => node.props.testID);
  expect(new Set(actionTestIDs)).toEqual(
    new Set([
      'controlled-pilot-round-review',
      'controlled-pilot-round-space',
      'controlled-pilot-round-continue',
    ]),
  );
  expect(
    tree!.root.findByProps({ testID: 'controlled-pilot-round-continue' }),
  ).toBeTruthy();
  expect(JSON.stringify(tree!.toJSON())).not.toContain('购买');
});

test('keeps pending-round review read-only', () => {
  const card = createLocalLearningSession('cet4').catalogCards[0];
  let tree: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <ControlledPilotReviewSurface
        card={card}
        currentIndex={0}
        onBack={jest.fn()}
        onNext={jest.fn()}
        palette={palette}
        totalCount={1}
      />,
    );
  });

  expect(
    new Set(
      tree!.root
        .findAll(node =>
          ['controlled-pilot-round-review-next'].includes(node.props.testID),
        )
        .map(node => node.props.testID),
    ),
  ).toEqual(new Set(['controlled-pilot-round-review-next']));
  expect(JSON.stringify(tree!.toJSON())).toContain('返回本轮完成页');
  expect(JSON.stringify(tree!.toJSON())).not.toContain('提交');
});
