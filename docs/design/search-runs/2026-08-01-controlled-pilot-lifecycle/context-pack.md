# Controlled Pilot Lifecycle Context Pack

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/membership.json`
- `spec/visual-language.json`
- `infra/cloudbase/controlled-pilot-v1-runtime-contract.md`
- `docs/design/design-harness.md`

## Surface

iOS and Android phone surfaces for the fixed pilot identity, first-valid-card notice, every-five-card completion object, and Mine entitlement state.

## Accepted Baseline

Extend `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, and `docs/design/interaction-motion/learning-card-rhythm-v1.md` without replacing their single-current-object grammar.

## Product Truth

- The visible identity is exactly “CET4 受控试点”; no exam-type selector or unavailable exam-type entry appears.
- Login, account browsing, invalid content, and failed session preparation do not start the trial.
- The notice appears only when the first valid Learning card is ready and remains secondary to that card.
- A round completes after five server-confirmed Learning or review events; the object offers only review, Space, and continue.
- The primary next step is “继续下一轮”; no score ring, task center, streak reward, or complex statistics appears.
- Mine shows server-authoritative start, end, remaining time, and pilot identity. The pilot is free and operationally granted; there is no purchase button.
- This is `controlled_pilot`, never formal beta, public release, or launch-ready evidence.

## Hard Constraints

- Preserve one focal knowledge object on Learning and one focal completion object after a round.
- Preserve the active library as the only strong Learning accent.
- Keep Space as library / group / box / card rather than flattening it into a saved list.
- Keep the first-card notice non-blocking, dismiss-free, and without a second primary action.
- Use exactly three completion destinations with one dominant continue action.
- Keep all phone proofs contained at 393 x 852 and compatible with enlarged text.
- This run is design-only; no RN implementation authority is created.

## Soft Objectives

- Make the start of a real 120-hour experience understandable in one read.
- Make the fifth-card pause feel like a card settling into the learner’s Space, not a gamified checkpoint.
- Make Mine trustworthy and operational without turning it into a billing dashboard.
- Keep weak-network and reduced-motion states calm and recoverable.

## Source Artifacts

- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/single-card-ux-contract.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `docs/design/physical-space/README.md`
- `docs/design/canon.md`

## Forbidden Drift

- Blocking welcome modal, tutorial carousel, or forced acknowledgement.
- Progress dashboard, score ring, countdown spectacle, or celebratory reward chrome.
- Four equal navigation doors after a round.
- Exam-type catalogue, unavailable option teaser, or purchase/premium upsell.
- Local entitlement calculation, visible backend fields, or internal process language.

## Candidate Budget

Eight materially different generation-one candidates, four hard-filter survivors, three pairwise reviews, one promoted synthesis, and one browser-inspected 393 x 852 proof. Product-owner approval remains a protected external checkpoint; this design run does not substitute for it.
