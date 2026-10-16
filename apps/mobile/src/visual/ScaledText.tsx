import React from 'react';
import {StyleSheet, Text, useWindowDimensions} from 'react-native';
import {inlineTextSegments} from '../learning/inlineText';
import type {TextProps} from 'react-native';

// Keep measurement and glyph size together during live system font changes,
// without resetting the surrounding card, disclosure, or audio player.
export const ScaledText = React.forwardRef<Text, TextProps>(function ScaledText(props, ref) {
  const format = (child: React.ReactNode): React.ReactNode => typeof child === 'string' && /\*\*[^*\n]+\*\*/.test(child)
    ? inlineTextSegments(child).map((segment, index) => segment.strong
      ? <Text key={index} style={{fontWeight: '700'}}>{segment.text}</Text> : segment.text)
    : Array.isArray(child) ? child.map(format) : child;
  props = {...props, children: format(props.children)};
  const {fontScale} = useWindowDimensions();
  const style = StyleSheet.flatten(props.style);
  const maximum = props.maxFontSizeMultiplier;
  // Body text follows the complete system multiplier. Only an explicit caller
  // limit caps it; text without a size retains native parent inheritance.
  if (props.allowFontScaling !== false && typeof style?.fontSize === 'number') {
    const multiplier = typeof maximum === 'number' && maximum > 0
      ? Math.min(fontScale, maximum) : fontScale;
    return <Text {...props} ref={ref} key={fontScale} allowFontScaling={false}
      style={[props.style, {fontSize: style.fontSize * multiplier,
        ...(typeof style.lineHeight === 'number' ? {lineHeight: style.lineHeight * multiplier} : {}),
        ...(typeof style.letterSpacing === 'number' ? {letterSpacing: style.letterSpacing * multiplier} : {})}]} />;
  }
  return <Text {...props} ref={ref} key={fontScale} />;
});
