import {useEffect, useRef, useState} from 'react';
import type {LearningTrack} from '../../mobile/src/learning/model';
import {StudioIcon} from './StudioIcon';

export function CourseSwitch({track, disabled = false, onSelect}: {track: LearningTrack; disabled?: boolean; onSelect: (track: LearningTrack) => void}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    root.current?.querySelector<HTMLButtonElement>('.course-option[aria-pressed="true"]')?.focus();
    const dismiss = (event: PointerEvent) => {if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false);};
    const escape = (event: KeyboardEvent) => {if (event.key === 'Escape') {event.preventDefault();setOpen(false);trigger.current?.focus();}};
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {document.removeEventListener('pointerdown', dismiss);document.removeEventListener('keydown', escape);};
  }, [open]);
  return <div className="course-control" ref={root}>
    <button ref={trigger} className="course-switch" aria-label="选择备考科目" aria-expanded={open} aria-haspopup="dialog" disabled={disabled} onClick={() => setOpen(value => !value)}>
      <StudioIcon name="book" /><span>{track === 'cet6' ? '英语六级' : '英语四级'}</span><StudioIcon name={open ? 'chevronUp' : 'chevronDown'} />
    </button>
    {open ? <div className="course-options" role="dialog" aria-label="切换备考科目">
      <p>备考科目</p>
      {(['cet4', 'cet6'] as const).map(value => <button key={value} className="course-option" aria-label={value === 'cet6' ? '英语六级' : '英语四级'} aria-pressed={track === value} disabled={disabled} onClick={() => {setOpen(false);if (value !== track) onSelect(value);trigger.current?.focus();}}>
        <span><strong>{value === 'cet6' ? '英语六级' : '英语四级'}</strong><small>CET {value === 'cet6' ? '6' : '4'}</small></span>
        {value === track ? <StudioIcon name="checkCircle" /> : <StudioIcon name="chevronRight" />}
      </button>)}
      <small className="course-options-note">四六级的学习进度分别保留</small>
    </div> : null}
  </div>;
}
