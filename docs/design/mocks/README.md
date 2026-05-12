# Rendered Mock Artifacts

## 当前任务引用的 spec

- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/canon.md`
- `docs/design/visual-reference.html`

## Purpose

This folder holds accepted rendered screen mocks for core surfaces and states.

For core Learning or Space implementation work, prose direction alone is not enough to claim high-confidence visual quality. A rendered mock or equivalent external design file should close proportion, layout, hierarchy, containment, and visible-state questions before implementation.

## Accepted Artifacts

- `learning-space-phone-frames-v1.md`: phone-frame mock specification, dark-mode proof, and contrast proof.
- `learning-space-phone-frames-v1.html`: rendered `393 x 852` Learning and Space phone frames.
- `space-surface-visual-proof-v1.md`: Space-specific visual proof with three directions and accepted multi-state requirements.
- `space-surface-visual-proof-v1.html`: rendered Space visual direction set and accepted state frames for box focus, inspect, favorite tag, sleep, wake, and return to Learning.
- `space-surface-visual-refinement-v1.md`: refined accepted `Box Desk` Space visual稿 with implementation-facing regions and containment stress.
- `space-surface-visual-refinement-v1.html`: rendered refined Space phone frames for primary box desk, card inspect, sleep/wake, and long-content containment.
- `space-surface-shelf-desk-v1.md`: accepted Space shelf-desk mock promoted from `space-04` search evidence, with parent shelf, open box tray, contained cards, and sleep alcove.
- `space-surface-shelf-desk-v1.html`: rendered accepted Space shelf-desk phone proof.

## Required Contents

Each artifact must state:

- target surface, device class, and current library;
- source decision artifact;
- first-read path and focal object;
- screenshot or rendered asset reference;
- design review checklist answers;
- known unimplemented or unproven gaps.
