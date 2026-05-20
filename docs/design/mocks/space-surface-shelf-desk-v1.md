# Space Surface Shelf Desk v1

## 当前任务引用的 spec

- `spec/product-core.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/search-runs/README.md`
- `docs/design/physical-space/space-model-v1.md`
- `docs/design/search-runs/2026-05-10-space-desk-evolution/promotion-record.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`

## Rendered Asset

- `docs/design/mocks/space-surface-shelf-desk-v1.html`

## Product Truth

Space remains a top-level physical hierarchy. Every card keeps owning-container relationship. Favorite is a tag on a card object, sleep is a physical state under the owning container, and returning to Learning preserves the addressed object context.

This artifact does not authorize new Space operations and does not change `spec/knowledge-map.json`, `spec/space-operations.json`, or `spec/box-catalog.json`.

## Implementation Hypothesis

This artifact accepts the `space-04` synthesis from `docs/design/search-runs/2026-05-10-space-desk-evolution/` as the next Space visual baseline. It extends `docs/design/mocks/space-surface-visual-refinement-v1.md` by making parent shelf context, open current box tray, contained cards, sleep alcove, and Learning continuity visible in one phone proof.

This is design-only authority. Future RN or Web implementation must still name this artifact, map implementation regions to `docs/design/mapping/learning-space-implementation-map-v1.md`, and declare unimplemented gaps in the PR body.

## Search Provenance

- Source search run: `docs/design/search-runs/2026-05-10-space-desk-evolution/`
- Winning candidate: `space-04`
- Rendered search proof: `docs/design/search-runs/2026-05-10-space-desk-evolution/rendered-proof.html`
- Promoted fragments:
  - `space-03`: secondary shelf spine for parent context and wider-device adaptation.
  - `space-05`: quiet sleep alcove and lift-back wake causality.
  - `space-02`: card inspect may inform future secondary state only when parent box remains visible.

## Visual Frames

- `Shelf Desk Primary`: address shelf, open current box tray, contained cards, attached favorite tag, sleep alcove, and return to Learning.
- `Sleep / Wake Causality`: sleeping cards lower into the alcove under the same box; wake lifts them back without changing ownership.
- `Learning Continuity`: return action points back to the same addressed Learning flow, not to module selection.

## Accepted Claims

- The current box tray is the first-read object.
- The shelf is secondary parent context, not a module picker.
- Cards are contained objects inside the current box, not equal top-level cards.
- Favorite is rendered as a tag attached to a card object.
- Sleep is rendered as an alcove under the current box, never as a second box, archive, or deletion.
- The display accent is the only strong library accent.
- Mint and amber may appear only as state feedback families, not as alternate library identity.

## Implementation Mapping Delta

Future `apps/mobile/src/space/SpaceSurface.tsx` work should map this accepted artifact as:

- address shelf -> library / group / box breadcrumb and sibling context;
- open box tray -> current object region and first-read focal object;
- contained card strip -> active card and sibling card objects;
- favorite tag -> card state badge, not a container;
- sleep alcove -> sleep / wake state region under owning-container relationship;
- return strip -> Learning continuity with preserved context;
- floating top-level chrome -> navigation affordance that remains secondary to the Space object.

## Unimplemented Gaps

- This artifact does not implement RN or Web.
- Tablet and pc web versions still require rendered proof before implementation.
- Loading, empty, remote-error, permission, and paywall Space states remain outside this artifact.
- Card inspect transition needs storyboard evidence before implementation changes motion or operation shape.
- This is not a Figma component library and does not define final production component names.

## Design Review Checklist Answers

Q1: Current library is represented by the anonymous current-library slot. The display accent is the single strong accent for the address chip, current box edge, and primary return action.

Q2: Focal object is the open current box tray. First-read path is address shelf -> box tray -> contained cards -> sleep alcove -> return to Learning.

Q3: Space is not a Learning interaction silhouette. Its required silhouette is physical hierarchy with parent context, current box focus, contained card objects, favorite tag, sleep alcove, and return continuity.

Q4: No forbidden patterns are introduced: no gradient text, no gamification reward chrome, no full-width bottom tabbar replacement, no removed self-assess tokens, and no serif dependency.

Q5: The rendered asset is constrained to a `393 x 852` phone frame. Candidate text and actions remain contained, and the primary return action is not clipped.

Q6: This is Space-only. It does not alter flip self-assess, stats numerals, or Learning's system-sequenced path.
