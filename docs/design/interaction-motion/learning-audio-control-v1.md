# Learning Audio Control Motion v1

## 当前任务引用的 spec

- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/decisions/learning-audio-control-decision-v1.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`

## Target

This artifact governs the attached audio resource control. Audio remains outside the interaction-family list.

## State Sequence

```text
ready --explicit tap--> preparing --verified local file ready--> playing
playing --tap/system interruption/background--> paused
paused --explicit tap--> playing
preparing/playing --recoverable failure--> error --tap retry--> preparing
any state --card change--> stopped and new-card ready
```

## Feedback And Timing

- Press settle: 90–140ms scale from 1 to 0.98 and back; interruptible.
- Ready → preparing: copy crossfade in 120–160ms; a 16px border ring may rotate once per 900–1200ms.
- Preparing → playing: icon/copy crossfade in 120–180ms; no success burst.
- Playing → paused: immediate native pause, then 120–180ms icon/copy crossfade.
- Failure: tint shifts to quiet amber over 120–180ms; no shake, red flash, or modal.
- Card change: sound stops before the next card settles; the chip leaves with its owning card.

## Interruptibility

- Duplicate taps while preparing are ignored and exposed as busy.
- Backgrounding or an audio-session interruption pauses immediately.
- Returning from background never resumes without a new tap.
- A stale prepare completion from a previous card must not start playback.

## Reduce Motion

- No rotating ring or scale settle.
- Copy and icon replace immediately.
- Playback behavior, explicit-action requirement, and accessibility announcements remain identical.

## Low-Burden Reason

Motion only confirms that one requested resource is being prepared or controlled. It never asks the learner to manage a queue, scrub time, choose a speed, or interpret decorative signal animation.

## Failure Recovery

- First integrity/download failure is retried internally once.
- Final recoverable state uses `暂时无法播放 · 重试`.
- Offline uncached state uses `连接网络后可播放` and retains the card task.
- The current card, answer state, and progress never reset because audio failed.
