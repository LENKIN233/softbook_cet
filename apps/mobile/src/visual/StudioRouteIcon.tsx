import React from 'react';
import {StyleSheet, View} from 'react-native';
import {STUDIO} from './studio';

export function StudioRouteIcon({
  active = false,
  color,
  routeKey,
  variant = 'tab',
}: {
  active?: boolean;
  color: string;
  routeKey: 'learning' | 'space' | 'statistics' | 'mine';
  variant?: 'tab' | 'sidebar' | 'header';
}) {
  const iconStyle =
    variant === 'sidebar'
      ? styles.routeIconFrameSidebar
      : variant === 'header'
      ? styles.routeIconFrameHeader
      : styles.routeIconFrameTab;
  const strokeWidth = STUDIO.icon.stroke;
  const lineStyle = {
    backgroundColor: color,
  };
  const borderStyle = {
    borderColor: color,
  };

  if (routeKey === 'learning') {
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.routeIconFrame, iconStyle]}
      >
        <View
          style={[
            styles.routeIconBook,
            borderStyle,
            active ? styles.routeIconBookActive : null,
          ]}
        >
          <View style={[styles.routeIconBookSpine, lineStyle]} />
          <View style={[styles.routeIconBookLine, lineStyle]} />
          <View style={[styles.routeIconBookLineShort, lineStyle]} />
        </View>
      </View>
    );
  }

  if (routeKey === 'space') {
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.routeIconFrame, iconStyle]}
      >
        <View
          style={[
            styles.routeIconSpaceLine,
            styles.routeIconSpaceLineTop,
            lineStyle,
            { height: strokeWidth },
          ]}
        />
        <View
          style={[
            styles.routeIconSpaceLine,
            styles.routeIconSpaceLineBottom,
            lineStyle,
            { height: strokeWidth },
          ]}
        />
        <View
          style={[
            styles.routeIconSpaceNode,
            styles.routeIconSpaceNodeStart,
            borderStyle,
            active ? lineStyle : null,
          ]}
        />
        <View
          style={[
            styles.routeIconSpaceNode,
            styles.routeIconSpaceNodeMiddle,
            borderStyle,
            active ? lineStyle : null,
          ]}
        />
        <View
          style={[
            styles.routeIconSpaceNode,
            styles.routeIconSpaceNodeEnd,
            borderStyle,
            active ? lineStyle : null,
          ]}
        />
      </View>
    );
  }

  if (routeKey === 'statistics') {
    return (
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        style={[styles.routeIconFrame, iconStyle, styles.routeIconStatsFrame]}
      >
        <View style={[styles.routeIconStatBarShort, lineStyle]} />
        <View style={[styles.routeIconStatBarMid, lineStyle]} />
        <View style={[styles.routeIconStatBarTall, lineStyle]} />
      </View>
    );
  }

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[styles.routeIconFrame, iconStyle]}
    >
      <View
        style={[
          styles.routeIconMineHead,
          borderStyle,
          active ? lineStyle : null,
        ]}
      />
      <View style={[styles.routeIconMineBody, borderStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  routeIconFrame: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  routeIconFrameTab: {
    width: 23,
    height: 23,
  },
  routeIconFrameSidebar: {
    width: 26,
    height: 26,
  },
  routeIconFrameHeader: {
    width: 23,
    height: 23,
  },
  routeIconBook: {
    width: 17,
    height: 18,
    borderWidth: STUDIO.icon.stroke,
    borderRadius: 5,
  },
  routeIconBookActive: {
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  routeIconBookSpine: {
    position: 'absolute',
    left: 4,
    top: 2,
    width: STUDIO.icon.stroke,
    height: 13,
    borderRadius: 999,
  },
  routeIconBookLine: {
    position: 'absolute',
    left: 8,
    top: 6,
    width: 6,
    height: STUDIO.icon.stroke,
    borderRadius: 999,
  },
  routeIconBookLineShort: {
    position: 'absolute',
    left: 8,
    top: 11,
    width: 4,
    height: STUDIO.icon.stroke,
    borderRadius: 999,
  },
  routeIconSpaceLine: {
    position: 'absolute',
    width: 13,
    borderRadius: 999,
  },
  routeIconSpaceLineTop: {
    left: 6,
    top: 8,
    transform: [{ rotate: '-26deg' }],
  },
  routeIconSpaceLineBottom: {
    left: 6,
    top: 14,
    transform: [{ rotate: '26deg' }],
  },
  routeIconSpaceNode: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 999,
    borderWidth: STUDIO.icon.stroke,
    backgroundColor: 'transparent',
  },
  routeIconSpaceNodeStart: {
    left: 2,
    top: 9,
  },
  routeIconSpaceNodeMiddle: {
    left: 11,
    top: 3,
  },
  routeIconSpaceNodeEnd: {
    right: 2,
    bottom: 4,
  },
  routeIconStatsFrame: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
  },
  routeIconStatBarShort: {
    width: STUDIO.icon.stroke,
    height: 9,
    borderRadius: 999,
  },
  routeIconStatBarMid: {
    width: STUDIO.icon.stroke,
    height: 14,
    borderRadius: 999,
  },
  routeIconStatBarTall: {
    width: STUDIO.icon.stroke,
    height: 18,
    borderRadius: 999,
  },
  routeIconMineHead: {
    width: 9,
    height: 9,
    borderRadius: 999,
    borderWidth: STUDIO.icon.stroke,
    marginBottom: 2,
  },
  routeIconMineBody: {
    width: 17,
    height: 9,
    borderTopWidth: STUDIO.icon.stroke,
    borderLeftWidth: STUDIO.icon.stroke,
    borderRightWidth: STUDIO.icon.stroke,
    borderBottomWidth: 0,
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
});
