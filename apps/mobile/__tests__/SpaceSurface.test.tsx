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

type TestRendererNode =
  | ReactTestRenderer.ReactTestRendererJSON
  | ReactTestRenderer.ReactTestRendererJSON[]
  | string
  | null;

function collectTestIDs(node: TestRendererNode, testIDs: string[] = []) {
  if (node === null || typeof node === 'string') {
    return testIDs;
  }

  if (Array.isArray(node)) {
    node.forEach(child => collectTestIDs(child, testIDs));
    return testIDs;
  }

  if (typeof node.props.testID === 'string') {
    testIDs.push(node.props.testID);
  }

  node.children?.forEach(child => collectTestIDs(child, testIDs));
  return testIDs;
}

function expectSpaceFirstReadOrder(
  tree: ReactTestRenderer.ReactTestRenderer,
  railTestID: string,
) {
  const testIDs = collectTestIDs(tree.toJSON());
  const addressIndex = testIDs.indexOf('space-address-shelf');
  const railIndex = testIDs.indexOf(railTestID);
  const boxIndex = testIDs.indexOf('space-current-box-tray');

  expect(addressIndex).toBeGreaterThanOrEqual(0);
  expect(railIndex).toBeGreaterThanOrEqual(0);
  expect(boxIndex).toBeGreaterThanOrEqual(0);
  expect(addressIndex).toBeLessThan(railIndex);
  expect(railIndex).toBeLessThan(boxIndex);
}

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
  expect(output).toContain('当前盒为空');
  expect(output).toContain('当前盒暂无可展示卡片');
  expect(output).toContain(
    `${currentCard.space_metadata.library} / ${currentCard.space_metadata.group} / ${currentCard.space_metadata.box}`,
  );
  expect(output).not.toContain('空间地图还没有可展示的数据');
});

test('uses contained skeleton slots while Space cards are loading', () => {
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
        spaceStatusRail={{
          detail: '正在整理本轮卡片；空间地址架和当前盒位会先保留在原位。',
          label: '加载中',
          state: 'loading',
          title: '正在整理空间内容',
        }}
      />,
    );
  });

  const root = tree!.root;
  const output = JSON.stringify(tree!.toJSON());

  expect(output).toContain('正在整理盒内卡片');
  expect(output).toContain('盒内卡片整理中');
  expect(output).toContain('正在整理卡片');
  expect(output).toContain('完成后回到真实内容');
  expect(root.findAllByProps({ testID: 'space-loading-card-skeleton' }).length)
    .toBeGreaterThan(0);
  expect(
    root.findAllByProps({ testID: 'space-loading-address-skeleton' }).length,
  ).toBeGreaterThan(0);
  expect(root.findAllByProps({ testID: 'space-loading-box-skeleton' }).length)
    .toBeGreaterThan(0);
  expect(root.findAllByProps({ testID: 'space-empty-card-slot' }))
    .toHaveLength(0);
  expect(root.findAllByProps({ testID: 'space-status-rail' }).length)
    .toBeGreaterThan(0);
  expectSpaceFirstReadOrder(tree!, 'space-status-rail');
});

test('places Space state rail between address context and current box', () => {
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
        spaceCards={session.catalogCards}
        spaceSyncRail={{
          detail: '正在同步空间里的收藏标签和休眠状态。',
          label: '同步中',
          state: 'syncing',
          title: '正在同步空间状态',
        }}
      />,
    );
  });

  const root = tree!.root;

  expect(root.findAllByProps({ testID: 'space-shelf-desk' }).length)
    .toBeGreaterThan(0);
  expect(root.findAllByProps({ testID: 'space-sync-rail' }).length)
    .toBeGreaterThan(0);
  expectSpaceFirstReadOrder(tree!, 'space-sync-rail');
});

test('uses box-code selector IDs for Space library and group chips', () => {
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
        spaceCards={session.catalogCards}
      />,
    );
  });

  const root = tree!.root;

  expect(root.findAllByProps({ testID: 'space-library-00' }).length)
    .toBeGreaterThan(0);
  expect(root.findAllByProps({ testID: 'space-library-05' }).length)
    .toBeGreaterThan(0);
  expect(root.findAllByProps({ testID: 'space-library-2' })).toHaveLength(0);

  ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'space-library-05' }).props.onPress();
  });

  expect(root.findAllByProps({ testID: 'space-group-052' }).length)
    .toBeGreaterThan(0);
  expect(root.findAllByProps({ testID: 'space-group-1' })).toHaveLength(0);
});
