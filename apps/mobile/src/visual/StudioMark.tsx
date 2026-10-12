import React from 'react';
import {StyleSheet, View} from 'react-native';
import {STUDIO} from './studio';
import {StudioIcon} from './StudioIcon';

export function StudioMark() {
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.mark}>
    <StudioIcon name="book" color={STUDIO.color.paper} size={21}/>
  </View>;
}
const styles = StyleSheet.create({
  mark: {width: 28, height: 28, borderRadius: 8, backgroundColor: STUDIO.color.ink, alignItems: 'center', justifyContent: 'center'},
});
