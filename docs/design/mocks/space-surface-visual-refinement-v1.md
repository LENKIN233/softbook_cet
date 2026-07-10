# Space Surface Visual Refinement v1

## 当前任务引用的 spec

- `spec/product-core.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/physical-space/space-model-v1.md`
- `docs/design/directions/space-surface-visual-directions-v1.md`
- `docs/design/mocks/space-surface-visual-proof-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`

## Rendered Asset

- `docs/design/mocks/space-surface-visual-refinement-v1.html`

## Product Truth

Space remains a top-level physical hierarchy. A card keeps its owning-container relationship. Favorite is a tag state, sleep is a spatial state, and return to Learning preserves context.

This artifact does not authorize new Space operations and does not change `spec/knowledge-map.json`, `spec/space-operations.json`, or `spec/box-catalog.json`.

## Implementation Hypothesis

This artifact refines the accepted `Box Desk` direction from `space-surface-visual-proof-v1`. It is a design-only visual baseline for the first Space RN implementation, not a product-rule owner.

The refinement keeps the same first-read path:

```text
library/group address -> current box object -> contained card objects -> favorite/sleep state -> return to Learning
```

## Harness Position

`space-surface-visual-proof-v1` closed the direction-selection gap by showing three competing Space directions and accepting `Box Desk`. This refinement is the next Delivery/Judgment harness layer: it turns the accepted direction into a higher-fidelity visual稿 with stronger material hierarchy, real containment stress, and implementation-facing regions.

It is not a same-PR authority for RN. Future implementation PRs may consume this artifact only after this design-only PR is merged.

## Visual Frames

- `Primary Box Desk`: parent address, current box object, contained card rail, sleep tray, and Learning return.
- `Card Inspect`: selected card expands without losing owning-container relationship.
- `Sleep / Wake`: sleeping card remains under the 同盒 and can return to learning-eligible flow.
- `Long Content Containment`: long group / box / card labels remain contained inside phone width.

## Refinement Claims

- Address is a visible ladder, not a module picker.
- Current box remains the first-read object; cards are contained objects, not equal top-level cards.
- Favorite is rendered as a card tag, never as a physical favorite box.
- Sleep is rendered as a lower quiet tray under the same current box, never as deletion, archive, or a second box.
- The display accent is the only strong library accent in these frames.
- Mint and amber appear only as state feedback families, not as alternate library accents.
- The long-content frame is a layout stress proof; future RN must preserve wrapping and safe-area containment.

## Implementation Mapping Delta

Future `apps/mobile/src/space/SpaceSurface.tsx` should map the refined frames as:

- top address ladder -> library / group / box breadcrumb;
- box object plane -> current box focus and exam-content trust;
- card rail -> contained cards and sibling cards;
- tag chip -> favorite state on a card object;
- lower quiet tray -> sleep / wake state;
- continuity strip -> return to Learning with preserved context;
- floating tab capsule -> existing top-level navigation without replacing Space hierarchy.

## Design Review Checklist Answers

Q1: Current library is represented by the anonymous current-library slot. The display accent is the single dominant accent across CTA, current object highlight, and selected Space chrome. Other library hues are not used as strong accents.

Q2: Focal object is the current box. First-read path is address ladder -> current box object -> contained cards / state tray -> Learning continuity -> top-level chrome.

Q3: Space is not one of the five Learning interaction silhouettes. Its required silhouette is physical hierarchy with current box focus, contained cards, favorite tag, sleep tray, and preserved return context.

Q4: No forbidden patterns are introduced: no gradient text, no gamification chrome, no full-width bottom tabbar replacement, no pure `#000` / `#fff` dependency, no removed self-assess tokens, and no serif dependency.

Q5: The rendered asset uses `393 x 852` phone frames and a narrow viewport media query. Long labels wrap, the floating tab capsule remains inside the safe area, and no CTA is clipped at target width.

Q6: This is Space-only. It does not alter flip self-assess, stats numerals, or Learning's system-sequenced path.

## Known Gaps

- This is design-only and does not change RN.
- It is not a Figma component library and does not define final production component names.
- Tablet and pc web Space layouts remain governed by `learning-space-platform-layout-v1`.
- Remote loading, permission, and paywall states still require separate product-aware visual artifacts before implementation.
