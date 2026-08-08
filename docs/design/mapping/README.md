# Implementation Mapping

Mapping documents translate accepted design artifacts into implementation plans.

Every user-facing UI implementation should state:

- accepted design artifact source
- surface and state coverage
- implementation mapping
- intentional deviations
- unimplemented design gaps

## Accepted Mappings

- `learning-audio-control-implementation-map-v1.md`: maps the accepted attached listening chip to verified cache, native playback, lifecycle, visible state, and accessibility surfaces.
- `pc-web-core-implementation-map-v1.md`: maps the accepted PC Web workbench artifact to a future, separate implementation PR without treating the design-only artifact as shipped behavior.
- `pc-web-core-implementation-evidence-v1.md`: records the separate PC Web implementation mapping, browser/automated evidence, design checklist, production-safe runtime boundary, and explicit remaining gaps.

## Explicitly Rejected / Non-Consumable Mappings

- `mobile-core-surface-reset-implementation-map-v1.md`: blocked by the
  2026-08-08 product-owner veto and retained only as historical evidence.
- `mobile-editorial-study-object-v2-map.md` from closed, unmerged PR `#481`:
  never became consumable because its candidate decision was not accepted and
  was later vetoed.

See
`../rejected/mobile-visual-directions-product-owner-veto-2026-08-08.md`.
