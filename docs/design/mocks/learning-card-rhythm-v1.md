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
- Current library: reading
- Current accent: reading coral, used as the only dominant accent
- Rendered asset: `docs/design/mocks/learning-card-rhythm-v1.html`

## Product Truth

Learning remains a system-sequenced single-card flow. This proof does not create a new interaction family, module picker, content source, card identifier, or runtime state. It renders the accepted `Guided Addressed Card Rhythm` as a visible phone-state sequence.

## Implementation Hypothesis

The rendered asset proves the six-state rhythm without RN implementation:

```text
place -> focus -> support -> resolve -> settle -> continue
```

The HTML uses three phone frames:

1. `Place + Focus`: the current addressed card is first read, with multiple-choice 2x2 silhouette.
2. `Support`: hint and peek remain attached to the same card object and stay secondary.
3. `Resolve + Settle`: flip back content, `有把握 = mint` / confident and `再回看 = amber` / review self-assess, quiet recorded-result copy, and a next-card continuation.

## First-Read Path

```text
current library chip -> current card object -> interaction silhouette -> support/reveal -> settle copy -> next-card continuation
```

## Containment Proof

- Each phone is fixed to `393 x 852`.
- The HTML sets `overflow-x: hidden`.
- A narrow viewport media query keeps frames inside small screens.
- Bottom navigation is a floating capsule inside the phone frame, not a fixed full-width bar.

## Metadata-Leakage Boundary

The proof intentionally avoids user-visible:

- raw card or box identifiers;
- source, payload, repository, cache, queue, runtime, mock, or seed wording;
- module-first learning entry;
- detached hint or peek management screens.

## Known Gaps

- This artifact is a rendered mock, not RN implementation.
- It covers phone only; tablet and pc web remain governed by `docs/design/decisions/learning-space-platform-layout-v1.md`.
- It is static; motion timing remains governed by `docs/design/interaction-motion/learning-card-rhythm-v1.md` and `docs/design/storyboards/learning-space-motion-prototype-v1.md`.

## Design Review Checklist Answers

Q1: Current library is reading, and reading coral is the only strong accent. Mint and amber appear only as flip self-assess feedback colors.

Q2: Focal object is the current addressed CET card. First-read path is current library chip -> current card object -> interaction silhouette -> support/reveal -> settle -> continue.

Q3: The first frame uses the multiple-choice silhouette; the support frame keeps hint/peek attached to the current object; the resolve frame uses the flip silhouette with exactly two self-assess pills.

Q4: No forbidden design patterns are used: no gradient text, game-progress chrome, full-width bottom tabbar, removed self-assess tokens, or serif typography.

Q5: Phone frame containment is fixed at `393 x 852`; safe-area, card object, support layer, self-assess pills, continuation CTA, and floating capsule navigation stay inside the frame.

Q6: The flip state uses exactly `有把握 = mint` / confident and `再回看 = amber` / review. Stats are not introduced, and module selection is not exposed as the primary Learning path.
