# Learning Interaction Evolution Rendered Proof v1

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/decisions/learning-interaction-evolution-v1.md`
- `docs/design/interaction-motion/learning-object-theatre-v1.md`

## Rendered Asset

`docs/design/mocks/learning-interaction-evolution-v1.html`

## Target

- Phone frame: 393x852.
- Current library: one anonymous current-library slot per frame.
- States: short flip, multiple choice with hint, auto-scored result, and flip result/self-assess.

## Product Truth

The proof renders a stable addressed card stage, not a module page. Five interaction semantics remain owned by `spec/interactions.json`; the five-shape rail in the flip-result frame is reviewer evidence, not a new user action.

## Implementation Hypothesis

The visible card separates into stable stage and intrinsic material sheet. Short content includes its authored front signal and exam context and occupies at least half of the usable stage above the action rail; long content scrolls inside the sheet. Peek is the lightweight address aperture, while hint is the only conditional task-plane edge disclosure.

## Containment Evidence

- Stage, sheet, edge handle, action rail, and navigation remain inside 393x852.
- Interactive phone targets are at least 48px in the proof.
- Sheet owns overflow; the phone document does not scroll horizontally.
- The next-card edge appears only in resolved state.

## Known Gaps

This design-only proof does not establish RN behavior, physical-device screen-reader order, haptics, Reduce Motion execution, tablet, PC-Web, or receiver deployment.

## Design Review Checklist Answers

Q1: One current-library accent owns each stage and action.

Q2: Material sheet is focal and reads task -> interaction -> action -> result.

Q3: The proof includes flip, choice, and reviewer evidence for all five silhouettes; implementation must render each actual task body.

Q4: No gradient text, reward chrome, full-width bar, serif, or four-state self-assessment appears.

Q5: Phone frame is 393x852 with 48px controls, contained action rail, and internal sheet overflow.

Q6: Flip uses only `有把握 = confident / mint` and `再回看 = review / amber`; no module chooser or statistics blocker appears.
