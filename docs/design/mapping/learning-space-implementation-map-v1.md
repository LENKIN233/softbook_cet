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
- `docs/design/decisions/learning-space-platform-layout-v1.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/physical-space/space-model-v1.md`
- `docs/design/directions/space-surface-visual-directions-v1.md`
- `docs/design/mocks/learning-space-phone-frames-v1.md`
- `docs/design/mocks/space-surface-visual-proof-v1.md`
- `docs/design/mocks/space-surface-visual-refinement-v1.md`
- `docs/design/storyboards/learning-space-motion-prototype-v1.md`

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

### Space Region Mapping

Future `apps/mobile/src/space/SpaceSurface.tsx` implementation should map the accepted `Box Desk` direction:

- parent context region -> library / group breadcrumb;
- current object region -> current box focus;
- contained object region -> card tiles and sibling cards;
- state region -> favorite tag, sleep zone, and wake action;
- continuity region -> return to Learning with current context.

For visual fidelity, consume `docs/design/mocks/space-surface-visual-refinement-v1.md` as the refined rendered baseline after it is merged:

- address ladder -> compact `library / group / box` path, not a module picker;
- box object plane -> first-read current box object with one reading-coral accent edge;
- card rail -> contained card objects with favorite / sleep tags attached to cards;
- quiet tray -> sleep / wake state under the same box;
- continuity strip -> return to Learning with preserved context;
- floating tab capsule -> top-level navigation chrome that does not replace Space hierarchy.

## Resolved Design Proof Questions

The previous design-proof questions are now closed by accepted artifacts:

- exact phone-frame mock for accepted Learning direction: `docs/design/mocks/learning-space-phone-frames-v1.html`;
- exact phone-frame mock for accepted Space direction: `docs/design/mocks/learning-space-phone-frames-v1.html`;
- expanded Space visual direction and state proof: `docs/design/mocks/space-surface-visual-proof-v1.html`;
- refined accepted Space visual baseline: `docs/design/mocks/space-surface-visual-refinement-v1.html`;
- tablet layout decision: `docs/design/decisions/learning-space-platform-layout-v1.md`;
- pc web layout decision: `docs/design/decisions/learning-space-platform-layout-v1.md`;
- dark-mode rendering proof: `docs/design/mocks/learning-space-phone-frames-v1.md`;
- accessibility contrast proof for low-alpha library chips: `docs/design/mocks/learning-space-phone-frames-v1.md`;
- rendered motion prototype for flip / hint reveal / swipe: `docs/design/storyboards/learning-space-motion-prototype-v1.html`.

## Remaining Implementation Boundary

RN / Web implementation has not started in this mapping PR. Future implementation PRs still must name the accepted artifact being implemented, map component regions to this file, declare any implementation-only gaps, and pass the PR design gate.

## Design Review Checklist Answers

Q1: Future PRs must name the current library per screen and prove Law of One. This mapping uses no single rendered library.

Q2: Focal object is the current addressed card for Learning and the current box/card location for Space.

Q3: Mapping requires all five canonical Learning silhouettes and calls out that icon swaps are insufficient.

Q4: Mapping rejects forbidden patterns and does not introduce visual CSS or RN styling.

Q5: Phone-frame containment is resolved by `docs/design/mocks/learning-space-phone-frames-v1.html`.

Q6: Learning and flip constraints are explicitly mapped.
