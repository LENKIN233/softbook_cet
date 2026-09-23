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
  // Keep punctuation attached to the preceding touch target so flex wrapping
  // cannot strand a period or comma on its own line on narrow phones.
  const displaySegments: Array<PassageSegment & {punctuationFor?: string}> = [];
  for (const segment of segments) {
    const leadingPunctuation = segment.itemId
      ? segment.text.match(/^[,;—–]\s*/)?.[0]
      : null;
    if (leadingPunctuation) {
      displaySegments.push({text: leadingPunctuation, punctuationFor: segment.itemId});
      displaySegments.push({text: segment.text.slice(leadingPunctuation.length), itemId: segment.itemId});
    } else {
      displaySegments.push({...segment});
    }
  }
  for (let index = 1; index < displaySegments.length; index += 1) {
    const segment = displaySegments[index];
    const previous = displaySegments[index - 1];
    const punctuation = !segment.itemId && !segment.punctuationFor && previous.itemId
      ? segment.text.match(/^[.,!?;:，。！？；：](?=\s|$)/)?.[0]
      : null;
    if (punctuation) {
      previous.text += punctuation;
      segment.text = segment.text.slice(punctuation.length);
    }
  }
  const parts = displaySegments.flatMap((segment, index) => {
    const itemId = segment.itemId;
    if (!itemId) {
      const punctuationSelected = segment.punctuationFor && selectedIds.includes(segment.punctuationFor);
      if (punctuationSelected) return [];
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
