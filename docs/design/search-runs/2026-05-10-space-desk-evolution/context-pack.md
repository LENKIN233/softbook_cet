# Space Desk Evolution Context Pack

## 当前任务引用的 spec

- `spec/product-core.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/search-runs/README.md`
- `docs/design/physical-space/space-model-v1.md`
- `docs/design/mocks/space-surface-visual-refinement-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`

## Surface

Space surface, phone first, target proof frame `393 x 852`. The run focuses on the first Space screen after returning from Learning while the current display context is 馆 1 / 组 1 / 盒 1.

## Accepted Baseline

Accepted baseline: `docs/design/mocks/space-surface-visual-refinement-v1.md` and rendered baseline `docs/design/mocks/space-surface-visual-refinement-v1.html`.

The baseline already establishes `Box Desk`: address ladder -> current box object -> contained card rail -> sleep tray -> return to Learning. This run tries to beat that baseline on first-read clarity, physical hierarchy, sleep/favorite comprehension, and implementation mapping without changing product truth.

## Product Truth

- Softbook CET is a CET4/6 preparation product, not a general English dashboard or focus-area-only tool.
- Space is a top-level physical hierarchy: `library -> group -> box -> card`.
- Every card keeps original knowledge ownership; the user may inspect, tag favorite, sleep, wake, and return to Learning, but may not arbitrarily rewrite box ownership.
- Favorite is a tag on a card object, not a physical favorite box.
- Sleep is a physical zone under the same ownership context and affects Learning eligibility; it is not deletion, archive, or a second box.
- Learning remains system-sequenced; Space should preserve continuity back to the same addressed object or the next eligible card.
- Current library is represented by the anonymous current-library slot; the display accent is the only strong accent in the proof.
- A search run is pre-acceptance evidence only. It does not authorize same-PR RN or Web implementation.

## Hard Constraints

- Preserve a visible three-layer Space hierarchy before any card state: library/group context, current box focus, card objects or state zones.
- Use one strong library accent bound to current. Other colors may only be low-weight state or neutral material.
- Reject any candidate that reduces Space to a flat card list, statistics board, module picker, favorite box plus sleep box, arbitrary organizer, or generic flashcard collection.
- Reject any candidate that hides the current box behind chrome, counters, decorative maps, or unrelated progress widgets.
- Preserve accepted implementation authority: candidates may reference `SpaceSurface.tsx` mapping regions but may not define production component APIs.
- Rendered proof must fit a constrained phone frame without clipped primary actions or hidden hierarchy.

## Soft Objectives

- 35% physical-space distinctiveness: the user should feel a box and its contained cards, not a list.
- 25% first-read clarity: current box and next action should be obvious after a squint test.
- 15% CET trust: the surface should feel like exam material storage, not a game inventory.
- 10% low-burden return: returning to Learning should be visible but not overpower the Space hierarchy.
- 10% implementation feasibility: regions should map to existing `SpaceSurface.tsx` obligations.
- 5% platform extensibility: the structure should plausibly adapt to tablet and pc web without becoming a dashboard.

## Source Artifacts

- `docs/design/physical-space/space-model-v1.md`
- `docs/design/directions/space-surface-visual-directions-v1.md`
- `docs/design/mocks/space-surface-visual-proof-v1.md`
- `docs/design/mocks/space-surface-visual-refinement-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `docs/design/decisions/learning-space-platform-layout-v1.md`
- `spec/visual-language.json`
- `spec/product-core.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`

## Forbidden Drift

- Statistics-first Space where progress charts become the focal object.
- Favorite and sleep represented as two physical boxes.
- Module-first browse screen that asks the user to choose a learning module before seeing the current object.
- Decorative galaxy, globe, mind map, or floating node field that hides `library -> group -> box -> card`.
- Current card detail page with no parent box and no sibling card context.
- Bottom navigation or chrome that visually replaces the Space object.
- Any rendered proof that relies on post-implementation screenshots as design authority.

## Candidate Budget

Population size: 8 candidates in generation 1. Hard filter all 8, run pairwise reviews across every survivor with one connected comparison graph, harvest fragments, apply one targeted mutation, and promote at most one candidate or synthesis. Human checkpoint: stop after one generation if a survivor beats the accepted baseline on physical hierarchy and first-read clarity without regressing implementation authority.
