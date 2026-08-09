# Design Decisions

Decisions record the selected direction and the reasons rejected alternatives did not win.

Implementation work should reference a decision when a direction has been accepted.

## Accepted Decisions

- `learning-space-direction-decision-v1.md`: accepts the Addressed Exam Object direction.
- `learning-card-rhythm-decision-v1.md`: accepts the Guided Addressed Card Rhythm for Learning state sequencing.
- `learning-audio-control-decision-v1.md`: accepts the Attached Listening Chip for explicit, card-bound audio playback.
- `learning-space-platform-layout-v1.md`: accepts phone / tablet / pc web layout separation for Learning and Space.
- `pc-web-core-surface-decision-v1.md`: accepts the Focused Workbench direction for PC Web Learning, Space, Statistics, Mine, authentication, and membership-gate surfaces.

## Protected Governance Decisions

- `mobile-ux-checkpoint-layering-decision-v1.md`: accepts the six-checkpoint
  topology and Batch 1 owner/matrix/manifest-preparation boundary only when the
  exact head of pull request `#484` containing the record passes the protected
  `formal-product-owner-approval` environment. It permits no evidence collection
  and does not accept architecture evidence, a visual direction, implementation,
  native behavior, release, or leadership readiness.

## Explicitly Rejected / Non-Authority

- `mobile-core-surface-reset-v1.md`: product-owner vetoed on 2026-08-08; the
  former design-only promotion is revoked and cannot authorize mobile RN work.
- `mobile-editorial-study-object-v2.md` on closed, unmerged PR `#481`: never
  accepted and subsequently vetoed; it is not present on `main` and must not be
  recovered from its branch as implementation authority.

The binding record is
`../rejected/mobile-visual-directions-product-owner-veto-2026-08-08.md`.
