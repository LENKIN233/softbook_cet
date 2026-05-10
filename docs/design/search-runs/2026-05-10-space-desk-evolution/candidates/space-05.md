# DesignCandidate space-05

## Candidate ID

`space-05`

## Provenance

- Tool or model: Codex design search, generation 1
- Prompt: Make sleep and wake understandable while preserving current box ownership.
- Source context pack: docs/design/search-runs/2026-05-10-space-desk-evolution/context-pack.md
- Artifact: Prose candidate record for Quiet Sleep Alcove
- Screenshots: Covered by run-level rendered proof if promoted.

## Product Truth Fit

This candidate excels at sleep/wake semantics by giving sleeping cards a quiet alcove under the same current box. It preserves favorite as tag. Risk: sleep can become too prominent and make Space feel like a state manager instead of a knowledge map.

## Focal Object

Current box with a visible sleep alcove.

## First-Read Path

Current box header -> active card row -> sleep alcove -> wake action -> parent address.

## Interaction Silhouette

Space hierarchy with state alcove attached to the box. It is not a separate sleep box.

## Spatial Model

The card remains inside the reading library, locating-keywords group, and current box. Sleep changes availability in the Learning flow but not ownership.

## State Language

Sleep is a dimmed physical pocket. Wake is a small action attached to the sleeping card. Favorite stays as a tag on active or sleeping cards.

## Motion Causality

Card moves downward into the alcove when slept and upward back to active row when woken. Motion expresses state change, not decorative reward.

## Platform Strategy

Good for phone because state is legible. Tablet and pc web would need extra parent context so sleep does not dominate the whole surface.

## Implementation Mapping

Maps to `SpaceSurface.tsx` state region and card state affordances. It still needs the baseline address and current object regions.

## Known Risks

May over-index on sleep state, weakening the first-read current box and broader hierarchy. It may imply sleep is a primary destination.

## Design Review Checklist Answers

Q1: Current library is reading; state treatment stays quiet and does not add a second strong accent.

Q2: Focal object is the current box plus sleep alcove; first-read is clear for state review but less balanced for general Space entry.

Q3: Space hierarchy is acceptable because the alcove remains under the current box.

Q4: No forbidden design pattern is required; no reward, dashboard, or text-gradient treatment is introduced.

Q5: Phone containment is plausible because the layout is vertically stacked.

Q6: Space-only candidate; Learning and stats rules are not changed.
