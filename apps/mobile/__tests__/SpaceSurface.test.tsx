/**
 * @format
 */

import React from 'react';
import {Dimensions, StyleSheet} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import { createLocalLearningSession } from '../src/learning/session';
import {
  SpaceSurface,
  isShortSpaceViewport,
} from '../src/space/SpaceSurface';

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
  expect(output).toContain('本轮暂时没有符合条件的卡片');
  expect(output).toContain('当前卡盒已定位');
  expect(renderedText).not.toContain(currentCard.space_metadata.library);
  expect(renderedText).not.toContain(currentCard.space_metadata.group);
  expect(renderedText).not.toContain(currentCard.space_metadata.box);
  expect(renderedText).not.toContain(currentCard.space_metadata.box_ref);
  expect(output).not.toContain('空间地图还没有可展示的数据');
});

test('keeps 44dp hierarchy targets reachable in a scroll viewport at 393x852', () => {
  expect(isShortSpaceViewport(393, 852)).toBe(false);
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
  expect(root.findByProps({testID: 'space-scroll-viewport'})).toBeTruthy();
  expect(root.findAllByProps({testID: 'space-fixed-viewport'})).toHaveLength(0);
  for (const level of ['library', 'group', 'box']) {
    const rowStyle = StyleSheet.flatten(
      root.findByProps({testID: `space-${level}-row`}).props.style,
    );
    const previousStyle = StyleSheet.flatten(
      root.findByProps({testID: `space-${level}-prev`}).props.style,
    );
    const nextStyle = StyleSheet.flatten(
      root.findByProps({testID: `space-${level}-next`}).props.style,
    );

    expect(rowStyle.minHeight).toBeGreaterThanOrEqual(44);
    expect(previousStyle).toMatchObject({height: 44, width: 44});
    expect(nextStyle).toMatchObject({height: 44, width: 44});
  }

  ReactTestRenderer.act(() => {
    root.findByProps({testID: 'space-library-next'}).props.onPress();
  });
  expect(
    StyleSheet.flatten(
      root.findByProps({testID: 'space-follow-current-box'}).props.style,
    ),
  ).toMatchObject({minHeight: 44, minWidth: 44});
  expect(
    StyleSheet.flatten(
      root.findByProps({testID: 'space-return-learning'}).props.style,
    ).minHeight,
  ).toBeGreaterThanOrEqual(44);
  const inspectButton = root.findByProps({testID: 'space-open-card-list'});
  expect(
    StyleSheet.flatten(inspectButton.props.style).minHeight,
  ).toBeGreaterThanOrEqual(44);
  expect(inspectButton.props.accessibilityRole).toBe('button');
});

