# DesignCandidate space-01

## Candidate ID

`space-01`

## Provenance

- Tool or model: Codex design search, generation 1
- Prompt: Refine accepted Box Desk without changing product truth.
- Source context pack: docs/design/search-runs/2026-05-10-space-desk-evolution/context-pack.md
- Artifact: docs/design/search-runs/2026-05-10-space-desk-evolution/candidate-proofs/survivor-comparison.html#space-01
- Screenshots: Rendered survivor panel `space-01` in `candidate-proofs/survivor-comparison.html`.

## Product Truth Fit

This candidate preserves the existing Box Desk model: current reading box first, cards inside it, favorite as tag, sleep as a quiet tray, and Learning return with context. Risk is limited originality; it may not beat the accepted baseline enough to justify a new artifact.

## Focal Object

Current reading box `定位词抓取 / 细节定位盒`.

## First-Read Path

Reading address chip -> large current box panel -> contained card row -> lower sleep tray -> compact return to Learning.

## Interaction Silhouette

Space hierarchy silhouette: address ladder above one large box object, with contained cards below and state tray under the same object.

## Spatial Model

Library `仔细阅读`, group `定位词抓取`, box `细节定位盒`, and three visible cards remain nested. Sibling context is only hinted through small labels.

## State Language

Favorite appears as a small tag on one card. Sleep appears as a muted tray below the box. Wake action returns the card to the same box context.

## Motion Causality

Static candidate. If animated later, sleep would lower a card into the tray and wake would lift it back into the card row.

## Platform Strategy

Phone target is direct. Tablet and pc web would widen the card row and expose siblings, but this candidate does not add a stronger adaptation model.

## Implementation Mapping

Maps to `SpaceSurface.tsx` address region, current object region, card rail, state tray, and Learning continuity strip described in `docs/design/mapping/learning-space-implementation-map-v1.md`.

## Known Risks

May be too close to the accepted baseline, so it gives low design-search value. Sibling box context may remain weak for users entering Space outside Learning.

## Design Review Checklist Answers

Q1: Current library is reading; one reading-coral accent marks the current box and primary return action.

Q2: Focal object is the current box; first-read path runs from address to box to contained cards.

Q3: Space hierarchy silhouette is preserved with box focus and nested card states.

Q4: No forbidden pattern is required by this candidate; it avoids reward chrome, text gradients, full-width bottom tabs, removed self-assess tokens, and serif dependency.

Q5: Phone containment is plausible because the layout is close to the accepted `393 x 852` baseline.

Q6: Space-only candidate; it does not alter Learning, flip, or stats rules.
