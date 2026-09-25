import {STUDIO} from '../../mobile/src/visual/studio';

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
      <span className="audio-disc" aria-hidden="true"><svg viewBox="0 0 24 24">{status === 'playing' ? <path d="M7 5h3v14H7zM14 5h3v14h-3z"/> : <path d="m8 5 11 7-11 7z"/>}</svg></span>
      <span className="audio-label"><strong>{label}</strong><small>{Math.max(1, Math.round(durationMs / 1000))} 秒录音</small></span>
      <span className="audio-wave" aria-hidden="true">{STUDIO.motion.waveHeights.map((height, index) => <i key={index} style={{height, animationDelay: `${index % 5 * -0.11}s`}} />)}</span>
    </button>
  </div>;
}
