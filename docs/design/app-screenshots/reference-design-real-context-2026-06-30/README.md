# Reference Design Real-Context Screenshot Pack

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`

## Purpose

This package converts the earlier leadership reference designs into real mobile screenshot dimensions so they can be reviewed as app screens instead of isolated design canvases.

## Source Designs

- `docs/design/mocks/leadership-screenshot-handoff-v2/home.png`
- `docs/design/mocks/leadership-screenshot-handoff-v2/card-list.png`
- `docs/design/mocks/leadership-screenshot-handoff-v2/detail.png`
- `docs/design/mocks/leadership-screenshot-handoff-v2/space.png`
- `docs/design/mocks/leadership-screenshot-handoff-v2/board.png`
- `docs/design/mocks/leadership-screenshot-handoff-v1/home.png`
- `docs/design/mocks/leadership-screenshot-handoff-v1/card-list.png`
- `docs/design/mocks/leadership-screenshot-handoff-v1/detail.png`
- `docs/design/mocks/leadership-screenshot-handoff-v1/space.png`

## Exported Screens

- `00-reference-pack-overview.png`: overview of the eight phone screens.
- `01-home-v2.png`: v2 home / current-card reference in phone screenshot dimensions.
- `02-learning-v2.png`: v2 card-list / in-box learning reference.
- `03-detail-v2.png`: v2 learning detail reference.
- `04-space-v2.png`: v2 knowledge-space reference.
- `05-home-v1.png`: earlier home reference in phone screenshot dimensions.
- `06-learning-v1.png`: earlier learning-card list reference.
- `07-detail-v1.png`: earlier detail reference.
- `08-space-v1.png`: earlier space reference.
- `09-space-board-landscape.png`: v2 multi-screen board in a desktop-style software window.

## Boundary

These are reference-design screenshots, not simulator captures from the current RN app. Future implementation work must still rebuild the real app to match the accepted design direction and then recapture simulator screenshots from the app runtime.