test('short phone Space scrolls intrinsic content instead of clipping the primary return action', () => {
  expect(isShortSpaceViewport(393, 700)).toBe(true);
  const consoleErrors: unknown[][] = [];
  const consoleError = jest.spyOn(console, 'error').mockImplementation(
    (...args: unknown[]) => {
      consoleErrors.push(args);
    },
  );
  ReactTestRenderer.act(() => {
    Dimensions.set({
      screen: {fontScale: 1, height: 700, scale: 1, width: 393},
      window: {fontScale: 1, height: 700, scale: 1, width: 393},
    });
  });
  const session = createLocalLearningSession('cet4');
  let tree: ReactTestRenderer.ReactTestRenderer;

  try {
    ReactTestRenderer.act(() => {
      tree = ReactTestRenderer.create(
        <SpaceSurface
          cardStateById={{}}
          currentLearningCard={session.catalogCards[0]}
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
    const scroll = root.findByProps({testID: 'space-scroll-viewport'});
    expect(StyleSheet.flatten(scroll.props.contentContainerStyle).flexGrow).toBe(
      1,
    );
    expect(
      StyleSheet.flatten(
        root.findByProps({testID: 'space-shelf-desk'}).props.style,
      ).flex,
    ).toBe(0);
    expect(
      StyleSheet.flatten(
        root.findByProps({testID: 'space-current-box-tray'}).props.style,
      ).overflow,
    ).toBe('visible');
    expect(
      StyleSheet.flatten(
        root.findByProps({testID: 'space-open-box-deck'}).props.style,
      ).flex,
    ).toBe(0);
    expect(
      StyleSheet.flatten(
        root.findByProps({testID: 'space-return-learning'}).props.style,
      ).minHeight,
    ).toBeGreaterThanOrEqual(44);
  } finally {
    ReactTestRenderer.act(() => {
      tree?.unmount();
    });
    ReactTestRenderer.act(() => {
      Dimensions.set({
        screen: {fontScale: 1, height: 852, scale: 1, width: 393},
        window: {fontScale: 1, height: 852, scale: 1, width: 393},
      });
    });
    consoleError.mockRestore();
  }

  expect(consoleErrors).toEqual([]);
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
  expect(root.findByProps({testID: 'space-scroll-viewport'})).toBeTruthy();
  expectSpaceFirstReadOrder(tree!, 'space-sync-rail');
});

test('uses a compact address clue instead of selector controls in the card list layer', () => {
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

  expect(root.findAllByProps({ testID: 'space-browse-rail' })).toHaveLength(0);
  expect(
    root.findAllByProps({ testID: 'space-browse-address-clue' }).length,
  ).toBeGreaterThan(0);
  const addressClueStyle = StyleSheet.flatten(
    root.findByProps({ testID: 'space-browse-address-clue' }).props.style,
  );
  expect(addressClueStyle.flexDirection).toBe('row');
  expect(addressClueStyle.gap).toBeGreaterThanOrEqual(6);
  expect(
    root.findAllByProps({ testID: 'space-browse-card-continuity' }).length,
  ).toBeGreaterThan(0);
  const containedStripStyle = StyleSheet.flatten(
    root.findByProps({ testID: 'space-contained-card-strip' }).props.style,
  );
  expect(containedStripStyle.flex).toBe(1);
  expect(containedStripStyle.justifyContent).toBe('center');
  const browseCardObjectStyle = StyleSheet.flatten(
    root.findByProps({ testID: 'space-browse-card-object' }).props.style,
  );
  expect(browseCardObjectStyle.flexGrow).toBe(0);
  expect(browseCardObjectStyle.minHeight).toBe(0);
  const browseCardFaceStyle = StyleSheet.flatten(
    root.findByProps({ testID: 'space-browse-card-face' }).props.style,
  );
  expect(browseCardFaceStyle.borderWidth).toBe(1);
  expect(browseCardFaceStyle.minHeight).toBe(166);
  expect(browseCardFaceStyle.justifyContent).toBe('space-between');
  expect(
    root.findAllByProps({ testID: 'space-browse-card-locator' }).length,
  ).toBeGreaterThan(0);
  const browsePagerStyle = StyleSheet.flatten(
    root.findByProps({ testID: 'space-browse-card-pager' }).props.style,
  );
  expect(browsePagerStyle.marginTop).toBeUndefined();
  for (const testID of ['space-card-prev', 'space-card-next']) {
    const control = root
      .findAllByProps({testID})
      .find(candidate => candidate.props.style !== undefined)!;
    expect(
      StyleSheet.flatten(control.props.style).minHeight,
    ).toBeGreaterThanOrEqual(44);
    expect(control.props.accessibilityRole).toBe('button');
  }
  const browseStateTrayStyle = StyleSheet.flatten(
    root.findByProps({ testID: 'space-browse-card-state-tray' }).props.style,
  );
  expect(browseStateTrayStyle.paddingHorizontal).toBe(4);
  expect(browseStateTrayStyle.paddingVertical).toBe(4);
  expect(
    root.findAllByProps({ testID: 'space-card-list-back' }).length,
  ).toBeGreaterThan(0);
  expect(root.findAllByProps({ testID: 'space-library-00' })).toHaveLength(0);
  expect(root.findAllByProps({ testID: 'space-library-05' })).toHaveLength(0);
  expect(root.findAllByProps({ testID: 'space-library-1' })).toHaveLength(0);
  expect(root.findAllByProps({ testID: 'space-library-2' })).toHaveLength(0);
  expect(root.findAllByProps({ testID: 'space-group-1' })).toHaveLength(0);
  expect(root.findAllByProps({ testID: 'space-box-1' })).toHaveLength(0);
  expect(renderedText).toContain(currentCard.space_metadata.library);
  expect(renderedText).toContain(currentCard.space_metadata.group);
  expect(renderedText).toContain(currentCard.space_metadata.box);
  expect(renderedText).not.toContain(currentCard.space_metadata.box_ref);
  expect(renderedText).toContain('盒内浏览');
  expect(renderedText).toContain('当前位置');
  expect(renderedText).toContain('2 张');
  expect(renderedText).toContain('本盒共 2 张');
  expect(renderedText).toContain('保存到收藏');
  expect(renderedText).not.toContain('可收藏');
  expect(renderedText).not.toContain('有收藏');
  expect(renderedText).not.toContain('卡片列表');
  expect(renderedText).not.toContain('切换位置');
  expect(renderedText).not.toContain('相邻对象');
  expect(
    root.findByProps({testID: 'space-favorite-1'}).props.accessibilityRole,
  ).toBe('checkbox');
  expect(
    root.findByProps({testID: 'space-sleep-1'}).props.accessibilityRole,
  ).toBe('switch');
  expect(
    root.findAllByProps({testID: 'space-return-learning'}).some(
      candidate => candidate.props.accessibilityRole === 'button',
    ),
  ).toBe(true);
});

test('defaults Space first-read focus to the current learning card box', () => {
  const session = createLocalLearningSession('cet4');
  const firstLibrary = session.catalogCards[0].space_metadata.library;
  const currentCard = session.catalogCards.find(
    card => card.space_metadata.library !== firstLibrary,
  )!;
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

  expect(renderedText).toContain(
    `书架 ${currentCard.space_metadata.library} 分区 ${currentCard.space_metadata.group} 卡盒 ${currentCard.space_metadata.box}`,
  );
  expect(renderedText).toContain('当前盒桌 打开卡盒');
  expect(renderedText).toContain('同盒卡片');
  expect(renderedText).toContain('同盒卡片都在这里');
  expect(renderedText).toContain('同盒休眠');
  expect(renderedText).toContain('暂无休眠');
  expect(renderedText).toContain('回学习 回到刚才那张卡');
  expect(
    root.findAllByProps({ testID: 'space-open-box-lid' }).length,
  ).toBeGreaterThan(0);
  const openBoxDeck = root.findByProps({ testID: 'space-open-box-deck' });
  expect(
    openBoxDeck.findAllByProps({ testID: 'space-sleep-alcove' }).length,
  ).toBeGreaterThan(0);
  expect(
    openBoxDeck.findAllByProps({ testID: 'space-return-learning' }),
  ).toHaveLength(0);
  expect(
    root.findAllByProps({ testID: 'space-sleep-alcove' }).length,
  ).toBeGreaterThan(0);
  expect(
    root.findAllByProps({ testID: 'space-return-learning' }).length,
  ).toBeGreaterThan(0);
  expect(renderedText).not.toContain('当前地址');
  expect(renderedText).not.toContain('当前学习卡位于');
});

test('browses sibling boxes, groups, and libraries while preserving the current-card return focus', () => {
  const session = createLocalLearningSession('cet4');
  const baseCard = session.catalogCards[0];
  const createSpaceCard = (
    cardId: string,
    library: string,
    group: string,
    box: string,
    boxRef: string,
    prompt: string,
  ) => ({
    ...baseCard,
    card_id: cardId,
    front: {...baseCard.front, prompt},
    space_metadata: {box, box_ref: boxRef, group, library},
  });
  const currentCard = createSpaceCard(
    '000001',
    '听力',
    '逻辑关系',
    '转折关系',
    '0000',
    '当前学习卡提示',
  );
  const siblingBoxCard = createSpaceCard(
    '000101',
    '听力',
    '逻辑关系',
    '因果关系',
    '0001',
    '相邻卡盒提示',
  );
  const siblingGroupCard = createSpaceCard(
    '001001',
    '听力',
    '细节捕捉',
    '数字细节',
    '0010',
    '相邻分区提示',
  );
  const siblingLibraryCard = createSpaceCard(
    '010001',
    '仔细阅读',
    '定位词抓取',
    '题干定位',
    '0100',
    '相邻书架提示',
  );
  const onReturnToLearning = jest.fn();
  let tree: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <SpaceSurface
        cardStateById={{}}
        currentLearningCard={currentCard}
        deviceClass="phone"
        onReturnToLearning={onReturnToLearning}
        onToggleFavoriteTag={jest.fn()}
        onToggleSleepState={jest.fn()}
        palette={palette}
        spaceCards={[
          currentCard,
          siblingBoxCard,
          siblingGroupCard,
          siblingLibraryCard,
        ]}
      />,
    );
  });

  const root = tree!.root;
  expect(root.findByProps({testID: 'space-browse-rail'})).toBeTruthy();
  expect(collectRenderedText(tree!.toJSON()).join(' ')).toContain(
    '当前学习卡提示',
  );

  ReactTestRenderer.act(() => {
    root.findByProps({testID: 'space-box-next'}).props.onPress();
  });
  let renderedText = collectRenderedText(tree!.toJSON()).join(' ');
  expect(renderedText).toContain('因果关系');
  expect(renderedText).toContain('相邻卡盒提示');
  expect(root.findByProps({testID: 'space-follow-current-box'})).toBeTruthy();

  ReactTestRenderer.act(() => {
    root.findByProps({testID: 'space-group-next'}).props.onPress();
  });
  renderedText = collectRenderedText(tree!.toJSON()).join(' ');
  expect(renderedText).toContain('细节捕捉');
  expect(renderedText).toContain('相邻分区提示');

  ReactTestRenderer.act(() => {
    root.findByProps({testID: 'space-library-next'}).props.onPress();
  });
  renderedText = collectRenderedText(tree!.toJSON()).join(' ');
  expect(renderedText).toContain('仔细阅读');
  expect(renderedText).toContain('相邻书架提示');

  ReactTestRenderer.act(() => {
    root.findByProps({testID: 'space-follow-current-box'}).props.onPress();
  });
  renderedText = collectRenderedText(tree!.toJSON()).join(' ');
  expect(renderedText).toContain('转折关系');
  expect(renderedText).toContain('当前学习卡提示');
  expect(root.findAllByProps({testID: 'space-follow-current-box'})).toHaveLength(
    0,
  );

  ReactTestRenderer.act(() => {
    root.findByProps({testID: 'space-return-learning'}).props.onPress();
  });
  expect(onReturnToLearning).toHaveBeenCalledTimes(1);
});

