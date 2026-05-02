# Learning + Space Motion Prototype v1

## 当前任务引用的 spec

- `spec/product-core.json`
- `spec/interactions.json`
- `spec/space-operations.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/physical-space/space-model-v1.md`

## Rendered Asset

- `docs/design/storyboards/learning-space-motion-prototype-v1.html`

The HTML asset renders three motion strips: flip, hint reveal, and swipe. It also includes `prefers-reduced-motion` handling with explicit fallback states.

## Storyboard 1: Flip

- Start state: current card front is visible.
- User action: user triggers flip.
- System feedback: same object rotates or crossfades to back content, preserving object identity.
- End state: two self-assess pills appear: `有把握` in confident mint and `再回看` in review amber.
- Semantic reason: user understands the back is the same card object, not a new page.
- Duration range: 280-360ms.
- Interruptibility: self-assess is not committed until user taps a pill.
- Reduce-motion fallback: no rotation; the motion frame switches to a front/back crossfade cue.
- Failure state: if back content is unavailable, keep front object and show retry affordance.

## Storyboard 2: Hint Reveal

- Start state: hint trigger is attached to the current card object.
- User action: user opens hint.
- System feedback: hint layer appears from object edge with supporting exam clue.
- End state: card remains answerable; hint does not solve the card.
- Semantic reason: hint is a layer, not a standalone card type.
- Duration range: 120-200ms.
- Interruptibility: hint can be closed without changing answer state.
- Reduce-motion fallback: hint text appears inline below the card object.
- Failure state: no hint means no placeholder panel.

## Storyboard 3: Swipe

- Start state: one top card is centered, left/right direction hints are visible.
- User action: user drags or chooses direction.
- System feedback: card follows direction and next card enters from stack context.
- End state: answer state is recorded and next eligible card appears.
- Semantic reason: the system advances one object at a time without exposing module management.
- Duration range: 180-260ms after release.
- Interruptibility: before release, returning to center cancels the answer.
- Reduce-motion fallback: directional buttons replace card travel.
- Failure state: ambiguous drag snaps back and records nothing.

## Design Review Checklist Answers

Q1: The prototype uses one reading accent as the dominant color.

Q2: Focal object is the current card in all strips.

Q3: Flip uses card + two-pill silhouette, hint is attached layer, swipe is single top card with directional trail.

Q4: No forbidden patterns are used; no reward bursts or gamification chrome appear.

Q5: No phone frame is included here; the prototype is a storyboard strip.

Q6: Flip uses exactly two self-assess pills with AP-23 colors: `有把握` = mint and `再回看` = amber. Module selection is absent.
