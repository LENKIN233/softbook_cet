# DesignCandidate: Welcome Modal

## Candidate ID

`cpl-03`

## Provenance

- Tool or model: Codex design search.
- Prompt: Explain the five-day pilot in a conventional full-screen welcome confirmation.
- Source context pack: `docs/design/search-runs/2026-08-01-controlled-pilot-lifecycle/context-pack.md`
- Artifact: prose-only rejected record.
- Screenshots: No-render rationale: the blocking acknowledgement violates the first-valid-card and low-burden hard filters before visual comparison.

## Product Truth Fit

Fails because it inserts onboarding between a valid session and the card and can imply that tapping the modal starts the trial.

## Focal Object

The modal, incorrectly displacing the knowledge card.

## First-Read Path

Welcome explanation -> confirmation -> card.

## Interaction Silhouette

Blocking overlay rather than single-card Learning.

## Spatial Model

Space continuity is hidden.

## State Language

Over-explains eligibility and creates a false acknowledgement state.

## Motion Causality

Modal entrance is caused by navigation, not a meaningful learning operation.

## Platform Strategy

Phone modal, but invalid at any size.

## Implementation Mapping

Would require an extra blocking surface and is therefore not mapped.

## Known Risks

Trial-start ambiguity, abandonment, screen-reader focus trap, and duplicated account copy.

## Design Review Checklist Answers

Q1: Accent could be singular but hierarchy still fails.

Q2: Wrong focal object.

Q3: Learning silhouette is blocked.

Q4: Onboarding chrome is forbidden.

Q5: Not rendered because product truth already fails.

Q6: No self-assess change.
