---
status: passed
branch: module/learning-hint-copy
pr: pending
referenced_specs:
  - spec/requirement-memory.json
  - spec/product-core.json
  - spec/action-surface.json
  - spec/interactions.json
  - spec/visual-language.json
  - docs/design/single-card-ux-contract.md
  - docs/design/mapping/learning-space-implementation-map-v1.md
  - docs/design/interaction-motion/learning-card-rhythm-v1.md
  - docs/design/mocks/learning-card-rhythm-v1.md
---

# Agent run: learning hint copy

## Scope

Tight visible-copy cleanup for the Learning hint control after PR #133. The goal is to avoid presenting hint as a generic UI/prompt-layer function and keep the control in learner-facing clue language.

## product_truth

Learning remains a guided single-card flow. A learner can ask for a clue on the current card, but the UI should not foreground an internal prompt/hint layer as a standalone surface.

## implementation_hypothesis

The RN Learning hint control can replace `查看提示` / `收起提示` with `要一点线索` / `收起这点线索` while preserving the same hint visibility state, testID, card flow, and runtime behavior.

## Changed files

- `apps/mobile/src/learning/LearningSurface.tsx`
- `apps/mobile/__tests__/LearningSurface.test.tsx`
- `apps/mobile/__tests__/App.test.tsx`
- `docs/agent-runs/2026-05-22-learning-hint-copy.md`

## Local verification

- `git diff --check` passed.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` passed.
- `python3 scripts/validate_harness.py` passed.
- `PR_BODY=... python3 scripts/validate_pr_design_gate.py --base origin/main --head HEAD` passed.
- `PR_BODY=... python3 scripts/validate_agent_review.py` passed.
