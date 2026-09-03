# Learning Interaction Candidate

## Candidate ID

lie-05

## Provenance

- Tool or model: model:codex
- Prompt: Arrange peek, hint, favorite, position, and progress as controls around the card perimeter.
- Source context pack: `docs/design/search-runs/2026-09-03-learning-interaction-evolution/context-pack.md`
- Artifact: No-render rationale: hard-filtered because the perimeter becomes a control halo.
- Screenshots: No-render rationale: equal-weight controls reproduce the user's stated complaint.

## Product Truth Fit

Every capability is discoverable, but the primary task loses dominance.

## Focal Object

The control ring rather than the card content.

## First-Read Path

Progress -> hint -> favorite -> task -> action, with no stable priority.

## Interaction Silhouette

Internal silhouettes survive but are visually overpowered by chrome.

## Spatial Model

Location becomes another button and loses ambient meaning.

## State Language

Tool labels dominate the learning copy.

## Motion Causality

Controls pulse or expand independently, creating competing motion.

## Platform Strategy

Fails quickly at 320px and accessibility text sizes.

## Implementation Mapping

Would add more absolute-positioned utilities to `LearningSurface`.

## Known Risks

High cognitive load, accidental taps, and fragile containment.

## Design Review Checklist Answers

Q1: One library color is possible but many strong controls remain.
Q2: No single focal object survives.
Q3: Interaction silhouettes are obscured.
Q4: The control halo is a product anti-pattern even without forbidden CSS.
Q5: Narrow-phone containment fails.
Q6: Flip policy survives, but Learning becomes a toolbar.
