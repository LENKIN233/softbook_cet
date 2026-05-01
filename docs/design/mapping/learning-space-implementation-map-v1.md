# Learning + Space Implementation Map v1

## 当前任务引用的 spec

- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`

## Design Artifact Source

- `docs/design/design-harness.md`
- `docs/design/briefs/learning-space-worldview.md`
- `docs/design/directions/learning-surface-3-directions.md`
- `docs/design/decisions/learning-space-direction-decision-v1.md`

## Product Truth

This map does not authorize implementation by itself. It maps accepted design decisions to code surfaces so future implementation PRs do not invent user-facing design inside RN.

## Implementation Hypothesis

Current RN files are behavior prototypes. They can provide interaction and state evidence, but they do not define final user-facing visual design.

## Code Surface Ownership

| Product Surface | Current Code Surface | Design Obligation |
|---|---|---|
| Learning current card | `apps/mobile/src/learning/LearningSurface.tsx` | Render the current card as an addressed exam object, not a generic card shell. |
| Learning interaction area | `apps/mobile/src/learning/LearningSurface.tsx` | Preserve interaction-specific silhouettes for flip, multiple choice, lock, elimination, and swipe. |
| Learning tools | `apps/mobile/src/learning/LearningSurface.tsx` | Keep `peek`, `hint`, and `favorite` visible but secondary. |
| Learning address aperture | `apps/mobile/src/learning/LearningSurface.tsx` | Show light library/group/box context without turning module selection into the primary path. |
| Space hierarchy | `apps/mobile/src/space/SpaceSurface.tsx` | Render library / group / box / card as spatial hierarchy, not flat list or two-box shortcut. |
| Favorite state | `apps/mobile/src/space/SpaceSurface.tsx` and learning tag affordance | Treat favorite as tag state, never as a physical box. |
| Sleep state | `apps/mobile/src/space/SpaceSurface.tsx` and contextual learning affordance | Treat sleep as a physical zone affecting learning flow. |

## Required Implementation Mapping In Future PRs

Any future PR changing user-facing Learning or Space UI must state:

- which accepted artifact is being implemented;
- which component region maps to current object plane;
- which component region maps to action plane;
- which component region maps to tool plane;
- which component region maps to address aperture or Space continuation;
- which interaction silhouettes are implemented;
- which design gaps remain.

## Minimum Visual Contract For Learning

### Current Object Plane

RN should expose one main visual container for the current card object. It must not be decomposed into many equal cards, panels, counters, and modules.

### Action Plane

RN should branch by interaction type at the shape level:

- flip: card object + bottom two-pill self-assess.
- multiple choice: prompt + 2x2 option grid.
- lock: vertical lock rows.
- elimination: candidate set with strike-through affordance.
- swipe: top card with left/right trail hints.

Changing only icons or button labels is not enough to satisfy interaction silhouette requirements.

### Tool Plane

Tools should be visually lighter than the primary interaction:

- `peek` can be a small object-side affordance.
- `hint` can reveal a layer attached to the object.
- `favorite` can be a tag mark.
- `sleep` should remain contextual and spatial.

### Address Aperture

Address context should be visible as a compact spatial clue:

```text
track / library / group / box
```

It should not become a module picker.

## Minimum Visual Contract For Space

Space implementation must preserve:

- visible hierarchy;
- current card or current box focus;
- box contents;
- favorite tag state;
- sleep zone and wake action;
- return path to Learning.

It must not reduce Space to:

- favorites box + sleep box;
- flat card list;
- study statistics board;
- arbitrary drag-and-drop organizer.

## Unimplemented Design Gaps

These gaps must be closed before a full visual implementation can be called done:

- exact phone-frame mock for accepted Learning direction;
- exact phone-frame mock for accepted Space direction;
- tablet layout decision;
- pc web layout decision;
- dark-mode rendering proof;
- accessibility contrast proof for low-alpha library chips;
- motion proof for flip / hint reveal / swipe with reduce-motion fallback.

## Design Review Checklist Answers

Q1: Future PRs must name the current library per screen and prove Law of One. This mapping uses no single rendered library.

Q2: Focal object is the current addressed card for Learning and the current box/card location for Space.

Q3: Mapping requires all five canonical Learning silhouettes and calls out that icon swaps are insufficient.

Q4: Mapping rejects forbidden patterns and does not introduce visual CSS or RN styling.

Q5: Not applicable here because no rendered phone frame is included.

Q6: Learning and flip constraints are explicitly mapped.
