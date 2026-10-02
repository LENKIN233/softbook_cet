import {useEffect, useRef, useState, type ReactNode} from 'react';
import type {LearningTrack} from '../../mobile/src/learning/model';
import {StudioMark} from './StudioMark';

function GuidanceDialog({title, children, dismiss}: {title: string; children: ReactNode; dismiss?: () => void}) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.current?.focus();
    const captureKey = (event: KeyboardEvent) => {
      // Learning keyboard shortcuts must not run behind a modal.
      event.stopPropagation();
      if (event.key === 'Escape') {
        event.preventDefault();
        dismiss?.();
      }
      if (event.key !== 'Tab') return;
      const controls = Array.from(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input:not(:disabled), [tabindex="0"]') ?? []);
      const first = controls[0];
      const last = controls.at(-1);
      if (!first || !last) {event.preventDefault(); return;}
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog.current)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog.current)) {
        event.preventDefault(); first.focus();
      }
    };
    window.addEventListener('keydown', captureKey, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', captureKey, true);
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, [dismiss]);
  return <div className="first-run-backdrop">
    <section ref={dialog} className="first-run-dialog" role="dialog" aria-modal="true" aria-labelledby="first-run-title" tabIndex={-1}>
      <div className="first-run-brand"><StudioMark /><span>软书</span></div>
      <h1 id="first-run-title">{title}</h1>
      {children}
    </section>
  </div>;
}

export function FirstSubjectDialog({loadError, recoveringRecord, onRetry, onConfirm}: {loadError: boolean; recoveringRecord: boolean; onRetry: () => void; onConfirm: (track: LearningTrack) => void}) {
  const [selected, setSelected] = useState<LearningTrack | null>(null);
  const [saveError, setSaveError] = useState(false);
  function confirm() {
    if (selected === null) return;
    try {onConfirm(selected); setSaveError(false);} catch {setSaveError(true);}
  }
  return <GuidanceDialog title="先选一个备考科目">
    <p className="first-run-lede">你现在准备哪一场考试？</p>
    {recoveringRecord ? <p className="first-run-error" role="alert">原来的科目选择未能读出，请重新选一次。学习记录仍会保留。</p> : null}
    {loadError ? <div className="first-run-error" role="alert"><p>暂时无法读取你的选择，请重试。</p><button className="secondary" onClick={onRetry}>重新读取</button></div> : <>
      <div className="first-subject-options" role="group" aria-label="选择备考科目">
        {(['cet4', 'cet6'] as const).map(track => <button key={track} className={`first-subject-option${selected === track ? ' selected' : ''}`} aria-pressed={selected === track} data-testid={`first-subject-${track}`} onClick={() => {setSelected(track); setSaveError(false);}}>
          <span className="first-subject-code">{track === 'cet4' ? 'CET 4' : 'CET 6'}</span>
          <strong>{track === 'cet4' ? '英语四级' : '英语六级'}</strong>
          <span className="first-subject-check" aria-hidden="true">{selected === track ? '✓' : ''}</span>
        </button>)}
      </div>
      <p className="first-run-switch">以后到 <strong>我的 → 备考科目</strong> 就能切换，四、六级进度分别保留。</p>
      {saveError ? <p className="first-run-error" role="alert">暂时无法记住你的选择，请重试。开启浏览器的本地存储后再继续。</p> : null}
      <button className="primary first-run-continue" data-testid="first-subject-continue" disabled={selected === null} onClick={confirm}>{selected === null ? '选择科目后继续' : '继续'}</button>
    </>}
  </GuidanceDialog>;
}

export function FirstLearningDialog({onContinue}: {onContinue: () => void}) {
  const [saveError, setSaveError] = useState(false);
  function finish() {
    try {onContinue();} catch {setSaveError(true);}
  }
  return <GuidanceDialog title="从一张卡开始" dismiss={finish}>
    <div className="first-learning-steps">
      <p><span>1</span>先读题，再按卡片要求作答。</p>
      <p><span>2</span>需要提示时点“看判断方法”。</p>
      <p><span>3</span>答题后看解释，再继续下一张。</p>
    </div>
    <p className="first-run-switch">在“空间”里查找卡片、收藏或休眠。</p>
    <p className="first-run-switch">切换考试：<strong>我的 → 备考科目</strong>。</p>
    {saveError ? <p className="first-run-error" role="alert">暂时无法保存指引状态，请重试。</p> : null}
    <button className="primary first-run-continue" data-testid="first-learning-guide-start" onClick={finish}>开始学习</button>
  </GuidanceDialog>;
}
