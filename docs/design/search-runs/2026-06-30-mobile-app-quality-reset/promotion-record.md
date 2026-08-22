# Promotion Record

> **Promotion revoked.** The product owner rejected the rendered mobile result
> on 2026-08-08. This record is historical evidence and must not authorize
> implementation. See
> `docs/design/rejected/mobile-visual-directions-product-owner-veto-2026-08-08.md`.

## Promoted Artifact

Historical action, now revoked: this run promoted
`docs/design/decisions/mobile-core-surface-reset-v1.md` and
`docs/design/mocks/mobile-core-surface-reset-v1.html`. Future implementation
must not consume either artifact or
`docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`.

## Winning Candidate

Historical internal result: `msr-01` won this run's comparison. That result
is not current authority; its promotion is revoked.

## Baseline Comparison

**Historical comparison; revoked as current authority.**

At the time, compared with the then-current Learning and Space baseline plus the
then-current app screenshots, reviewers judged `msr-01` more coherent at the
app level. The direction stopped treating Detail as a separate report, made the
current card the persistent focal object, and made Space continuity visible
without turning Learning into module browsing. This judgment is historical and
revoked; it neither describes the current baseline nor authorizes future UI.

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

**Historical expectations; revoked as current authority.**

The revoked record once expected RN to map the app shell, current object plane,
action plane, answer slip, Space address aperture, quiet ledger, Mine account
card, and floating navigation capsule. No future RN implementation may consume
those expectations or this search run as visual authority.

## Unimplemented Gaps

**Historical gaps; revoked as current authority.**

- That run did not change final RN code.
- It deferred exact motion timing to then-existing interaction/motion artifacts
  and a later implementation check.
- It expected final card density to be checked against real external-workspace
  payloads without producing or approving content in this repository.
- It expected simulator screenshots after implementation to check RN survival.

These historical gaps and expectations are revoked as authority.

## Failure Sedimentation

**Historical record; revoked as current authority.**

That run recorded failure patterns in
`docs/design/rejected/mobile-core-surface-reset-failures-v1.md` and did not
mutate product specs. This statement is historical and does not assess the
requirements of any future PR.

## Design Review Checklist Answers

**Historical answers; revoked as current authority.**

Q1: The historical answer assigned coral to the then-active library and treated
it as the dominant accent. This answer is revoked.

Q2: The historical answer used study card -> primary operation or answer slip
-> Space address -> app chrome as its first-read path. This answer is revoked.

Q3: The historical answer bound Learning to a current-card silhouette and Space
to an address-plus-hierarchy preview. This answer is revoked.

Q4: The historical answer claimed that its proof avoided the then-listed
forbidden patterns. This answer is revoked.

Q5: The historical answer cited one 393 px phone frame and its safe-area spacing.
This answer is revoked.

Q6: The historical answer kept Learning system-sequenced, flip at exactly two
self-assess states, and Statistics tabular. This answer is revoked.
