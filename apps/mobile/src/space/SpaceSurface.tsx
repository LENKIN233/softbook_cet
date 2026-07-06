import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Pressable,
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
import { hexToRgba, resolveLibraryTone } from '../visual/tokens';

type SpacePalette = {
  accent: string;
  accentSoft: string;
  accentStrong: string;
  background?: string;
  border: string;
  danger: string;
  panel: string;
  panelStrong: string;
  primaryActionMuted?: string;
  primaryActionSurface?: string;
  primaryActionText?: string;
  success: string;
  text: string;
  textMuted: string;
  warning: string;
};

type DeviceClass = 'phone' | 'tablet';
export type SpaceSurfaceScreen = 'overview' | 'card_list';

type SpaceSelectionMode = 'follow_current' | 'manual';

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
      cardId: currentLearningCard.card_id,
      cardIndex: Math.max(
        box.cards.findIndex(
          card => card.cardId === currentLearningCard.card_id,
        ),
        0,
      ),
      groupName: group.groupName,
      libraryName: library.libraryName,
      position,
    };
  }, [currentLearningCard, seed]);
  const [selectionMode, setSelectionMode] =
    useState<SpaceSelectionMode>('follow_current');
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
  const [selectedCardIndex, setSelectedCardIndex] = useState(0);
  const lastFocusedCardIdRef = useRef(focusedSelection?.cardId ?? null);
  useEffect(() => {
    const focusedCardId = focusedSelection?.cardId ?? null;
    const didFocusedCardChange = lastFocusedCardIdRef.current !== focusedCardId;
    lastFocusedCardIdRef.current = focusedCardId;

    if (!focusedSelection) {
      return;
    }

    if (
      screen === 'overview' ||
      (selectionMode === 'follow_current' && didFocusedCardChange)
    ) {
      setSelectionMode('follow_current');
      setSelectedLibraryName(focusedSelection.libraryName);
      setSelectedGroupName(focusedSelection.groupName);
      setSelectedBoxRef(focusedSelection.boxRef);
      setSelectedCardIndex(focusedSelection.cardIndex);
    }
  }, [focusedSelection, screen, selectionMode]);
  const selectedBox =
    selectedGroup?.boxes.find(box => box.boxRef === selectedBoxRef) ??
    selectedGroup?.boxes[0];
  const selectedBoxCards = selectedBox?.cards ?? [];
  const safeSelectedCardIndex =
    selectedBoxCards.length === 0
      ? 0
      : Math.min(selectedCardIndex, selectedBoxCards.length - 1);
  const selectedFavoriteCards = selectedBoxCards.filter(
    card => cardStateById[card.cardId]?.isFavorited,
  );
  const selectedSleepingCards = selectedBoxCards.filter(
    card => cardStateById[card.cardId]?.isSleeping,
  );
  const selectedOverviewDeckCards = buildOverviewDeckCards(
    selectedBoxCards,
    currentLearningCard?.card_id ?? null,
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
          selectedGroup.boxes.findIndex(
            box => box.boxRef === selectedBox.boxRef,
          ) + 1,
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
  const isDarkSpacePalette =
    palette.background === '#0B0B12' || palette.text === '#F2F1EB';
  const solidPanel = isDarkSpacePalette ? '#1C1C2A' : '#FFFFFA';
  const solidPanelStrong = isDarkSpacePalette ? '#222434' : '#FFFFFC';
  const neutralObjectSurface = hexToRgba(
    palette.text,
    isDarkSpacePalette ? 0.04 : 0.028,
  );
  const neutralObjectBorder = hexToRgba(
    palette.text,
    isDarkSpacePalette ? 0.08 : 0.065,
  );
  const primaryActionSurface = palette.primaryActionSurface ?? palette.text;
  const primaryActionText = palette.primaryActionText ?? solidPanelStrong;
  const primaryActionMuted =
    palette.primaryActionMuted ?? hexToRgba(primaryActionText, 0.72);
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
  const hasStateRail = Boolean(
    spaceGateRail || spaceSyncRail || spaceStatusRail,
  );

  if (!selectedLibrary || !selectedGroup || !selectedBox) {
    const emptyTone = currentLearningCard
      ? resolveLibraryTone(currentLearningCard.space_metadata.library)
      : resolveLibraryTone();
    const emptySelectedPath = currentCardPath ? '当前卡盒已定位' : '位置待同步';
    const isSpaceLoading = spaceStatusRail?.state === 'loading';

    return (
      <View
        style={[
          styles.content,
          styles.contentOneScreen,
          deviceClass === 'tablet' ? styles.contentTablet : null,
        ]}
      >
        <View
          style={[styles.shelfDeskFrame, styles.shelfDeskFrameOneScreen]}
          testID="space-empty-state"
        >
          <SurfaceCard
            palette={palette}
            style={[styles.addressShelf, styles.addressShelfOneScreen]}
            testID="space-address-shelf"
          >
            <Text style={[styles.eyebrow, { color: emptyTone.accent }]}>
              空间地址
            </Text>
            <Text style={[styles.title, { color: palette.text }]}>
              当前卡盒
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.summary, { color: palette.textMuted }]}
            >
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
              style={[
                styles.addressPath,
                {
                  backgroundColor: hexToRgba(emptyTone.accent, 0.05),
                  borderColor: hexToRgba(emptyTone.accent, 0.34),
                },
              ]}
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
              <View style={styles.headerActionStack}>
                {!isSpaceLoading ? (
                  <ActionChip
                    label="查看列表"
                    onPress={onOpenCardList ?? noop}
                    palette={palette}
                    testID="space-open-card-list"
                  />
                ) : null}
                <ActionChip
                  label="回学习"
                  onPress={onReturnToLearning}
                  palette={palette}
                  testID="space-return-learning"
                />
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
              {currentCardPath ? '当前卡会回到这里' : '空间正在等待本轮卡片。'}
            </Text>

            <View style={styles.boxShelf} testID="space-current-position">
              <View
                style={[
                  styles.boxShelfTile,
                  {
                    backgroundColor: emptyTone.accentSoft,
                    borderColor: hexToRgba(emptyTone.accent, 0.32),
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
                    当前卡盒
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
                    label="回盒桌"
                    onPress={onBackToOverview ?? noop}
                    palette={palette}
                    testID="space-card-list-back"
                  />
                </View>
              </View>
              <View
                style={styles.cardStrip}
                testID="space-contained-card-strip"
              >
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
                      <Text
                        style={[styles.cardPrompt, { color: palette.text }]}
                      >
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
                    <Text
                      style={[styles.cardMeta, { color: palette.textMuted }]}
                    >
                      本轮暂时没有符合条件的卡片；可以继续学习或稍后再看。
                    </Text>
                  </View>
                )}
              </View>
            </SurfaceCard>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.content,
        styles.contentOneScreen,
        deviceClass === 'tablet' ? styles.contentTablet : null,
      ]}
    >
      <View
        style={[styles.shelfDeskFrame, styles.shelfDeskFrameOneScreen]}
        testID="space-shelf-desk"
      >
        {hasStateRail ? (
          <SurfaceCard
            palette={palette}
            style={[styles.addressShelf, styles.addressShelfOneScreen]}
            testID="space-address-shelf"
          >
            {screen === 'card_list' ? (
              <View style={styles.addressListBar}>
                <View style={styles.statusCopy}>
                  <Text
                    style={[styles.eyebrow, { color: selectedTone.accent }]}
                  >
                    空间地址
                  </Text>
                  <Text style={[styles.title, { color: palette.text }]}>
                    盒内卡片
                  </Text>
                </View>
                <View
                  style={[
                    styles.addressPath,
                    styles.addressPathCompact,
                    {
                      backgroundColor: hexToRgba(selectedTone.accent, 0.05),
                      borderColor: hexToRgba(selectedTone.accent, 0.24),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.addressPathLabel,
                      { color: selectedTone.accent },
                    ]}
                  >
                    当前位置
                  </Text>
                  <Text
                    style={[styles.addressPathText, { color: palette.text }]}
                  >
                    当前卡盒已定位
                  </Text>
                </View>
              </View>
            ) : (
              <>
                <Text style={[styles.eyebrow, { color: selectedTone.accent }]}>
                  空间地址
                </Text>
                <Text style={[styles.title, { color: palette.text }]}>
                  当前卡盒
                </Text>
                <Text
                  numberOfLines={1}
                  style={[styles.summary, { color: palette.textMuted }]}
                >
                  先恢复地址，再回到盒内卡片和休眠区。
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
              </>
            )}
          </SurfaceCard>
        ) : null}

        {stateRailStack}

        {screen === 'overview' ? (
          <>
            <View
              style={[
                styles.overviewWorkbench,
                {
                  backgroundColor: solidPanel,
                  borderColor: hexToRgba(selectedTone.accent, 0.14),
                },
              ]}
              testID="space-current-box-tray"
            >
              {!hasStateRail ? (
                <View
                  style={[
                    styles.spaceAddressRail,
                    {
                      backgroundColor: neutralObjectSurface,
                      borderColor: neutralObjectBorder,
                    },
                  ]}
                  testID="space-address-shelf"
                >
                  <View style={styles.spaceAddressNode}>
                    <Text
                      style={[
                        styles.spaceAddressLabel,
                        { color: selectedTone.accent },
                      ]}
                    >
                      书架
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.spaceAddressValue,
                        { color: palette.text },
                      ]}
                    >
                      {formatSpaceLibraryLabel(selectedLibraryIndex)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.spaceAddressDot,
                      { backgroundColor: hexToRgba(selectedTone.accent, 0.32) },
                    ]}
                  />
                  <View style={styles.spaceAddressNode}>
                    <Text
                      style={[
                        styles.spaceAddressLabel,
                        { color: palette.textMuted },
                      ]}
                    >
                      分区
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.spaceAddressValue,
                        { color: palette.text },
                      ]}
                    >
                      {formatSpaceGroupLabel(selectedGroupIndex)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.spaceAddressDot,
                      { backgroundColor: hexToRgba(selectedTone.accent, 0.22) },
                    ]}
                  />
                  <View style={styles.spaceAddressNode}>
                    <Text
                      style={[
                        styles.spaceAddressLabel,
                        { color: palette.textMuted },
                      ]}
                    >
                      卡盒
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.spaceAddressValue,
                        { color: palette.text },
                      ]}
                    >
                      {formatSpaceBoxLabel(selectedBoxIndex)}
                    </Text>
                  </View>
                </View>
              ) : null}

              <View style={styles.overviewHeroRow}>
                <View style={styles.statusCopy}>
                  <Text style={[styles.eyebrow, { color: palette.textMuted }]}>
                    当前盒桌
                  </Text>
                  <Text style={[styles.boxTrayTitle, { color: palette.text }]}>
                    打开卡盒
                  </Text>
                  <Text
                    style={[styles.locationText, { color: palette.textMuted }]}
                  >
                    {currentCardPath
                      ? '同盒卡片都在这里'
                      : '学习卡位置会随进度归位'}
                  </Text>
                </View>
                <Pressable
                  onPress={onOpenCardList ?? noop}
                  style={[
                    styles.overviewInspectButton,
                    {
                      backgroundColor: solidPanelStrong,
                      borderColor: palette.border,
                    },
                  ]}
                  testID="space-open-card-list"
                >
                  <Text
                    style={[
                      styles.overviewInspectButtonTitle,
                      { color: palette.text },
                    ]}
                  >
                    查看卡片
                  </Text>
                </Pressable>
              </View>

              <View
                style={[
                  styles.openBoxDeck,
                  styles.openBoxDeckUnified,
                  {
                    backgroundColor: neutralObjectSurface,
                    borderColor: neutralObjectBorder,
                  },
                ]}
                testID="space-open-box-deck"
              >
                <View
                  style={[
                    styles.openBoxLid,
                    {
                      backgroundColor: 'transparent',
                      borderColor: 'transparent',
                    },
                  ]}
                  testID="space-open-box-lid"
                >
                  <Text
                    style={[styles.openBoxLidTitle, { color: palette.text }]}
                  >
                    同盒卡片
                  </Text>
                  <Text
                    style={[
                      styles.openBoxLidCount,
                      { color: palette.textMuted },
                    ]}
                  >
                    {`${selectedBoxCards.length} 张`}
                  </Text>
                </View>

                <View style={styles.openBoxDeskBody}>
                  <View style={styles.openBoxTray}>
                    <View style={styles.deckCardRow}>
                      {selectedOverviewDeckCards.length === 0 ? (
                        <View
                          style={[
                            styles.deckCardOverview,
                            styles.deckCardOverviewPrimary,
                            {
                              backgroundColor: solidPanelStrong,
                              borderColor: palette.border,
                            },
                          ]}
                          testID="space-empty-box-slot"
                        >
                          <Text
                            style={[
                              styles.deckCardTag,
                              { color: selectedTone.accent },
                            ]}
                          >
                            空盒
                          </Text>
                          <Text
                            numberOfLines={3}
                            style={[
                              styles.deckCardPrompt,
                              { color: palette.text },
                            ]}
                          >
                            当前卡盒暂无可展示卡片
                          </Text>
                        </View>
                      ) : null}
                      {selectedOverviewDeckCards
                        .slice(0, 3)
                        .map((card, index) => {
                          const isCurrent =
                            currentLearningCard?.card_id === card.cardId;
                          const cardState = cardStateById[card.cardId];

                          return (
                            <View
                              key={card.cardId}
                              style={[
                                styles.deckCardOverview,
                                index === 0
                                  ? styles.deckCardOverviewPrimary
                                  : index === 1
                                  ? styles.deckCardOverviewSecondary
                                  : styles.deckCardOverviewTertiary,
                                isCurrent
                                  ? styles.deckCardOverviewActive
                                  : null,
                                {
                                  backgroundColor: isCurrent
                                    ? hexToRgba(selectedTone.accent, 0.075)
                                    : solidPanelStrong,
                                  borderColor: isCurrent
                                    ? hexToRgba(selectedTone.accent, 0.3)
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
                                numberOfLines={index === 0 ? 4 : 3}
                                style={[
                                  styles.deckCardPrompt,
                                  { color: palette.text },
                                ]}
                              >
                                {card.prompt}
                              </Text>
                              <Text
                                numberOfLines={1}
                                style={[
                                  styles.deckCardMeta,
                                  { color: palette.textMuted },
                                ]}
                              >
                                {card.interactionLabel}
                              </Text>
                            </View>
                          );
                        })}
                    </View>

                    <Pressable
                      onPress={onOpenCardList ?? noop}
                      style={[
                        styles.sleepAlcove,
                        styles.sleepAlcoveDesk,
                        {
                          backgroundColor: neutralObjectSurface,
                          borderColor: 'transparent',
                        },
                      ]}
                      testID="space-sleep-alcove"
                    >
                      <View style={styles.sleepAlcoveCopy}>
                        <View style={styles.sleepAlcoveHeader}>
                          <Text
                            style={[
                              styles.sleepAlcoveTitle,
                              { color: palette.text },
                            ]}
                          >
                            同盒休眠
                          </Text>
                          <Text
                            style={[
                              styles.sleepAlcoveActionText,
                              {
                                backgroundColor: hexToRgba(
                                  palette.text,
                                  isDarkSpacePalette ? 0.08 : 0.055,
                                ),
                                color: palette.text,
                              },
                            ]}
                            testID="space-sleep-alcove-action"
                          >
                            查看
                          </Text>
                        </View>
                        <Text
                          numberOfLines={1}
                          style={[
                            styles.sleepAlcoveMeta,
                            { color: palette.textMuted },
                          ]}
                        >
                          {selectedSleepingCards.length > 0
                            ? `${selectedSleepingCards.length} 张暂休，仍留在盒内`
                            : '暂无休眠，继续按盒内顺序学习'}
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                </View>
              </View>

              <Pressable
                onPress={onReturnToLearning}
                style={[
                  styles.returnContinuity,
                  styles.returnContinuityStrip,
                  {
                    backgroundColor: primaryActionSurface,
                    borderColor: primaryActionSurface,
                  },
                ]}
                testID="space-return-learning"
              >
                <View
                  style={[
                    styles.returnContinuityAccent,
                    { backgroundColor: selectedTone.accent },
                  ]}
                />
                <View style={styles.returnContinuityCopy}>
                  <Text
                    style={[
                      styles.returnContinuityTitle,
                      { color: primaryActionText },
                    ]}
                  >
                    回学习
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.returnContinuityMeta,
                      { color: primaryActionMuted },
                    ]}
                  >
                    回到刚才那张卡。
                  </Text>
                </View>
                <View
                  style={[
                    styles.returnContinuityActionPill,
                    {
                      backgroundColor: hexToRgba(
                        primaryActionText,
                        isDarkSpacePalette ? 0.12 : 0.14,
                      ),
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.returnContinuityActionText,
                      { color: primaryActionText },
                    ]}
                  >
                    继续
                  </Text>
                  <Text
                    numberOfLines={1}
                    style={[
                      styles.returnContinuityActionMeta,
                      { color: primaryActionMuted },
                    ]}
                  >
                    保持位置
                  </Text>
                </View>
              </Pressable>
            </View>
          </>
        ) : null}

        {screen === 'card_list' ? (
          <>
            <View
              style={[
                styles.boxBrowseSurface,
                {
                  backgroundColor: solidPanel,
                  borderColor: neutralObjectBorder,
                },
              ]}
              testID="space-box-detail"
            >
              <View
                style={[
                  styles.browseObjectPlane,
                  styles.browseObjectPlaneDesk,
                  styles.browseAddressTray,
                  {
                    backgroundColor: solidPanelStrong,
                    borderColor: neutralObjectBorder,
                  },
                ]}
                testID="space-current-box-tray"
              >
                <View
                  style={styles.browseHeader}
                  testID="space-card-list-header"
                >
                  <View
                    style={[
                      styles.browseObjectMarker,
                      { backgroundColor: selectedTone.accent },
                    ]}
                  />
                  <View style={styles.statusCopy}>
                    <Text
                      style={[styles.eyebrow, { color: palette.textMuted }]}
                    >
                      当前盒桌
                    </Text>
                    <Text
                      style={[styles.browseTrayTitle, { color: palette.text }]}
                    >
                      当前卡盒
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.locationText,
                        { color: palette.textMuted },
                      ]}
                    >
                      {currentCardPath
                        ? '正在查看同盒卡片'
                        : '学习卡位置会随学习更新'}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.browseStatusBadge,
                      {
                        backgroundColor: neutralObjectSurface,
                        borderColor: neutralObjectBorder,
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.browseStatusBadgeText,
                        { color: palette.text },
                      ]}
                    >
                      {isGated
                        ? '待开放'
                        : selectedFavoriteCards.length > 0
                        ? '已标记'
                        : '浏览中'}
                    </Text>
                  </View>
                </View>
                <View
                  style={[
                    styles.browseAddressClue,
                    {
                      backgroundColor: neutralObjectSurface,
                      borderColor: neutralObjectBorder,
                    },
                  ]}
                  testID="space-address-shelf"
                >
                  <View style={styles.browseAddressClueHeader}>
                    <Text
                      style={[
                        styles.browseAddressClueTitle,
                        { color: selectedTone.accent },
                      ]}
                    >
                      当前位置
                    </Text>
                    <Text
                      style={[
                        styles.browseAddressClueMeta,
                        { color: palette.textMuted },
                      ]}
                    >
                      {`本盒共 ${selectedBoxCards.length} 张`}
                    </Text>
                  </View>
                  <View
                    style={[styles.browseObjectPath, styles.browseAddressLine]}
                    testID="space-browse-address-clue"
                  >
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.browseAddressLineText,
                        { color: selectedTone.accent },
                      ]}
                    >
                      {formatSpaceLibraryLabel(selectedLibraryIndex)}
                    </Text>
                    <Text
                      style={[
                        styles.browseAddressSeparator,
                        { color: palette.textMuted },
                      ]}
                    >
                      /
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.browseAddressLineText,
                        { color: palette.text },
                      ]}
                    >
                      {formatSpaceGroupLabel(selectedGroupIndex)}
                    </Text>
                    <Text
                      style={[
                        styles.browseAddressSeparator,
                        { color: palette.textMuted },
                      ]}
                    >
                      /
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[
                        styles.browseAddressLineText,
                        { color: palette.text },
                      ]}
                    >
                      {formatSpaceBoxLabel(selectedBoxIndex)}
                    </Text>
                  </View>
                </View>
              </View>

              <View
                style={styles.cardStrip}
                testID="space-contained-card-strip"
              >
                {selectedBoxCards
                  .slice(safeSelectedCardIndex, safeSelectedCardIndex + 1)
                  .map((card, visibleIndex) => {
                    const cardIndex = safeSelectedCardIndex + visibleIndex;
                    const cardDisplayIndex = cardIndex + 1;
                    const isCurrent =
                      currentLearningCard?.card_id === card.cardId;
                    const isFavorited =
                      cardStateById[card.cardId]?.isFavorited ?? false;
                    const isSleeping =
                      cardStateById[card.cardId]?.isSleeping ?? false;
                    const canShowPreviousCard = safeSelectedCardIndex > 0;
                    const canShowNextCard =
                      safeSelectedCardIndex < selectedBoxCards.length - 1;

                    return (
                      <View
                        key={card.cardId}
                        style={[
                          styles.cardTile,
                          styles.inspectCardTile,
                          styles.browseCardTile,
                          {
                            backgroundColor: solidPanelStrong,
                            borderColor: neutralObjectBorder,
                          },
                        ]}
                        testID="space-browse-card-object"
                      >
                        <View
                          style={[
                            styles.inspectCardEdge,
                            { backgroundColor: selectedTone.accent },
                          ]}
                        />
                        <View style={styles.inspectCardHeader}>
                          <View style={styles.statusCopy}>
                            <Text
                              style={[
                                styles.eyebrow,
                                { color: palette.textMuted },
                              ]}
                            >
                              同盒卡片
                            </Text>
                            <Text
                              style={[
                                styles.cardMeta,
                                { color: palette.textMuted },
                              ]}
                            >
                              {selectedBoxCards.length > 0
                                ? `${cardDisplayIndex}/${selectedBoxCards.length}`
                                : '0/0'}
                            </Text>
                          </View>
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
                        <View
                          style={styles.browseCardFace}
                          testID="space-browse-card-face"
                        >
                          <Text
                            numberOfLines={4}
                            style={[
                              styles.cardPrompt,
                              styles.browseCardPrompt,
                              { color: palette.text },
                            ]}
                          >
                            {card.prompt}
                          </Text>
                          <Text
                            style={[
                              styles.cardMeta,
                              styles.browseCardMeta,
                              { color: palette.textMuted },
                            ]}
                          >
                            {card.interactionLabel}
                          </Text>
                        </View>
                        <View
                          style={[
                            styles.cardStateDeck,
                            styles.browseCardStateDeck,
                            {
                              backgroundColor: neutralObjectSurface,
                              borderColor: neutralObjectBorder,
                            },
                          ]}
                          testID="space-browse-card-state-tray"
                        >
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
                              <Pressable
                                onPress={() => {
                                  setSelectionMode('manual');
                                  onToggleFavoriteTag(card.cardId);
                                }}
                                style={[
                                  styles.favoriteTagButton,
                                  styles.browseCompactStateButton,
                                  {
                                    backgroundColor: isFavorited
                                      ? hexToRgba(selectedTone.accent, 0.1)
                                      : solidPanelStrong,
                                    borderColor: isFavorited
                                      ? hexToRgba(selectedTone.accent, 0.28)
                                      : neutralObjectBorder,
                                  },
                                ]}
                                testID={`space-favorite-${cardDisplayIndex}`}
                              >
                                <Text
                                  numberOfLines={1}
                                  style={[
                                    styles.favoriteTagLabel,
                                    {
                                      color: isFavorited
                                        ? selectedTone.accent
                                        : palette.text,
                                    },
                                  ]}
                                  testID={
                                    isFavorited
                                      ? `space-favorite-active-${cardDisplayIndex}`
                                      : `space-favorite-inactive-${cardDisplayIndex}`
                                  }
                                >
                                  {isFavorited ? '取消收藏' : '收藏'}
                                </Text>
                                <Text
                                  numberOfLines={1}
                                  style={[
                                    styles.favoriteTagMeta,
                                    { color: palette.textMuted },
                                  ]}
                                >
                                  {isFavorited ? '已贴标记' : '贴上标记'}
                                </Text>
                              </Pressable>

                              <Pressable
                                onPress={() => {
                                  setSelectionMode('manual');
                                  onToggleSleepState(card.cardId);
                                }}
                                style={[
                                  styles.sleepPocketButton,
                                  styles.browseCompactStateButton,
                                  {
                                    backgroundColor: isSleeping
                                      ? hexToRgba(palette.warning, 0.1)
                                      : solidPanelStrong,
                                    borderColor: isSleeping
                                      ? hexToRgba(palette.warning, 0.28)
                                      : neutralObjectBorder,
                                  },
                                ]}
                                testID={`space-sleep-${cardDisplayIndex}`}
                              >
                                <View style={styles.sleepPocketHeader}>
                                  <Text
                                    numberOfLines={1}
                                    style={[
                                      styles.sleepPocketLabel,
                                      { color: palette.text },
                                    ]}
                                  >
                                    休眠
                                  </Text>
                                  <Text
                                    numberOfLines={1}
                                    style={[
                                      styles.sleepPocketAction,
                                      {
                                        color: isSleeping
                                          ? palette.warning
                                          : palette.text,
                                      },
                                    ]}
                                    testID={
                                      isSleeping
                                        ? `space-sleep-active-${cardDisplayIndex}`
                                        : `space-sleep-inactive-${cardDisplayIndex}`
                                    }
                                  >
                                    {isSleeping ? '移出休眠' : '放入休眠'}
                                  </Text>
                                </View>
                                <Text
                                  numberOfLines={1}
                                  style={[
                                    styles.sleepPocketMeta,
                                    { color: palette.textMuted },
                                  ]}
                                >
                                  {isSleeping ? '仍留在盒内' : '暂时不练'}
                                </Text>
                              </Pressable>
                            </>
                          )}
                        </View>
                        <View
                          style={[
                            styles.boxBrowsePager,
                            styles.browseCompactPager,
                            {
                              backgroundColor: 'transparent',
                              borderColor: 'transparent',
                            },
                          ]}
                          testID="space-browse-card-pager"
                        >
                          <ActionChip
                            disabled={!canShowPreviousCard}
                            label="上一张"
                            onPress={() => {
                              if (!canShowPreviousCard) {
                                return;
                              }

                              setSelectionMode('manual');
                              setSelectedCardIndex(
                                Math.max(safeSelectedCardIndex - 1, 0),
                              );
                            }}
                            palette={palette}
                            testID="space-card-prev"
                          />
                          <Text
                            style={[
                              styles.boxBrowsePagerMeta,
                              { color: palette.textMuted },
                            ]}
                          >
                            {selectedBoxCards.length > 0
                              ? `${safeSelectedCardIndex + 1}/${
                                  selectedBoxCards.length
                                }`
                              : '0/0'}
                          </Text>
                          <ActionChip
                            disabled={!canShowNextCard}
                            label="下一张"
                            onPress={() => {
                              if (!canShowNextCard) {
                                return;
                              }

                              setSelectionMode('manual');
                              setSelectedCardIndex(
                                Math.min(
                                  safeSelectedCardIndex + 1,
                                  Math.max(selectedBoxCards.length - 1, 0),
                                ),
                              );
                            }}
                            palette={palette}
                            testID="space-card-next"
                          />
                        </View>
                        <View
                          style={[
                            styles.browseContinuityBar,
                            styles.browseCompactContinuityBar,
                          ]}
                          testID="space-browse-card-continuity"
                        >
                          <Pressable
                            onPress={onReturnToLearning}
                            style={[
                              styles.browseContinuityPrimary,
                              {
                                backgroundColor: primaryActionSurface,
                                borderColor: primaryActionSurface,
                                borderLeftColor: selectedTone.accent,
                                borderLeftWidth: 4,
                              },
                            ]}
                            testID="space-return-learning"
                          >
                            <Text
                              style={[
                                styles.browseContinuityTitle,
                                { color: primaryActionText },
                              ]}
                            >
                              回学习
                            </Text>
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.browseContinuityMeta,
                                { color: primaryActionMuted },
                              ]}
                            >
                              同一地址
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={onBackToOverview ?? noop}
                            style={[
                              styles.browseContinuitySecondary,
                              {
                                backgroundColor: neutralObjectSurface,
                                borderColor: 'transparent',
                              },
                            ]}
                            testID="space-card-list-back"
                          >
                            <Text
                              style={[
                                styles.browseContinuityTitle,
                                { color: palette.text },
                              ]}
                            >
                              回盒桌
                            </Text>
                            <Text
                              numberOfLines={1}
                              style={[
                                styles.browseContinuityMeta,
                                { color: palette.textMuted },
                              ]}
                            >
                              盒内概览
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
              </View>
            </View>
          </>
        ) : null}
      </View>
    </View>
  );
}

