# Mobile Editorial Reset Context Pack

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/single-card-ux-contract.md`

## Surface

Phone Learning front, flip back, Physical Space continuity, and the mobile shell at 393 × 852. The run responds to direct product-owner rejection of the current shipped visual quality.

## Accepted Baseline

The baseline to beat is `docs/design/mocks/mobile-core-surface-reset-v1.html`, its decision and implementation map, plus the real iOS/Android screenshots captured on 2026-08-05. The baseline is treated as a failed accepted artifact because it produced a generic glass template, a weak first-read path, and an undersized focal card in the real app.

## Product Truth

- Learning is a system-sequenced single-card flow, not a dashboard or module chooser.
- The current CET card is the progress unit and the first-read focal object.
- The product should feel like trusted, low-burden CET material with physical position, not a generic flashcard or AI app.
- Physical Space keeps library / group / box / card visible as a hierarchy.
- The current active subject in the proof uses coral as its only strong accent.
- Flip uses exactly two self-assess states after reveal: 有把握 = confident / mint (#22C58B), 再回看 = review / amber (#F5B100).

## Hard Constraints

- The focal card occupies roughly 60% of usable phone height and includes the primary operation.
- The main task finishes without vertical scrolling at default type size.
- Secondary tools never share equal weight with the primary operation.
- One library hue dominates; correctness and self-assess retain separate semantic colors.
- Navigation remains Learning / Space / Statistics / Mine but does not become the largest object.
- No gradient title, gamification, full-width bottom bar, serif, exposed internal wording, or generic metric dashboard.
- This search run is design-only and cannot authorize same-PR React Native changes.

## Soft Objectives

- Replace generic Aurora-glass styling with a recognizable editorial exam-material identity.
- Make the card feel physical without copying a paper notebook literally.
- Use warm color fields and deep plum ink so neutral hierarchy is not mistaken for a black/white/gray theme.
- Make the front-to-back transition and the card-to-Space transition causally obvious.
- Preserve feasible React Native mapping and large-text containment.

## Source Artifacts

- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/physical-space/space-state-baseline-v1.md`
- `spec/visual-language.json`

## Forbidden Drift

- Do not “fix” the baseline by changing only its accent color.
- Do not put the primary CTA outside the physical card object.
- Do not leave the bottom half of the screen visually dead while the card is compressed at the top.
- Do not make every control a pill or every surface frosted glass.
- Do not turn Space into a list of rounded rectangles.

## Candidate Budget

Eight materially different directions are considered in one generation. Three receive rendered comparison proof; five are stopped before rendering by explicit hard-filter reasons. Two connected pairwise reviews select one synthesis for product-owner review. No React Native implementation is included.
