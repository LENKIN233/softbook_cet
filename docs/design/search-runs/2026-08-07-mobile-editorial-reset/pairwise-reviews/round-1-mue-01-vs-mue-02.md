# Pairwise Review: mue-01 vs mue-02

## Pair

- Candidate A: `mue-01`
- Candidate B: `mue-02`

## Reviewer Role

UI/UX director review for CET trust, first-read clarity, one-hand task completion, interaction silhouette, physical-space continuity, and phone containment.

## Winner

Candidate A, `mue-01`.

## Visual Evidence

- Candidate A: `candidate-proofs/mobile-editorial-candidates.html#mue-01`
- Candidate B: `candidate-proofs/mobile-editorial-candidates.html#mue-02`

## Product Truth

Both preserve a current card. `mue-01` better communicates “trusted CET material” through an editorial margin without turning the object into a generic flashcard stack.

## Task Clarity

`mue-01` has one dominant operation attached to the card. `mue-02` is clear for multiple choice but its stacked backs compete slightly with the question.

## Space Or Interaction Fit

`mue-02` has the stronger Space metaphor. `mue-01` has the stronger flip silhouette and front/back continuity.

## Visual System Fit

`mue-01` uses warm paper, deep plum ink, and one coral rail with less decorative noise. `mue-02` risks making every interaction look like a stack.

## Implementation Mapping

`mue-01` maps to a card container, margin identity, attached action edge, and large-text fallback. `mue-02` requires layered transforms and more z-order management.

## Rationale

Choose `mue-01` for Learning. Borrow nested physical depth from `mue-02` only for Space, where depth carries product meaning.

## Borrowable Fragments

`mue-02`'s visible card stack and tab become the current-box compartment and current-card marker in Space.

## Rejected Fragments

Do not keep rotated decorative cards behind every Learning object or use a folder tab as the only library identity.
