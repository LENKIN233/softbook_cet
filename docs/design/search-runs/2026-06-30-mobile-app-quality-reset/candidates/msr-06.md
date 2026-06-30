# Glass Dashboard

## Candidate ID

msr-06

## Provenance

- Tool or model: Codex design synthesis
- Prompt: Phone reset exploring a polished overview screen with Learning, Space, and Statistics visible together.
- Source context pack: `context-pack.md`
- Artifact: `candidate-proofs/mobile-reset-candidate-proof.html#msr-06`
- Screenshots: `candidate-proofs/mobile-reset-candidate-proof.html#msr-06`

## Product Truth Fit

Fails because it makes the app center a dashboard. That conflicts with low burden and current-card operation.

## Focal Object

The overview metric grid.

## First-Read Path

Daily metrics -> current card preview -> Space shortcut -> action.

## Interaction Silhouette

Weak because the interaction surface is only one panel among many.

## Spatial Model

Space becomes a shortcut tile rather than a hierarchy.

## State Language

Metrics and streak-like continuity become visually dominant, even without explicit achievement chrome.

## Motion Causality

Any motion would likely animate panels rather than product state transitions, which is not acceptable for the reset.

## Platform Strategy

Phone becomes crowded and desktop would drift further into a dashboard.

## Implementation Mapping

Would push implementation toward shared page cards and counters, the exact pattern this reset rejects.

## Known Risks

It can look superficially modern while still failing the product.

## Design Review Checklist Answers

Q1: Current library would be unclear because multiple tiles compete for accent.

Q2: Focal object is a metric grid, not the current card.

Q3: Interaction silhouette is not distinguishable when blurred.

Q4: It avoids named forbidden tokens but drifts toward dashboard composition.

Q5: Phone containment is poor because too many equal regions compete in one viewport.

Q6: Statistics would become too prominent, which conflicts with quiet tabular treatment.
