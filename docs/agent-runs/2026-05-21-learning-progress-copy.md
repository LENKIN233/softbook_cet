---
status: passed
branch: module/learning-progress-copy
pr: 128
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

Tight visible-copy cleanup for Learning completion/header states after PR #127. The goal is to remove remaining system-organization wording from Learning visible copy without changing runtime state, card flow, eligibility, membership, or Space behavior.

## product_truth

Learning remains a guided single-card flow. Header and completion states should tell the learner how to continue in study terms. They should not expose internal sequencing terms such as system order, source labels, card source, or card group as if those were the user's primary task.

## implementation_hypothesis

The RN Learning UI can sanitize `sessionLabel` at the display boundary and replace completion wording with `学习节奏` / `这一组` while preserving the existing reset/review actions and without changing data flow.

## Changed files

- `apps/mobile/src/learning/LearningSurface.tsx`
- `apps/mobile/__tests__/LearningSurface.test.tsx`
- `apps/mobile/__tests__/App.test.tsx`
- `apps/mobile/__tests__/App.remoteFallback.test.tsx`
- `docs/agent-runs/2026-05-21-learning-progress-copy.md`

## CI follow-up

- Initial remote `mobile-quality` correctly caught that the default rendered Learning header still showed `系统顺序学习` through `sessionLabel`.
- Added a LearningSurface display-label boundary that maps source/system/card-group labels to learner-facing labels before render.
- Initial remote `design-artifact-gate` correctly required concrete Q1/Q2/Q4/AP-22 evidence in the PR body; updated the PR body accordingly.

## Local verification

- `git diff --check` passed.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` passed.
- `python3 scripts/validate_harness.py` passed.
- `PR_BODY=... python3 scripts/validate_pr_design_gate.py --base origin/main --head HEAD` passed after committing the fix locally.
- `PR_BODY=... python3 scripts/validate_agent_review.py` passed.
