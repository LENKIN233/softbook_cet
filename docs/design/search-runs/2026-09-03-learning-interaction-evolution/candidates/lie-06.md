# Learning Interaction Candidate

## Candidate ID

lie-06

## Provenance

- Tool or model: model:codex
- Prompt: Hide all secondary actions until long press, edge drag, or card tilt.
- Source context pack: `docs/design/search-runs/2026-09-03-learning-interaction-evolution/context-pack.md`
- Artifact: No-render rationale: hard-filtered because required actions become gesture-only.
- Screenshots: No-render rationale: discoverability and assistive-access failure precedes visual review.

## Product Truth Fit

Produces a quiet screen but violates explicit lightweight visibility for peek and favorite.

## Focal Object

The bare current card.

## First-Read Path

Prompt -> primary gesture, with no visible support path.

## Interaction Silhouette

Primary interactions remain clear; support interaction disappears.

## Spatial Model

Physical gestures are over-literal and unavailable to many users.

## State Language

Almost no chrome, but hidden actions require tutorial language.

## Motion Causality

Direct manipulation is causal but not reliably discoverable or accessible.

## Platform Strategy

Fails keyboard, screen-reader, and non-touch parity.

## Implementation Mapping

Would add long-press and edge-gesture recognizers plus fallback menus.

## Known Risks

Hidden functionality, gesture conflicts, and high onboarding burden.

## Design Review Checklist Answers

Q1: One accent and one task remain.
Q2: The current card is focal.
Q3: Primary silhouettes are clear.
Q4: No visual forbidden pattern is used.
Q5: Visual containment passes but accessible reachability fails.
Q6: Flip stays two-state; required actions become invisible.
