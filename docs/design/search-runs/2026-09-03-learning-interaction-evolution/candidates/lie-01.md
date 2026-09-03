# Learning Interaction Candidate

## Candidate ID

lie-01

## Provenance

- Tool or model: model:codex
- Prompt: Preserve the current 92%-height white card and improve only spacing, type, and shadows.
- Source context pack: `docs/design/search-runs/2026-09-03-learning-interaction-evolution/context-pack.md`
- Artifact: No-render rationale: hard-filtered because polishing preserves the dead-slab failure.
- Screenshots: No-render rationale: the current simulator screenshot already proves the rejected geometry.

## Product Truth Fit

Preserves single-card sequencing and every interaction contract, but treats implementation geometry as untouchable and therefore fails the user's visual-density requirement.

## Focal Object

One oversized white rounded rectangle.

## First-Read Path

Header -> prompt -> interaction -> bottom action.

## Interaction Silhouette

All five silhouettes remain, but they appear inside the same dominant slab.

## Spatial Model

Address stays in the header; the object has no stronger physical behavior.

## State Language

Current copy remains quiet and exam-facing.

## Motion Causality

Only opacity and spacing polish; state continuity remains underdesigned.

## Platform Strategy

Simple to scale, but reproduces oversized empty surfaces on phone and tablet.

## Implementation Mapping

Minimal style changes in `LearningSurface.tsx`.

## Known Risks

Would produce another cosmetic PR without solving information hierarchy or object continuity.

## Design Review Checklist Answers

Q1: One library accent remains.
Q2: The card is focal, but unused white area competes with the task.
Q3: Silhouettes survive inside the slab.
Q4: No forbidden ornament is added.
Q5: Containment is easy, density is not.
Q6: Flip remains two-state and no module picker appears.
