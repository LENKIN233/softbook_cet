import React from 'react';
import {StyleSheet, View} from 'react-native';
import {STUDIO} from './studio';

export function StudioMark() {
  return <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.mark}>
    <View style={[styles.page, styles.left]} /><View style={[styles.page, styles.right]} />
  </View>;
}
const styles = StyleSheet.create({
  mark: {width: 28, height: 28, borderRadius: 8, backgroundColor: STUDIO.color.ink, alignItems: 'center', justifyContent: 'center', flexDirection: 'row'},
  page: {width: 8, height: 13, borderWidth: 1.2, borderColor: STUDIO.color.paper, borderRadius: 1.5},
  left: {transform: [{skewY: '8deg'}]},
  right: {transform: [{skewY: '-8deg'}], marginLeft: -1},
});
