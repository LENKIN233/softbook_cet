# Interaction + Motion Artifacts

## 当前任务引用的 spec

- `spec/product-core.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`

## Purpose

This folder holds accepted interaction and motion artifacts for core product interactions.

These artifacts are required before implementing Learning or other core interaction UI when the implementation changes operation shape, feedback, failure state, transition, or micro-animation.

## Accepted Artifacts

- `learning-core-interactions-v1.md`: Learning core interaction operation, feedback, failure, motion, interruptibility, and reduce-motion contract for `flip`, `multiple_choice`, `lock`, `elimination`, `swipe`, and `hint_layer`.
- `learning-card-rhythm-v1.md`: Learning single-card place -> focus -> support -> resolve -> settle -> continue rhythm, including user-facing state boundaries that prevent implementation metadata from entering the UI.

## Required Contents

Each artifact must state:

- target interaction: `flip`, `multiple_choice`, `lock`, `elimination`, `swipe`, or `hint_layer`;
- operation model;
- feedback model;
- failure / recovery state;
- motion intent and timing range;
- interruptibility and reduce-motion fallback;
- how the motion preserves low-burden CET learning rather than becoming decoration.

## Authority Boundary

Interaction + motion artifacts do not override `spec/interactions.json`. If the interaction contract changes, update the owner spec first.
