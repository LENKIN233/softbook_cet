# Pairwise Review 03

## Pair

`lie-04` vs `lie-08`

- Candidate A: `lie-04`
- Candidate B: `lie-08`

## Reviewer Role

Physical-object, motion, and accessibility reviewer.

## Winner

`lie-08`

## Visual Evidence

Candidate A: `candidate-proofs/survivor-comparison.html#lie-04`; Candidate B: `candidate-proofs/survivor-comparison.html#lie-08`.

## Product Truth

`lie-08` preserves physicality without borrowing swipe semantics for every card.

## Task Clarity

The compact sheet and single action rail in `lie-08` dominate more clearly than the layered stack.

## Space Or Interaction Fit

`lie-04` contributes continuity, but `lie-08` keeps interaction-specific motion causal and bounded.

## Visual System Fit

`lie-08` is quieter, less decorative, and more compatible with Aurora Glass restraint.

## Implementation Mapping

Both need layered views; `lie-08` avoids persistent animated depth and therefore has a safer Reduce Motion fallback.

## Borrowable Fragments

Use the next-card edge from `lie-04` only after result settlement.

## Rejected Fragments

Reject stacked-card parallax, side travel for non-swipe cards, and decorative depth loops.

## Rationale

Candidate B wins because it keeps physical continuity without teaching a false swipe affordance and has a safer reduced-motion implementation.
