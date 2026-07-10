# Mobile Core Surface Reset Implementation Map v1

## 当前任务引用的 spec

- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/single-card-ux-contract.md`

## Design Artifact Source

- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/search-runs/2026-06-30-mobile-app-quality-reset/`
- `docs/design/mapping/learning-space-implementation-map-v1.md`

## Product Truth

This map does not authorize implementation by itself. Future implementation PRs must reference this mapping and an accepted artifact, declare gaps, and prove the result with real simulator screenshots.

## Implementation Hypothesis

The existing mobile app should be restructured around a shared object grammar rather than separately polishing each screen.

## App Shell Mapping

| Region | Design role | Future code surface |
|---|---|---|
| Floating top context | quiet current route and active library context | mobile shell around `LearningSurface`, `SpaceSurface`, statistics, and mine surfaces |
| Floating nav capsule | top-level Learning / Space / Statistics / Mine navigation without full-width bottom tabbar | mobile app navigation shell |
| Page background | Aurora Glass atmosphere with one active library accent where applicable | mobile visual token layer |

## Learning Mapping

| Region | Design role | Future code surface |
|---|---|---|
| Current object plane | one addressed current card as the focal object | `apps/mobile/src/learning/LearningSurface.tsx` |
| Action plane | interaction-specific operation area beneath or attached to the card | `LearningSurface` interaction branches |
| Tool plane | hint, peek, favorite as secondary attached tools | `LearningSurface` tool controls |
| Address aperture | compact library / group / box / card context | Learning state model plus Space continuity link |

## Detail Mapping

| Region | Design role | Future code surface |
|---|---|---|
| Resolved object | same card object after answer | `LearningSurface` result state |
| Answer slip | explanation, correctness, and recovery attached to object | result-detail substate in Learning flow |
| Continue CTA | primary next-card continuation | Learning progression action |

Detail must not be implemented as a separate report page or a vertical article. It is a resolved state of the current object.

## Space Mapping

| Region | Design role | Future code surface |
|---|---|---|
| Address shelf | current library / group / box path | `apps/mobile/src/space/SpaceSurface.tsx` |
| Current box | first-read physical container | `SpaceSurface` current focus |
| Contained cards | active and sibling card objects | `SpaceSurface` card tiles |
| Tag and sleep state | favorite as tag, sleep as zone | Space state UI and supported operations |
| Return path | continue Learning from current context | Space to Learning transition |

## Statistics Mapping

| Region | Design role | Future code surface |
|---|---|---|
| Daily object | quiet learning-day state | statistics surface |
| Ledger rows | tabular numbers with low visual weight | statistics list/table components |
| No primary dashboard | stats do not compete with Learning | route-level composition |

## Mine Mapping

| Region | Design role | Future code surface |
|---|---|---|
| Account object | login and membership state as one quiet card | mine/profile surface |
| Account rows | phone, membership, restore purchase, route status | profile/account controls |
| Membership action | clear but non-invasive primary command | membership entry |

## Required Future Implementation Evidence

- Real simulator screenshots for Learning, Detail, Space, Statistics, and Mine.
- Explicit gap table comparing RN output to `docs/design/mocks/mobile-core-surface-reset-v1.html`.
- Confirmation that no user-visible internal language appears in screenshots.
- Confirmation that Learning remains one-screen and does not require vertical scrolling for the main task.
- Confirmation that Space preserves library / group / box / card hierarchy.

## Design Review Checklist Answers

Q1: Future implementation must name the current library per screen and keep one strong accent. The reset proof uses the active library with coral.

Q2: Future implementation must identify the focal object for each surface and preserve object -> attached state -> chrome.

Q3: Future implementation must preserve Learning current-card silhouette and Space hierarchy silhouette.

Q4: Future implementation must avoid forbidden design patterns and removed self-assess tokens.

Q5: Future implementation must prove phone containment with simulator screenshots.

Q6: Future implementation must keep Learning system-sequenced, Statistics tabular, and flip self-assess exactly two states.
