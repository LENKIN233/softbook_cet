import {filterSpaceCards, type SpaceCardFilter} from './cardFilters';
import { spaceCardPreview } from '../learning/presentation';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {StudioPressable as Pressable, MotionView} from '../learning/NativeMotion';
import {STUDIO} from '../visual/studio';
import {
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';

import {
  INTERACTION_LABELS,
  LearningCard,
  LearningTrack,
} from '../learning/model';
import {
  formatSpaceDisplayName,
  formatSpacePathByNames,
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

export function isShortSpaceViewport(width: number, height: number) {
  return Math.min(width, height) < 600 && height < 800;
}

export type SpaceGateRail = {
  actionSlot: React.ReactNode;
  detail: string;
  label: string;
  title: string;
};

export type SpaceSyncRail = {
  requiresAttention?: boolean;
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
  pendingReviewIds = [],
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
  usesAccessibilityLayout = false,
}: {
  cardStateById: Record<string, { isFavorited: boolean; isSleeping: boolean }>;
  currentLearningCard: LearningCard | null;
  pendingReviewIds?: string[];
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
  usesAccessibilityLayout?: boolean;
}) {
  const { height: viewportHeight, width: viewportWidth } =
    useWindowDimensions();
  const usesShortViewport = isShortSpaceViewport(viewportWidth, viewportHeight);
  const [filter, setFilter] = useState<SpaceCardFilter>('all');
  const [filterLimit, setFilterLimit] = useState(40);
  const matches = filterSpaceCards(spaceCards, filter, Object.keys(cardStateById).filter(id => cardStateById[id].isFavorited), pendingReviewIds);
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
  const [selectedCardIndex, setSelectedCardIndex] = useState(
    focusedSelection?.cardIndex ?? 0,
  );
  const focusedSelectionKey = focusedSelection
    ? [
        focusedSelection.cardId,
        focusedSelection.libraryName,
        focusedSelection.groupName,
        focusedSelection.boxRef,
        focusedSelection.cardIndex,
      ].join('\u0000')
    : null;
  const lastFocusedSelectionKeyRef = useRef(focusedSelectionKey);
  useEffect(() => {
    const didFocusedSelectionChange =
      lastFocusedSelectionKeyRef.current !== focusedSelectionKey;
    lastFocusedSelectionKeyRef.current = focusedSelectionKey;

    if (!focusedSelection) {
      return;
    }

    if (selectionMode === 'follow_current' && didFocusedSelectionChange) {
      setSelectionMode('follow_current');
      setSelectedLibraryName(focusedSelection.libraryName);
      setSelectedGroupName(focusedSelection.groupName);
      setSelectedBoxRef(focusedSelection.boxRef);
      setSelectedCardIndex(focusedSelection.cardIndex);
    }
  }, [focusedSelection, focusedSelectionKey, selectionMode]);
  const selectedBox =
    selectedGroup?.boxes.find(box => box.boxRef === selectedBoxRef) ??
    selectedGroup?.boxes[0];
  const selectedLibraryIndex = Math.max(
    seed.libraries.findIndex(library => library === selectedLibrary),
    0,
  );
  const selectedGroupIndex = Math.max(
    selectedLibrary?.groups.findIndex(group => group === selectedGroup) ?? 0,
    0,
  );
  const selectedBoxIndex = Math.max(
    selectedGroup?.boxes.findIndex(box => box === selectedBox) ?? 0,
    0,
  );
  const selectedBoxCards = selectedBox?.cards ?? [];
  const safeSelectedCardIndex =
    selectedBoxCards.length === 0
      ? 0
      : Math.min(selectedCardIndex, selectedBoxCards.length - 1);
  const selectedSleepingCards = selectedBoxCards.filter(
    card => cardStateById[card.cardId]?.isSleeping,
  );
  const selectedOverviewDeckCards = buildOverviewDeckCards(
    selectedBoxCards,
    currentLearningCard?.card_id ?? null,
  );
  const selectedTone = resolveLibraryTone(selectedLibrary?.libraryName);
  const visibleShelfName = formatSpaceDisplayName(
    selectedLibrary?.libraryName ?? '',
    '当前书架',
  );
  const visibleSectionName = formatSpaceDisplayName(
    selectedGroup?.groupName ?? '',
    '当前分区',
  );
  const visibleContainerName = formatSpaceDisplayName(
    selectedBox?.boxName ?? '',
    '当前卡盒',
  );
  const isDarkSpacePalette =
    palette.background === '#0B0B12' || palette.text === '#F2F1EB';
  const solidPanelStrong = isDarkSpacePalette ? '#222434' : STUDIO.color.paper;
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
  const currentCardPath = currentLearningCard
    ? formatSpacePathByNames(
        currentLearningCard.space_metadata.library,
        currentLearningCard.space_metadata.group,
        currentLearningCard.space_metadata.box,
      )
    : null;
  const selectedBoxIsCurrent = Boolean(
    focusedSelection &&
      selectedLibrary?.libraryName === focusedSelection.libraryName &&
      selectedGroup?.groupName === focusedSelection.groupName &&
      selectedBox?.boxRef === focusedSelection.boxRef,
  );
  const selectLibraryAt = (index: number) => {
    const library = seed.libraries[index];
    const group = library?.groups[0];
    const box = group?.boxes[0];

    if (!library || !group || !box) {
      return;
    }

    setSelectionMode('manual');
    setSelectedLibraryName(library.libraryName);
    setSelectedGroupName(group.groupName);
    setSelectedBoxRef(box.boxRef);
    setSelectedCardIndex(0);
  };
  const selectGroupAt = (index: number) => {
    const group = selectedLibrary?.groups[index];
    const box = group?.boxes[0];

    if (!group || !box) {
      return;
    }

    setSelectionMode('manual');
    setSelectedGroupName(group.groupName);
    setSelectedBoxRef(box.boxRef);
    setSelectedCardIndex(0);
  };
  const selectBoxAt = (index: number) => {
    const box = selectedGroup?.boxes[index];

    if (!box) {
      return;
    }

    setSelectionMode('manual');
    setSelectedBoxRef(box.boxRef);
    setSelectedCardIndex(
      focusedSelection?.boxRef === box.boxRef ? focusedSelection.cardIndex : 0,
    );
  };
  const followCurrentBox = () => {
    if (!focusedSelection) {
      return;
    }

    setSelectionMode('follow_current');
    setSelectedLibraryName(focusedSelection.libraryName);
    setSelectedGroupName(focusedSelection.groupName);
    setSelectedBoxRef(focusedSelection.boxRef);
    setSelectedCardIndex(focusedSelection.cardIndex);
  };
  const isGated = spaceGateRail !== null && spaceGateRail !== undefined;
  const stateRailStack = (
    <>
      {spaceGateRail ? (
        <SpaceGateRailCard palette={palette} rail={spaceGateRail} />
      ) : null}

      {spaceSyncRail && (spaceSyncRail.state === 'error' || spaceSyncRail.requiresAttention) ? (
        <SpaceSyncRailCard palette={palette} rail={spaceSyncRail} />
      ) : null}

      {spaceStatusRail ? (
        <SpaceStatusRailCard palette={palette} rail={spaceStatusRail} />
      ) : null}
    </>
  );
  const hasStateRail = Boolean(
    spaceGateRail || spaceSyncRail?.state === 'error' || spaceSyncRail?.requiresAttention || spaceStatusRail,
  );
  const usesScrollableViewport = usesAccessibilityLayout
    ? deviceClass === 'tablet'
    : deviceClass === 'phone' || usesShortViewport || hasStateRail;

  if (!selectedLibrary || !selectedGroup || !selectedBox) {
    const emptyTone = currentLearningCard
      ? resolveLibraryTone(currentLearningCard.space_metadata.library)
      : resolveLibraryTone();
    const emptySelectedPath = currentCardPath ? '当前卡盒' : '尚未同步';
    const isSpaceLoading = spaceStatusRail?.state === 'loading';

    return (
      <SpaceViewport
        deviceClass={deviceClass}
        usesAccessibilityLayout={usesAccessibilityLayout}
        usesShortViewport={usesScrollableViewport}
      >
        <View
          style={[
            styles.shelfDeskFrame,
            styles.shelfDeskFrameOneScreen,
            usesAccessibilityLayout ? styles.shelfDeskFrameAccessible : null,
            usesScrollableViewport ? styles.shelfDeskFrameShortViewport : null,
          ]}
          testID="space-empty-state"
        >
          <SurfaceCard
            palette={palette}
            style={[styles.addressShelf, styles.addressShelfOneScreen]}
            testID="space-address-shelf"
          >
            <Text style={[styles.eyebrow, { color: emptyTone.accent }]}>
              卡片位置
            </Text>
            <Text style={[styles.title, { color: palette.text }]}>
              当前卡盒
            </Text>
            <Text
              numberOfLines={1}
              style={[styles.summary, { color: palette.textMuted }]}
            >
              {isSpaceLoading ? '正在加载卡片。' : '这里还没有卡片。'}
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
                value={isSpaceLoading ? '加载中' : '空'}
              />
              <AddressContextPill
                label="下一步"
                palette={palette}
                value="返回学习"
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
                  {isSpaceLoading ? '正在加载' : '暂无卡片'}
                </Text>
                <Text style={[styles.boxTrayTitle, { color: palette.text }]}>
                  当前卡盒
                </Text>
                <Text style={[styles.ruleText, { color: palette.textMuted }]}>
                  {isSpaceLoading ? '正在加载卡片' : '这里还没有卡片'}
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
                  label="继续学习"
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
              {currentCardPath ? '当前学习卡' : '还没有当前学习卡'}
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
                  {isSpaceLoading ? '正在加载卡片' : '暂无卡片'}
                </Text>
                <Text style={[styles.currentTag, { color: emptyTone.accent }]}>
                  {isSpaceLoading ? '加载中' : '空'}
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
                    {isSpaceLoading ? '加载中' : '暂无卡片'}
                  </Text>
                  <ActionChip
                    label="返回卡盒"
                    onPress={onBackToOverview ?? noop}
                    palette={palette}
                    testID="space-card-list-back"
                  />
                </View>
              </View>
              <View
                style={[styles.cardStrip, styles.browseCardStrip]}
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
                        正在加载卡片
                      </Text>
                      <Text
                        style={[styles.cardMeta, { color: palette.textMuted }]}
                      >
                        加载完成后即可查看。
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
                      这个卡盒还没有卡片
                    </Text>
                    <Text
                      style={[styles.cardMeta, { color: palette.textMuted }]}
                    >
                      这个卡盒暂时没有卡片，可以先继续学习。
                    </Text>
                  </View>
                )}
              </View>
            </SurfaceCard>
          ) : null}
        </View>
      </SpaceViewport>
    );
  }

  const selectedCard = selectedBoxCards[safeSelectedCardIndex];
  const selectedSource = spaceCards.find(
    card => card.card_id === selectedCard?.cardId,
  );
  const selectedPreview = selectedSource
    ? spaceCardPreview(selectedSource)
    : { title: selectedCard?.prompt ?? '暂无卡片', detail: [] };
  const selectedState = selectedCard
    ? cardStateById[selectedCard.cardId]
    : undefined;
  const inspectedCardIsCurrent =
    selectedCard?.cardId === currentLearningCard?.card_id;
  const isFavorited = Boolean(selectedState?.isFavorited);
  const isSleeping = Boolean(selectedState?.isSleeping);
  const cardDisplayIndex = safeSelectedCardIndex + 1;
  const openFilteredCard = (card: LearningCard) => {
    const position = resolveSpacePosition(seed, card);
    if (!position) return;
    setSelectionMode('manual');
    const library = seed.libraries[position.libraryIndex - 1];
    const group = library.groups[position.groupIndex - 1];
    const box = group.boxes[position.boxIndex - 1];
    setSelectedLibraryName(library.libraryName);
    setSelectedGroupName(group.groupName);
    setSelectedBoxRef(box.boxRef);
    setSelectedCardIndex(Math.max(0, box.cards.findIndex(item => item.cardId === card.card_id)));
    setFilter('all');
    onOpenCardList?.();
  };
  const inspectCard = (cardId: string) => {
    setSelectionMode('manual');
    setSelectedCardIndex(
      Math.max(
        selectedBoxCards.findIndex(card => card.cardId === cardId),
        0,
      ),
    );
    onOpenCardList?.();
  };
  return (
    <SpaceViewport
      deviceClass={deviceClass}
      usesAccessibilityLayout={usesAccessibilityLayout}
      usesShortViewport={usesScrollableViewport || deviceClass === 'tablet'}
    >
      <View style={styles.spaceComposition} testID="space-shelf-desk">
        {hasStateRail ? (
          <View testID="space-address-shelf">
            <Text
              style={[styles.spaceLocation, { color: palette.textMuted }]}
            >{`${visibleShelfName} / ${visibleSectionName} / ${visibleContainerName}`}</Text>
          </View>
        ) : null}
        {stateRailStack}
        <View style={styles.filterBar} accessibilityRole="toolbar" testID="space-filter-bar">
          {([['all', '全部卡片', '全部卡片'], ['favorites', '收藏', '只看收藏'], ['review', '待复习', '只看待复习']] as const).map(([value, label, name]) => <Pressable key={value}
            accessibilityRole="button" accessibilityLabel={name} accessibilityState={{selected: filter === value}}
            onPress={() => {setFilter(value); setFilterLimit(40);}} style={[styles.filterButton, {borderBottomColor: filter === value ? palette.accent : 'transparent'}]} testID={`space-filter-${value}`}>
            <Text style={{color: filter === value ? palette.text : palette.textMuted}}>{label}</Text>
          </Pressable>)}
        </View>
        {filter !== 'all' ? <View style={styles.filterResults} testID="space-filter-results">
          <Text accessibilityLiveRegion="polite" style={{color: palette.textMuted}}>{matches.length ? `${matches.length} 张卡片` : filter === 'favorites' ? '还没有收藏的卡片。' : '目前没有待复习的卡片。'}</Text>
          {matches.slice(0, filterLimit).map((item, index) => {
            const locationLabel = formatSpacePathByNames(
              item.space_metadata.library,
              item.space_metadata.group,
              item.space_metadata.box,
            );
            const previewTitle = spaceCardPreview(item).title;
            const isCurrent = item.card_id === currentLearningCard?.card_id;
            return (
              <Pressable
                key={item.card_id}
                accessibilityRole="button"
                onPress={() => openFilteredCard(item)}
                style={[styles.filteredCard, {borderBottomColor: palette.border}]}
                testID={`space-filter-card-${index}`}
              >
                <Text style={[styles.spaceMeta, {color: palette.textMuted}]}>
                  {locationLabel}
                </Text>
                <Text style={[styles.previewPrompt, {color: palette.text}]}>
                  {previewTitle}
                </Text>
                {isCurrent ? (
                  <Text style={{color: palette.accent}}>当前学习</Text>
                ) : null}
              </Pressable>
            );
          })}
          {matches.length > filterLimit ? <Pressable accessibilityRole="button" style={styles.filterButton} onPress={() => setFilterLimit(value => value + 40)}><Text style={{color: palette.text}}>显示更多</Text></Pressable> : null}
        </View> : screen === 'overview' ? (
          <View style={styles.spaceComposition} testID="space-current-box-tray">
            <View style={styles.shelfNavigator} testID="space-browse-rail">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.shelfLibraryRow}
                testID="space-library-strip"
              >
                {seed.libraries.map((library, index) => {
                  const displayName = formatSpaceDisplayName(
                    library.libraryName,
                    '书架',
                  );
                  return (
                    <Pressable
                      key={library.libraryName}
                      accessibilityRole="tab"
                      accessibilityLabel={displayName}
                      accessibilityState={{
                        selected: index === selectedLibraryIndex,
                      }}
                      onPress={() => selectLibraryAt(index)}
                      style={[
                        styles.shelfLibraryTab,
                        {
                          backgroundColor:
                            index === selectedLibraryIndex
                              ? solidPanelStrong
                              : 'transparent',
                        },
                      ]}
                      testID={`space-library-choice-${index + 1}`}
                    >
                      <View
                        style={[
                          styles.shelfLibraryDot,
                          {
                            backgroundColor: resolveLibraryTone(
                              library.libraryName,
                            ).accent,
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.shelfLibraryLabel,
                          {
                            color:
                              index === selectedLibraryIndex
                                ? palette.text
                                : palette.textMuted,
                          },
                        ]}
                      >
                        {displayName}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.shelfGroupTabs}
                testID="space-group-strip"
              >
                {selectedLibrary.groups.map((group, index) => {
                  const displayName = formatSpaceDisplayName(
                    group.groupName,
                    '分区',
                  );
                  return (
                    <Pressable
                      key={group.groupName}
                      accessibilityRole="tab"
                      accessibilityLabel={displayName}
                      accessibilityState={{
                        selected: index === selectedGroupIndex,
                      }}
                      onPress={() => selectGroupAt(index)}
                      style={[
                        styles.shelfGroupTab,
                        {
                          borderBottomColor:
                            index === selectedGroupIndex
                              ? selectedTone.accent
                              : 'transparent',
                        },
                      ]}
                      testID={`space-group-choice-${index + 1}`}
                    >
                      <Text
                        style={[
                          styles.shelfGroupLabel,
                          {
                            color:
                              index === selectedGroupIndex
                                ? palette.text
                                : palette.textMuted,
                          },
                        ]}
                      >
                        {displayName}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              <View
                style={[
                  styles.shelfBoard,
                  { borderBottomColor: palette.border },
                ]}
              >
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.siblingBoxRow}
                  testID="space-sibling-boxes"
                >
                  {selectedGroup.boxes.map((box, index) => {
                    const displayName = formatSpaceDisplayName(
                      box.boxName,
                      '卡盒',
                    );
                    const countLabel = `${box.cards.length} 张`;
                    const accessibleLabel = `${displayName}，${countLabel}`;
                    return (
                      <Pressable
                        key={box.boxRef}
                        accessibilityRole="button"
                        accessibilityLabel={accessibleLabel}
                        accessibilityState={{
                          selected: index === selectedBoxIndex,
                        }}
                        onPress={() => selectBoxAt(index)}
                        style={[
                          styles.siblingBox,
                          {
                            backgroundColor:
                              index === selectedBoxIndex
                                ? selectedTone.accentSoft
                                : solidPanelStrong,
                            borderColor: palette.border,
                            borderTopColor:
                              index === selectedBoxIndex
                                ? selectedTone.accent
                                : palette.border,
                          },
                        ]}
                        testID={`space-box-choice-${index + 1}`}
                      >
                        <Text
                          style={[
                            styles.siblingBoxName,
                            { color: palette.text },
                          ]}
                        >
                          {displayName}
                        </Text>
                        <Text
                          style={[
                            styles.siblingBoxCount,
                            { color: palette.textMuted },
                          ]}
                        >
                          {countLabel}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>
              {!selectedBoxIsCurrent && focusedSelection ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={followCurrentBox}
                  style={styles.followCurrentLink}
                  testID="space-follow-current-box"
                >
                  <Text
                    style={[
                      styles.followCurrentLinkText,
                      { color: palette.textMuted },
                    ]}
                  >
                    查看当前卡片 →
                  </Text>
                </Pressable>
              ) : null}
            </View>

            <MotionView motionKey={selectedBox.boxRef} kind="space"
              style={[
                styles.openTray,
                {
                  borderColor: neutralObjectBorder,
                  backgroundColor: neutralObjectSurface,
                },
              ]}
              testID="space-open-box-deck"
            >
              <View style={styles.trayHeading} testID="space-open-box-lid">
                <View style={styles.trayTitleCopy}>
                  <Text
                    style={[styles.spaceSectionTitle, { color: palette.text }]}
                  >
                    {visibleContainerName}
                  </Text>
                  <Text
                    style={[styles.spaceMeta, { color: palette.textMuted }]}
                  >{`${selectedBoxCards.length} 张${
                    selectedBoxIsCurrent ? ' · 正在学习' : ''
                  }`}</Text>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={
                    selectedBoxIsCurrent
                      ? '查看当前卡盒里的卡片'
                      : '查看所选卡盒里的卡片'
                  }
                  onPress={onOpenCardList ?? noop}
                  style={styles.quietAction}
                  testID="space-open-card-list"
                >
                  <Text
                    style={[styles.quietActionText, { color: palette.text }]}
                  >
                    查看卡片 →
                  </Text>
                </Pressable>
              </View>
              <View
                style={styles.previewRow}
                testID="space-contained-card-strip"
              >
                {selectedOverviewDeckCards.map(card => {
                  const source = spaceCards.find(
                    item => item.card_id === card.cardId,
                  );
                  const previewText = source
                    ? spaceCardPreview(source).title
                    : card.prompt;
                  const isCurrent =
                    currentLearningCard?.card_id === card.cardId;
                  const status = cardStateById[card.cardId];
                  return (
                    <Pressable
                      key={card.cardId}
                      accessibilityRole="button"
                      accessibilityLabel={`查看卡片，${previewText}`}
                      onPress={() => inspectCard(card.cardId)}
                      style={[
                        styles.previewPaper,
                        {
                          backgroundColor: solidPanelStrong,
                          borderColor: neutralObjectBorder,
                          borderTopColor: isCurrent
                            ? selectedTone.accent
                            : neutralObjectBorder,
                        },
                      ]}
                      testID="space-overview-card-object"
                    >
                      <Text
                        style={[styles.spaceMeta, { color: palette.textMuted }]}
                      >
                        {[
                          card.interactionLabel,
                          isCurrent ? '当前' : '',
                          status?.isFavorited ? '已收藏' : '',
                          status?.isSleeping ? '休眠' : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                      <Text
                        numberOfLines={usesAccessibilityLayout ? undefined : 4}
                        style={[styles.previewPrompt, { color: palette.text }]}
                      >
                        {previewText}
                      </Text>
                    </Pressable>
                  );
                })}
                {selectedBoxCards.length === 0 ? (
                  <Text
                    style={[styles.spaceMeta, { color: palette.textMuted }]}
                    testID="space-empty-box-slot"
                  >
                    这个盒里暂无卡片。
                  </Text>
                ) : null}
              </View>
              <View
                style={[styles.sleepZone, { borderColor: neutralObjectBorder }]}
                testID="space-sleep-alcove"
              >
                <Text style={[styles.spaceMeta, { color: palette.textMuted }]}>
                  {selectedSleepingCards.length
                    ? `休眠区 · ${selectedSleepingCards.length} 张`
                    : '休眠区 · 暂无休眠'}
                </Text>
                {selectedSleepingCards.length ? (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => inspectCard(selectedSleepingCards[0].cardId)}
                    style={styles.quietAction}
                    testID="space-open-sleep"
                  >
                    <Text
                      style={[styles.quietActionText, { color: palette.text }]}
                    >
                      查看 →
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </MotionView>
          </View>
        ) : (
          <>
            <View
              style={styles.inspectionAddress}
              testID="space-browse-address-clue"
            >
              <Text
                style={[styles.spaceLocation, { color: palette.textMuted }]}
              >{`${visibleShelfName} / ${visibleSectionName}`}</Text>
              <Text style={[styles.spaceSectionTitle, { color: palette.text }]}>
                {visibleContainerName}
              </Text>
            </View>
            <View
              style={styles.spaceComposition}
              testID="space-contained-card-strip"
            >
              <MotionView motionKey={selectedBox.boxRef+":"+selectedCardIndex} kind="space"
                style={[
                  styles.inspectionPaper,
                  {
                    backgroundColor: solidPanelStrong,
                    borderColor: neutralObjectBorder,
                    borderTopColor: selectedTone.accent,
                  },
                ]}
                testID="space-browse-card-object"
              >
                <Text style={[styles.spaceMeta, { color: palette.textMuted }]}>
                  {[
                    selectedCard?.interactionLabel,
                    inspectedCardIsCurrent ? '当前' : '',
                    isFavorited ? '已收藏' : '',
                    isSleeping ? '休眠' : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </Text>
                <View
                  style={styles.inspectionMaterial}
                  testID="space-browse-card-face"
                >
                  <Text
                    style={[styles.inspectionPrompt, { color: palette.text }]}
                  >
                    {selectedPreview.title}
                  </Text>
                  {selectedPreview.detail.map(text => (
                    <Text
                      key={text}
                      style={[
                        styles.cardPreviewDetail,
                        { color: palette.textMuted },
                      ]}
                    >
                      {text}
                    </Text>
                  ))}
                </View>
                <View
                  style={[
                    styles.stateActionRow,
                    { borderColor: neutralObjectBorder },
                  ]}
                  testID="space-browse-card-state-tray"
                >
                  {isGated ? (
                    <Text
                      style={[styles.spaceMeta, { color: palette.textMuted }]}
                    >
                      试用或会员后可调整收藏和休眠状态
                    </Text>
                  ) : selectedCard ? (
                    <>
                      <Pressable
                        accessibilityRole="checkbox"
                        accessibilityLabel={
                          isFavorited ? '取消收藏当前卡' : '收藏当前卡'
                        }
                        accessibilityState={{ checked: isFavorited }}
                        onPress={() => {
                          setSelectionMode('manual');
                          onToggleFavoriteTag(selectedCard.cardId);
                        }}
                        style={styles.quietAction}
                        testID={`space-favorite-${cardDisplayIndex}`}
                      >
                        <Text
                          style={[
                            styles.quietActionText,
                            { color: palette.text },
                          ]}
                          testID={`space-favorite-${
                            isFavorited ? 'active' : 'inactive'
                          }-${cardDisplayIndex}`}
                        >
                          {isFavorited ? '★ 取消收藏' : '☆ 收藏'}
                        </Text>
                      </Pressable>
                      <Pressable
                        accessibilityRole="switch"
                        accessibilityLabel={
                          isSleeping
                            ? '恢复学习这张卡'
                            : '暂不学习这张卡'
                        }
                        accessibilityState={{ checked: isSleeping }}
                        onPress={() => {
                          setSelectionMode('manual');
                          onToggleSleepState(selectedCard.cardId);
                        }}
                        style={styles.quietAction}
                        testID={`space-sleep-${cardDisplayIndex}`}
                      >
                        <Text
                          style={[
                            styles.quietActionText,
                            {
                              color: isSleeping
                                ? palette.warning
                                : palette.text,
                            },
                          ]}
                          testID={`space-sleep-${
                            isSleeping ? 'active' : 'inactive'
                          }-${cardDisplayIndex}`}
                        >
                          {isSleeping ? '恢复学习' : '暂不学习这张卡'}
                        </Text>
                      </Pressable>
                    </>
                  ) : null}
                </View>
              </MotionView>
              <View
                style={styles.inspectionPager}
                testID="space-browse-card-pager"
              >
                <ActionChip
                  disabled={safeSelectedCardIndex === 0}
                  label="上一张"
                  onPress={() => {
                    setSelectionMode('manual');
                    setSelectedCardIndex(
                      Math.max(safeSelectedCardIndex - 1, 0),
                    );
                  }}
                  palette={palette}
                  testID="space-card-prev"
                />
                <Text
                  style={[styles.spaceMeta, { color: palette.textMuted }]}
                >{`${selectedBoxCards.length ? cardDisplayIndex : 0} / ${
                  selectedBoxCards.length
                }`}</Text>
                <ActionChip
                  disabled={
                    safeSelectedCardIndex >= selectedBoxCards.length - 1
                  }
                  label="下一张"
                  onPress={() => {
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
            </View>
          </>
        )}
        <View style={styles.spaceFooter} testID="space-browse-card-continuity">
          {screen === 'card_list' ? (
            <Pressable
              accessibilityRole="button"
              onPress={onBackToOverview ?? noop}
              style={styles.quietAction}
              testID="space-card-list-back"
            >
              <Text
                style={[styles.quietActionText, { color: palette.textMuted }]}
              >
                ← 回卡盒
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="继续学习"
            onPress={onReturnToLearning}
            style={[
              styles.returnAction,
              { backgroundColor: primaryActionSurface },
            ]}
            testID="space-return-learning"
          >
            <Text
              style={[styles.returnActionText, { color: primaryActionText }]}
            >
              继续学习
            </Text>
          </Pressable>
        </View>
      </View>
    </SpaceViewport>
  );
}

function SpaceViewport({
  children,
  deviceClass,
  usesAccessibilityLayout,
  usesShortViewport,
}: {
  children: React.ReactNode;
  deviceClass: DeviceClass;
  usesAccessibilityLayout: boolean;
  usesShortViewport: boolean;
}) {
  const baseStyle = [
    styles.content,
    deviceClass === 'tablet' ? styles.contentTablet : null,
  ];

  if (usesShortViewport) {
    return (
      <ScrollView
        contentContainerStyle={[...baseStyle, styles.contentShortViewport]}
        showsVerticalScrollIndicator={false}
        style={styles.contentScroll}
        testID="space-scroll-viewport"
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View
      style={[
        ...baseStyle,
        styles.contentOneScreen,
        usesAccessibilityLayout ? styles.contentAccessible : null,
      ]}
      testID="space-fixed-viewport"
    >
      {children}
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
      accessibilityLabel={label}
      accessibilityRole="button"
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
  filterBar: {flexDirection: 'row', flexWrap: 'wrap', gap: 16},
  filterButton: {minHeight: 44, justifyContent: 'center', paddingHorizontal: 4, paddingVertical: 10, borderBottomWidth: 2},
  filterResults: {gap: 12},
  filteredCard: {minHeight: 64, paddingVertical: 16, borderBottomWidth: 1, gap: 8},
  spaceComposition: { gap: 18 },
  spaceLocation: { fontSize: 12, lineHeight: 20 },
  spaceSectionTitle: { fontSize: 18, lineHeight: 27, fontWeight: '600' },
  spaceMeta: { fontSize: 12, lineHeight: 20 },
  openTray: { borderWidth: 1, borderRadius: STUDIO.radius.card, padding: 18, gap: 16 },
  trayHeading: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  trayTitleCopy: { flex: 1, gap: 4 },
  quietAction: {
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  quietActionText: { fontSize: 13, lineHeight: 21, fontWeight: '500' },
  previewRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  previewPaper: {
    flexGrow: 1,
    flexBasis: 220,
    borderWidth: 1,
    borderTopWidth: 3,
    borderRadius: STUDIO.radius.control,
    padding: 16,
    gap: 12,
    minHeight: 120,
  },
  previewPrompt: { fontSize: 16, lineHeight: 26 },
  sleepZone: {
    borderTopWidth: 1,
    paddingTop: 8,
    minHeight: 44,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  inspectionAddress: { gap: 4 },
  inspectionPaper: {
    borderWidth: 1,
    borderTopWidth: 3,
    borderRadius: STUDIO.radius.card,
    padding: 20,
    gap: 20,
  },
  inspectionMaterial: { gap: 12 },
  inspectionPrompt: { fontSize: 20, lineHeight: 30, fontWeight: '400' },
  stateActionRow: {
    borderTopWidth: 1,
    paddingTop: 8,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 20,
  },
  inspectionPager: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  spaceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingBottom: 8,
  },
  returnAction: {
    minHeight: 48,
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
  },
  returnActionText: { fontSize: 14, lineHeight: 22, fontWeight: '500' },

  cardPreviewDetail: { fontSize: 15, lineHeight: 25, marginTop: 12 },
  shelfNavigator: { gap: 10, flexShrink: 0 },
  shelfLibraryRow: { gap: 6, alignItems: 'center', paddingBottom: 6 },
  shelfLibraryTab: {
    minHeight: 44,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingHorizontal: 12,
  },
  shelfLibraryDot: { width: 6, height: 6, borderRadius: 3 },
  shelfLibraryLabel: { fontSize: 12, fontWeight: '500' },
  shelfGroupTabs: { gap: 16 },
  shelfGroupTab: {
    minHeight: 44,
    justifyContent: 'center',
    borderBottomWidth: 2,
  },
  shelfGroupLabel: { fontSize: 12, fontWeight: '400' },
  shelfBoard: { borderBottomWidth: 0, paddingBottom: 14, paddingTop: 12 },
  siblingBoxRow: { gap: 12, alignItems: 'stretch' },
  siblingBox: {
    width: 144,
    minHeight: 126,
    borderWidth: 0,
    borderTopWidth: 4,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 16,
    justifyContent: 'space-between',
    gap: 16,
  },
  siblingBoxName: { fontSize: 15, fontWeight: '600', lineHeight: 22 },
  siblingBoxCount: { fontSize: 11, lineHeight: 18 },
  followCurrentLink: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  followCurrentLinkText: { fontSize: 12, lineHeight: 20 },

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
  contentScroll: {
    flex: 1,
  },
  contentShortViewport: {
    flexGrow: 1,
    gap: 8,
    paddingVertical: 8,
  },
  contentAccessible: {
    flex: 0,
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
    gap: 16,
  },
  shelfDeskFrameAccessible: {
    flex: 0,
  },
  shelfDeskFrameShortViewport: {
    flex: 0,
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
    gap: 10,
    paddingVertical: 12,
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
  addressPathLabel: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
  },
  addressPathText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
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
    fontWeight: '600',
    letterSpacing: 1.1,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  summary: {
    fontSize: 12,
    lineHeight: 18,
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
    fontWeight: '600',
    letterSpacing: 0.7,
  },
  addressContextValue: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  statusCopy: {
    flex: 1,
    gap: 4,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  locationText: {
    fontSize: 14,
    fontWeight: '600',
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
    fontSize: 23,
    fontWeight: '600',
    lineHeight: 30,
  },
  boxAccentRail: {
    borderRadius: 999,
    opacity: 0.36,
    width: 3,
  },
  boxTraySkeleton: {
    gap: 8,
    paddingRight: 22,
  },
  ruleText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 21,
  },
  boxShelf: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  boxShelfTile: {
    borderRadius: 16,
    borderWidth: 1,
    gap: 5,
    minWidth: 132,
    paddingHorizontal: 14,
    paddingVertical: 18,
  },
  boxName: {
    fontSize: 15,
    fontWeight: '600',
  },
  boxMeta: {
    fontSize: 12,
    lineHeight: 18,
  },
  currentTag: {
    fontSize: 12,
    fontWeight: '600',
  },
  stateTag: {
    fontSize: 12,
    fontWeight: '600',
  },
  actionChip: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 0,
    minHeight: 44,
    minWidth: 58,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  actionChipLabel: {
    fontSize: 12,
    fontWeight: '600',
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
  browseCardStrip: {
    justifyContent: 'flex-start',
    paddingBottom: 2,
    paddingTop: 1,
  },
  cardTile: {
    borderRadius: STUDIO.radius.section,
    borderWidth: 0,
    gap: 10,
    minWidth: 0,
    paddingHorizontal: 18,
    paddingVertical: 18,
    width: '100%',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0,
    shadowRadius: 18,
    elevation: 0,
  },
  loadingCardSkeleton: {
    borderStyle: 'dashed',
  },
  cardPrompt: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 25,
  },
  cardMeta: {
    fontSize: 12,
    lineHeight: 19,
  },
  headerActionStack: {
    alignItems: 'flex-end',
    gap: 8,
  },
});
