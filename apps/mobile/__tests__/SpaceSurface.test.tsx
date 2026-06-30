/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';

import { createLocalLearningSession } from '../src/learning/session';
import { SpaceSurface } from '../src/space/SpaceSurface';
import {
  formatSpacePathByIndex,
  resolveSpacePosition,
} from '../src/space/spaceMetadataDisplay';
import type { SpaceSeedLike } from '../src/space/spaceMetadataDisplay';

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

function countOccurrences(text: string, needle: string) {
  return text.split(needle).length - 1;
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

function buildSpaceSeedLike(
  cards: ReturnType<typeof createLocalLearningSession>['catalogCards'],
): SpaceSeedLike {
  const libraries: SpaceSeedLike['libraries'] = [];

  for (const card of cards) {
    let library = libraries.find(
      item => item.libraryName === card.space_metadata.library,
    );
    if (!library) {
      library = { groups: [], libraryName: card.space_metadata.library };
      libraries.push(library);
    }

    let group = library.groups.find(
      item => item.groupName === card.space_metadata.group,
    );
    if (!group) {
      group = { boxes: [], groupName: card.space_metadata.group };
      library.groups.push(group);
    }

    if (!group.boxes.some(box => box.boxRef === card.space_metadata.box_ref)) {
      group.boxes.push({ boxRef: card.space_metadata.box_ref });
    }
  }

  return { libraries };
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
        screen="card_list"
        spaceCards={[]}
      />,
    );
  });

  const root = tree!.root;
  const output = JSON.stringify(tree!.toJSON());
  const renderedText = collectRenderedText(tree!.toJSON()).join(' ');

  expect(
    root.findAllByProps({ testID: 'space-empty-state' }).length,
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
  expect(output).toContain('当前卡盒待整理');
  expect(output).toContain('当前卡盒暂无可展示卡片');
  expect(output).toContain('空间正在等待本轮卡片');
  expect(output).toContain('位置待同步');
  expect(renderedText).not.toContain(currentCard.space_metadata.library);
  expect(renderedText).not.toContain(currentCard.space_metadata.group);
  expect(renderedText).not.toContain(currentCard.space_metadata.box);
  expect(renderedText).not.toContain(currentCard.space_metadata.box_ref);
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
        screen="card_list"
        spaceCards={[]}
        spaceStatusRail={{
          detail: '正在整理本轮卡片；空间当前位置会先保留在原位。',
          label: '加载中',
          state: 'loading',
          title: '正在整理空间内容',
        }}
      />,
    );
  });

  const root = tree!.root;
  const output = JSON.stringify(tree!.toJSON());

  expect(output).toContain('正在整理卡片');
  expect(output).toContain('卡片正在整理');
  expect(output).toContain('正在整理卡片');
  expect(output).toContain('完成后显示本轮内容');
  expect(
    root.findAllByProps({ testID: 'space-loading-card-skeleton' }).length,
  ).toBeGreaterThan(0);
  expect(
    root.findAllByProps({ testID: 'space-loading-address-skeleton' }).length,
  ).toBeGreaterThan(0);
  expect(
    root.findAllByProps({ testID: 'space-loading-box-skeleton' }).length,
  ).toBeGreaterThan(0);
  expect(root.findAllByProps({ testID: 'space-empty-card-slot' })).toHaveLength(
    0,
  );
  expect(
    root.findAllByProps({ testID: 'space-status-rail' }).length,
  ).toBeGreaterThan(0);
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

  expect(
    root.findAllByProps({ testID: 'space-shelf-desk' }).length,
  ).toBeGreaterThan(0);
  expect(
    root.findAllByProps({ testID: 'space-sync-rail' }).length,
  ).toBeGreaterThan(0);
  expectSpaceFirstReadOrder(tree!, 'space-sync-rail');
});

test('uses anonymous ordered selector IDs for Space library and group chips in the card list layer', () => {
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
        screen="card_list"
        spaceCards={session.catalogCards}
      />,
    );
  });

  const root = tree!.root;
  const renderedText = collectRenderedText(tree!.toJSON()).join(' ');

  expect(
    root.findAllByProps({ testID: 'space-library-1' }).length,
  ).toBeGreaterThan(0);
  expect(
    root.findAllByProps({ testID: 'space-browse-rail' }).length,
  ).toBeGreaterThan(0);
  expect(
    root.findAllByProps({ testID: 'space-library-2' }).length,
  ).toBeGreaterThan(0);
  expect(root.findAllByProps({ testID: 'space-library-00' })).toHaveLength(0);
  expect(root.findAllByProps({ testID: 'space-library-05' })).toHaveLength(0);
  expect(renderedText).not.toContain(currentCard.space_metadata.library);
  expect(renderedText).not.toContain(currentCard.space_metadata.group);
  expect(renderedText).not.toContain(currentCard.space_metadata.box);
  expect(renderedText).not.toContain(currentCard.space_metadata.box_ref);
  expect(renderedText).toContain('盒内查看');
  expect(renderedText).not.toContain('卡片列表');

  ReactTestRenderer.act(() => {
    root.findByProps({ testID: 'space-library-2' }).props.onPress();
  });

  expect(
    root.findAllByProps({ testID: 'space-group-1' }).length,
  ).toBeGreaterThan(0);
  expect(
    root.findAllByProps({ testID: 'space-group-2' }).length,
  ).toBeGreaterThan(0);
  expect(root.findAllByProps({ testID: 'space-group-052' })).toHaveLength(0);
});

