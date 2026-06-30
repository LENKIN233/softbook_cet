# Progress Timeline Tutor

## Candidate ID

msr-05

## Provenance

- Tool or model: Codex design synthesis
- Prompt: Phone reset exploring a guided timeline from today's study path through the current card.
- Source context pack: `context-pack.md`
- Artifact: `candidate-proofs/mobile-reset-candidate-proof.html#msr-05`
- Screenshots: `candidate-proofs/mobile-reset-candidate-proof.html#msr-05`

## Product Truth Fit

Fails because the timeline becomes the main product object. It shifts the user from operating the current card to managing progress.

## Focal Object

The daily path timeline.

## First-Read Path

Timeline -> current step -> card preview -> action.

## Interaction Silhouette

Weak Learning silhouette because the current card is demoted below path management.

## Spatial Model

Space is reduced to path position and does not prove library / group / box / card hierarchy.

## State Language

States become step completion markers, which risks turning the app into a plan tracker.

## Motion Causality

Timeline movement would be caused by step completion, but that motion emphasizes progress management more than study operation.

## Platform Strategy

Phone can render it, but it would expand into a planning surface on larger screens.

## Implementation Mapping

Would require new path-management UI and would not map cleanly to the accepted Learning / Space artifacts.

## Known Risks

It undermines low-burden learning, promotes module-like progress thinking, and weakens Space.

## Design Review Checklist Answers

Q1: Current library could be Reading, but timeline states would compete with the single accent.

Q2: Focal object is the timeline, which is the wrong focal object for Learning.

Q3: Learning silhouette is weak because the card is not primary.

Q4: It avoids obvious forbidden visual patterns but creates a product-structure failure.

Q5: Phone containment is feasible, but the timeline consumes too much vertical attention.

Q6: Learning risks becoming path or module management, so this candidate is rejected.