test('stacks Space objects instead of overlapping them at accessibility font sizes', () => {
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
        usesAccessibilityLayout
      />,
    );
  });

  const root = tree!.root;
  const openBoxDeckStyle = StyleSheet.flatten(
    root.findByProps({ testID: 'space-open-box-deck' }).props.style,
  );
  const cardStyles = root
    .findAllByProps({ testID: 'space-overview-card-object' })
    .map(card => StyleSheet.flatten(card.props.style));
  const returnStyle = StyleSheet.flatten(
    root.findByProps({ testID: 'space-return-learning' }).props.style,
  );
  const viewportStyle = StyleSheet.flatten(
    root.findByProps({testID: 'space-fixed-viewport'}).props.style,
  );

  expect(openBoxDeckStyle).toMatchObject({ flex: 0, overflow: 'visible' });
  expect(cardStyles.length).toBeGreaterThan(1);
  cardStyles.forEach(style => {
    expect(style).toMatchObject({
      height: 'auto',
      position: 'relative',
      width: '100%',
    });
  });
  expect(returnStyle).toMatchObject({
    alignItems: 'stretch',
    flexDirection: 'column',
  });
  expect(viewportStyle.flex).toBe(0);
});

test('keeps accessibility-size tablet Space intrinsically scrollable', () => {
  const session = createLocalLearningSession('cet4');
  let tree: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <SpaceSurface
        cardStateById={{}}
        currentLearningCard={session.catalogCards[0]}
        deviceClass="tablet"
        onReturnToLearning={jest.fn()}
        onToggleFavoriteTag={jest.fn()}
        onToggleSleepState={jest.fn()}
        palette={palette}
        spaceCards={session.catalogCards}
        usesAccessibilityLayout
      />,
    );
  });

  expect(
    tree!.root.findByProps({testID: 'space-scroll-viewport'}),
  ).toBeTruthy();
});

