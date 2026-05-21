# Agent run record: Learning address continuity

## Task summary

Implement the smallest Learning UI structure fix after visible copy cleanup: the Learning address aperture now shows an anonymous Space position instead of a generic session counter.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/workspace-boundary.json`
- `spec/agent-run-record.json`
- `docs/design/single-card-ux-contract.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`
- `docs/design/interaction-motion/learning-card-rhythm-v1.md`
- `docs/design/mocks/learning-card-rhythm-v1.md`
- `docs/design/physical-space/space-model-v1.md`

## Product truth used

- `product_truth`: Learning is a guided single-card flow, not a dashboard or module picker.
- `product_truth`: Learning must preserve continuity to Space without exposing raw source, card, box, or semantic metadata.
- `product_truth`: Space remains a physical knowledge-map hierarchy with anonymous user-visible address cues.

## Implementation hypothesis changed

- `implementation_hypothesis`: `LearningSurface` can derive a stable anonymous address from the current session cards using the same `馆 / 组 / 盒` display vocabulary already used by Space.
- `implementation_hypothesis`: The address aperture should show `当前位置：馆 n / 组 n / 盒 n`, not `当前位置：学习会话 n/m`.

## Workspace boundary and read scope

- Worktree: `/Users/lenkin/programing/softbook_cet_learning_address`.
- Branch: `module/learning-address-continuity`.
- Read scope: single-card UX contract, implementation mapping, learning rhythm artifacts, interaction spec, `LearningSurface`, learning card model, display metadata helpers, and existing address/metadata tests.

## Files changed

- `apps/mobile/src/learning/LearningSurface.tsx`
- `apps/mobile/__tests__/App.test.tsx`
- `apps/mobile/__tests__/LearningSurface.test.tsx`
- `docs/agent-runs/2026-05-21-learning-address-continuity.md`

## Commands run

- `./scripts/install_git_hooks.sh`
- `node apps/mobile/scripts/check-metadata-leaks.mjs`
- `python3 scripts/validate_harness.py`
- `PR_BODY="$(cat /tmp/softbook_learning_address_pr_body.md)" python3 scripts/validate_pr_design_gate.py --base origin/main --head HEAD`
- `PR_BODY="$(cat /tmp/softbook_learning_address_pr_body.md)" python3 scripts/validate_agent_review.py`

## Validation results

- `node apps/mobile/scripts/check-metadata-leaks.mjs`: `PASS: No metadata leaks detected in visible text.`
- `python3 scripts/validate_harness.py`: `HARNESS VALIDATION OK`.
- `PR_BODY="$(cat /tmp/softbook_learning_address_pr_body.md)" python3 scripts/validate_pr_design_gate.py --base origin/main --head HEAD`: `PR DESIGN GATE OK`.
- `PR_BODY="$(cat /tmp/softbook_learning_address_pr_body.md)" python3 scripts/validate_agent_review.py`: `AGENT REVIEW GATE OK`.

## Agent review status

- Reviewer: Codex local learning-address-continuity review.
- Review status: Passed.
- Blocking findings: No blocking findings.
- Review summary: Reviewed the Learning address aperture change against the single-card UX contract, Learning rhythm proof, implementation mapping, metadata leak boundary, and Space continuity requirement. The patch is limited to anonymous address display plus tests.

## User-visible UI impact

Learning current-card address copy changes from a generic session counter to an anonymous Space address cue. It does not change layout, motion timing, interaction state, scoring, content, membership, or Space behavior.

## Card make external workspace impact

None. This PR does not produce, approve, import, or smoke-test card content.

## Risks and open questions

- The address index is derived from the current session order. If future sessions span multiple libraries/groups from a remote catalog, it remains anonymous but may not match a full-catalog Space index unless the session receives the full Space seed.
- This is intentionally a smallest implementation step; it does not implement the full Learning card rhythm visual redesign.

## Follow-up

Next Learning implementation slice should move the primary action zone closer to the thumb-stable action plane, using the accepted rhythm proof and without changing product truth.
