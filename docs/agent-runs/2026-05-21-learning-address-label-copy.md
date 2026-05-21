---
status: passed
branch: module/learning-address-label-copy
pr: pending
referenced_specs:
  - spec/requirement-memory.json
  - spec/product-core.json
  - spec/action-surface.json
  - spec/interactions.json
  - spec/knowledge-map.json
  - spec/space-operations.json
  - spec/visual-language.json
  - docs/design/single-card-ux-contract.md
  - docs/design/mapping/learning-space-implementation-map-v1.md
  - docs/design/interaction-motion/learning-card-rhythm-v1.md
  - docs/design/mocks/learning-card-rhythm-v1.md
---

# Agent run: learning address-label copy

## Scope

Tight visible-copy cleanup for the Learning address aperture after PR #130. The goal is to make the card-to-space label read as a learner-facing address cue, not a generic system position label.

## product_truth

Learning remains a guided single-card flow with continuity into the physical-space knowledge map. The address should stay visible, but the label should say where this card lives instead of presenting a system coordinate state.

## implementation_hypothesis

The RN Learning address aperture can replace `当前位置：` with `这张在：` while preserving the existing馆/组/盒 address, spatial mapping, card flow, and runtime behavior.

## Changed files

- `apps/mobile/src/learning/LearningSurface.tsx`
- `apps/mobile/__tests__/LearningSurface.test.tsx`
- `apps/mobile/__tests__/App.test.tsx`
- `docs/agent-runs/2026-05-21-learning-address-label-copy.md`

## Local verification

- `git diff --check` passed.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` passed.
- `python3 scripts/validate_harness.py` passed.
- `PR_BODY=... python3 scripts/validate_pr_design_gate.py --base origin/main --head HEAD` passed.
- `PR_BODY=... python3 scripts/validate_agent_review.py` passed.
