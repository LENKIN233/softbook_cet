# DesignCandidate space-06

## Candidate ID

`space-06`

## Provenance

- Tool or model: Codex design search, generation 1
- Prompt: Explore a progress-heavy Space command board as a negative control.
- Source context pack: docs/design/search-runs/2026-05-10-space-desk-evolution/context-pack.md
- Artifact: Prose candidate record for Progress Command Board
- Screenshots: Not rendered because hard-filter rejected.

## Product Truth Fit

This candidate fails product truth. It makes completion counters, review load, and streak-like management status the first objects. That turns Space into statistics and planning instead of a physical map of knowledge cards.

## Focal Object

Progress summary board, which is the wrong focal object for Space.

## First-Read Path

Progress summary -> review counts -> library chips -> cards. This order hides current box ownership.

## Interaction Silhouette

Not a valid Space hierarchy silhouette because the physical hierarchy appears after counters.

## Spatial Model

Library, group, box, and card are flattened into dashboard rows. The card's physical position is not visible early enough.

## State Language

Favorite and sleep appear as filters or counts, which risks converting them into management categories.

## Motion Causality

No meaningful physical motion; transitions would be dashboard filtering.

## Platform Strategy

Would scale as a dashboard, but that is the wrong product capability for this surface.

## Implementation Mapping

Would pressure `SpaceSurface.tsx` to invent progress widgets and state filters outside accepted Space mapping.

## Known Risks

Hard product violation: statistics-first first-read, flattened hierarchy, and high operation burden.

## Design Review Checklist Answers

Q1: Reading could be accented, but the current library is not the first product object.

Q2: Focal object is wrong because progress board precedes current box.

Q3: Space hierarchy silhouette is missing at first read.

Q4: The concept risks management chrome and should be rejected before visual production.

Q5: Rendering could fit, but proof would validate the wrong surface.

Q6: Space-only candidate, but it would create stats-like behavior on the Space surface and is rejected.
