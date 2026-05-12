# DesignCandidate space-03

## Candidate ID

`space-03`

## Provenance

- Tool or model: Codex design search, generation 1
- Prompt: Make Space feel like a shelf spine without becoming module-first navigation.
- Source context pack: docs/design/search-runs/2026-05-10-space-desk-evolution/context-pack.md
- Artifact: docs/design/search-runs/2026-05-10-space-desk-evolution/candidate-proofs/survivor-comparison.html#space-03
- Screenshots: Rendered survivor panel `space-03` in `candidate-proofs/survivor-comparison.html`.

## Product Truth Fit

This candidate emphasizes the physical map by rendering a vertical shelf spine of sibling boxes and opening the current box to the right. It preserves hierarchy strongly. Risk: the shelf can read like a file browser or module picker if it competes with the current box.

## Focal Object

Open current box adjacent to a quiet box spine.

## First-Read Path

Quiet reading shelf spine -> highlighted current box -> contained cards -> state badges -> Learning return.

## Interaction Silhouette

Space hierarchy silhouette with parent shelf rail and open box focus.

## Spatial Model

Library and group define the shelf. Sibling boxes appear as low-emphasis spines. Current box opens into card objects. Cards keep favorite and sleep state attached.

## State Language

Favorite and sleep remain on card objects. Sleep is a lower pocket inside the opened box. Sibling boxes show no strong actions.

## Motion Causality

Opening a box would unfold the spine into a desk plane. Sleep/wake movement remains inside the current box.

## Platform Strategy

Strongest candidate for tablet and pc web because the shelf spine can become a persistent rail while the desk plane expands.

## Implementation Mapping

Maps to `SpaceSurface.tsx` as parent context rail plus current object region. Future implementation must keep the rail secondary and avoid module-first selection.

## Known Risks

File-browser feeling, extra visual density, and possible confusion between supported browse and forbidden arbitrary reorganization.

## Design Review Checklist Answers

Q1: Current library is reading; the shelf uses quiet neutrals while reading coral marks the open current box only.

Q2: Focal object is the opened current box; the shelf is secondary context.

Q3: Space hierarchy silhouette is strong: shelf -> box focus -> contained cards.

Q4: No forbidden pattern is necessary; the candidate avoids gamified chrome and full-width tabs.

Q5: Phone proof is risky because a side spine plus desk can become crowded at `393 x 852`.

Q6: Space-only candidate; no Learning, flip, or stats rule changes.
