# Study Object Rail

## Candidate ID

msr-01

## Provenance

- Tool or model: Codex design synthesis
- Prompt: One-screen phone app reset centered on a current CET study object with attached result and Space layers.
- Source context pack: `context-pack.md`
- Artifact: `candidate-proofs/mobile-reset-candidate-proof.html#msr-01`
- Screenshots: `candidate-proofs/mobile-reset-candidate-proof.html#msr-01`

## Product Truth Fit

Preserves system-sequenced single-card flow by making the current card the persistent object. Preserves Physical Space by exposing an attached address shelf instead of a separate list. The main risk is hiding too much explanation if the answer slip is too compact.

## Focal Object

The current-library card object with one coral accent rail.

## First-Read Path

Current card -> answer/action slip -> compact Space address -> floating navigation capsule.

## Interaction Silhouette

Learning current-card silhouette. Detail is a resolved state attached to the same card rather than a separate report page.

## Spatial Model

The address shelf shows library / group / box / card as context. Space is reachable from the shelf without turning module browsing into the main path.

## State Language

Correctness appears as a calm resolved slip. Favorite appears as a light tag on the card. Review state is local to the result slip and does not become a score dashboard.

## Motion Causality

The answer slip rises from the card after the user resolves the interaction. The Space shelf expands only when the user asks where the card lives.

## Platform Strategy

Phone first. Tablet can widen the address shelf beside the current object. PC web can place Space context in a persistent side rail while preserving the same current object model.

## Implementation Mapping

Maps to future mobile shell plus `apps/mobile/src/learning/LearningSurface.tsx` for the object/action/slip planes and `apps/mobile/src/space/SpaceSurface.tsx` for the address aperture.

## Known Risks

The rail could become too abstract if real card text is long. The attached slip needs strict height control to prevent vertical-feed regression.

## Design Review Checklist Answers

Q1: Current library is the active library, and coral is the only strong accent in the candidate proof.

Q2: Focal object is the current card; the first-read path is card, slip, address, chrome.

Q3: It uses the Learning current-card silhouette and treats Detail as a continuation of that silhouette.

Q4: It avoids forbidden patterns: no gradient title, no full-width bottom tabbar, no achievement chrome, no serif, and no removed self-assess tokens.

Q5: Phone target is a 393px frame with contained floating chrome and no horizontal overflow in the proof.

Q6: Learning remains system-sequenced, module choice is secondary, and flip self-assess would remain two choices when used.
