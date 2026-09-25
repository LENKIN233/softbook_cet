# PC Web Core Surface Decision v1

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/membership.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/single-card-ux-contract.md`

## Product Truth

PC Web is a required release target and must carry the same core product capabilities as iOS and Android. It is not a stretched phone layout, a generic course catalogue, or a management dashboard. Learning remains a system-sequenced single-card flow; Space remains a visible physical hierarchy; Statistics and Mine remain supporting routes.

## Implementation Hypothesis

A 1440 x 900 reference workbench uses width to separate one current object from bounded context. Exact breakpoints, DOM structure, and component names remain implementation choices as long as the accepted focal hierarchy and interaction silhouettes survive.

## Decision

Adopt the `pcw-01` Focused Workbench synthesis from `docs/design/search-runs/2026-08-01-pc-web-core/`.

The shared PC Web grammar is:

1. Left route rail: Learning / Space / Statistics / Mine in the canonical order.
2. Center workbench: one route-specific focal object, never a grid of equal tasks.
3. Attached context: a quiet address above the paper and contextual help/actions on the object. The current light-studio decision allows a quiet, non-sticky address rail at wide Learning viewports; it disappears on narrow windows and never duplicates answer controls.
4. Material state: review, audio, membership, and errors attach to the affected object rather than replacing the whole product with a generic page.

## Surface Decisions

### Auth

For remote accounts, show a calm identity gate with phone SMS verification. The explicit device-local build instead starts with CET4/CET6 selection and never requests a phone number. Do not reveal an operable Learning shell behind it. Product value may be stated through object language, not marketing claims.

### Learning And Review

The current card owns the center workbench. The center region branches at shape level for flip, multiple choice, lock, elimination, and swipe. Review appears as an attached answer slip on the same object. Audio appears as an attached resource chip with ready, preparing, playing, paused, and recoverable states governed by the existing audio artifact.

Each new server selection starts at the question and beginning of its material,
even when the previous answer required a long scroll. An update to the same
selection preserves its reading position and draft. A supplied listening
transcript is collapsed under the resolved answer and can be opened explicitly;
it never appears before answering. A corrected lock attempt is completed with
“已解锁，稍后复习”, following the attempt assessment in `spec/interactions.json`.

For a resolved multiple-choice card, the attached slip explicitly labels the
learner's choice and the correct answer before the explanation. Show each option
label and full text; color is supplementary. No correct-answer disclosure appears
before resolution, and continuing removes the old card's comparison. This
correction follows the observed case where a wrong selection remained highlighted
without identifying the correct answer.

### Space

Space uses the wide surface as a shelf: a compact library strip, visible group regions containing sibling boxes, then the opened box and its cards. Card actions attach to the selected object without a repeated full-height inspector. Favorite remains a card tag. Sleep/wake remains a physical state region under the owning box.

The “当前学习” marker follows the Learning session card, independently of Space selection.
A selected non-current active card is labelled “正在浏览”; selection continues to drive the inspector and its highlight. Browsing another card or box does not change the Learning card, draft answer, resolved feedback, or session position.
The observed failure was that selecting a sibling moved “当前学习” to that sibling even though returning resumed the original card.

The shared help entry reveals separate hint and exam-tip actions; only requesting the content marks its existing assistance event. Audio appears after the front task/material and before answer choices. Long text remains intact and receives reading typography; long options stack. Space offers cross-box favorite and pending-review filters over the accessible catalog, with original addresses and a return to the owning box. Filtering never changes the Learning cursor.

### Statistics

Statistics uses a quiet daily ledger and tabular numerals. Daily completion is a count, never a fraction of the full catalog. Cumulative coverage is shown only from available complete history; the device-local v2 profile now persists history on both Web and native; account and device-local data retain separate authority. Normal saved state is quiet. It does not become the default home, achievement wall, or chart dashboard.
User-facing copy describes today's completed work and what needs revisiting;
it does not explain rejected design patterns or implementation choices.

### Mine And Membership

Mine centers one account object with phone identity, membership state, purchase/restore, and sign-out controls. A membership interruption attaches to the current limited object and preserves enough Learning or Space context to explain why access is limited.
The visible title is “我的账户”; object terminology belongs to the design model,
not the learner's account page.

## Input And Motion

- Mouse and keyboard preserve interaction meaning without forcing literal touch gestures.
- Shortcut hints remain secondary and are capped to the active interaction.
- Focus order follows route rail -> focal object -> primary action -> attached support -> context rail.
- Reduced motion replaces flip and swipe travel with discrete crossfade or directional choices.
- No hover-only action may be required to complete a core task.

## Rejected Directions

- Progress dashboard as the application center.
- Several equal current cards or modules in a study grid.
- Movable glass windows as knowledge space.
- Seven-library catalogue as the default Learning route.

These are recorded in `docs/design/rejected/pc-web-core-surface-failures-v1.md`.

## Single-Card UX Contract Answers

- Current card: one system-selected card in the center workbench.
- Primary task: perform the current interaction.
- Primary action: the interaction's own operation or the next-card continuation after resolution.
- Secondary actions: hint, peek, favorite, audio, and compact Space address in the right context rail or attached object layer.
- Feedback: auto-scored interactions attach a concise result; flip alone exposes 有把握 / 需要复习.
- Recovery: cancelled swipe returns to center; missing content or audio preserves the current object and offers a narrow retry; queued sync does not expose technical state.
- Learning to Space continuity: the right rail shows the owning address and opens the dedicated tree / box / inspector Space composition.

## Design Review Checklist Answers

Q1: The active library uses coral as the one dominant library accent in the Learning and Space reference frames. Other library colors appear only as low-weight dots in Space.

Q2: The focal object is route-specific: login card, current knowledge card, current box/selected card, daily ledger, account object, or the limited current object. The first-read path is object -> operation/state -> rails.

Q3: The rendered artifact proves five distinct Learning silhouettes and the Space hierarchy silhouette.

Q4: The decision rejects gradient text, serif type, reward chrome, full-width bottom navigation, removed self-assess tokens, dashboards, and user-visible internal language.

Q5: Not a phone proof. Frames are contained at 1440 x 900.

Q6: Flip has exactly two self-assess choices, Statistics uses tabular numerals, and Learning never promotes module selection.

## Status

The 2026-09-10 review revises this baseline with the current paper-and-shelf composition. Implementation and observed corrections proceed together under machine-acceptance experience acceptance.

## Interaction motion mapping

Card and flip transitions retain the outgoing object until the visual midpoint;
the real state update occurs once and can never be replayed by an animation.
Choice settling, lock opening, reversible strike drawing, attached help reveal,
and result appearance use separate motions. Keyboard and pointer actions share
the same transition path. Reduced motion and browsers without animation support
apply the state directly. Learning and its current Space card share visual
identity during navigation when View Transitions are available; older browsers
keep the same state and navigation behavior without a snapshot transition.
Only the card object is captured for the shared transition. Navigation and the
Space return action stay live while that object moves; the document snapshot
layer must not swallow a quick return click.
