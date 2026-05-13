/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import { createLocalLearningSession } from '../src/learning/session';
import { SpaceSurface } from '../src/space/SpaceSurface';

const palette = {
  accent: '#7C8BFF',
  accentSoft: 'rgba(124,139,255,0.16)',
  accentStrong: '#3847B8',
  border: 'rgba(29,31,42,0.12)',
  danger: '#D94C5C',
  panel: '#FFFFFF',
  panelStrong: '#F3F4F8',
  success: '#1E9B63',
  text: '#1E1F2A',
  textMuted: '#686B7A',
  warning: '#B77900',
};

test('keeps a physical Space outline when no cards are visible', () => {
  const session = createLocalLearningSession('cet4');
  const currentCard = session.catalogCards[0];
  let tree: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <SpaceSurface
        cardStateById={{}}
        currentLearningCard={currentCard}
        deviceClass="phone"
        onReturnToLearning={jest.fn()}
        onToggleFavoriteTag={jest.fn()}
        onToggleSleepState={jest.fn()}
        palette={palette}
        spaceCards={[]}
      />,
    );
  });

  const root = tree!.root;
  const output = JSON.stringify(tree!.toJSON());

  expect(root.findAllByProps({ testID: 'space-empty-state' }).length)
    .toBeGreaterThan(0);
  expect(root.findAllByProps({ testID: 'space-address-shelf' }).length)
    .toBeGreaterThan(0);
  expect(root.findAllByProps({ testID: 'space-current-box-tray' }).length)
    .toBeGreaterThan(0);
  expect(root.findAllByProps({ testID: 'space-contained-card-strip' }).length)
    .toBeGreaterThan(0);
  expect(root.findAllByProps({ testID: 'space-continuity-strip' }).length)
    .toBeGreaterThan(0);
  expect(output).toContain('EMPTY BOX TRAY');
  expect(output).toContain('当前盒暂无可展示卡片');
  expect(output).toContain(
    `${currentCard.space_metadata.library} / ${currentCard.space_metadata.group} / ${currentCard.space_metadata.box}`,
  );
  expect(output).not.toContain('空间地图还没有可展示的数据');
});
