# Mobile Editorial Study Object v2 Mapping

## 当前任务引用的 spec

- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`

## Design Artifact Source

- `docs/design/decisions/mobile-editorial-study-object-v2.md`
- `docs/design/mocks/mobile-editorial-study-object-v2.html`
- `docs/design/search-runs/2026-08-07-mobile-editorial-reset/`

## Authority Boundary

This is a future implementation map only. It becomes consumable by an RN implementation PR after the v2 decision is explicitly accepted and merged as design-only authority.

## Mobile Shell Mapping

| Design region | Future code surface | Mapping requirement |
|---|---|---|
| warm editorial canvas | `apps/mobile/App.tsx` palette/backdrop | no decorative aurora blobs competing with the card |
| quiet route header | phone/tablet shell | route and round progress only; account chip leaves the Learning focal field |
| route rail | phone nav | active state is a small mark, not a large filled pill |
| tablet gutter | tablet shell | dedicated tablet composition, not enlarged phone layout |

## Learning Mapping

| Design region | Future code surface | Mapping requirement |
|---|---|---|
| tall current object | `apps/mobile/src/learning/LearningSurface.tsx` | roughly 60% usable height at default type size |
| identity margin | Learning card chrome | current library hue, with horizontal large-text fallback |
| card body | interaction branches | preserve each canonical silhouette inside the object |
| attached action edge | flip/submit controls | one primary operation physically belongs to the card |
| reverse explanation | flip/result state | same object, not a separate report panel |
| self-assess edge | flip only | exactly 有把握 / 再回看; mint/amber semantics |

## Space Mapping

| Design region | Future code surface | Mapping requirement |
|---|---|---|
| address path | `apps/mobile/src/space/SpaceSurface.tsx` | library/group/box path remains visible |
| cabinet | Space hierarchy layout | nested compartments, not a flat card list |
| current-card marker | current box state | marker sits inside its owning box |
| return command | Space → Learning transition | restores current learning position |

## Accessibility Mapping

- At font scale ≥ 1.3, replace the vertical identity rail with a horizontal band.
- Keep primary operation after the content in normal flow; do not absolutely pin it over text.
- At font scale 2.0, allow object-level vertical scrolling and keep navigation outside the scrolling object.
- Preserve 44px minimum targets and AA contrast against the computed paper surface.

## Unimplemented Gaps

- No RN code is changed by the design-only proposal.
- Tablet rendered proof is required before implementation.
- Statistics and Mine editorial variants remain follow-up artifacts.
- Motion frames for the margin-preserving flip require a storyboard update after acceptance.
