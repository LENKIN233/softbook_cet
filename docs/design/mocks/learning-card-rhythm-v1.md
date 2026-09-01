# Learning Card Rhythm Rendered Proof v1

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/decisions/learning-space-direction-decision-v1.md`
- `docs/design/decisions/learning-card-rhythm-decision-v1.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`

## Target Surface

- Surface: Learning
- Device class: phone
- Frame: `393 x 852`
- Current library: current
- Display accent: display accent, used as the only dominant accent
- Rendered asset: `docs/design/mocks/learning-card-rhythm-v1.html`

## Product Truth

Learning remains a system-sequenced single-card flow. This proof does not create a new interaction family, module picker, content source, internal identifier, or runtime state. It renders the accepted `Guided Addressed Card Rhythm` as a visible phone-state sequence.

## Implementation Hypothesis

The rendered asset proves the six-state rhythm without RN implementation:

```text
place -> focus -> support -> resolve -> settle -> continue
```

The HTML uses three phone frames:

1. `Short Content`: the stable current object balances a short prompt and the
   multiple-choice 2x2 silhouette without leaving a dead half-screen.
2. `Long Content + Support`: the same outer object keeps its geometry while the
   task band scrolls; hint opens from the card edge, peek belongs to the address
   aperture, and favorite remains a header tag.
3. `Resolve + Settle`: the same object resolves to flip back content,
   `有把握 = mint` / confident and `再回看 = amber` / review self-assess, quiet
   recorded-result copy, and a next-card continuation.

The proof also includes a five-interaction silhouette rail. The outer object is
stable while flip, multiple choice, lock, elimination, and swipe remain
recognizable by their internal task shape.

## First-Read Path

```text
address/progress -> current card task -> interaction silhouette -> primary action -> support/reveal when requested -> settle -> next card
```

## Containment Proof

- Each phone is fixed to `393 x 852`.
- The HTML sets `overflow-x: hidden`.
- A narrow viewport media query keeps frames inside small screens.
- Bottom navigation is a floating capsule inside the phone frame, not a fixed full-width bar.
- Each frame uses the same stable object envelope. Short content is balanced;
  long content scrolls inside the task band without moving the action anchor.

## Metadata-Leakage Boundary

The proof intentionally avoids user-visible:

- raw internal identifiers;
- source, payload, repository, cache, queue, runtime, mock, or seed wording;
- module-first learning entry;
- detached hint or peek management screens.

## Known Gaps

- This artifact is a rendered mock, not RN implementation.
- It covers phone only; tablet and pc web remain governed by `docs/design/decisions/learning-space-platform-layout-v1.md`.
- It is static; motion timing remains governed by `docs/design/interaction-motion/learning-card-rhythm-v1.md` and `docs/design/storyboards/learning-space-motion-prototype-v1.md`.

## Design Review Checklist Answers

Q1: Current library is represented by the anonymous current-library slot, and the display accent is the only strong accent. Mint and amber appear only as flip self-assess feedback colors.

Q2: Focal object is the current addressed CET card. First-read path is
address/progress -> task -> interaction silhouette -> primary action ->
support/reveal when requested -> settle -> continue. The stable three-band
object prevents tools or empty space from becoming a competing focal point.

Q3: The first frame uses the multiple-choice silhouette; the support frame
keeps hint on the object edge, peek in the address aperture, and favorite in
the header; the resolve frame uses the flip silhouette with exactly two
self-assess pills. The silhouette rail confirms all five core families.

Q4: No forbidden design patterns are used: no gradient text, game-progress chrome, full-width bottom tabbar, removed self-assess tokens, or serif typography.

Q5: Phone frame containment is fixed at `393 x 852`; safe-area, card object, support layer, self-assess pills, continuation CTA, and floating capsule navigation stay inside the frame.

Q6: The flip state uses exactly `有把握 = mint` / confident and `再回看 = amber` / review. Stats are not introduced, and module selection is not exposed as the primary Learning path.
