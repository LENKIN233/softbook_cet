# PC Web Core Surface Context Pack

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

## Surface

PC Web core application at a 1440 x 900 reference viewport: Auth, Learning, resolved review, the five core interaction silhouettes, audio as a card resource, Space, Statistics, Mine, and membership interruption. This is a dedicated pc-web composition, not a stretched phone frame.

## Accepted Baseline

The run extends, and must not regress:

- `docs/design/decisions/learning-space-platform-layout-v1.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/physical-space/space-model-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mocks/space-surface-shelf-desk-v1.html`

The baseline already decides the pc-web rails and object grammar in prose. This run must beat it by providing a contained, rendered, implementation-facing pc-web proof across the whole core surface set.

## Product Truth

- PC means Web at personal-computer scale, not a native desktop application.
- Top-level navigation is Learning / Space / Statistics / Mine in that order.
- Learning is a system-sequenced single-card flow; module selection and multi-card browsing are not the default entry.
- All five core interactions remain distinguishable by silhouette.
- Space visibly preserves library / group / box / card hierarchy, favorite as a tag, and sleep as a physical zone.
- Login is required before Learning, using phone SMS verification.
- Audio remains a resource attached to the current card, not an interaction family.
- Statistics and Mine support Learning without competing with it.
- Membership and purchase are available on Web without turning the application shell into marketing.

## Hard Constraints

- Use a persistent left navigation rail, a dominant center workbench, and a bounded right context rail at 1440 x 900.
- One current library supplies the only strong accent on Learning and its resolved states.
- Flip exposes exactly two self-assess choices: 有把握 = mint and 再回看 = amber.
- Multiple choice uses a prompt plus 2 x 2 option grid; lock uses vertical lock rows; elimination uses visible strike-through candidates; swipe shows exactly one top card with directional trails.
- Space uses a hierarchy rail, current box workbench, and selected-object inspector; it cannot become a table, dashboard, favorites box, or arbitrary organizer.
- Statistics uses tabular numerals and quiet ledger rows; no achievements, streak celebration, XP, or circular dashboard.
- No gradient text, serif type, full-width bottom navigation, reward chrome, or user-visible internal language.
- The design-only PR may create accepted artifacts; it must not include production Web implementation.

## Soft Objectives

- Make the wide viewport feel calmer and more focused than a mobile screen, not denser.
- Preserve exam-material trust and the feeling of manipulating one addressed knowledge object.
- Let keyboard and mouse hints improve efficiency without turning the right rail into a shortcut manual.
- Give Space greater simultaneous hierarchy visibility while keeping the current box as the first-read object.
- Provide a shared object grammar across Auth, Learning, review, Space, Statistics, Mine, and membership states.
- Keep the layout feasible for a future semantic HTML/CSS/React implementation with keyboard access and reduced-motion support.

## Source Artifacts

- `docs/design/canon.md`
- `docs/design/visual-reference.html`
- `docs/design/decisions/learning-space-platform-layout-v1.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/interaction-motion/learning-audio-control-v1.md`
- `docs/design/physical-space/space-model-v1.md`
- `docs/design/physical-space/space-state-baseline-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mocks/space-surface-shelf-desk-v1.html`

## Forbidden Drift

- Phone canvas centered inside empty desktop chrome.
- Dashboard-first home screen or module/library picker as the Learning entry.
- Several cards visible as equal primary work items.
- Space flattened into table rows, kanban columns, favorites, or sleep-only management.
- Right rail filled with counters, settings, shortcuts, or debug-like status.
- Paywall as a promotional landing page rather than a contextual interruption.
- Auth screen that exposes the rest of the application before identity is established.

## Candidate Budget

Eight materially different generation-one candidates share this context pack. Four may survive hard filtering. A connected three-edge pairwise graph covers the four survivors. One targeted synthesis may be promoted only after candidate-bound rendered comparison, fragment harvest, and mutation review. No production Web code is authorized by this run.
