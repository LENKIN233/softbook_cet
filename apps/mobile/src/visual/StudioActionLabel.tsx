import React from 'react';
import {StyleSheet, View, type StyleProp, type TextStyle} from 'react-native';
import {ScaledText as Text} from './ScaledText';
import {StudioIcon} from './StudioIcon';

export function StudioActionLabel({icon, children, color, size = 20, textStyle,
  textTestID, align = 'center', maxFontSizeMultiplier}: {
  icon: React.ComponentProps<typeof StudioIcon>['name'];
  children: React.ReactNode;
  color: string;
  size?: number;
  textStyle?: StyleProp<TextStyle>;
  textTestID?: string;
  align?: 'center' | 'start';
  maxFontSizeMultiplier?: number;
}) {
  return <View style={[styles.row, align === 'start' ? styles.start : null]}>
    <StudioIcon name={icon} color={color} size={size} />
    <Text style={[styles.text, {color}, align === 'start' ? {textAlign: 'left'} : null, textStyle]} testID={textTestID}
      maxFontSizeMultiplier={maxFontSizeMultiplier}>{children}</Text>
  </View>;
}

const styles = StyleSheet.create({
  row: {flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, maxWidth: '100%'},
  start: {justifyContent: 'flex-start'},
  text: {flexShrink: 1, minWidth: 0, textAlign: 'center'},
});
