# DesignCandidate space-07

## Candidate ID

`space-07`

## Provenance

- Tool or model: Codex design search, generation 1
- Prompt: Explore a simple favorite box and sleep box model as a negative control.
- Source context pack: docs/design/search-runs/2026-05-10-space-desk-evolution/context-pack.md
- Artifact: Prose candidate record for Favorite Sleep Twin Boxes
- Screenshots: Not rendered because hard-filter rejected.

## Product Truth Fit

This candidate fails product truth. It makes favorite and sleep into two physical containers, which contradicts favorite-as-tag and sleep-as-state-under-original-box. It also makes the original knowledge hierarchy secondary.

## Focal Object

Two state boxes labelled favorite and sleep, which are invalid focal objects.

## First-Read Path

Favorite box -> sleep box -> card thumbnails -> original box. This reverses the required ownership hierarchy.

## Interaction Silhouette

Invalid Space silhouette because state containers replace library/group/box/card structure.

## Spatial Model

Cards appear to move out of their original box into state boxes. This implies arbitrary reassignment and breaks ownership.

## State Language

Favorite is misrepresented as a physical destination. Sleep is misrepresented as a separate storage box rather than a temporary zone under original ownership.

## Motion Causality

Motion would imply cards jump between containers, which is the wrong semantic model.

## Platform Strategy

Simple to implement but product-wrong across phone, tablet, and pc web.

## Implementation Mapping

Would force `SpaceSurface.tsx` to model invalid containers and should not map to production code.

## Known Risks

Hard product violation, misleading mental model, and likely long-term drift into card management.

## Design Review Checklist Answers

Q1: Reading accent would be displaced by state boxes, so Law of One would not protect the hierarchy.

Q2: Focal object is wrong because state boxes replace current box.

Q3: Space hierarchy silhouette fails because original library/group/box/card ownership is hidden.

Q4: Candidate must be rejected before visual production because it encodes a forbidden Space pattern.

Q5: Rendering could fit, but containment is irrelevant because semantics fail.

Q6: Space-only candidate; it does not directly change Learning or stats, but it breaks Space product truth.
