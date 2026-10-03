import React from 'react';
import {StyleSheet, View, type ViewStyle} from 'react-native';
import {STUDIO} from './studio';
import {STUDIO_ICON_SHAPES, type StudioIconName, type StudioIconShape} from './studioIconShapes';

function segmentStyle(x1: number, y1: number, x2: number, y2: number, color: string): ViewStyle {
  const stroke = STUDIO.icon.stroke;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const width = Math.hypot(dx, dy) + stroke;
  return {
    position: 'absolute',
    left: (x1 + x2 - width) / 2,
    top: (y1 + y2 - stroke) / 2,
    width,
    height: stroke,
    borderRadius: stroke / 2,
    backgroundColor: color,
    transform: [{rotate: `${Math.atan2(dy, dx) * 180 / Math.PI}deg`}],
  };
}

function Shape({shape, color}: {shape: StudioIconShape; color: string}) {
  if (shape.kind === 'line') {
    return <View style={segmentStyle(shape.x1, shape.y1, shape.x2, shape.y2, color)} />;
  }
  if (shape.kind === 'polyline') {
    return <>{shape.points.slice(1).map((point, index) => {
      const start = shape.points[index];
      return <View key={index} style={segmentStyle(start[0], start[1], point[0], point[1], color)} />;
    })}</>;
  }
  if (shape.kind === 'circle') {
    const inset = shape.filled ? 0 : STUDIO.icon.stroke / 2;
    return <View style={{position: 'absolute', left: shape.cx - shape.r - inset, top: shape.cy - shape.r - inset,
      width: (shape.r + inset) * 2, height: (shape.r + inset) * 2, borderRadius: shape.r + inset,
      borderColor: color, borderWidth: shape.filled ? 0 : STUDIO.icon.stroke,
      backgroundColor: shape.filled ? color : 'transparent'}} />;
  }
  const inset = STUDIO.icon.stroke / 2;
  return <View style={{position: 'absolute', left: shape.x - inset, top: shape.y - inset,
    width: shape.width + inset * 2, height: shape.height + inset * 2, borderRadius: (shape.radius ?? 0) + inset,
    borderColor: color, borderWidth: STUDIO.icon.stroke}} />;
}

/** Decorative only: the enclosing control supplies its label and touch target. */
export function StudioIcon({name, color = STUDIO.color.inkSecondary, size = 20}: {
  name: StudioIconName;
  color?: string;
  size?: number;
}) {
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden
    importantForAccessibility="no-hide-descendants" style={{width: size, height: size, flexShrink: 0}}>
    <View style={[styles.canvas, {left: (size - 24) / 2, top: (size - 24) / 2, transform: [{scale: size / 24}]}]}>
      {STUDIO_ICON_SHAPES[name].map((shape, index) => <Shape key={index} shape={shape} color={color} />)}
    </View>
  </View>;
}

const styles = StyleSheet.create({canvas: {position: 'absolute', width: 24, height: 24}});
