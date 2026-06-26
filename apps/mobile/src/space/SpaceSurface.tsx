import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';

import {
  INTERACTION_LABELS,
  LearningCard,
  LearningTrack,
} from '../learning/model';
import {
  formatSpacePathByIndex,
  formatSpaceBoxLabel,
  formatSpaceGroupLabel,
  formatSpaceLibraryLabel,
  resolveSpacePosition,
} from './spaceMetadataDisplay';
import { resolveLibraryTone } from '../visual/tokens';

type SpacePalette = {
  accent: string;
  accentSoft: string;
  accentStrong: string;
  border: string;
  danger: string;
  panel: string;
  panelStrong: string;
  success: string;
  text: string;
  textMuted: string;
  warning: string;
};

type DeviceClass = 'phone' | 'tablet';
export type SpaceSurfaceScreen = 'overview' | 'card_list';

type SpaceCardPreview = {
  boxName: string;
  boxRef: string;
  cardId: string;
  interactionLabel: string;
  prompt: string;
  track: LearningTrack;
};

type SpaceBoxNode = {
  boxName: string;
  boxRef: string;
  cards: SpaceCardPreview[];
};

type SpaceGroupNode = {
  boxes: SpaceBoxNode[];
  groupName: string;
};

type SpaceLibraryNode = {
  groups: SpaceGroupNode[];
  libraryName: string;
};

type SpaceSeed = {
  allCards: SpaceCardPreview[];
  boxCount: number;
  cardCount: number;
  groupCount: number;
  libraries: SpaceLibraryNode[];
  libraryCount: number;
};

const noop = () => undefined;

export type SpaceGateRail = {
  actionSlot: React.ReactNode;
  detail: string;
  label: string;
  title: string;
};

export type SpaceSyncRail = {
  detail: string;
  label: string;
  state: 'syncing' | 'synced' | 'error';
  title: string;
};

export type SpaceStatusRail = {
  actionSlot?: React.ReactNode;
  detail: string;
  label: string;
  state: 'loading' | 'error';
  title: string;
};

