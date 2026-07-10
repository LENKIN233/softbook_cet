---
status: passed
branch: module/learning-current-card-copy
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

# Agent run: learning current-card copy

## Scope

Tight visible-copy cleanup for the Learning card chrome after PR #128. The goal is to remove the remaining system-style `当前卡`/`当前这一张` labels from the card header without changing the single-card flow, self-assess model, Space address, progress, or card interactions.

## product_truth

Learning remains a guided single-card flow. The first-read object is the one card the learner should act on now, but the UI should phrase that as a learner action, not as an internal current-card state label.

## implementation_hypothesis

The RN Learning card chrome can replace `当前卡` with `这张练习` and `当前这一张` with `先做这一张` while preserving the accepted silhouette and all behavior.

## Changed files

- `apps/mobile/src/learning/LearningSurface.tsx`
- `apps/mobile/__tests__/LearningSurface.test.tsx`
- `apps/mobile/__tests__/App.test.tsx`
- `docs/agent-runs/2026-05-21-learning-current-card-copy.md`

## Local verification

- `git diff --check` passed.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` passed.
- `python3 scripts/validate_harness.py` passed.
- `PR_BODY=... python3 scripts/validate_pr_design_gate.py --base origin/main --head HEAD` passed.
- `PR_BODY=... python3 scripts/validate_agent_review.py` passed.
