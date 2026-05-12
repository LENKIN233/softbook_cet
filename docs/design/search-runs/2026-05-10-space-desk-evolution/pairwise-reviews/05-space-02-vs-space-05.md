# Pairwise Review 05

## Pair

- Candidate A: space-02
- Candidate B: space-05

## Reviewer Role

UX Task / Interaction Motion / Physical Space / Implementation / Accessibility Layout.

## Winner

space-05

## Visual Evidence

Compared rendered survivor panels `space-02` and `space-05` in `docs/design/search-runs/2026-05-10-space-desk-evolution/candidate-proofs/survivor-comparison.html#space-02` and `docs/design/search-runs/2026-05-10-space-desk-evolution/candidate-proofs/survivor-comparison.html#space-05`.

## Product Truth

Both candidates can preserve ownership if carefully rendered. `space-05` is safer because it keeps state under the current box, while `space-02` can hide box ownership behind card inspect.

## Task Clarity

`space-02` clarifies card detail. `space-05` clarifies an operation users are more likely to misunderstand: sleep and wake.

## Space Or Interaction Fit

`space-05` better expresses allowed Space state transitions. `space-02` is a useful secondary state but weak as the default silhouette.

## Visual System Fit

`space-05` can keep accent quiet and semantic. `space-02` may need strong selected-card emphasis that competes with the current box.

## Implementation Mapping

`space-05` maps to the state region already required by Space. `space-02` needs additional selected-card behavior and likely motion storyboarding.

## Rationale

The search run needs to improve Space comprehension, not just provide card detail. `space-05` contributes a clearer product-state fragment.

## Borrowable Fragments

- Borrow `space-02` card drawer for future inspect state.
- Borrow `space-05` sleep/wake alcove for the promoted synthesis.

## Rejected Fragments

- Reject detail-first Space entry.
- Reject state handling that loses parent box context.