test('defaults Space first-read focus to the current learning card box', () => {
  const session = createLocalLearningSession('cet4');
  const firstLibrary = session.catalogCards[0].space_metadata.library;
  const currentCard = session.catalogCards.find(
    card => card.space_metadata.library !== firstLibrary,
  )!;
  const position = resolveSpacePosition(
    buildSpaceSeedLike(session.catalogCards),
    currentCard,
  )!;
  const expectedPath = formatSpacePathByIndex(
    position.libraryIndex,
    position.groupIndex,
    position.boxIndex,
  );
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
  const renderedText = collectRenderedText(tree!.toJSON()).join(' ');

  expect(expectedPath).not.toMatch(/馆|组|盒\s+\d|\d/);
  expect(renderedText).toContain('书架 相邻书架 分区 当前分区 卡盒 当前卡盒');
  expect(renderedText).toContain('当前卡盒 盒内卡片');
  expect(renderedText).toContain('当前学习卡在这里');
  expect(renderedText).toContain('休眠区属于当前盒');
  expect(renderedText).toContain('回学习 同一张卡，同一地址');
  expect(
    root.findAllByProps({ testID: 'space-open-box-lid' }).length,
  ).toBeGreaterThan(0);
  expect(
    root.findAllByProps({ testID: 'space-sleep-alcove' }).length,
  ).toBeGreaterThan(0);
  expect(
    root.findAllByProps({ testID: 'space-return-learning' }).length,
  ).toBeGreaterThan(0);
  expect(renderedText).not.toContain('当前地址');
  expect(renderedText).not.toContain('当前学习卡位于');
});

test('resyncs Space focus when the current learning card changes after render', () => {
  const session = createLocalLearningSession('cet4');
  const initialCard = session.catalogCards[0];
  const nextCard = session.catalogCards.find(
    card => card.space_metadata.library !== initialCard.space_metadata.library,
  )!;
  let tree: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <SpaceSurface
        cardStateById={{}}
        currentLearningCard={initialCard}
        deviceClass="phone"
        onReturnToLearning={jest.fn()}
        onToggleFavoriteTag={jest.fn()}
        onToggleSleepState={jest.fn()}
        palette={palette}
        spaceCards={session.catalogCards}
      />,
    );
  });

  const initialText = collectRenderedText(tree!.toJSON()).join(' ');

  expect(initialText).toContain(initialCard.front.prompt);
  expect(countOccurrences(initialText, nextCard.front.prompt)).toBe(0);

  ReactTestRenderer.act(() => {
    tree!.update(
      <SpaceSurface
        cardStateById={{}}
        currentLearningCard={nextCard}
        deviceClass="phone"
        onReturnToLearning={jest.fn()}
        onToggleFavoriteTag={jest.fn()}
        onToggleSleepState={jest.fn()}
        palette={palette}
        spaceCards={session.catalogCards}
      />,
    );
  });

  const updatedText = collectRenderedText(tree!.toJSON()).join(' ');

  expect(updatedText).toContain('当前学习卡在这里');
  expect(countOccurrences(updatedText, nextCard.front.prompt)).toBeGreaterThan(
    0,
  );
});

test('does not render raw metadata values from loaded Space cards', () => {
  const session = createLocalLearningSession('cet4');
  const metadataValues = [
    'raw-space-library-visible-guard',
    'raw-space-group-visible-guard',
    'raw-space-box-visible-guard',
    'raw-space-box-ref-visible-guard',
  ];
  const guardedCards = session.catalogCards.slice(0, 2).map(card => ({
    ...card,
    space_metadata: {
      box: metadataValues[2],
      box_ref: metadataValues[3],
      group: metadataValues[1],
      library: metadataValues[0],
    },
  }));
  let tree: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <SpaceSurface
        cardStateById={{}}
        currentLearningCard={guardedCards[0]}
        deviceClass="phone"
        onReturnToLearning={jest.fn()}
        onToggleFavoriteTag={jest.fn()}
        onToggleSleepState={jest.fn()}
        palette={palette}
        spaceCards={guardedCards}
      />,
    );
  });

  const renderedText = collectRenderedText(tree!.toJSON()).join(' ');

  metadataValues.forEach(value => {
    expect(renderedText).not.toContain(value);
  });
  expect(renderedText).toContain('书架 主书架 分区 当前分区 卡盒 当前卡盒');
  expect(renderedText).not.toContain('馆 1 / 组 1 / 盒 1');
});
