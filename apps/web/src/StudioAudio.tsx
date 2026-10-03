import {STUDIO} from '../../mobile/src/visual/studio';
import {StudioIcon} from './StudioIcon';

export function StudioAudio({status, durationMs, disabled, onPlay}: {
  status: 'idle' | 'loading' | 'paused' | 'playing' | 'ready' | 'error';
  durationMs: number;
  disabled: boolean;
  onPlay: (() => void) | null;
}) {
  const label = status === 'loading' ? '正在准备音频' : status === 'playing' ? '暂停音频'
    : status === 'paused' ? '继续播放' : status === 'error' ? '重试播放' : '播放音频';
  return <div className={'audio-resource' + (status === 'playing' ? ' playing' : '')}>
    <button className="audio-action" aria-label={label} aria-busy={status === 'loading'} disabled={disabled || onPlay === null || status === 'loading'} onClick={onPlay ?? undefined}>
      <span className="audio-disc" aria-hidden="true"><StudioIcon name={status === 'playing' ? 'pause' : status === 'error' || status === 'loading' ? 'refresh' : 'play'} size={24} /></span>
      <span className="audio-label"><strong>{label}</strong><small>{Math.max(1, Math.round(durationMs / 1000))} 秒录音</small></span>
      <span className="audio-wave" aria-hidden="true">{STUDIO.motion.waveHeights.map((height, index) => <i key={index} style={{height, animationDelay: `${index % 5 * -0.11}s`}} />)}</span>
    </button>
  </div>;
}
