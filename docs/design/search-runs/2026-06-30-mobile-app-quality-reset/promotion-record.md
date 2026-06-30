# Promotion Record

## Promoted Artifact

Promote `docs/design/decisions/mobile-core-surface-reset-v1.md` as the design-only direction and `docs/design/mocks/mobile-core-surface-reset-v1.html` as the rendered phone proof. Future implementation must consume `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`.

## Winning Candidate

`msr-01` wins as the base synthesis. It borrows answer-slip material from `msr-02`, compact Space address from `msr-03`, and primary-action discipline from `msr-04`.

## Baseline Comparison

Compared with the accepted Learning and Space baseline plus the current real app screenshots, `msr-01` beats the baseline on app-level coherence. It stops treating Detail as a separate report, makes the current card the persistent focal object, and makes Space continuity visible without turning Learning into module browsing. It does not yet solve all final typography and asset fidelity; that remains a future implementation gap.

## Borrowed Fragments

- `msr-02`: answer detail as an attached paper/glass slip with CET-trust density.
- `msr-03`: spatial address shelf showing library / group / box / card as context.
- `msr-04`: one primary operation and fewer equal-weight panels.

## Rejected Fragments

- `msr-05`: timeline as the main learning path.
- `msr-06`: dashboard metrics as the app center.
- `msr-07`: carousel-first Space browsing.
- `msr-08`: result report as the main page.

## Rendered Proof

Rendered proof:

- `candidate-proofs/mobile-reset-candidate-proof.html#msr-01`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`

## Implementation Mapping Expectations

Future RN implementation must map the app shell, current object plane, action plane, answer slip, Space address aperture, quiet ledger, Mine account card, and floating navigation capsule. It must not use this search run as same-PR authority for RN implementation.

## Unimplemented Gaps

- Final RN code is not changed in this PR.
- Exact motion timing remains governed by existing interaction/motion artifacts and future implementation verification.
- Final card content density must be checked against real payloads from the external content workspace without producing or approving content in this repo.
- Simulator screenshots must be recaptured after implementation to prove the design survived RN constraints.

## Failure Sedimentation

Failure patterns are recorded in `docs/design/rejected/mobile-core-surface-reset-failures-v1.md`. No spec mutation is required in this PR because the product truths already exist in `spec/product-core.json`, `spec/visual-language.json`, and `spec/perturbation-audit.json`.

## Design Review Checklist Answers

Q1: Current library is Reading for the promoted phone proof. Law of One is preserved: reading coral drives CTA, active edge, and detail emphasis; other subject colors are absent or quiet context only.

Q2: Focal object is the current study card. The first-read path is card object -> primary operation or answer slip -> Space address -> floating app chrome.

Q3: The promoted direction binds Learning to the current-card silhouette and preserves Space as an address aperture plus hierarchy preview rather than a generic card list.

Q4: No forbidden design patterns are used in the promoted proof: no gradient title, no achievement chrome, no full-width bottom tabbar, no serif typography, and no removed self-assess tokens.

Q5: The target is phone. The proof uses a 393px frame, respects safe-area spacing, and keeps the floating capsule clear of CTA and content.

Q6: Learning remains system-sequenced; module selection is not the main path. Flip self-assess remains two states, 有把握 = #22C58B mint and 再回看 = #F5B100 amber, and Statistics remains quiet with tabular number treatment.
