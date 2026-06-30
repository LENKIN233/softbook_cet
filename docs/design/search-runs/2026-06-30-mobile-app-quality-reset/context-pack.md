# Mobile App Quality Reset Context Pack

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/visual-language.json`
- `spec/perturbation-audit.json`
- `docs/design/canon.md`
- `docs/design/design-harness.md`
- `docs/design/single-card-ux-contract.md`

## Surface

Phone app core surface reset for the real mobile app at 393 x 852: app shell, Learning current card, Learning result detail, Space, Statistics, and Mine. The run treats the current simulator screenshots as implementation evidence to beat, not as design authority.

## Accepted Baseline

Baseline to beat:

- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `docs/design/mocks/learning-space-phone-frames-v1.md`
- `docs/design/mocks/learning-card-rhythm-v1.md`
- `docs/design/mocks/space-surface-shelf-desk-v1.md`
- `docs/design/physical-space/space-state-baseline-v1.md`
- Current real app screenshot evidence under `docs/design/app-screenshots/current-real-app/`

The baseline word is used deliberately: accepted Learning and Space artifacts remain authority, while the current real app screenshot set is a visual-fidelity baseline that must be surpassed.

## Product Truth

- 软书四六级 helps Chinese college students pass 四六级 with lower burden and higher trust, not a general English learning dashboard.
- Learning is a system-sequenced single-card flow. The user should operate one current card, one primary task, bounded secondary tools, feedback, recovery, and Learning to Space continuity.
- The top-level app structure remains Learning / Space / Statistics / Mine, but Learning is the strongest entry.
- Physical Space is a core differentiator: library / group / box / card must be visible as spatial hierarchy, and favorite is a tag rather than a physical box.
- User-facing UI requires an accepted design artifact before RN implementation treats it as shippable.
- Existing RN screens are behavior prototypes and smoke evidence; they do not define final user-facing visual design.

## Hard Constraints

- P-32: no direct implementation from RN code or agent taste.
- P-33: no same-PR task-local brief as authority for user-facing implementation.
- P-34: core interaction motion cannot be decorative; it must explain operation, feedback, failure, and state change.
- P-35: Space cannot be a normal list page; it needs a spatial model and state transitions.
- P-37 and P-38: no one-shot core-surface design promotion. Candidates, hard filter, pairwise comparison, fragment harvest, mutation, promotion evidence, and rendered proof are required.
- Law of One: one current library drives the single strong accent per screen.
- Learning cannot make module browsing the main path.
- Statistics must stay quiet and tabular; no achievement chrome.
- Flip self-assess remains exactly two choices: 有把握 = #22C58B mint and 再回看 = #F5B100 amber.
- No user-visible internal language such as agent, harness, validator, metadata, runtime, mock, prototype, seed, fixture, debug, dev, repo path, API route, raw exception, or TODO.

## Soft Objectives

- Make the app look like a finished mainstream mobile app rather than stacked documentation panels.
- Preserve CET trust: the screen should feel like a focused exam-prep companion, not a marketing page or toy.
- Enforce one-screen flow by moving excess information into progressive layers, attached slips, or object-level drill-in states instead of vertical page scrolling.
- Create a unified app grammar across Learning, Detail, Space, Statistics, and Mine.
- Make Space visibly different from Learning without breaking continuity.
- Keep implementation feasible for `apps/mobile/src/learning/`, `apps/mobile/src/space/`, and the top-level mobile shell.

## Source Artifacts

- `docs/design/design-harness.md`
- `docs/design/canon.md`
- `docs/design/visual-reference.html`
- `docs/design/single-card-ux-contract.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/physical-space/space-model-v1.md`
- `docs/design/physical-space/space-state-baseline-v1.md`
- `docs/design/mocks/space-surface-shelf-desk-v1.md`
- `docs/design/app-screenshots/current-real-app/auth.png`
- `docs/design/app-screenshots/current-real-app/learning.png`
- `docs/design/app-screenshots/current-real-app/detail.png`
- `docs/design/app-screenshots/current-real-app/space.png`
- `docs/design/app-screenshots/current-real-app/statistics.png`
- `docs/design/app-screenshots/current-real-app/mine.png`

## Forbidden Drift

- Do not keep tuning only `detail.png` while the app shell and flow remain wrong.
- Do not make a long vertical feed and call it one-screen flow.
- Do not turn Space into favorites plus sleep.
- Do not turn Statistics into a progress dashboard that competes with Learning.
- Do not make Mine a settings center that visually overwhelms learning.
- Do not use a design-search middle artifact as authority for same-PR RN implementation.

## Candidate Budget

Eight candidates are generated in one generation against this context pack. Four candidates are expected to survive hard filtering. Pairwise review uses a connected comparison graph across the survivors. Promotion can create a design-only accepted direction and implementation mapping expectation, but it does not authorize RN implementation in this PR.
