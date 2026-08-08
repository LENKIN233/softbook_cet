# Mobile Core Surface Reset Implementation Map v1

> **Lifecycle: `rejected_non_authority`.** This historical mapping is blocked
> from implementation by
> `docs/design/rejected/mobile-visual-directions-product-owner-veto-2026-08-08.md`.
> Its prior future-facing instructions are retained only as failure evidence.

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

This map no longer authorizes implementation, alone or in combination with its
former decision and proof. Future mobile implementation PRs must not reference
it as their design source.

## Implementation Hypothesis

Historical, now rejected: restructure the mobile app around this shared object
grammar rather than separately polishing each screen.

## Historical App Shell Mapping

| Region | Historical design role | Then-targeted code surface (revoked) |
|---|---|---|
| Floating top context | quiet current route and active library context | mobile shell around `LearningSurface`, `SpaceSurface`, statistics, and mine surfaces |
| Floating nav capsule | top-level Learning / Space / Statistics / Mine navigation without full-width bottom tabbar | mobile app navigation shell |
| Page background | Aurora Glass atmosphere with one active library accent where applicable | mobile visual token layer |

## Historical Learning Mapping

| Region | Historical design role | Then-targeted code surface (revoked) |
|---|---|---|
| Current object plane | one addressed current card as the focal object | `apps/mobile/src/learning/LearningSurface.tsx` |
| Action plane | interaction-specific operation area beneath or attached to the card | `LearningSurface` interaction branches |
| Tool plane | hint, peek, favorite as secondary attached tools | `LearningSurface` tool controls |
| Address aperture | compact library / group / box / card context | Learning state model plus Space continuity link |

## Historical Detail Mapping

| Region | Historical design role | Then-targeted code surface (revoked) |
|---|---|---|
| Resolved object | same card object after answer | `LearningSurface` result state |
| Answer slip | explanation, correctness, and recovery attached to object | result-detail substate in Learning flow |
| Continue CTA | primary next-card continuation | Learning progression action |

The revoked mapping treated Detail as a resolved current-object state rather
than a separate report page or vertical article.

## Historical Space Mapping

| Region | Historical design role | Then-targeted code surface (revoked) |
|---|---|---|
| Address shelf | current library / group / box path | `apps/mobile/src/space/SpaceSurface.tsx` |
| Current box | first-read physical container | `SpaceSurface` current focus |
| Contained cards | active and sibling card objects | `SpaceSurface` card tiles |
| Tag and sleep state | favorite as tag, sleep as zone | Space state UI and supported operations |
| Return path | continue Learning from current context | Space to Learning transition |

## Historical Statistics Mapping

| Region | Historical design role | Then-targeted code surface (revoked) |
|---|---|---|
| Daily object | quiet learning-day state | statistics surface |
| Ledger rows | tabular numbers with low visual weight | statistics list/table components |
| No primary dashboard | stats do not compete with Learning | route-level composition |

## Historical Mine Mapping

| Region | Historical design role | Then-targeted code surface (revoked) |
|---|---|---|
| Account object | login and membership state as one quiet card | mine/profile surface |
| Account rows | phone, membership, restore purchase, route status | profile/account controls |
| Membership action | clear but non-invasive primary command | membership entry |

## Historical Evidence Expectations

- Real simulator screenshots for Learning, Detail, Space, Statistics, and Mine.
- Explicit gap table comparing RN output to `docs/design/mocks/mobile-core-surface-reset-v1.html`.
- Confirmation that no user-visible internal language appears in screenshots.
- Confirmation that Learning remains one-screen and does not require vertical scrolling for the main task.
- Confirmation that Space preserves library / group / box / card hierarchy.

## Historical 2026-08-01 Implementation Evidence (Revoked As Authority)

- At that time, `apps/mobile/App.tsx` stopped telling an unknown signed-out user
  that a card, box position, or daily rhythm had already been retained. The
  then-implemented account object said that account state would be read after
  verification and distinguished an existing account from a new account.
- At that time, the first authenticated counted entry started
  `trial_available -> trial` automatically. Local mode updated immediately;
  remote mode waited for validated account state, used the authenticated
  membership repository, and preserved the existing queued-retry/server-ack
  boundary.
- `apps/mobile/__tests__/App.test.tsx` historically covered local automatic
  start, remote automatic start with authorization, failed-start queue/replay,
  and the resulting five-card session.
- A historical iOS simulator run at the then-used phone frame rendered the
  neutral auth object without horizontal overflow, clipped CTA, or covered
  navigation. The screenshot remained local evidence and was not committed as
  ordinary Git content.

Those observations described the then-implemented state only. The decision,
mock, mapping, evidence, and checklist below are now revoked as visual
authority; none authorizes or constrains future user-visible UI.

## Historical Design Review Checklist Answers (Revoked)

Q1: The historical checklist answer said the active library should be named per
screen and one coral accent should remain dominant. This answer is revoked.

Q2: The historical checklist answer identified object -> attached state ->
chrome as its focal hierarchy. This answer is revoked.

Q3: The historical checklist answer used a Learning current-card silhouette and
a Space hierarchy silhouette. This answer is revoked.

Q4: The historical checklist answer claimed avoidance of then-forbidden patterns
and removed self-assess tokens. This answer is revoked.

Q5: The historical checklist answer relied on simulator screenshots for phone
containment. This answer is revoked.

Q6: The historical checklist answer kept Learning system-sequenced, Statistics
tabular, and flip self-assessment at two states. This answer is revoked.
