import type {ReactNode} from 'react';
import {STUDIO_ICON_SHAPES, type StudioIconName, type StudioIconShape} from '../../mobile/src/visual/studioIconShapes';
import {STUDIO} from '../../mobile/src/visual/studio';

export function StudioIcon({name, size = 20, className = ''}: {name: StudioIconName; size?: number; className?: string}) {
  return <svg className={`studio-icon ${className}`.trim()} width={size} height={size} viewBox="0 0 24 24"
    fill="none" stroke="currentColor" strokeWidth={STUDIO.icon.stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {(STUDIO_ICON_SHAPES[name] as readonly StudioIconShape[]).map((shape, index) => {
      if (shape.kind === 'line') return <line key={index} x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} />;
      if (shape.kind === 'polyline') return <polyline key={index} points={shape.points.map(([x, y]) => `${x},${y}`).join(' ')} />;
      if (shape.kind === 'circle') return <circle key={index} cx={shape.cx} cy={shape.cy} r={shape.r} fill={shape.filled ? 'currentColor' : 'none'} stroke={shape.filled ? 'none' : undefined} />;
      return <rect key={index} x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.radius} />;
    })}
  </svg>;
}

export function IconLabel({name, children, size = 20}: {name: StudioIconName; children: ReactNode; size?: number}) {
  return <span className="icon-label"><StudioIcon name={name} size={size} /><span>{children}</span></span>;
}

export function DisclosureLabel({name, children}: {name: StudioIconName; children: ReactNode}) {
  return <><IconLabel name={name}>{children}</IconLabel><StudioIcon name="chevronDown" className="disclosure-chevron" /></>;
}