test('opens card inspection on the current learning card instead of the first sibling', () => {
  const session = createLocalLearningSession('cet4');
  const currentCard = session.catalogCards.find((candidate, index, cards) =>
    cards
      .slice(0, index)
      .some(
        sibling =>
          sibling.space_metadata.box_ref === candidate.space_metadata.box_ref,
      ),
  );

  expect(currentCard).toBeDefined();
  const siblingCards = session.catalogCards.filter(
    card => card.space_metadata.box_ref === currentCard!.space_metadata.box_ref,
  );
  const currentSiblingIndex = siblingCards.findIndex(
    card => card.card_id === currentCard!.card_id,
  );
  expect(currentSiblingIndex).toBeGreaterThan(0);
  let tree: ReactTestRenderer.ReactTestRenderer;

  ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(
      <SpaceSurface
        cardStateById={{}}
        currentLearningCard={currentCard!}
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

  const renderedText = collectRenderedText(tree!.toJSON()).join(' ');
  expect(renderedText).toContain(currentCard!.front.prompt);
  expect(renderedText).toContain(
    `${currentSiblingIndex + 1}/${siblingCards.length}`,
  );
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

  expect(updatedText).toContain('同盒卡片都在这里');
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
  expect(renderedText).toContain('书架 当前书架 分区 当前分区 卡盒 当前卡盒');
  expect(renderedText).not.toContain('馆 1 / 组 1 / 盒 1');
});
