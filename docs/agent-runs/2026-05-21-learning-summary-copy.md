# Agent Run: Learning Summary Copy

## Scope

- Surface: Learning current-card top summary.
- Goal: make the current-card summary study-facing instead of system-explanation-facing.
- Non-goals: no product truth change, no interaction model change, no Space behavior change, no membership/runtime/card payload change.

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

Learning remains a guided single-card flow. The top summary should tell the learner what to do now, not explain that the system selected the card.

## Implementation Hypothesis

The RN summary line can say `先完成这一张，再继续下一步`, preserving the guided order while removing system-facing phrasing.

## Changed Files

- `apps/mobile/src/learning/LearningSurface.tsx`
- `apps/mobile/__tests__/LearningSurface.test.tsx`
- `docs/agent-runs/2026-05-21-learning-summary-copy.md`

## Validation Plan

- metadata leakage visible-text check;
- harness validation;
- PR design artifact gate with PR body;
- agent review gate with PR body;
- mobile quality through GitHub required checks.
