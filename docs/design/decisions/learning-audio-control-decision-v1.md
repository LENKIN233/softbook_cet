# Learning Audio Control Decision v1

## 当前任务引用的 spec

- `spec/card-system.json`
- `spec/interactions.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/directions/learning-audio-control-directions-v1.md`
- `docs/design/decisions/learning-card-rhythm-decision-v1.md`

## Decision

Accept `Direction B — Attached Audio Chip`, borrowing the editorial restraint of Direction A.

## Visible Contract

| Situation | Visible control | User action |
|---|---|---|
| Ready or not cached | `播放听力` with speaker icon | Tap starts preparation and playback |
| Preparing | `正在准备听力…` with restrained progress ring | No duplicate request |
| Playing | `暂停` with pause icon | Tap pauses |
| Paused | `继续播放` with play icon | Tap resumes |
| Recoverable failure | `暂时无法播放 · 重试` | Tap retries |

The chip stays in the same location and approximately the same width between states. No elapsed time, scrubber, waveform, provider, file state, or technical reason is shown.

## Card Relationship

- For listening-first cards, the chip sits immediately after the short task instruction and before options or answer actions.
- For optional-audio cards, it sits in the secondary attached-tool row with lower contrast.
- Changing card stops the previous sound and returns the new card to its own ready state.
- The back may show transcript content, but the front never requires subtitles.

## Failure And Offline Language

- Uncached and offline: `连接网络后可播放` with a `重试` action.
- Corrupt or expired download recovery remains internal; after one automatic retry, use the same recoverable failure state.
- System interruption pauses playback. Returning to the app shows `继续播放`; it never resumes automatically.
- Raw native errors, module names, URLs, hashes, and stacks are forbidden.

## Accessibility

- Minimum target is 44 × 44 points/dp.
- Ready, playing, paused, busy, and error states expose role, label, hint, busy/disabled state, and selected/playing state where supported.
- Icon is never the sole state carrier; copy always changes with state.
- Reduce motion replaces ring rotation and press settling with immediate state changes.

## Rejected Alternatives

- Editorial-only text row is too easy to miss on audio-first cards.
- Transport shelf overstates audio as a standalone product family.
- Animated waveform is decorative, implies live signal analysis, and violates the no-waveform rule.

## Acceptance Criteria

- One explicit tap is always required before sound begins.
- The chip remains attached to the card and never becomes a global player.
- It works in light/dark themes and at 320dp width without clipping.
- Loading and failure copy contain no implementation metadata.
- Audio never changes the outcome model of flip, choice, lock, elimination, or swipe.

## Design Review Checklist

- Q1: Listening indigo is the only strong accent; other card and shell materials remain neutral.
- Q2: The card task is focal; the chip is the first actionable resource only when audio is required.
- Q3: The underlying interaction silhouette remains canonical; the chip occupies an attached resource slot.
- Q4: No forbidden design patterns are introduced.
- Q5: Phone containment requires a single-line chip at 320dp and safe-area compliant card padding.
- Q6: Learning remains system-sequenced and flip self-assess remains exactly two states.
- AP-22: Checklist was answered in the direction artifact before visual rendering.
- AP-23: `有把握` remains mint and `再回看` remains amber; audio does not introduce red or four-state assessment.
