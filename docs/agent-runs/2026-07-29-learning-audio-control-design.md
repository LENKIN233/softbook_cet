# Agent Run — Learning Audio Control Design

## Task

Create an implementation-authorizing, design-only audio control artifact before adding player code to the Learning surface.

## Specs And Artifacts Read

- `spec/requirement-memory.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/decisions/learning-card-rhythm-decision-v1.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`

## Product Truth

Audio is a card resource, not a standalone interaction family. Playback requires an explicit user action, front subtitles are not mandatory, and no waveform animation is introduced.

## Implementation Hypothesis

An attached listening chip can expose preparation, playback, pause, and recoverable failure without creating a transport shelf or moving the focal point away from the current CET card.

## Changes

- Compared editorial row, attached chip, and transport shelf directions.
- Accepted the attached chip and recorded rejected alternatives.
- Defined visible copy, accessibility, interruption, retry, and reduce-motion behavior.
- Rendered six phone proofs, including dark appearance and failure.
- Added an implementation map for verified cache, iOS, Android, lifecycle, and visible state.
- No React Native, native player, content, audio asset, backend, or database state changed.

## Design Review Checklist

- Q1 / Law of One: The current audio-focused library is explicit and indigo is the only strong accent.
- Q2 / focal object: The current card remains focal; task → attached audio → tools → shell is the first-read path.
- Q3 / silhouette: Audio occupies an attached resource slot and does not alter the five canonical interaction silhouettes.
- Q4 / forbidden patterns: No gradient text, gamification, full-width tab bar, pure black/white, serif, waveform, or technical metadata appears.
- Q5 / containment: The rendered phone control fits a 320dp minimum width, uses a single-line label, and does not clip the task or navigation.
- Q6 / Learning: Learning stays system-sequenced; flip remains exactly two self-assess states.
- AP-22: All six answers were written in the direction artifact before the rendered HTML was created.
- AP-23: `有把握` remains mint/confident and `再回看` remains amber/review; no red or four-state assessment is introduced.

## Validation

- `npm --prefix apps/mobile run design-metadata-leak-scan` — passed.
- `python3 scripts/validate_harness.py --format text` — passed (`HARNESS VALIDATION OK`).
- `git diff --check` — passed.
- In-app browser inspection — not completed: the browser security policy rejected the local `file://` artifact. No browser workaround was attempted; the 320dp containment claim remains a design review item until the PR proof is inspected in an allowed environment.

## Remaining Gaps

- This is design-only authority. Native players, TypeScript controller, cache wiring, user-visible implementation, and device playback remain unimplemented.
- Pixel-level browser review at desktop and 320dp remains open because the local artifact could not be loaded under the in-app browser policy.
