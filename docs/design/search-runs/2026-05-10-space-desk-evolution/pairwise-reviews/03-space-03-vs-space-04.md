# Pairwise Review 03

## Pair

- Candidate A: space-03
- Candidate B: space-04

## Reviewer Role

Space hierarchy reviewer, first-read reviewer, visual-language reviewer, and implementation mapping reviewer.

## Winner

space-04

## Visual Evidence

Compared rendered survivor panels `space-03` and `space-04` in `docs/design/search-runs/2026-05-10-space-desk-evolution/candidate-proofs/survivor-comparison.html#space-03` and `docs/design/search-runs/2026-05-10-space-desk-evolution/candidate-proofs/survivor-comparison.html#space-04`.

## Product Truth

Both candidates preserve hierarchy. `space-04` better balances parent context with current box focus, so it avoids `space-03`'s file-browser risk.

## Task Clarity

`space-04` has a stronger next action: inspect contained cards or return to Learning from the open tray. `space-03` makes location clear but action less immediate.

## Space Or Interaction Fit

`space-04` keeps parent shelf, current box, cards, favorite tag, and sleep alcove visible without letting any one secondary region dominate.

## Visual System Fit

`space-04` gives one strong reading accent to the tray edge and return action. `space-03` risks too many accented shelf states if implemented literally.

## Implementation Mapping

`space-04` maps to the current `SpaceSurface.tsx` obligations with cleaner region names: address shelf, object tray, card strip, state alcove, continuity strip.

## Rationale

`space-04` takes the best part of `space-03` and resolves its main risk. It feels like a physical working surface, not a file system.

## Borrowable Fragments

- Borrow `space-03` shelf context inside `space-04`.
- Preserve `space-04` open box tray as the focal object.

## Rejected Fragments

- Reject shelf-first layout.
- Reject any sibling box treatment that competes with current box focus.
