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
- `check-in-account-deletion-states-implementation-map-v1.md`: maps the accepted Statistics check-in and Mine account-deletion states to mobile and PC Web while keeping local, accepted-request, and completed-erasure facts distinct.
