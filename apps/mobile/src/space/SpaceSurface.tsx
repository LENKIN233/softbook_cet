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

import { localLearningCardRecords } from '../learning/localCardRecords';
import { INTERACTION_LABELS, LearningCard, LearningTrack } from '../learning/model';
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

type SpaceCardPreview = {
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

export function SpaceSurface({
  cardStateById,
  currentLearningCard,
  deviceClass,
  onToggleFavoriteTag,
  onToggleSleepState,
  palette,
}: {
  cardStateById: Record<string, {isFavorited: boolean; isSleeping: boolean}>;
  currentLearningCard: LearningCard | null;
  deviceClass: DeviceClass;
  onToggleFavoriteTag: (cardId: string) => void;
  onToggleSleepState: (cardId: string) => void;
  palette: SpacePalette;
}) {
  const seed = useMemo(() => buildSpaceSeed(), []);
  const favoriteCards = seed.allCards.filter(card => cardStateById[card.cardId]?.isFavorited);
  const sleepingCards = seed.allCards.filter(card => cardStateById[card.cardId]?.isSleeping);
  const [selectedLibraryName, setSelectedLibraryName] = useState(
    seed.libraries[0]?.libraryName ?? '',
  );
  const selectedLibrary =
    seed.libraries.find(library => library.libraryName === selectedLibraryName) ??
    seed.libraries[0];

  const [selectedGroupName, setSelectedGroupName] = useState(
    selectedLibrary?.groups[0]?.groupName ?? '',
  );
  const selectedGroup =
    selectedLibrary?.groups.find(group => group.groupName === selectedGroupName) ??
    selectedLibrary?.groups[0];

  const [selectedBoxRef, setSelectedBoxRef] = useState(
    selectedGroup?.boxes[0]?.boxRef ?? '',
  );
  const selectedBox =
    selectedGroup?.boxes.find(box => box.boxRef === selectedBoxRef) ??
    selectedGroup?.boxes[0];
  const selectedTone = resolveLibraryTone(selectedLibrary?.libraryName);
  const currentTone = resolveLibraryTone(currentLearningCard?.space_metadata.library);

  if (!selectedLibrary || !selectedGroup || !selectedBox) {
    return (
      <ScrollView contentContainerStyle={styles.content}>
        <SurfaceCard palette={palette}>
          <Text style={[styles.eyebrow, { color: palette.accent }]}>
            SPACE / EMPTY
          </Text>
          <Text style={[styles.title, { color: palette.text }]}>
            空间地图还没有可展示的数据
          </Text>
          <Text style={[styles.summary, { color: palette.textMuted }]}>
            当前模块需要至少一批带有 library / group / box 的卡片数据才能接出空间知识地图。
          </Text>
        </SurfaceCard>
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
      <SurfaceCard palette={palette}>
        <Text style={[styles.eyebrow, { color: selectedTone.accent }]}>
          KNOWLEDGE MAP / SPACE
        </Text>
        <Text style={[styles.title, { color: palette.text }]}>
          已接入卡片的物理空间
        </Text>
        <Text style={[styles.summary, { color: palette.textMuted }]}>
          当前先把已接入卡片的 library / group / box / card 层级接进空间入口，让用户能浏览知识地图、查看盒内卡片，并看见当前学习卡的位置。
        </Text>
        <View style={styles.summaryRow}>
          <SummaryPill label="library" palette={palette} value={seed.libraryCount} />
          <SummaryPill label="group" palette={palette} value={seed.groupCount} />
          <SummaryPill label="box" palette={palette} value={seed.boxCount} />
          <SummaryPill label="card" palette={palette} value={seed.cardCount} />
          <SummaryPill label="favorite" palette={palette} value={favoriteCards.length} />
          <SummaryPill label="sleep" palette={palette} value={sleepingCards.length} />
        </View>
      </SurfaceCard>

      <View style={styles.sectionGrid}>
        <SurfaceCard
          palette={palette}
          style={deviceClass === 'tablet' ? styles.surfaceCardHalf : null}
          testID="space-current-position"
        >
          <Text style={[styles.cardTitle, { color: palette.text }]}>当前位置</Text>
          {currentLearningCard ? (
            <>
               <Text style={[styles.locationText, { color: currentTone.accent }]}>
                 当前学习卡位于 {currentLearningCard.space_metadata.library} /{' '}
                 {currentLearningCard.space_metadata.group} /{' '}
                 {currentLearningCard.space_metadata.box}
              </Text>
              <Text style={[styles.ruleText, { color: palette.textMuted }]}>
                {currentLearningCard.card_id} · {currentLearningCard.front.prompt}
              </Text>
            </>
          ) : (
            <Text style={[styles.ruleText, { color: palette.textMuted }]}>
              登录后开始学习，就能在这里看到当前学习卡的物理位置。
            </Text>
          )}
        </SurfaceCard>

        <SurfaceCard
          palette={palette}
          style={deviceClass === 'tablet' ? styles.surfaceCardHalf : null}
        >
          <Text style={[styles.cardTitle, { color: palette.text }]}>空间规则</Text>
          <RuleItem
            palette={palette}
            text="收藏是标签，不是物理盒子；它不会改写知识归属。"
          />
          <RuleItem
            palette={palette}
            text="休眠区会影响学习流，但这里先把规则显性化，不开放任意拖拽改盒。"
          />
          <RuleItem
            palette={palette}
            text="当前模块只做低成本浏览与盒内查看，不把空间做成复杂管理器。"
          />
        </SurfaceCard>

        <SurfaceCard palette={palette} testID="space-sleep-zone">
          <Text style={[styles.cardTitle, { color: palette.text }]}>休眠区</Text>
          <Text style={[styles.ruleText, { color: palette.textMuted }]}>
            进入休眠区的卡会立刻移出当前学习流，直到你把它移出来。
          </Text>
          {sleepingCards.length > 0 ? (
            <View style={styles.statusList}>
              {sleepingCards.map(card => (
                <View
                  key={card.cardId}
                  style={[
                    styles.statusRow,
                    { backgroundColor: palette.panelStrong, borderColor: palette.border },
                  ]}
                >
                  <View style={styles.statusCopy}>
                    <Text style={[styles.statusTitle, { color: palette.text }]}>
                      {card.prompt}
                    </Text>
                    <Text style={[styles.statusMeta, { color: palette.textMuted }]}>
                      {card.cardId} · box_ref {card.boxRef}
                    </Text>
                  </View>
                  <ActionChip
                    label="移出休眠"
                    onPress={() => onToggleSleepState(card.cardId)}
                    palette={palette}
                    testID={`space-wake-${card.cardId}`}
                  />
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.ruleText, { color: palette.textMuted }]}>
              当前还没有卡进入休眠区。
            </Text>
          )}
        </SurfaceCard>
      </View>

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
          <Text style={[styles.cardTitle, { color: palette.text }]}>知识地图浏览</Text>
          <Text style={[styles.ruleText, { color: palette.textMuted }]}>
            先选 library，再缩到 group，最后查看 box 内卡片。
          </Text>

          <Text style={[styles.selectorTitle, { color: palette.textMuted }]}>
            Library
          </Text>
          <View style={styles.selectorWrap}>
            {seed.libraries.map((library, index) => {
              const isActive = library.libraryName === selectedLibrary.libraryName;

              return (
                <Pressable
                  key={library.libraryName}
                  onPress={() => {
                    setSelectedLibraryName(library.libraryName);
                    setSelectedGroupName(library.groups[0]?.groupName ?? '');
                    setSelectedBoxRef(library.groups[0]?.boxes[0]?.boxRef ?? '');
                  }}
                  style={[
                      styles.selectorChip,
                      {
                        backgroundColor: isActive
                          ? selectedTone.accentSoft
                          : palette.panelStrong,
                        borderColor: isActive ? selectedTone.accent : palette.border,
                      },
                    ]}
                    testID={`space-library-${index}`}
                  >
                    <View style={styles.selectorHeader}>
                      <View
                        style={[
                          styles.selectorDot,
                          {
                            backgroundColor: resolveLibraryTone(library.libraryName).accent,
                          },
                        ]}
                      />
                      <Text
                        style={[
                          styles.selectorLabel,
                          {
                            color: isActive ? palette.text : palette.textMuted,
                          },
                        ]}
                      >
                        {library.libraryName}
                      </Text>
                    </View>
                    <Text style={[styles.selectorMeta, { color: palette.textMuted }]}>
                      {library.groups.length} 个 group
                    </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={[styles.selectorTitle, { color: palette.textMuted }]}>Group</Text>
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
                        borderColor: isActive ? selectedTone.accent : palette.border,
                      },
                    ]}
                    testID={`space-group-${index}`}
                >
                  <Text
                    style={[
                      styles.selectorLabel,
                      { color: isActive ? palette.accentStrong : palette.textMuted },
                    ]}
                  >
                    {group.groupName}
                  </Text>
                  <Text style={[styles.selectorMeta, { color: palette.textMuted }]}>
                    {group.boxes.length} 个 box
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
          <Text style={[styles.cardTitle, { color: palette.text }]}>收藏标签</Text>
          <Text style={[styles.ruleText, { color: palette.textMuted }]}>
            收藏是轻标签，不会改变卡片的物理位置。
          </Text>
          {favoriteCards.length > 0 ? (
            <View style={styles.statusList}>
              {favoriteCards.map(card => (
                <View
                  key={card.cardId}
                  style={[
                    styles.statusRow,
                    { backgroundColor: palette.panelStrong, borderColor: palette.border },
                  ]}
                >
                  <View style={styles.statusCopy}>
                    <Text style={[styles.statusTitle, { color: palette.text }]}>
                      {card.prompt}
                    </Text>
                    <Text style={[styles.statusMeta, { color: palette.textMuted }]}>
                      {card.cardId} · {card.boxRef}
                    </Text>
                  </View>
                  <ActionChip
                    label="取消收藏"
                    onPress={() => onToggleFavoriteTag(card.cardId)}
                    palette={palette}
                    testID={`space-unfavorite-${card.cardId}`}
                  />
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.ruleText, { color: palette.textMuted }]}>
              当前还没有收藏标签；你可以在学习卡或空间里直接加上它。
            </Text>
          )}
        </SurfaceCard>
      </View>

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
          <Text style={[styles.cardTitle, { color: palette.text }]}>盒列表</Text>
          <Text style={[styles.ruleText, { color: palette.textMuted }]}>
            盒是知识点容器，不允许直接改写归属。
          </Text>
          <View style={styles.boxList}>
            {selectedGroup.boxes.map(box => {
              const isActive = box.boxRef === selectedBox.boxRef;
              const isCurrent = currentLearningCard?.space_metadata.box_ref === box.boxRef;

              return (
                <Pressable
                  key={box.boxRef}
                  onPress={() => setSelectedBoxRef(box.boxRef)}
                  style={[
                    styles.boxRow,
                    {
                      backgroundColor: isActive
                        ? selectedTone.accentSoft
                        : palette.panelStrong,
                      borderColor: isActive ? selectedTone.accent : palette.border,
                    },
                  ]}
                  testID={`space-box-${box.boxRef}`}
                >
                  <View style={styles.boxCopy}>
                    <Text style={[styles.boxName, { color: palette.text }]}>
                      {box.boxName}
                    </Text>
                    <Text style={[styles.boxMeta, { color: palette.textMuted }]}>
                      box_ref {box.boxRef} · {box.cards.length} 张已接入卡片
                    </Text>
                  </View>
                   {isCurrent ? (
                     <Text style={[styles.currentTag, { color: currentTone.accent }]}>
                       当前卡在此
                     </Text>
                   ) : null}
                </Pressable>
              );
            })}
          </View>
        </SurfaceCard>

        <SurfaceCard
          palette={palette}
          style={deviceClass === 'tablet' ? styles.surfaceCardHalf : null}
          testID="space-box-detail"
        >
          <Text style={[styles.cardTitle, { color: palette.text }]}>盒内卡片</Text>
          <Text style={[styles.ruleText, { color: palette.textMuted }]}>
            {selectedLibrary.libraryName} / {selectedGroup.groupName} / {selectedBox.boxName}
          </Text>
          <View style={styles.cardList}>
            {selectedBox.cards.map(card => {
              const isCurrent = currentLearningCard?.card_id === card.cardId;
              const isFavorited = cardStateById[card.cardId]?.isFavorited ?? false;
              const isSleeping = cardStateById[card.cardId]?.isSleeping ?? false;

              return (
                <View
                  key={card.cardId}
                  style={[
                    styles.cardRow,
                    {
                      backgroundColor: palette.panelStrong,
                      borderColor: isCurrent ? palette.accent : palette.border,
                    },
                  ]}
                >
                  <Text style={[styles.cardPrompt, { color: palette.text }]}>
                    {card.prompt}
                  </Text>
                  <Text style={[styles.cardMeta, { color: palette.textMuted }]}>
                    {card.cardId} · {card.interactionLabel} · {card.track}
                  </Text>
                  <View style={styles.badgeRow}>
                    {isFavorited ? (
                      <Text style={[styles.stateTag, { color: palette.accentStrong }]}>
                        已收藏
                      </Text>
                    ) : null}
                    {isSleeping ? (
                       <Text style={[styles.stateTag, { color: palette.warning }]}>
                         休眠中
                       </Text>
                     ) : null}
                     {isCurrent ? (
                       <Text style={[styles.currentTag, { color: currentTone.accent }]}>
                         当前学习卡
                       </Text>
                     ) : null}
                  </View>
                  <View style={styles.actionWrap}>
                    <ActionChip
                      label={isFavorited ? '取消收藏' : '收藏'}
                      onPress={() => onToggleFavoriteTag(card.cardId)}
                      palette={palette}
                      testID={`space-favorite-${card.cardId}`}
                    />
                    <ActionChip
                      label={isSleeping ? '移出休眠' : '放入休眠'}
                      onPress={() => onToggleSleepState(card.cardId)}
                      palette={palette}
                      testID={`space-sleep-${card.cardId}`}
                    />
                  </View>
                </View>
              );
            })}
          </View>
        </SurfaceCard>
      </View>
    </ScrollView>
  );
}

function ActionChip({
  label,
  onPress,
  palette,
  testID,
}: {
  label: string;
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
      <Text style={[styles.actionChipLabel, { color: palette.accentStrong }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SummaryPill({
  label,
  palette,
  value,
}: {
  label: string;
  palette: SpacePalette;
  value: number;
}) {
  return (
    <View
      style={[
        styles.summaryPill,
        { backgroundColor: palette.panelStrong, borderColor: palette.border },
      ]}
    >
      <Text style={[styles.summaryValue, { color: palette.text }]}>{value}</Text>
      <Text style={[styles.summaryLabel, { color: palette.textMuted }]}>{label}</Text>
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

function RuleItem({
  palette,
  text,
}: {
  palette: SpacePalette;
  text: string;
}) {
  return (
    <View style={styles.ruleRow}>
      <View
        style={[
          styles.ruleDot,
          { backgroundColor: palette.accent, borderColor: palette.border },
        ]}
      />
      <Text style={[styles.ruleText, { color: palette.textMuted }]}>{text}</Text>
    </View>
  );
}

function buildSpaceSeed(): SpaceSeed {
  const libraryMap = new Map<
    string,
    Map<string, Map<string, { boxName: string; cards: SpaceCardPreview[] }>>
  >();
  const allCards: SpaceCardPreview[] = [];

  for (const record of localLearningCardRecords) {
    const library =
      libraryMap.get(record.space_metadata.library) ??
      libraryMap
        .set(record.space_metadata.library, new Map())
        .get(record.space_metadata.library)!;
    const group =
      library.get(record.space_metadata.group) ??
      library
        .set(record.space_metadata.group, new Map())
        .get(record.space_metadata.group)!;
    const box =
      group.get(record.space_metadata.box_ref) ??
      group
        .set(record.space_metadata.box_ref, {
          boxName: record.space_metadata.box,
          cards: [],
        })
        .get(record.space_metadata.box_ref)!;

    const preview = {
      boxRef: record.space_metadata.box_ref,
      cardId: record.card_id,
      interactionLabel: INTERACTION_LABELS[record.interaction_id],
      prompt: record.front.prompt,
      track: record.track,
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
    gap: 16,
    paddingHorizontal: 20,
    paddingVertical: 18,
  },
  contentTablet: {
    paddingHorizontal: 28,
    paddingVertical: 24,
  },
  surfaceCard: {
    borderRadius: 24,
    borderWidth: 1,
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.1,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
  },
  summary: {
    fontSize: 15,
    lineHeight: 23,
  },
  summaryRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
  statusList: {
    gap: 10,
  },
  statusRow: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
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
  boxList: {
    gap: 10,
  },
  boxRow: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  boxCopy: {
    flex: 1,
    gap: 4,
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
  cardList: {
    gap: 10,
  },
  cardRow: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 14,
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
});
