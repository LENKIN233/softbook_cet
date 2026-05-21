---
status: passed
branch: module/learning-progress-copy
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

# Agent run: learning progress copy

## Scope

Tight visible-copy cleanup for Learning completion states after PR #127. The goal is to remove remaining system-organization wording from completion and review-finished copy without changing runtime state, card flow, eligibility, membership, or Space behavior.

## product_truth

Learning remains a guided single-card flow. Completion states should tell the learner how to continue in study terms. They should not expose internal sequencing terms such as system order or current card group as if those were the user's primary task.

## implementation_hypothesis

The RN Learning completion copy can replace `系统顺序` with `学习节奏` and `当前卡组` with `这一组` while preserving the existing reset/review actions and without changing data flow.

## Changed files

- `apps/mobile/src/learning/LearningSurface.tsx`
- `apps/mobile/__tests__/LearningSurface.test.tsx`
- `apps/mobile/__tests__/App.test.tsx`
- `docs/agent-runs/2026-05-21-learning-progress-copy.md`

## Local verification

- `git diff --check` passed.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` passed.
- `python3 scripts/validate_harness.py` passed.
- `PR_BODY=... python3 scripts/validate_pr_design_gate.py --base origin/main --head HEAD` passed.
- `PR_BODY=... python3 scripts/validate_agent_review.py` passed.
