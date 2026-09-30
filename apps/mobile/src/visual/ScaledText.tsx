import React from 'react';
import {Text, useWindowDimensions} from 'react-native';
import type {TextProps} from 'react-native';

// Recreate only the native text node when Dynamic Type changes. This refreshes
// native measurement without resetting the surrounding card, disclosure, or
// audio player. The system still controls font scaling, including body text.
export const ScaledText = React.forwardRef<Text, TextProps>(function ScaledText(props, ref) {
  const {fontScale} = useWindowDimensions();
  return <Text {...props} ref={ref} key={fontScale} />;
});
