import React from 'react';
import {StudioIcon} from './StudioIcon';
import type {StudioIconName} from './studioIconShapes';

const routeIcons = {
  learning: 'book',
  space: 'map',
  statistics: 'chart',
  mine: 'user',
} as const satisfies Record<string, StudioIconName>;

export function StudioRouteIcon({color, routeKey, variant = 'tab'}: {
  active?: boolean;
  color: string;
  routeKey: keyof typeof routeIcons;
  variant?: 'tab' | 'sidebar' | 'header';
}) {
  return <StudioIcon name={routeIcons[routeKey]} color={color}
    size={variant === 'sidebar' ? 26 : variant === 'header' ? 22 : 24} />;
}