export function SpaceSurface({
  cardStateById,
  currentLearningCard,
  deviceClass,
  onBackToOverview,
  onOpenCardList,
  onReturnToLearning,
  onToggleFavoriteTag,
  onToggleSleepState,
  palette,
  screen = 'overview',
  spaceGateRail,
  spaceCards,
  spaceStatusRail,
  spaceSyncRail,
}: {
  cardStateById: Record<string, { isFavorited: boolean; isSleeping: boolean }>;
  currentLearningCard: LearningCard | null;
  deviceClass: DeviceClass;
  onBackToOverview?: () => void;
  onOpenCardList?: () => void;
  onReturnToLearning: () => void;
  onToggleFavoriteTag: (cardId: string) => void;
  onToggleSleepState: (cardId: string) => void;
  palette: SpacePalette;
  screen?: SpaceSurfaceScreen;
  spaceGateRail?: SpaceGateRail | null;
  spaceCards: LearningCard[];
  spaceStatusRail?: SpaceStatusRail | null;
  spaceSyncRail?: SpaceSyncRail | null;
}) {
  const seed = useMemo(() => buildSpaceSeed(spaceCards), [spaceCards]);
  const focusedSelection = useMemo(() => {
    if (!currentLearningCard) {
      return null;
    }

    const position = resolveSpacePosition(seed, currentLearningCard);
    if (!position) {
      return null;
    }

    const library = seed.libraries[position.libraryIndex - 1];
    const group = library?.groups[position.groupIndex - 1];
    const box = group?.boxes[position.boxIndex - 1];

    if (!library || !group || !box) {
      return null;
    }

    return {
      boxRef: box.boxRef,
      groupName: group.groupName,
      libraryName: library.libraryName,
      position,
    };
  }, [currentLearningCard, seed]);
  const [selectedLibraryName, setSelectedLibraryName] = useState(
    focusedSelection?.libraryName ?? seed.libraries[0]?.libraryName ?? '',
  );
  const selectedLibrary =
    seed.libraries.find(
      library => library.libraryName === selectedLibraryName,
    ) ?? seed.libraries[0];

  const [selectedGroupName, setSelectedGroupName] = useState(
    focusedSelection?.groupName ?? selectedLibrary?.groups[0]?.groupName ?? '',
  );
  const selectedGroup =
    selectedLibrary?.groups.find(
      group => group.groupName === selectedGroupName,
    ) ?? selectedLibrary?.groups[0];

  const [selectedBoxRef, setSelectedBoxRef] = useState(
    focusedSelection?.boxRef ?? selectedGroup?.boxes[0]?.boxRef ?? '',
  );
  const selectedBox =
    selectedGroup?.boxes.find(box => box.boxRef === selectedBoxRef) ??
    selectedGroup?.boxes[0];
  const selectedBoxCards = selectedBox?.cards ?? [];
  const selectedFavoriteCards = selectedBoxCards.filter(
    card => cardStateById[card.cardId]?.isFavorited,
  );
  const selectedSleepingCards = selectedBoxCards.filter(
    card => cardStateById[card.cardId]?.isSleeping,
  );
  const currentBoxCard = selectedBoxCards.find(
    card => card.cardId === currentLearningCard?.card_id,
  );
  const selectedLibraryIndex =
    selectedLibrary == null
      ? 1
      : Math.max(
          seed.libraries.findIndex(
            library => library.libraryName === selectedLibrary.libraryName,
          ) + 1,
          1,
        );
  const selectedGroupIndex =
    selectedLibrary == null || selectedGroup == null
      ? 1
      : Math.max(
          selectedLibrary.groups.findIndex(
            group => group.groupName === selectedGroup.groupName,
          ) + 1,
          1,
        );
  const selectedBoxIndex =
    selectedGroup == null || selectedBox == null
      ? 1
      : Math.max(
          selectedGroup.boxes.findIndex(box => box.boxRef === selectedBox.boxRef) +
            1,
          1,
        );
  const currentCardPosition = focusedSelection?.position ?? null;
  const selectedTone = resolveLibraryTone(selectedLibrary?.libraryName);
  const currentLibraryName = currentCardPosition
    ? seed.libraries[currentCardPosition.libraryIndex - 1]?.libraryName
    : undefined;
  const currentTone = resolveLibraryTone(
    currentLibraryName ?? selectedLibrary?.libraryName,
  );
  const currentCardPath = currentCardPosition
    ? formatSpacePathByIndex(
        currentCardPosition.libraryIndex,
        currentCardPosition.groupIndex,
        currentCardPosition.boxIndex,
      )
    : null;
  const isGated = spaceGateRail !== null && spaceGateRail !== undefined;
  const stateRailStack = (
    <>
      {spaceGateRail ? (
        <SpaceGateRailCard palette={palette} rail={spaceGateRail} />
      ) : null}

      {spaceSyncRail ? (
        <SpaceSyncRailCard palette={palette} rail={spaceSyncRail} />
      ) : null}

      {spaceStatusRail ? (
        <SpaceStatusRailCard palette={palette} rail={spaceStatusRail} />
      ) : null}
    </>
  );

  if (!selectedLibrary || !selectedGroup || !selectedBox) {
    const emptyTone = currentLearningCard
      ? resolveLibraryTone(currentLearningCard.space_metadata.library)
      : resolveLibraryTone();
    const emptySelectedPath = currentCardPath
      ? '当前卡盒已定位'
      : '位置待同步';
    const isSpaceLoading = spaceStatusRail?.state === 'loading';

    return (
      <ScrollView
        contentContainerStyle={[
          styles.content,
          deviceClass === 'tablet' ? styles.contentTablet : null,
        ]}
      >
        <View style={styles.shelfDeskFrame} testID="space-empty-state">
          <SurfaceCard
            palette={palette}
            style={styles.addressShelf}
            testID="space-address-shelf"
          >
            <Text style={[styles.eyebrow, { color: emptyTone.accent }]}>
              知识空间
            </Text>
            <Text style={[styles.title, { color: palette.text }]}>
              卡片的物理空间
            </Text>
            <Text style={[styles.summary, { color: palette.textMuted }]}>
              {isSpaceLoading
                ? '正在整理本轮卡片；空间先保留当前位置。'
                : '当前卡盒暂时没有可展示卡片；空间仍保留回到学习的上下文。'}
            </Text>
            <View style={styles.addressContextRow}>
              <AddressContextPill
                emphasized
                label="位置"
                palette={palette}
                toneColor={emptyTone.accent}
                value={emptySelectedPath}
              />
              <AddressContextPill
                label="状态"
                palette={palette}
                value={isSpaceLoading ? '整理中' : '待整理'}
              />
              <AddressContextPill
                label="连续性"
                palette={palette}
                value="回到学习"
              />
            </View>
            <View
              style={[styles.addressPath, { borderColor: emptyTone.accent }]}
            >
              <Text
                style={[styles.addressPathLabel, { color: emptyTone.accent }]}
              >
                当前位置
              </Text>
              <Text style={[styles.addressPathText, { color: palette.text }]}>
                {emptySelectedPath}
              </Text>
              {isSpaceLoading ? (
                <View
                  style={styles.loadingSkeletonStack}
                  testID="space-loading-address-skeleton"
                >
                  <View
                    style={[
                      styles.loadingSkeletonBar,
                      { backgroundColor: emptyTone.accentSoft },
                    ]}
                  />
                  <View
                    style={[
                      styles.loadingSkeletonBar,
                      styles.loadingSkeletonBarShort,
                      { backgroundColor: emptyTone.accentSoft },
                    ]}
                  />
                </View>
              ) : null}
            </View>
          </SurfaceCard>

          {stateRailStack}

          <SurfaceCard palette={palette} testID="space-current-box-tray">
            <View style={styles.boxTrayHeader}>
              <View style={styles.boxTrayCopy}>
                <Text style={[styles.eyebrow, { color: emptyTone.accent }]}>
                  {isSpaceLoading ? '正在整理卡片' : '当前卡盒待整理'}
                </Text>
                <Text style={[styles.boxTrayTitle, { color: palette.text }]}>
                  当前卡盒
                </Text>
                <Text style={[styles.ruleText, { color: palette.textMuted }]}>
                  {isSpaceLoading ? '卡片正在整理' : '暂时没有可展示卡片'}
                </Text>
              </View>
              <View
                style={[
                  styles.boxAccentRail,
                  { backgroundColor: emptyTone.accent },
                ]}
              />
            </View>

            {isSpaceLoading ? (
              <View
                style={styles.boxTraySkeleton}
                testID="space-loading-box-skeleton"
              >
                <View
                  style={[
                    styles.loadingSkeletonBar,
                    { backgroundColor: emptyTone.accentSoft },
                  ]}
                />
                <View
                  style={[
                    styles.loadingSkeletonBar,
                    styles.loadingSkeletonBarShort,
                    { backgroundColor: emptyTone.accentSoft },
                  ]}
                />
              </View>
            ) : null}

            <Text style={[styles.locationText, { color: emptyTone.accent }]}>
                {currentCardPath
                  ? '当前学习卡在这里'
                  : '空间正在等待本轮卡片。'}
              </Text>

            <View style={styles.boxShelf} testID="space-current-position">
              <View
                style={[
                  styles.boxShelfTile,
                  {
                    backgroundColor: emptyTone.accentSoft,
                    borderColor: emptyTone.accent,
                  },
                ]}
                testID="space-empty-box-slot"
              >
                <Text style={[styles.boxName, { color: palette.text }]}>
                  当前卡盒
                </Text>
                <Text style={[styles.boxMeta, { color: palette.textMuted }]}>
                  {isSpaceLoading ? '正在整理卡片' : '暂无可展示卡片'}
                </Text>
                <Text style={[styles.currentTag, { color: emptyTone.accent }]}>
                  {isSpaceLoading ? '整理中' : '待整理'}
                </Text>
              </View>
            </View>
          </SurfaceCard>

          {screen === 'card_list' ? (
            <SurfaceCard palette={palette} testID="space-box-detail">
              <View style={styles.containedHeader}>
                <View style={styles.statusCopy}>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>
                    卡片列表
                  </Text>
                  <Text style={[styles.ruleText, { color: palette.textMuted }]}>
                    {emptySelectedPath}
                  </Text>
                </View>
                <View style={styles.headerActionStack}>
                  <Text style={[styles.stateTag, { color: palette.warning }]}>
                    {isSpaceLoading ? '整理中' : '待整理'}
                  </Text>
                  <ActionChip
                    label="返回概览"
                    onPress={onBackToOverview ?? noop}
                    palette={palette}
                    testID="space-card-list-back"
                  />
                </View>
              </View>
              <View style={styles.cardStrip} testID="space-contained-card-strip">
                {isSpaceLoading ? (
                  [1, 2, 3].map(index => (
                    <View
                      key={index}
                      style={[
                        styles.cardTile,
                        styles.loadingCardSkeleton,
                        {
                          backgroundColor: palette.panelStrong,
                          borderColor: palette.border,
                        },
                      ]}
                      testID="space-loading-card-skeleton"
                    >
                      <Text style={[styles.cardPrompt, { color: palette.text }]}>
                        正在整理卡片
                      </Text>
                      <Text
                        style={[styles.cardMeta, { color: palette.textMuted }]}
                      >
                        正在整理卡片；完成后显示本轮内容。
                      </Text>
                    </View>
                  ))
                ) : (
                  <View
                    style={[
                      styles.cardTile,
                      {
                        backgroundColor: palette.panelStrong,
                        borderColor: palette.border,
                      },
                    ]}
                    testID="space-empty-card-slot"
                  >
                    <Text style={[styles.cardPrompt, { color: palette.text }]}>
                      当前卡盒暂无可展示卡片
                    </Text>
                    <Text style={[styles.cardMeta, { color: palette.textMuted }]}>
                      本轮暂时没有符合条件的卡片；可以继续学习或稍后再看。
                    </Text>
                  </View>
                )}
              </View>
            </SurfaceCard>
          ) : (
            <SurfaceCard palette={palette} testID="space-card-list-entry">
              <View style={styles.returnStrip}>
                <View style={styles.statusCopy}>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>
                    卡片列表
                  </Text>
                  <Text style={[styles.ruleText, { color: palette.textMuted }]}>
                    {isSpaceLoading
                      ? '列表正在整理，完成后再进入查看。'
                      : '当前卡盒暂无可展示卡片；列表作为单独页面保留。'}
                  </Text>
                </View>
                <ActionChip
                  label="查看列表"
                  onPress={onOpenCardList ?? noop}
                  palette={palette}
                  testID="space-open-card-list"
                />
              </View>
            </SurfaceCard>
          )}

          <SurfaceCard palette={palette} testID="space-continuity-strip">
            <View style={styles.returnStrip}>
              <View style={styles.statusCopy}>
                <Text style={[styles.cardTitle, { color: palette.text }]}>
                  回到学习
                </Text>
                <Text style={[styles.ruleText, { color: palette.textMuted }]}>
                  回到学习时继续当前进度，不让空盒打断练习。
                </Text>
              </View>
              <ActionChip
                label="回到学习"
                onPress={onReturnToLearning}
                palette={palette}
                testID="space-return-learning"
              />
            </View>
          </SurfaceCard>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[
        styles.content,
        deviceClass === 'tablet' ? styles.contentTablet : null,
      ]}
    >
      <View style={styles.shelfDeskFrame} testID="space-shelf-desk">
        <SurfaceCard
          palette={palette}
          style={styles.addressShelf}
          testID="space-address-shelf"
        >
          <Text style={[styles.eyebrow, { color: selectedTone.accent }]}>
            知识空间
          </Text>
          <Text style={[styles.title, { color: palette.text }]}>
            卡片的物理空间
          </Text>
          <Text style={[styles.summary, { color: palette.textMuted }]}>
            空间只保留当前位置和卡片状态；当前卡盒是第一阅读对象，
            收藏与休眠只作为状态提示。
          </Text>
          <View style={styles.addressContextRow}>
            <AddressContextPill
              emphasized
              label="书架"
              palette={palette}
              toneColor={selectedTone.accent}
              value={formatSpaceLibraryLabel(selectedLibraryIndex)}
            />
            <AddressContextPill
              label="分区"
              palette={palette}
              value={formatSpaceGroupLabel(selectedGroupIndex)}
            />
            <AddressContextPill
              label="卡盒"
              palette={palette}
              value={formatSpaceBoxLabel(selectedBoxIndex)}
            />
            <AddressContextPill
              label="状态"
              palette={palette}
              value={selectedBox.cards.length > 0 ? '可查看' : '待整理'}
            />
          </View>
          <View
            style={[styles.addressPath, { borderColor: selectedTone.accent }]}
          >
            <Text
              style={[styles.addressPathLabel, { color: selectedTone.accent }]}
            >
              当前位置
            </Text>
            <Text style={[styles.addressPathText, { color: palette.text }]}>
              当前卡盒已定位
            </Text>
          </View>
        </SurfaceCard>

        {stateRailStack}

        <SurfaceCard palette={palette} testID="space-current-box-tray">
          <View style={styles.boxTrayHeader}>
              <View style={styles.boxTrayCopy}>
                <Text style={[styles.eyebrow, { color: selectedTone.accent }]}>
                  当前卡盒
                </Text>
                <Text style={[styles.boxTrayTitle, { color: palette.text }]}>
                  {formatSpaceBoxLabel(selectedBoxIndex)}
                </Text>
                <Text style={[styles.ruleText, { color: palette.textMuted }]}>
                  可练卡片已归在这里
                </Text>
            </View>
            <View
              style={[
                styles.boxAccentRail,
                { backgroundColor: selectedTone.accent },
              ]}
            />
          </View>

          <Text style={[styles.locationText, { color: selectedTone.accent }]}>
            {currentCardPath
              ? '当前学习卡在这里'
              : '当前学习卡位置信息将随学习进度更新。'}
          </Text>
          {currentLearningCard ? (
            <Text style={[styles.ruleText, { color: palette.textMuted }]}>
              {currentLearningCard.front.prompt}
            </Text>
          ) : null}

          <View
            style={[
              styles.openBoxDeck,
              {
                backgroundColor: selectedTone.accentSoft,
                borderColor: selectedTone.accent,
              },
            ]}
            testID="space-open-box-deck"
          >
            {selectedBoxCards.slice(0, 3).map((card, cardIndex, deckCards) => {
              const isCurrent = currentLearningCard?.card_id === card.cardId;
              const cardState = cardStateById[card.cardId];
              const deckStyle =
                deckCards.length === 1
                  ? styles.deckCardSolo
                  : deckCards.length === 2
                  ? cardIndex === 0
                    ? styles.deckCardPairLeft
                    : styles.deckCardPairRight
                  : cardIndex === 0
                  ? styles.deckCardLeft
                  : cardIndex === 1
                  ? styles.deckCardCenter
                  : styles.deckCardRight;

              return (
                <View
                  key={card.cardId}
                  style={[
                    styles.deckCard,
                    deckStyle,
                    {
                      backgroundColor: palette.panelStrong,
                      borderColor: isCurrent
                        ? selectedTone.accent
                        : palette.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.deckCardTag,
                      {
                        color: isCurrent
                          ? selectedTone.accent
                          : cardState?.isSleeping
                          ? palette.warning
                          : cardState?.isFavorited
                          ? palette.accentStrong
                          : palette.textMuted,
                      },
                    ]}
                  >
                    {isCurrent
                      ? '当前'
                      : cardState?.isSleeping
                      ? '休眠'
                      : cardState?.isFavorited
                      ? '收藏'
                      : '卡片'}
                  </Text>
                  <Text
                    numberOfLines={3}
                    style={[styles.deckCardPrompt, { color: palette.text }]}
                  >
                    {card.prompt}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={styles.boxShelf} testID="space-current-position">
            {selectedGroup.boxes.map((box, boxIndex) => {
              const isActive = box.boxRef === selectedBox.boxRef;
              const isCurrent =
                currentLearningCard?.space_metadata.box_ref === box.boxRef;

              return (
                <Pressable
                  key={box.boxRef}
                  onPress={() => setSelectedBoxRef(box.boxRef)}
                  style={[
                    styles.boxShelfTile,
                    {
                      backgroundColor: isActive
                        ? selectedTone.accentSoft
                        : palette.panelStrong,
                      borderColor: isActive
                        ? selectedTone.accent
                        : palette.border,
                    },
                  ]}
                  testID={`space-box-${boxIndex + 1}`}
                >
                  <Text style={[styles.boxName, { color: palette.text }]}>
                    {isActive ? '当前卡盒' : '相邻卡盒'}
                  </Text>
                  <Text style={[styles.boxMeta, { color: palette.textMuted }]}>
                    {box.cards.length > 0 ? '有卡片' : '待整理'}
                  </Text>
                  {isCurrent ? (
                    <Text
                      style={[styles.currentTag, { color: currentTone.accent }]}
                    >
                      当前卡在此
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </SurfaceCard>

        <View
          style={[
            styles.sectionGrid,
            deviceClass === 'tablet' ? styles.sectionGridTablet : null,
          ]}
        >
          <SurfaceCard
            palette={palette}
            style={deviceClass === 'tablet' ? styles.surfaceCardHalf : null}
          >
            <Text style={[styles.cardTitle, { color: palette.text }]}>
              浏览位置
            </Text>
            <Text style={[styles.ruleText, { color: palette.textMuted }]}>
              这里只切换浏览焦点；当前卡盒仍是上方的主对象。
            </Text>

            <Text style={[styles.selectorTitle, { color: palette.textMuted }]}>
              书架
            </Text>
            <View style={styles.selectorWrap}>
              {seed.libraries.map((library, index) => {
                const isActive =
                  library.libraryName === selectedLibrary.libraryName;

                return (
                  <Pressable
                    key={library.libraryName}
                    onPress={() => {
                      setSelectedLibraryName(library.libraryName);
                      setSelectedGroupName(library.groups[0]?.groupName ?? '');
                      setSelectedBoxRef(
                        library.groups[0]?.boxes[0]?.boxRef ?? '',
                      );
                    }}
                    style={[
                      styles.selectorChip,
                      {
                        backgroundColor: isActive
                          ? selectedTone.accentSoft
                          : palette.panelStrong,
                        borderColor: isActive
                          ? selectedTone.accent
                          : palette.border,
                      },
                    ]}
                    testID={`space-library-${index + 1}`}
                  >
                    <View style={styles.selectorHeader}>
                      <View
                        style={[
                          styles.selectorDot,
                          {
                            backgroundColor: isActive
                              ? selectedTone.accent
                              : palette.border,
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.selectorLabel,
                          {
                            color: isActive ? selectedTone.accent : palette.textMuted,
                          },
                        ]}
                      >
                        {formatSpaceLibraryLabel(index + 1)}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.selectorMeta,
                        { color: palette.textMuted },
                      ]}
                    >
                      可切换
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.selectorTitle, { color: palette.textMuted }]}>
              分区
            </Text>
            <View style={styles.selectorWrap}>
              {selectedLibrary.groups.map((group, index) => {
                const isActive = group.groupName === selectedGroup.groupName;

                return (
                  <Pressable
                    key={`${selectedLibrary.libraryName}-${group.groupName}`}
                    onPress={() => {
                      setSelectedGroupName(group.groupName);
                      setSelectedBoxRef(group.boxes[0]?.boxRef ?? '');
                    }}
                    style={[
                      styles.selectorChip,
                      {
                        backgroundColor: isActive
                          ? selectedTone.accentSoft
                          : palette.panelStrong,
                        borderColor: isActive
                          ? selectedTone.accent
                          : palette.border,
                      },
                    ]}
                    testID={`space-group-${index + 1}`}
                  >
                    <Text
                      style={[
                        styles.selectorLabel,
                        {
                          color: isActive
                            ? selectedTone.accent
                            : palette.textMuted,
                        },
                      ]}
                    >
                      {formatSpaceGroupLabel(index + 1)}
                    </Text>
                    <Text
                      style={[
                        styles.selectorMeta,
                        { color: palette.textMuted },
                      ]}
                    >
                      可切换
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </SurfaceCard>

          <SurfaceCard
            palette={palette}
            style={deviceClass === 'tablet' ? styles.surfaceCardHalf : null}
          >
            <Text style={[styles.cardTitle, { color: palette.text }]}>
              空间规则
            </Text>
            <RuleItem
              palette={palette}
              text="收藏是标签，不是物理盒子；它不会改写知识归属。"
            />
            <RuleItem
              palette={palette}
              text="休眠区会影响当前练习，但卡片仍留在原来的位置。"
            />
            <RuleItem
              palette={palette}
              text="空间只展示卡片位置、收藏和休眠，不要求你管理复杂列表。"
            />
          </SurfaceCard>
        </View>

        {screen === 'card_list' ? (
          <>
            <SurfaceCard palette={palette} testID="space-box-detail">
              <View style={styles.containedHeader} testID="space-card-list-header">
                <View style={styles.statusCopy}>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>
                    卡片列表
                  </Text>
                  <Text style={[styles.ruleText, { color: palette.textMuted }]}>
                    当前卡盒
                  </Text>
                </View>
                <View style={styles.headerActionStack}>
                  <Text style={[styles.stateTag, { color: palette.accentStrong }]}>
                    {isGated
                      ? '完整空间待开放'
                      : selectedFavoriteCards.length > 0
                      ? '有收藏'
                      : '可收藏'}
                  </Text>
                  <ActionChip
                    label="返回概览"
                    onPress={onBackToOverview ?? noop}
                    palette={palette}
                    testID="space-card-list-back"
                  />
                </View>
              </View>

              <View style={styles.cardStrip} testID="space-contained-card-strip">
                {selectedBoxCards.map((card, cardIndex) => {
                  const cardDisplayIndex = cardIndex + 1;
                  const isCurrent = currentLearningCard?.card_id === card.cardId;
                  const isFavorited =
                    cardStateById[card.cardId]?.isFavorited ?? false;
                  const isSleeping =
                    cardStateById[card.cardId]?.isSleeping ?? false;

                  return (
                    <View
                      key={card.cardId}
                      style={[
                        styles.cardTile,
                        {
                          backgroundColor: palette.panelStrong,
                          borderColor: isCurrent
                            ? selectedTone.accent
                            : palette.border,
                        },
                      ]}
                    >
                      <Text style={[styles.cardPrompt, { color: palette.text }]}>
                        {card.prompt}
                      </Text>
                      <Text style={[styles.cardMeta, { color: palette.textMuted }]}>
                        {card.interactionLabel}
                      </Text>
                      <View style={styles.badgeRow}>
                        {isFavorited ? (
                          <Text
                            style={[
                              styles.stateTag,
                              { color: palette.accentStrong },
                            ]}
                          >
                            已收藏
                          </Text>
                        ) : null}
                        {isSleeping ? (
                          <Text
                            style={[styles.stateTag, { color: palette.warning }]}
                          >
                            休眠中
                          </Text>
                        ) : null}
                        {isCurrent ? (
                          <Text
                            style={[
                              styles.currentTag,
                              { color: currentTone.accent },
                            ]}
                          >
                            当前学习卡
                          </Text>
                        ) : null}
                      </View>
                      <View style={styles.actionWrap}>
                        {isGated ? (
                          <Text
                            style={[
                              styles.lockedActionText,
                              { color: palette.textMuted },
                            ]}
                          >
                            试用或会员后可调整收藏和休眠状态
                          </Text>
                        ) : (
                          <>
                            <ActionChip
                              label={isFavorited ? '取消收藏' : '收藏'}
                              labelTestID={
                                isFavorited
                                  ? `space-favorite-active-${cardDisplayIndex}`
                                  : `space-favorite-inactive-${cardDisplayIndex}`
                              }
                              onPress={() => onToggleFavoriteTag(card.cardId)}
                              palette={palette}
                              testID={`space-favorite-${cardDisplayIndex}`}
                            />
                            <ActionChip
                              label={isSleeping ? '移出休眠' : '放入休眠'}
                              onPress={() => onToggleSleepState(card.cardId)}
                              palette={palette}
                              testID={`space-sleep-${cardDisplayIndex}`}
                            />
                          </>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            </SurfaceCard>

            <SurfaceCard palette={palette} testID="space-sleep-zone">
              <View style={styles.containedHeader}>
                <View style={styles.statusCopy}>
                  <Text style={[styles.cardTitle, { color: palette.text }]}>
                    休眠区
                  </Text>
                  <Text style={[styles.ruleText, { color: palette.textMuted }]}>
                    休眠区属于当前位置；卡片进入后会先退出当前练习，移出后回到原位置。
                  </Text>
                </View>
                <Text style={[styles.stateTag, { color: palette.warning }]}>
                  {selectedSleepingCards.length > 0 ? '有休眠' : '暂无休眠'}
                </Text>
              </View>
              {selectedSleepingCards.length > 0 ? (
                <View style={styles.sleepAlcove} testID="space-sleep-alcove">
                  {selectedSleepingCards.map((card, cardIndex) => (
                    <View
                      key={card.cardId}
                      style={[
                        styles.sleepingCard,
                        {
                          backgroundColor: palette.panelStrong,
                          borderColor: palette.border,
                        },
                      ]}
                    >
                      <View style={styles.statusCopy}>
                        <Text style={[styles.statusTitle, { color: palette.text }]}>
                          {card.prompt}
                        </Text>
                        <Text
                          style={[styles.statusMeta, { color: palette.textMuted }]}
                        >
                          位置保持在当前位置
                        </Text>
                      </View>
                      {isGated ? (
                        <Text
                          style={[
                            styles.lockedActionText,
                            { color: palette.textMuted },
                          ]}
                        >
                          完整空间恢复后可移出休眠
                        </Text>
                      ) : (
                        <ActionChip
                          label="移出休眠"
                          onPress={() => onToggleSleepState(card.cardId)}
                          palette={palette}
                          testID={`space-wake-${cardIndex + 1}`}
                        />
                      )}
                    </View>
                  ))}
                </View>
              ) : (
                <View
                  style={[
                    styles.sleepEmptySlot,
                    {
                      backgroundColor: palette.panelStrong,
                      borderColor: palette.border,
                    },
                  ]}
                >
                  <Text style={[styles.ruleText, { color: palette.textMuted }]}>
                    当前位置还没有卡进入休眠区。
                  </Text>
                </View>
              )}
            </SurfaceCard>
          </>
        ) : (
          <SurfaceCard palette={palette} testID="space-card-list-entry">
            <View style={styles.returnStrip}>
              <View style={styles.statusCopy}>
                <Text style={[styles.cardTitle, { color: palette.text }]}>
                  卡片列表
                </Text>
                <Text style={[styles.ruleText, { color: palette.textMuted }]}>
                  当前卡盒有 {selectedBoxCards.length} 张卡；进入列表后再收藏、休眠或查看状态。
                </Text>
              </View>
              <ActionChip
                label="查看列表"
                onPress={onOpenCardList ?? noop}
                palette={palette}
                testID="space-open-card-list"
              />
            </View>
          </SurfaceCard>
        )}

        <SurfaceCard palette={palette} testID="space-continuity-strip">
          <View style={styles.returnStrip}>
            <View style={styles.statusCopy}>
              <Text style={[styles.cardTitle, { color: palette.text }]}>
                回到学习
              </Text>
              <Text style={[styles.ruleText, { color: palette.textMuted }]}>
                回到学习时继续当前卡，并保留它在空间里的位置。
              </Text>
              {currentBoxCard ? (
                <Text
                  style={[styles.locationText, { color: currentTone.accent }]}
                >
                  下一步继续：{currentBoxCard.prompt}
                </Text>
              ) : null}
            </View>
            <ActionChip
              label="回到学习"
              onPress={onReturnToLearning}
              palette={palette}
              testID="space-return-learning"
            />
          </View>
        </SurfaceCard>
      </View>
    </ScrollView>
  );
}

function ActionChip({
  label,
  labelTestID,
  onPress,
  palette,
  testID,
}: {
  label: string;
  labelTestID?: string;
  onPress: () => void;
  palette: SpacePalette;
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.actionChip,
        { backgroundColor: palette.accentSoft, borderColor: palette.border },
      ]}
      testID={testID}
    >
      <Text
        style={[styles.actionChipLabel, { color: palette.accentStrong }]}
        testID={labelTestID}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function SpaceGateRailCard({
  palette,
  rail,
}: {
  palette: SpacePalette;
  rail: SpaceGateRail;
}) {
  return (
    <SurfaceCard
      palette={palette}
      style={styles.stateRail}
      testID="space-gate-rail"
    >
      <View style={styles.gateRailHeader}>
        <View style={styles.statusCopy}>
          <Text style={[styles.eyebrow, { color: palette.warning }]}>
            完整空间
          </Text>
          <Text style={[styles.cardTitle, { color: palette.text }]}>
            {rail.title}
          </Text>
          <Text style={[styles.ruleText, { color: palette.textMuted }]}>
            {rail.detail}
          </Text>
        </View>
        <Text style={[styles.stateTag, { color: palette.warning }]}>
          {rail.label}
        </Text>
      </View>
      {rail.actionSlot}
    </SurfaceCard>
  );
}

function SpaceSyncRailCard({
  palette,
  rail,
}: {
  palette: SpacePalette;
  rail: SpaceSyncRail;
}) {
  const railColor = resolveSpaceSyncRailColor(rail, palette);

  return (
    <SurfaceCard
      palette={palette}
      style={styles.stateRail}
      testID="space-sync-rail"
    >
      <View style={styles.gateRailHeader}>
        <View style={styles.statusCopy}>
          <Text style={[styles.eyebrow, { color: railColor }]}>
            空间同步
          </Text>
          <Text style={[styles.cardTitle, { color: palette.text }]}>
            {rail.title}
          </Text>
          <Text style={[styles.ruleText, { color: palette.textMuted }]}>
            {rail.detail}
          </Text>
        </View>
        <Text style={[styles.stateTag, { color: railColor }]}>
          {rail.label}
        </Text>
      </View>
    </SurfaceCard>
  );
}

function SpaceStatusRailCard({
  palette,
  rail,
}: {
  palette: SpacePalette;
  rail: SpaceStatusRail;
}) {
  const railColor = resolveSpaceStatusRailColor(rail, palette);

  return (
    <SurfaceCard
      palette={palette}
      style={styles.stateRail}
      testID="space-status-rail"
    >
      <View style={styles.gateRailHeader}>
        <View style={styles.statusCopy}>
          <Text style={[styles.eyebrow, { color: railColor }]}>
            空间状态
          </Text>
          <Text style={[styles.cardTitle, { color: palette.text }]}>
            {rail.title}
          </Text>
          <Text style={[styles.ruleText, { color: palette.textMuted }]}>
            {rail.detail}
          </Text>
        </View>
        <Text style={[styles.stateTag, { color: railColor }]}>
          {rail.label}
        </Text>
      </View>
      {rail.actionSlot}
    </SurfaceCard>
  );
}

function AddressContextPill({
  emphasized,
  label,
  palette,
  toneColor,
  value,
}: {
  emphasized?: boolean;
  label: string;
  palette: SpacePalette;
  toneColor?: string;
  value: string;
}) {
  const activeTone = emphasized && toneColor ? toneColor : palette.textMuted;

  return (
    <View
      style={[
        styles.addressContextPill,
        {
          backgroundColor: palette.panelStrong,
          borderColor: emphasized && toneColor ? toneColor : palette.border,
        },
      ]}
    >
      <Text style={[styles.addressContextLabel, { color: activeTone }]}>
        {label}
      </Text>
      <Text style={[styles.addressContextValue, { color: palette.text }]}>
        {value}
      </Text>
    </View>
  );
}

function SurfaceCard({
  children,
  palette,
  style,
  testID,
}: {
  children: React.ReactNode;
  palette: SpacePalette;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  return (
    <View
      style={[
        styles.surfaceCard,
        style,
        { backgroundColor: palette.panel, borderColor: palette.border },
      ]}
      testID={testID}
    >
      {children}
    </View>
  );
}

function RuleItem({ palette, text }: { palette: SpacePalette; text: string }) {
  return (
    <View style={styles.ruleRow}>
      <View
        style={[
          styles.ruleDot,
          { backgroundColor: palette.accent, borderColor: palette.border },
        ]}
      />
      <Text style={[styles.ruleText, { color: palette.textMuted }]}>
        {text}
      </Text>
    </View>
  );
}

function resolveSpaceSyncRailColor(
  rail: SpaceSyncRail,
  palette: SpacePalette,
) {
  if (rail.state === 'error') {
    return palette.warning;
  }

  if (rail.state === 'synced') {
    return palette.success;
  }

  return palette.accent;
}

function resolveSpaceStatusRailColor(
  rail: SpaceStatusRail,
  palette: SpacePalette,
) {
  if (rail.state === 'error') {
    return palette.warning;
  }

  return palette.accent;
}

function buildSpaceSeed(spaceCards: readonly LearningCard[]): SpaceSeed {
  const libraryMap = new Map<
    string,
    Map<string, Map<string, { boxName: string; cards: SpaceCardPreview[] }>>
  >();
  const allCards: SpaceCardPreview[] = [];

  for (const card of spaceCards) {
    const library =
      libraryMap.get(card.space_metadata.library) ??
      libraryMap
        .set(card.space_metadata.library, new Map())
        .get(card.space_metadata.library)!;
    const group =
      library.get(card.space_metadata.group) ??
      library
        .set(card.space_metadata.group, new Map())
        .get(card.space_metadata.group)!;
    const box =
      group.get(card.space_metadata.box_ref) ??
      group
        .set(card.space_metadata.box_ref, {
          boxName: card.space_metadata.box,
          cards: [],
        })
        .get(card.space_metadata.box_ref)!;

    const preview: SpaceCardPreview = {
      boxName: card.space_metadata.box,
      boxRef: card.space_metadata.box_ref,
      cardId: card.card_id,
      interactionLabel: INTERACTION_LABELS[card.interaction_id],
      prompt: card.front.prompt,
      track: card.track,
    };

    box.cards.push(preview);
    allCards.push(preview);
  }

  const libraries: SpaceLibraryNode[] = [];
  let groupCount = 0;
  let boxCount = 0;
  let cardCount = 0;

  for (const [libraryName, groups] of libraryMap.entries()) {
    const groupNodes: SpaceGroupNode[] = [];

    for (const [groupName, boxes] of groups.entries()) {
      const boxNodes: SpaceBoxNode[] = [];
      groupCount += 1;

      for (const [boxRef, box] of boxes.entries()) {
        boxCount += 1;
        cardCount += box.cards.length;
        boxNodes.push({
          boxName: box.boxName,
          boxRef,
          cards: box.cards,
        });
      }

      groupNodes.push({
        boxes: boxNodes,
        groupName,
      });
    }

    libraries.push({
      groups: groupNodes,
      libraryName,
    });
  }

  return {
    allCards,
    boxCount,
    cardCount,
    groupCount,
    libraries,
    libraryCount: libraries.length,
  };
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  contentTablet: {
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  shelfDeskFrame: {
    gap: 16,
  },
  surfaceCard: {
    borderRadius: 25,
    borderWidth: 1,
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  addressShelf: {
    overflow: 'hidden',
  },
  addressPath: {
    borderLeftWidth: 4,
    borderRadius: 16,
    gap: 2,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  addressPathLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  addressPathText: {
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 22,
  },
  loadingSkeletonStack: {
    gap: 7,
    marginTop: 8,
  },
  loadingSkeletonBar: {
    borderRadius: 999,
    height: 8,
    width: '72%',
  },
  loadingSkeletonBarShort: {
    width: '42%',
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  summary: {
    fontSize: 14,
    lineHeight: 21,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  addressContextRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  addressContextPill: {
    borderRadius: 15,
    borderWidth: 1,
    flexGrow: 1,
    gap: 4,
    minWidth: 112,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  addressContextLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  addressContextValue: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 20,
  },
  summaryPill: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 2,
    minWidth: 74,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  sectionGrid: {
    gap: 14,
  },
  sectionGridTablet: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  surfaceCardHalf: {
    width: '48%',
  },
  statusCopy: {
    flex: 1,
    gap: 4,
  },
  statusTitle: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  statusMeta: {
    fontSize: 12,
    lineHeight: 18,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  locationText: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
  },
  boxTrayHeader: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 14,
  },
  boxTrayCopy: {
    flex: 1,
    gap: 6,
  },
  boxTrayTitle: {
    fontSize: 25,
    fontWeight: '800',
    lineHeight: 32,
  },
  boxAccentRail: {
    borderRadius: 999,
    width: 6,
  },
  openBoxDeck: {
    borderRadius: 26,
    borderWidth: 1,
    height: 196,
    marginTop: 2,
    overflow: 'hidden',
    position: 'relative',
  },
  deckCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
    height: 142,
    paddingHorizontal: 14,
    paddingVertical: 13,
    position: 'absolute',
    top: 40,
    width: 132,
    shadowOffset: { width: 0, height: 13 },
    shadowOpacity: 0.13,
    shadowRadius: 22,
    elevation: 5,
  },
  deckCardLeft: {
    left: 12,
    transform: [{ rotate: '-7deg' }],
  },
  deckCardSolo: {
    left: '30%',
    top: 26,
    transform: [{ rotate: '0deg' }],
    width: 150,
  },
  deckCardPairLeft: {
    left: 24,
    top: 34,
    transform: [{ rotate: '-4deg' }],
    width: 148,
  },
  deckCardPairRight: {
    right: 24,
    top: 34,
    transform: [{ rotate: '4deg' }],
    width: 148,
  },
  deckCardCenter: {
    left: '31%',
    top: 24,
    transform: [{ rotate: '0deg' }],
    zIndex: 2,
  },
  deckCardRight: {
    right: 12,
    transform: [{ rotate: '7deg' }],
  },
  deckCardTag: {
    fontSize: 12,
    fontWeight: '800',
  },
  deckCardPrompt: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  boxTraySkeleton: {
    gap: 8,
    paddingRight: 22,
  },
  ruleRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
  },
  ruleDot: {
    borderRadius: 999,
    borderWidth: 1,
    height: 8,
    marginTop: 7,
    width: 8,
  },
  ruleText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
  },
  selectorTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    marginTop: 2,
  },
  selectorWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  selectorChip: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    minWidth: 124,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  selectorDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
  selectorLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  selectorMeta: {
    fontSize: 12,
    fontWeight: '500',
  },
  boxShelf: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  boxShelfTile: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 5,
    minWidth: 132,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  boxName: {
    fontSize: 15,
    fontWeight: '700',
  },
  boxMeta: {
    fontSize: 12,
    lineHeight: 18,
  },
  currentTag: {
    fontSize: 12,
    fontWeight: '700',
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  stateTag: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionChip: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  actionChipLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  stateRail: {
    borderStyle: 'solid',
  },
  gateRailHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  containedHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  cardStrip: {
    gap: 12,
  },
  cardTile: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 8,
    minWidth: 0,
    paddingHorizontal: 15,
    paddingVertical: 15,
    width: '100%',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  loadingCardSkeleton: {
    borderStyle: 'dashed',
  },
  cardPrompt: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
  },
  cardMeta: {
    fontSize: 12,
    lineHeight: 18,
  },
  lockedActionText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  sleepAlcove: {
    gap: 10,
  },
  sleepingCard: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  sleepEmptySlot: {
    borderRadius: 18,
    borderStyle: 'dashed',
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  returnStrip: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
  },
  headerActionStack: {
    alignItems: 'flex-end',
    gap: 8,
  },
});
