# Agent Run: Learning Support Copy

## Scope

- Surface: Learning current-card support layer.
- Goal: make peek support copy study-facing instead of source/status-facing.
- Non-goals: no product truth change, no action model change, no Space behavior change, no membership/runtime/card payload change.

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

Peek remains a lightweight secondary learning aid attached to the current card. It must not expose source, queue, schedule, runtime, or internal reasoning.

## Implementation Hypothesis

The RN peek layer can keep the existing secondary action and improve user trust by describing what to look for in the current card rather than why the system selected it.

## Changed Files

- `apps/mobile/src/learning/LearningSurface.tsx`
- `apps/mobile/__tests__/LearningSurface.test.tsx`
- `docs/agent-runs/2026-05-21-learning-support-copy.md`

## Validation Plan

- metadata leakage visible-text check;
- harness validation;
- PR design artifact gate with PR body;
- agent review gate with PR body;
- mobile quality through GitHub required checks.

## CI Follow-up

- GitHub `mobile-quality` first run failed because an App-level test still expected the old peek title. The assertion now expects the study-facing support title.
