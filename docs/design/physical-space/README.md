# Physical Space Artifacts

## 当前任务引用的 spec

- `spec/product-core.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`

## Purpose

This folder holds accepted physical-space design artifacts.

These artifacts are required before implementing Space UI or any UI that changes the user's understanding of library / group / box / card hierarchy, current-card address, box inspection, favorite tag, sleep zone, wake action, or Learning to Space continuity.

## Accepted Artifacts

- `space-model-v1.md`: Space hierarchy, allowed operations, favorite tag semantics, sleep/wake transition, and Learning <-> Space continuity model.
- `../directions/space-surface-visual-directions-v1.md`: Space visual direction set; accepts `Box Desk` as the primary Space visual direction.
- `../mocks/space-surface-visual-proof-v1.md`: rendered Space visual proof for box focus, inspect, favorite tag, sleep zone, wake, and return-to-Learning states.
- `../mocks/space-surface-visual-refinement-v1.md`: refined implementation-facing `Box Desk` Space visual baseline with region mapping and containment stress proof.
- `../mocks/space-surface-shelf-desk-v1.md`: accepted shelf-desk Space visual baseline promoted from design search, with parent shelf, open box tray, contained cards, sleep alcove, and Learning continuity.

## Required Contents

Each artifact must state:

- spatial model and hierarchy;
- current object and parent context;
- allowed user operations;
- disallowed operations and why;
- favorite tag semantics;
- sleep / wake state transition;
- Learning to Space and Space to Learning continuity;
- visual proof that Space is not a flat list, dashboard, or favorite/sleep two-box shortcut.

## Authority Boundary

Physical-space artifacts do not override `spec/knowledge-map.json`, `spec/space-operations.json`, or `spec/box-catalog.json`. If ownership or operation rules change, update the owner spec first.
