# Agent run record: visible copy leak closeout

## Task summary

Close the currently dirty mobile visible-copy leakage patch by moving it onto a clean `origin/main` worktree, keeping it scoped to user-facing copy anonymization and metadata-leak guard hardening.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/visual-language.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/workspace-boundary.json`
- `spec/agent-run-record.json`

## Product truth used

- `product_truth`: Softbook CET is a CET4/6 exam-pass product centered on single-card flow, high-value interactions, and physical-space knowledge map semantics.
- `product_truth`: User-visible UI must not expose internal implementation, design-governance, harness, runtime, or source metadata vocabulary.
- `product_truth`: Space remains a top-level physical knowledge-space capability; this change does not reduce it to favorites/sleep boxes.

## Implementation hypothesis changed

- `implementation_hypothesis`: Existing mobile copy that used governance/design terms such as shell, flow, gate, top-level entry, low-cost, or membership boundary should be rewritten into user-facing task language.
- `implementation_hypothesis`: The shared mobile metadata-leak scanner and rendered-text test guard should treat internal design/governance vocabulary as leak candidates.

## Workspace boundary and read scope

- Source dirty worktree: `/Users/lenkin/programing/softbook_cet` on `fix/user-visible-copy-leaks` was read-only audited and left untouched.
- Clean worktree: `/Users/lenkin/programing/softbook_cet_visible_copy_leaks` on `fix/user-visible-copy-leaks-closeout` was created from current `origin/main`.
- Read scope: dirty diff for six mobile files plus task-relevant memory notes about metadata leakage guardrails.

## Files changed

- `apps/mobile/App.tsx`
- `apps/mobile/__tests__/App.test.tsx`
- `apps/mobile/scripts/check-metadata-leaks.mjs`
- `apps/mobile/src/learning/LearningSurface.tsx`
- `apps/mobile/src/space/SpaceSurface.tsx`
- `apps/mobile/src/statistics/StatisticsSurface.tsx`
- `docs/agent-runs/2026-05-21-visible-copy-leak-closeout.md`

## Commands run

- `git diff -- <six mobile files> > /tmp/softbook_visible_copy_leaks.patch`
- `git worktree add -b fix/user-visible-copy-leaks-closeout /Users/lenkin/programing/softbook_cet_visible_copy_leaks origin/main`
- `./scripts/install_git_hooks.sh`
- `git apply /tmp/softbook_visible_copy_leaks.patch`
- `node apps/mobile/scripts/check-metadata-leaks.mjs`
- `python3 scripts/validate_harness.py`
- `PR_BODY="$(cat /tmp/softbook_visible_copy_leaks_pr_body.md)" python3 scripts/validate_pr_design_gate.py --base origin/main --head HEAD`
- `PR_BODY="$(cat /tmp/softbook_visible_copy_leaks_pr_body.md)" python3 scripts/validate_agent_review.py`
- `npm test -- --runInBand --watchAll=false __tests__/App.test.tsx`

## Validation results

- `node apps/mobile/scripts/check-metadata-leaks.mjs`: `PASS: No metadata leaks detected in visible text.`
- `python3 scripts/validate_harness.py`: `HARNESS VALIDATION OK`.
- `PR_BODY="$(cat /tmp/softbook_visible_copy_leaks_pr_body.md)" python3 scripts/validate_pr_design_gate.py --base origin/main --head HEAD`: `PR DESIGN GATE OK`.
- `PR_BODY="$(cat /tmp/softbook_visible_copy_leaks_pr_body.md)" python3 scripts/validate_agent_review.py`: `AGENT REVIEW GATE OK`.
- `npm test -- --runInBand --watchAll=false __tests__/App.test.tsx`: local pretest metadata scan passed, then stopped because this clean worktree has no local `jest` binary installed; CI mobile-quality remains the full test authority for this PR.

## Agent review status

- Reviewer: Codex local visible-copy leak review.
- Review status: Passed.
- Blocking findings: No blocking findings.
- Review summary: Reviewed the six mobile visible-copy/guard changes against the metadata-leak scope. The patch stays copy-only and does not alter layout, motion, space model, runtime contracts, membership rules, or card payloads.

## User-visible UI impact

Copy-only visible UI impact. The change removes internal design/governance/runtime vocabulary from visible mobile text and keeps the visible copy aligned to user tasks such as continuing the current card, returning to learning, checking today progress, and viewing account/membership state.

## Card make external workspace impact

None. This PR does not produce, approve, import, or smoke-test card content.

## Risks and open questions

- The change intentionally broadens leakage regexes; overmatching should be monitored if future legitimate visible Chinese wording is blocked.
- No layout, motion, spatial model, card payload, or membership rule changes are intended.

## Follow-up

If this closes cleanly, the next slice should address actual UI structure only from accepted design artifacts, not from this copy-only patch.
