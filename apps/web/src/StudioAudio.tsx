import {useEffect, useState} from 'react';
import {STUDIO} from '../../mobile/src/visual/studio';
import {StudioIcon} from './StudioIcon';

export function StudioAudio({status, durationMs, disabled, onPlay, readPosition, onSeek, onRestart}: {
  readPosition?: () => number | null | Promise<number | null>;
  onSeek?: (milliseconds: number) => void;
  onRestart?: () => void;
  status: 'idle' | 'loading' | 'paused' | 'playing' | 'ready' | 'error';
  durationMs: number;
  disabled: boolean;
  onPlay: (() => void) | null;
}) {
  const [position, setPosition] = useState<number | null>(null);
  useEffect(() => {
    if (!readPosition) return; let active = true;
    const read = () => {void Promise.resolve(readPosition()).then(value => {if (active) setPosition(value);}).catch(() => {if (active) setPosition(null);});};
    read(); const timer = ['playing', 'paused'].includes(status) ? window.setInterval(read, 500) : undefined;
    return () => {active = false; clearInterval(timer);};
  }, [readPosition, status]);
  const clock = (ms: number) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
  const label = status === 'loading' ? '正在准备音频' : status === 'playing' ? '暂停音频'
    : status === 'paused' ? '继续播放' : status === 'error' ? '重试播放' : '播放音频';
  return <div className={'audio-resource' + (status === 'playing' ? ' playing' : '')}>
    <button className="audio-action" aria-label={label} aria-busy={status === 'loading'} disabled={disabled || onPlay === null || status === 'loading'} onClick={onPlay ?? undefined}>
      <span className="audio-disc" aria-hidden="true"><StudioIcon name={status === 'playing' ? 'pause' : status === 'error' || status === 'loading' ? 'refresh' : 'play'} size={24} /></span>
      <span className="audio-label"><strong>{label}</strong><small>{position === null ? `${Math.max(1, Math.round(durationMs / 1000))} 秒录音` : `${clock(position)} / ${clock(durationMs)}`}</small></span>
      <span className="audio-wave" aria-hidden="true">{STUDIO.motion.waveHeights.map((height, index) => <i key={index} style={{height, animationDelay: `${index % 5 * -0.11}s`}} />)}</span>
    </button>
    {onRestart || onSeek ? <div className="audio-repeat-actions"><button className="text-button" disabled={disabled || status === 'loading' || !onRestart} onClick={onRestart}><StudioIcon name="refresh"/>从头重听</button><button className="text-button" disabled={disabled || status === 'loading' || position === null || position <= 0 || !onSeek} onClick={() => onSeek?.(Math.max(0, (position ?? 0) - 5000))}><StudioIcon name="chevronLeft"/>后退5秒</button></div> : null}
  </div>;
}
