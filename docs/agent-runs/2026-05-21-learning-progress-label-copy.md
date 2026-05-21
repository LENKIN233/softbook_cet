---
status: passed
branch: module/learning-progress-label-copy
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

# Agent run: learning progress-label copy

## Scope

Tight visible-copy cleanup for the Learning header after PR #129. The goal is to remove the remaining dashboard-style `学习进度` label from the single-card header while preserving the same count, card flow, Space address, and interaction behavior.

## product_truth

Learning remains a guided single-card flow. The header can show where the learner is in the current group, but it should read as study rhythm rather than a stats/dashboard surface.

## implementation_hypothesis

The RN Learning header can replace `学习进度 · 1/7` with `本组第 1/7 张` while preserving layout, count semantics, and all runtime behavior.

## Changed files

- `apps/mobile/src/learning/LearningSurface.tsx`
- `apps/mobile/__tests__/LearningSurface.test.tsx`
- `docs/agent-runs/2026-05-21-learning-progress-label-copy.md`

## Local verification

- `git diff --check` passed.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` passed.
- `python3 scripts/validate_harness.py` passed.
- `PR_BODY=... python3 scripts/validate_pr_design_gate.py --base origin/main --head HEAD` passed.
- `PR_BODY=... python3 scripts/validate_agent_review.py` passed.
