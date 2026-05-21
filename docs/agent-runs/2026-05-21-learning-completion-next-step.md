# Agent Run: Learning Completion Next Step

## Scope

- Surface: Learning completion state.
- Goal: remove dashboard-like completion density and make the next useful learning decision primary.
- Non-goals: no product truth change, no new interaction family, no Space behavior change, no membership/runtime/card payload change, no stats surface change.

## Referenced Specs And Artifacts

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/single-card-ux-contract.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `docs/design/mocks/learning-card-rhythm-v1.md`

## Product Truth

Learning completion remains part of the guided single-card flow. The user should see what was completed and the next useful action, not a dense report page.

## Implementation Hypothesis

The RN completion state can reduce cognitive load by:

- shrinking metric pills to completion plus next-step status;
- removing per-card completion rows from the Learning completion surface;
- making review / restart the primary decision.

## Changed Files

- `apps/mobile/src/learning/LearningSurface.tsx`
- `apps/mobile/__tests__/LearningSurface.test.tsx`
- `docs/agent-runs/2026-05-21-learning-completion-next-step.md`

## Validation Plan

- metadata leakage visible-text check;
- harness validation;
- PR design artifact gate with PR body;
- agent review gate with PR body;
- mobile quality through GitHub required checks.

## CI Follow-up

- GitHub `mobile-quality` first run failed at TypeScript because `MetricPill` only accepts `success | danger`; the completion next-step pill was changed to the allowed `success` tone.

## CI Test Follow-up

- GitHub `mobile-quality` second run passed type-check and failed only on tests that still expected the old completion detail labels or assumed button text would serialize as one string. The assertions now match the new next-step completion state and RN split text serialization.
