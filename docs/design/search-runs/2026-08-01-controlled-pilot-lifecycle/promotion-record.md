# Controlled Pilot Lifecycle Promotion Record

## Promoted Artifact

Promote `docs/design/decisions/controlled-pilot-lifecycle-decision-v1.md` and `docs/design/mocks/controlled-pilot-lifecycle-v1.html` as the design-only authority. Future implementation must consume `docs/design/mapping/controlled-pilot-lifecycle-implementation-map-v1.md`.

## Winning Candidate

`cpl-01` is the winning base, borrowing the settled-card aperture from `cpl-05`, the compact round receipt from `cpl-06`, and the explicit Mine time ledger from `cpl-02`.

## Baseline Comparison

The synthesis preserves the accepted single-card grammar and adds only pilot lifecycle states required by the controlled release contract. It improves the baseline by proving the fixed identity, first-valid-card notice, exact three-action round boundary, Space explanation, and no-payment Mine state. It does not replace production accessibility, device, or server evidence.

## Borrowed Fragments

- `cpl-02`: concise start/end time ledger, confined to Mine.
- `cpl-05`: confirmed-fifth-event card settlement and Space address aperture.
- `cpl-06`: compact completion receipt with one dominant continue action.

## Rejected Fragments

- `cpl-03`: modal acknowledgement.
- `cpl-04`: countdown, daily timeline, and dashboard cards.
- `cpl-07`: equal-weight destination doors.
- `cpl-08`: tutorial pages and next/skip chrome.

## Rendered Proof

- `candidate-proofs/survivor-comparison.html#cpl-01`
- `candidate-proofs/survivor-comparison.html#cpl-02`
- `candidate-proofs/survivor-comparison.html#cpl-05`
- `candidate-proofs/survivor-comparison.html#cpl-06`
- `rendered-proof.html`
- `docs/design/mocks/controlled-pilot-lifecycle-v1.html`

## Implementation Mapping Expectations

Future iOS and Android work must map the fixed identity chip, attached first-card slip, server-confirmed round boundary, completion receipt, Space aperture, exact three destinations, and Mine entitlement states. The implementation PR must remain separate.

## Unimplemented Gaps

- No RN component, API call, local entitlement calculation, timer, or navigation change is created here.
- Real content density, private audio, weak network, dynamic type, screen reader, and reduced-motion behavior still require implementation evidence.
- The protected product-owner approval and formal release gates remain external.

## Failure Sedimentation

Rejected patterns are recorded in `docs/design/rejected/controlled-pilot-lifecycle-failures-v1.md`. The metadata scanner now permits only the exact approved “CET4 受控试点” visible identity while continuing to reject other raw exam-type values.

## Design Review Checklist Answers

Q1: Learning and completion use one coral active-library accent. The pilot identity is neutral ink-on-glass and does not create a second library color.

Q2: The focal objects are the current knowledge card, the completed-round receipt, and the Mine account object. First-read paths remain identity -> object -> operation/state.

Q3: Learning keeps the accepted card interaction silhouette; completion uses receipt -> Space aperture -> one continue action. Space hierarchy is not flattened.

Q4: No gradient text, serif dependency, reward chrome, full-width bottom navigation, fake payment, tutorial carousel, or user-visible internal language appears.

Q5: All final frames are contained at 393 x 852. Long labels wrap, touch targets remain at least 44 points, and no horizontal overflow is accepted.

Q6: No new self-assess control appears. If a flip card is used later, 有把握 remains mint and 再回看 remains amber; red is not used for review state.
