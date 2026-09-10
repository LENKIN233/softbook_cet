import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {MotionPressable, StrikeText} from './NativeMotion';
import type {PassageSegment} from './presentation';

export function EliminationPassageText({
  segments, selectedIds, optionOrder, disabled, onToggle, textColor, mutedColor, selectionSurface,
}: {
  segments: PassageSegment[]; selectedIds: string[]; optionOrder: string[];
  disabled: boolean; onToggle: (id: string) => void;
  textColor: string; mutedColor: string; selectionSurface: string;
}) {
  const parts = segments.flatMap((segment, index) => {
    const itemId = segment.itemId;
    if (!itemId) {
      return (segment.text.match(/\S+\s*|\s+/g) ?? []).map((word, wordIndex) => (
        <Text key={`${index}-${wordIndex}`} style={[styles.word, {color: textColor}]}>{word}</Text>
      ));
    }
    const selected = selectedIds.includes(itemId);
    const accessibleLabel = `排除候选项，${segment.text}`;
    const targetId = `learning-elimination-${optionOrder.indexOf(itemId) + 1}`;
    return [
      <MotionPressable
        key={index}
        motionKey={selected}
        accessibilityRole="checkbox"
        accessibilityLabel={accessibleLabel}
        accessibilityState={{checked: selected, disabled}}
        disabled={disabled}
        onPress={() => onToggle(itemId)}
        testID={targetId}
        style={[styles.candidate, {backgroundColor: selected ? 'transparent' : selectionSurface}]}>
        <StrikeText struck={selected} color={mutedColor} style={[styles.phrase, {color: selected ? mutedColor : textColor}]}>{segment.text}</StrikeText>
      </MotionPressable>,
    ];
  });
  return (
    <View style={styles.area} testID="learning-elimination-passage">
      <View style={styles.passage}>{parts}</View>
      <Text style={[styles.guidance, {color: mutedColor}]}>轻点成分可划掉，再点可恢复。</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  area: {gap: 14},
  passage: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 0, rowGap: 0},
  word: {fontSize: 18, lineHeight: 28, paddingVertical: 8, minHeight: 44},
  candidate: {minHeight: 44, minWidth: 44, maxWidth: '100%', borderRadius: 4, paddingHorizontal: 3, paddingVertical: 8, justifyContent: 'center'},
  phrase: {fontSize: 18, lineHeight: 28},
  guidance: {fontSize: 12, lineHeight: 20},
});
