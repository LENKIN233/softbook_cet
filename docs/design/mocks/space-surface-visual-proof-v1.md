# Space Surface Visual Proof v1

## 当前任务引用的 spec

- `spec/product-core.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/physical-space/space-model-v1.md`
- `docs/design/directions/space-surface-visual-directions-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`

## Rendered Asset

- `docs/design/mocks/space-surface-visual-proof-v1.html`

Follow-up visual refinement:

- `docs/design/mocks/space-surface-visual-refinement-v1.md`
- `docs/design/mocks/space-surface-visual-refinement-v1.html`

## Product Truth

Space remains a top-level physical hierarchy. Favorite is a tag, sleep is a spatial state, and cards retain original library / group / box ownership.

This proof does not authorize new product operations and does not change `spec/space-operations.json`.

## Implementation Hypothesis

The accepted Space visual direction is `Box Desk`:

```text
library/group breadcrumb -> current box object -> contained card objects -> favorite/sleep state -> return to Learning
```

The rendered asset includes:

- three competing visual directions;
- accepted Direction B proof states;
- box inspect state;
- favorite tag state;
- sleep zone state;
- wake / return-to-Learning state.

## Visual Frames

### Direction Frames

- Direction A: Shelf Map.
- Direction B: Box Desk.
- Direction C: Operation Dock.

These are rendered as three phone frames in the HTML. They are not interchangeable skins; they carry different first-read paths and different failure risks.

### Accepted State Frames

- `Box Focus`: current box is the focal object and parent context stays visible.
- `Card Inspect`: a selected card remains inside its owning container.
- `Favorite Tag`: favorite is a tag on a card tile.
- `Sleep Zone`: sleeping card remains addressable under the same box.
- `Return To Learning`: Learning continuity is explicit and not a generic back button.

## Implementation Mapping

Future RN mapping should use:

- `apps/mobile/src/space/SpaceSurface.tsx` parent region -> `library / group` breadcrumb.
- current object region -> `current box focus`.
- contained objects region -> card tiles with favorite / sleep state markers.
- state region -> sleep zone and wake action.
- continuity region -> return to Learning with current context.

## Design Review Checklist Answers

Q1: Current library is represented by the anonymous current-library slot, and the display accent is the only dominant accent. Non-current context uses neutral chips and muted labels.

Q2: The focal object is the current box. The first-read path is parent context -> current box -> contained card states -> Learning continuity.

Q3: Space does not use a quiz interaction silhouette. It uses the physical-space silhouette required by `space-model-v1`: hierarchy, current box focus, contained cards, sleep zone, and return continuity.

Q4: No forbidden patterns are introduced: no gradient text, no gamification chrome, no full-width bottom tabbar replacement, no pure `#000` / `#fff` dependency, no self-assess token changes, no serif dependency.

Q5: The rendered proof uses phone-frame containment and state thumbnails that avoid horizontal overflow. Future RN implementation must preserve safe-area and avoid clipped CTA/nav at target phone width.

Q6: This is Space-only. It does not alter flip self-assess and does not expose module selection as Learning's primary path.

## Known Gaps

- This is design-only and does not change RN.
- Empty box, remote loading, and permission/error states are not fully visualized here.
- Tablet and pc web Space layouts remain future platform-adaptation work.