function ActionChip({
  disabled = false,
  label,
  labelTestID,
  onPress,
  palette,
  testID,
}: {
  disabled?: boolean;
  label: string;
  labelTestID?: string;
  onPress: () => void;
  palette: SpacePalette;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityState={disabled ? { disabled: true } : undefined}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.actionChip,
        {
          backgroundColor: disabled ? palette.panel : palette.accentSoft,
          borderColor: palette.border,
        },
      ]}
      testID={testID}
    >
      <Text
        numberOfLines={1}
        style={[
          styles.actionChipLabel,
          { color: disabled ? palette.textMuted : palette.accentStrong },
        ]}
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
          <Text style={[styles.eyebrow, { color: railColor }]}>空间同步</Text>
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
          <Text style={[styles.eyebrow, { color: railColor }]}>空间状态</Text>
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
          backgroundColor:
            emphasized && toneColor
              ? hexToRgba(toneColor, 0.08)
              : palette.panelStrong,
          borderColor:
            emphasized && toneColor
              ? hexToRgba(toneColor, 0.18)
              : palette.border,
        },
      ]}
    >
      <Text
        numberOfLines={1}
        style={[styles.addressContextLabel, { color: activeTone }]}
      >
        {label}
      </Text>
      <Text
        numberOfLines={1}
        style={[styles.addressContextValue, { color: palette.text }]}
      >
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

