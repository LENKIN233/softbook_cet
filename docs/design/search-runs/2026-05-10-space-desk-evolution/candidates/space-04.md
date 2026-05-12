# DesignCandidate space-04

## Candidate ID

`space-04`

## Provenance

- Tool or model: Codex design search, generation 1
- Prompt: Synthesize open desk tray, quiet shelf context, and attached state zones for Space.
- Source context pack: docs/design/search-runs/2026-05-10-space-desk-evolution/context-pack.md
- Artifact: docs/design/search-runs/2026-05-10-space-desk-evolution/candidate-proofs/survivor-comparison.html#space-04
- Screenshots: Rendered survivor panel `space-04` in `candidate-proofs/survivor-comparison.html` and promoted proof `rendered-proof.html`.

## Product Truth Fit

This candidate preserves Space as a physical hierarchy and improves the baseline by giving the current box a stronger object plane. Parent shelf context is visible but secondary. Favorite remains a tag on a card. Sleep is a lower alcove under the same current box. Learning return stays contextual.

## Focal Object

Open current box tray with contained reading cards.

## First-Read Path

Top address shelf -> open current box tray -> active and sibling cards -> favorite tag and sleep alcove -> return to Learning.

## Interaction Silhouette

Space hierarchy silhouette: parent shelf context, current box desk, contained card objects, attached state zones, and continuity strip.

## Spatial Model

Library `仔细阅读` and group `定位词抓取` sit in a compact shelf. Current box `细节定位盒` opens as the main tray. Cards remain inside the tray. Sleeping cards remain under the same box as a quiet alcove.

## State Language

Favorite tag attaches to the active card. Sleep is a quiet alcove labelled under the current box. Wake returns a sleeping card to the tray without changing ownership.

## Motion Causality

Motion is causally tied to card state: sleep lowers a card from tray to alcove; wake lifts it back; return to Learning pulls the current card forward from the same tray.

## Platform Strategy

Phone uses compressed shelf plus desk. Tablet can expand shelf into a left rail. Pc web can keep shelf, desk, and inspect as three columns without changing hierarchy.

## Implementation Mapping

Maps cleanly to `SpaceSurface.tsx`: address shelf, current object region, contained card strip, state alcove, and Learning continuity. It references implementation regions without defining component APIs.

## Known Risks

The shelf must stay quiet; if it becomes the first-read object, the screen drifts into module browsing. Phone density needs rendered proof for long labels.

## Design Review Checklist Answers

Q1: Current library is reading; one reading-coral accent binds address, current box edge, and primary return action.

Q2: Focal object is the open box tray. The first-read path is shelf -> box tray -> cards -> state alcove -> return.

Q3: Space hierarchy silhouette is explicit and does not reuse a Learning interaction silhouette.

Q4: Candidate avoids forbidden design patterns, reward chrome, text gradients, full-width bottom tabs, removed self-assess tokens, and serif dependency.

Q5: Rendered proof is required and provided by `rendered-proof.html` for `393 x 852` containment.

Q6: Space-only candidate; it does not change Learning sequence, flip self-assess, or stats formatting.
