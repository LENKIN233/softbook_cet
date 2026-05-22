---
status: passed
branch: module/learning-action-section-copy
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

# Agent run: learning action-section copy

## Scope

Tight visible-copy cleanup for the Learning action panel after PR #131. The goal is to remove the remaining UI-section label `答题区` from the card action area while preserving the same interaction controls and card flow.

## product_truth

Learning remains a guided single-card flow. The action panel should tell the learner what to do now, not label the area as a generic UI region.

## implementation_hypothesis

The RN Learning action panel can replace `答题区` with `现在做` while preserving all interaction buttons, action cues, self-assess behavior, and runtime state.

## Changed files

- `apps/mobile/src/learning/LearningSurface.tsx`
- `apps/mobile/__tests__/App.test.tsx`
- `docs/agent-runs/2026-05-22-learning-action-section-copy.md`

## Local verification

- `git diff --check` passed.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` passed.
- `python3 scripts/validate_harness.py` passed.
- `PR_BODY=... python3 scripts/validate_pr_design_gate.py --base origin/main --head HEAD` passed.
- `PR_BODY=... python3 scripts/validate_agent_review.py` passed.