function resolveSpaceSyncRailColor(rail: SpaceSyncRail, palette: SpacePalette) {
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

function buildOverviewDeckCards(
  cards: readonly SpaceCardPreview[],
  currentCardId: string | null,
) {
  if (cards.length === 0) {
    return [];
  }

  const currentCard = currentCardId
    ? cards.find(card => card.cardId === currentCardId)
    : undefined;

  if (!currentCard) {
    return cards.slice(0, 3);
  }

  return [
    currentCard,
    ...cards.filter(card => card.cardId !== currentCard.cardId),
  ].slice(0, 3);
}

const styles = StyleSheet.create({
  content: {
    gap: 14,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  contentOneScreen: {
    flex: 1,
    gap: 8,
    paddingVertical: 8,
  },
  contentTablet: {
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  shelfDeskFrame: {
    gap: 16,
  },
  shelfDeskFrameOneScreen: {
    flex: 1,
    gap: 8,
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
  addressShelfOneScreen: {
    gap: 8,
    paddingVertical: 12,
  },
  addressListBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  spaceObjectAddress: {
    gap: 8,
  },
  spaceObjectAddressHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  addressPath: {
    alignItems: 'center',
    borderWidth: 0,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addressPathCompact: {
    minWidth: 132,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  addressPathLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  addressPathText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
    textAlign: 'right',
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
    fontSize: 20,
    fontWeight: '800',
  },
  summary: {
    fontSize: 12,
    lineHeight: 18,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  addressContextRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  addressContextPill: {
    borderRadius: 13,
    borderWidth: 0,
    flexGrow: 1,
    gap: 2,
    minWidth: 76,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  addressContextLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  addressContextValue: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
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
    gap: 8,
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
  overviewWorkbench: {
    flex: 1,
    borderRadius: 28,
    borderWidth: 0,
    gap: 8,
    minHeight: 0,
    overflow: 'hidden',
    paddingHorizontal: 13,
    paddingVertical: 13,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.06,
    shadowRadius: 24,
    elevation: 3,
  },
  overviewWorkbenchAddress: {
    gap: 10,
  },
  overviewObjectStack: {
    gap: 8,
  },
  overviewObjectPlane: {
    borderRadius: 25,
    borderWidth: 1,
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  spaceAddressRail: {
    alignItems: 'center',
    borderRadius: 21,
    borderWidth: 0,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  spaceAddressNode: {
    flex: 1,
    gap: 2,
    minWidth: 0,
  },
  spaceAddressDot: {
    borderRadius: 999,
    height: 4,
    opacity: 0.46,
    width: 4,
  },
  spaceAddressLabel: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.6,
    lineHeight: 13,
  },
  spaceAddressValue: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  overviewHeroRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  overviewInspectButton: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 0,
    gap: 3,
    minWidth: 96,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  overviewInspectButtonTitle: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  openBoxTrayCard: {
    gap: 8,
    paddingBottom: 12,
  },
  boxBrowseSurface: {
    borderRadius: 28,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'column',
    gap: 7,
    minHeight: 0,
    overflow: 'hidden',
    paddingBottom: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
  },
  boxTrayHeader: {
    alignItems: 'stretch',
    flexDirection: 'row',
    gap: 14,
  },
  browseHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  browseObjectPlane: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  browseObjectPlaneDesk: {
    gap: 7,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  browseAddressTray: {
    borderRadius: 20,
    marginTop: 2,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  browseObjectMarker: {
    borderRadius: 999,
    height: 9,
    opacity: 0.9,
    width: 9,
  },
  browseStatusBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  browseStatusBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  browseObjectPath: {
    flexDirection: 'row',
    gap: 6,
  },
  browseAddressLine: {
    alignItems: 'center',
    minHeight: 24,
    paddingHorizontal: 2,
  },
  browseAddressLineText: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  browseAddressSeparator: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 16,
    opacity: 0.55,
  },
  browseAddressClue: {
    borderRadius: 17,
    borderWidth: 0,
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  browseAddressClueHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  browseAddressClueTitle: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.7,
    lineHeight: 13,
  },
  browseAddressClueMeta: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 13,
  },
  browsePathStep: {
    borderRadius: 13,
    flex: 1,
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  browsePathLabel: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.7,
  },
  browsePathValue: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
  },
  browseRail: {
    borderRadius: 18,
    borderTopWidth: 0,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 9,
    paddingVertical: 8,
  },
  browseRailDesk: {
    gap: 6,
  },
  browseRailTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  browseRailTitle: {
    fontSize: 11,
    fontWeight: '900',
    lineHeight: 14,
  },
  browseRailHint: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 13,
  },
  browseRailShelfRow: {
    gap: 3,
  },
  browseRailLevel: {
    alignItems: 'stretch',
    flexDirection: 'column',
    gap: 4,
  },
  browseRailShelfLevel: {
    alignItems: 'stretch',
  },
  browseRailPairRow: {
    flexDirection: 'row',
    gap: 7,
  },
  browseRailLevelHalf: {
    flex: 1,
  },
  browseRailLevelLabel: {
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.7,
  },
  browseRailRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  browseRailChip: {
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 56,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  browseRailChipSmall: {
    minWidth: 54,
  },
  browseRailShelfChip: {
    minWidth: 56,
    paddingHorizontal: 7,
  },
  browseRailChipActive: {
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 9,
    elevation: 1,
  },
  browseRailValue: {
    fontSize: 9,
    fontWeight: '800',
    lineHeight: 12,
    textAlign: 'center',
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
  browseTrayTitle: {
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 18,
  },
  boxAccentRail: {
    borderRadius: 999,
    opacity: 0.36,
    width: 3,
  },
  openBoxDeck: {
    borderRadius: 25,
    borderWidth: 0,
    flex: 1,
    minHeight: 292,
    overflow: 'hidden',
    position: 'relative',
  },
  openBoxDeckUnified: {
    marginTop: 0,
  },
  openBoxLid: {
    alignItems: 'center',
    borderBottomWidth: 0,
    borderTopLeftRadius: 21,
    borderTopRightRadius: 21,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 12,
    marginTop: 11,
    paddingHorizontal: 3,
    paddingVertical: 4,
  },
  openBoxLidTitle: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  openBoxLidCount: {
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  openBoxDeskBody: {
    flex: 1,
    flexDirection: 'column',
    gap: 8,
    minHeight: 0,
    paddingHorizontal: 11,
    paddingBottom: 11,
    paddingTop: 4,
  },
  openBoxTray: {
    flex: 1,
    gap: 10,
    justifyContent: 'space-between',
    minWidth: 0,
  },
  deckCardRow: {
    height: 208,
    minHeight: 208,
    position: 'relative',
  },
  deckCard: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 5,
    height: 78,
    paddingHorizontal: 11,
    paddingVertical: 9,
    position: 'absolute',
    top: 54,
    width: 118,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  deckCardOverview: {
    borderRadius: 23,
    borderWidth: 1,
    gap: 8,
    justifyContent: 'flex-start',
    minWidth: 0,
    position: 'absolute',
    paddingHorizontal: 13,
    paddingVertical: 13,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 1,
  },
  deckCardOverviewActive: {
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  deckCardOverviewPrimary: {
    height: 190,
    left: 0,
    top: 8,
    width: '53%',
    zIndex: 3,
  },
  deckCardOverviewSecondary: {
    height: 176,
    right: 0,
    top: 22,
    width: '44%',
    zIndex: 2,
  },
  deckCardOverviewTertiary: {
    height: 150,
    right: 8,
    top: 0,
    width: '40%',
    zIndex: 1,
  },
  openBoxActionDock: {
    bottom: 10,
    flexDirection: 'row',
    gap: 8,
    left: 12,
    position: 'absolute',
    right: 12,
  },
  deckCardLeft: {
    left: 12,
    transform: [{ rotate: '-2deg' }],
  },
  deckCardSolo: {
    left: '30%',
    top: 54,
    transform: [{ rotate: '0deg' }],
    width: 136,
  },
  deckCardPairLeft: {
    left: 24,
    top: 54,
    transform: [{ rotate: '-1deg' }],
    width: 126,
  },
  deckCardPairRight: {
    right: 24,
    top: 54,
    transform: [{ rotate: '1deg' }],
    width: 126,
  },
  deckCardCenter: {
    left: '31%',
    top: 54,
    transform: [{ rotate: '0deg' }],
    zIndex: 2,
  },
  deckCardRight: {
    right: 12,
    transform: [{ rotate: '2deg' }],
  },
  deckCardTag: {
    fontSize: 11,
    fontWeight: '800',
  },
  deckCardPrompt: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
  },
  deckCardMeta: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
    marginTop: 'auto',
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
  selectorChipCompact: {
    minWidth: 82,
    paddingHorizontal: 10,
    paddingVertical: 8,
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
  boxShelfTileCompact: {
    minWidth: 90,
    paddingHorizontal: 10,
    paddingVertical: 9,
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
  stateTag: {
    fontSize: 12,
    fontWeight: '700',
  },
  actionChip: {
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    minWidth: 58,
    paddingHorizontal: 11,
    paddingVertical: 8,
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
    flex: 1,
    gap: 0,
    minHeight: 0,
  },
  compactSelectorDeck: {
    gap: 8,
  },
  cardTile: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 10,
    minWidth: 0,
    paddingHorizontal: 16,
    paddingVertical: 16,
    width: '100%',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 18,
    elevation: 3,
  },
  inspectCardTile: {
    gap: 10,
    minHeight: 0,
    overflow: 'hidden',
    paddingLeft: 28,
    paddingTop: 15,
    paddingVertical: 13,
  },
  browseCardTile: {
    borderRadius: 24,
    borderWidth: 1,
    elevation: 1,
    flexGrow: 1,
    gap: 8,
    minHeight: 0,
    paddingBottom: 10,
    paddingHorizontal: 14,
    paddingLeft: 26,
    paddingRight: 14,
    paddingTop: 13,
    shadowOpacity: 0.04,
    shadowRadius: 12,
  },
  inspectCardEdge: {
    borderRadius: 999,
    height: 9,
    opacity: 0.86,
    position: 'absolute',
    left: 14,
    top: 18,
    width: 9,
  },
  inspectCardHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
  },
  browseCardFace: {
    flexGrow: 1,
    gap: 8,
    justifyContent: 'center',
    minHeight: 0,
  },
  browseCardPrompt: {
    fontSize: 18,
    lineHeight: 25,
  },
  browseCardMeta: {
    fontWeight: '800',
  },
  cardStateDeck: {
    borderTopWidth: 0,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 0,
    paddingTop: 9,
  },
  browseCardStateDeck: {
    borderRadius: 17,
    borderWidth: 1,
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  favoriteTagButton: {
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    gap: 2,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  browseCompactStateButton: {
    borderRadius: 14,
    minHeight: 42,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  favoriteTagLabel: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
  },
  favoriteTagMeta: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 13,
  },
  sleepPocketButton: {
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    gap: 3,
    minWidth: 0,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  sleepPocketHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
  },
  sleepPocketLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
  },
  sleepPocketAction: {
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 15,
  },
  sleepPocketMeta: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 13,
  },
  boxBrowsePager: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  browseCompactPager: {
    gap: 7,
    marginTop: 'auto',
    paddingHorizontal: 0,
    paddingVertical: 1,
  },
  boxBrowsePagerMeta: {
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 16,
  },
  browseContinuityBar: {
    flexDirection: 'row',
    gap: 8,
  },
  browseCompactContinuityBar: {
    gap: 8,
    marginTop: 2,
  },
  browseContinuityPrimary: {
    borderRadius: 20,
    borderWidth: 1,
    flex: 1.25,
    gap: 3,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  browseContinuitySecondary: {
    borderRadius: 20,
    borderWidth: 1,
    flex: 0.75,
    gap: 3,
    paddingHorizontal: 13,
    paddingVertical: 10,
  },
  browseContinuityTitle: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  browseContinuityMeta: {
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
  loadingCardSkeleton: {
    borderStyle: 'dashed',
  },
  cardPrompt: {
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 22,
  },
  cardMeta: {
    fontSize: 12,
    lineHeight: 17,
  },
  lockedActionText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 18,
  },
  overviewBottomRow: {
    flexDirection: 'row',
    gap: 9,
  },
  sleepAlcove: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  sleepAlcoveDesk: {
    alignItems: 'stretch',
    borderStyle: 'solid',
    borderWidth: 0,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  sleepAlcoveCompact: {
    alignItems: 'stretch',
    flex: 1,
    flexDirection: 'column',
    gap: 7,
    justifyContent: 'center',
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  sleepAlcoveCopy: {
    flex: 1,
    gap: 6,
  },
  sleepAlcoveCopyCompact: {
    flex: 0,
  },
  sleepAlcoveHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  sleepAlcoveTitle: {
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  sleepAlcoveActionText: {
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 11,
    fontWeight: '800',
    lineHeight: 14,
  },
  sleepAlcoveMeta: {
    fontSize: 11,
    lineHeight: 14,
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
  returnContinuity: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  returnContinuityStrip: {
    borderRadius: 23,
    borderWidth: 0,
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 15,
    paddingVertical: 11,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 2,
  },
  returnContinuityCopy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  returnContinuityAccent: {
    borderRadius: 999,
    height: 34,
    width: 4,
  },
  returnContinuityCompact: {
    alignItems: 'flex-start',
    flex: 1,
    flexDirection: 'column',
    gap: 3,
    justifyContent: 'center',
    minWidth: 104,
    paddingVertical: 10,
  },
  returnContinuityTitle: {
    flexShrink: 0,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 18,
  },
  returnContinuityMeta: {
    flex: 1,
    fontSize: 12,
    lineHeight: 17,
    opacity: 0.88,
  },
  returnContinuityAction: {
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingVertical: 7,
    fontSize: 12,
    fontWeight: '800',
  },
  returnContinuityActionPill: {
    borderRadius: 19,
    gap: 1,
    minWidth: 92,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  returnContinuityActionText: {
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 17,
    textAlign: 'center',
  },
  returnContinuityActionMeta: {
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 13,
    opacity: 0.9,
    textAlign: 'center',
  },
  headerActionStack: {
    alignItems: 'flex-end',
    gap: 8,
  },
});
