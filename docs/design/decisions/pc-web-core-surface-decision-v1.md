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
3. Right context rail: current address, attached support, recovery, or one secondary action cluster.
4. Material state: review, audio, membership, and errors attach to the affected object rather than replacing the whole product with a generic page.

## Surface Decisions

### Auth

Before authentication, show a calm identity gate with phone SMS verification. Do not reveal an operable Learning shell behind it. Product value may be stated through object language, not marketing claims.

### Learning And Review

The current card owns the center workbench. The center region branches at shape level for flip, multiple choice, lock, elimination, and swipe. Review appears as an attached answer slip on the same object. Audio appears as an attached resource chip with ready, preparing, playing, paused, and recoverable states governed by the existing audio artifact.

### Space

Space deliberately changes the wide-screen composition: left becomes the library / group tree, center becomes the current box and contained cards, and right becomes the selected-object inspector. Favorite remains a card tag. Sleep/wake remains a physical state region under the owning box.

### Statistics

Statistics uses a quiet daily ledger and tabular numerals. It does not become the default home, achievement wall, or chart dashboard.

### Mine And Membership

Mine centers one account object with phone identity, membership state, purchase/restore, and sign-out controls. A membership interruption attaches to the current limited object and preserves enough Learning or Space context to explain why access is limited.

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
- Feedback: auto-scored interactions attach a concise result; flip alone exposes 有把握 / 再回看.
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

Accepted for design-only planning after the completed PC Web design search run. This decision does not authorize same-PR Web implementation.
