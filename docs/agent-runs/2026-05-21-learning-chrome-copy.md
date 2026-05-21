# Agent Run: Learning Chrome Copy

## Scope

- Surface: Learning current-card top chrome.
- Goal: make the current-card context label study-facing instead of structure-facing.
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

Learning remains a guided single-card flow. Chrome copy should support the current card task and avoid exposing product-internal structure labels.

## Implementation Hypothesis

The RN top chip can describe the learner's current object as `当前这一张`, keeping the single-card focus without implying an internal session construct.

## Changed Files

- `apps/mobile/src/learning/LearningSurface.tsx`
- `apps/mobile/__tests__/LearningSurface.test.tsx`
- `docs/agent-runs/2026-05-21-learning-chrome-copy.md`

## Validation Plan

- metadata leakage visible-text check;
- harness validation;
- PR design artifact gate with PR body;
- agent review gate with PR body;
- mobile quality through GitHub required checks.
