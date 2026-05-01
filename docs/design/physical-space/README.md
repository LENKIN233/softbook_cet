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
