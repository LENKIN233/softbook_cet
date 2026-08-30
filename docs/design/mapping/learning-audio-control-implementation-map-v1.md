# Learning Audio Control Implementation Map v1

## Accepted Sources

- `docs/design/decisions/learning-audio-control-decision-v1.md`
- `docs/design/mocks/learning-audio-control-v1.html`
- `docs/design/interaction-motion/learning-audio-control-v1.md`
- `docs/design/decisions/learning-card-rhythm-decision-v1.md`

## Mapping

| Design region or state | Implementation surface |
|---|---|
| Attached chip placement | `apps/mobile/src/learning/LearningSurface.tsx` audio resource slot |
| Visible state and retry behavior | new Learning audio control component |
| Verified local-file preparation | `apps/mobile/src/audio/contentAssetCache.ts` plus player controller |
| iOS playback | native `AVAudioPlayer` adapter |
| Android playback | native Media3 ExoPlayer adapter |
| Card-change and app-state interruption | Learning lifecycle host and player controller |
| Accessible labels/state | attached chip component, not the native engine |

## Required Implementation Boundaries

- The player accepts only a path returned by the verified content-addressed cache.
- Expiring download URLs never enter visible state or durable UI storage.
- The selection authority is the exact server `selection_id` or an explicit local attempt identity, so a same-card next selection invalidates earlier preparation and playback.
- Every new prepare receives a controller-instance-scoped playback nonce. Native ended, error, and interruption events may change the chip only when that exact nonce is current; pause/resume inside the same selection keeps the nonce.
- Backgrounding while cache resolution, native prepare, or initial native play is pending invalidates that generation and nonce, stops native work, returns the chip to ready, and requires another explicit tap; a quick foreground retry cannot be overwritten by the cancelled completion.
- iOS binds the pending token/generation before activating its audio session and accepts installation/play only for that exact generation. Both native application-background and system audio-session notifications cancel one exact pending, ready, or playing generation on the main queue, stop it, and emit one token-bound `requiresPrepare` interruption even if JS AppState delivery is delayed; pause-only engines retain normal same-selection pause/resume.
- Android also token-binds play/pause. Native host pause releases pending prepare or READY-before-first-play authority and emits `requiresPrepare` before rejecting the prepare promise, while playback that already started remains a normal pause/resume interruption.
- Native/internal errors map to a bounded domain error before reaching visible copy.
- No autoplay, background resume, global mini-player, waveform, or speed control.

## Required Evidence

- Unit tests for all five visible states, stale completion, one retry, card change, offline cached/uncached, background pause, and error sanitization.
- iOS and Android screenshots for ready, preparing, playing, paused, and error at 320dp/standard phone width.
- Device proof that sound never begins before an explicit tap and never resumes automatically.
- Accessibility proof for label, role, busy/disabled state, 44dp target, and non-icon-only meaning.

## Unimplemented Gaps

At design acceptance time, the native players, TypeScript controller, visible chip, real-device playback, release key injection, and private-object device smoke remain unimplemented.
