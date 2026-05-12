# Pairwise Review 07

## Pair

- Candidate A: space-03
- Candidate B: space-05

## Reviewer Role

Physical Space / Platform Adaptation / Interaction Motion / Implementation / Accessibility Layout.

## Winner

space-03

## Visual Evidence

Compared rendered survivor panels `space-03` and `space-05` in `docs/design/search-runs/2026-05-10-space-desk-evolution/candidate-proofs/survivor-comparison.html#space-03` and `docs/design/search-runs/2026-05-10-space-desk-evolution/candidate-proofs/survivor-comparison.html#space-05`.

## Product Truth

`space-03` better preserves full physical hierarchy across device classes. `space-05` better preserves sleep semantics but needs parent context from another candidate.

## Task Clarity

`space-03` clarifies location. `space-05` clarifies state. For the default Space screen, location comes first and state must remain attached.

## Space Or Interaction Fit

`space-03` has the stronger hierarchy model. `space-05` has the stronger state transition model.

## Visual System Fit

`space-03` risks file-browser tone; `space-05` risks state-manager tone. The promoted candidate should borrow from both without adopting either tone fully.

## Implementation Mapping

`space-03` gives future tablet and pc web a cleaner rail-to-desk adaptation. `space-05` maps well to the state region only.

## Rationale

As a standalone default surface, `space-03` is more complete. As a fragment, `space-05` remains valuable and should be harvested into `space-04`.

## Borrowable Fragments

- Borrow `space-03` secondary shelf context.
- Borrow `space-05` quiet state alcove.

## Rejected Fragments

- Reject file-browser first-read.
- Reject sleep-first Space.
