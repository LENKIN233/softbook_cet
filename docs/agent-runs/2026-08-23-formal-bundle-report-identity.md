# Agent Run Record: formal bundle report identity

## Task summary

- Date: 2026-08-23
- Branch: `infra/formal-bundle-report-identity-v2`
- PR: #518
- Summary: Make retained formal bundle build output commit-, profile-, artifact-,
  operator- and execution-bound so it can later serve as a strict raw input to
  CET4 content evidence without becoming gate evidence itself.

## Referenced specs

- `AGENTS.md`
- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/card-system.json`
- `spec/box-catalog.json`
- `spec/runtime-boundaries.json`
- `spec/cet4-closed-beta-readiness.json`
- `spec/release-operational-policy.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `infra/cloudbase/release-bundle-v1-runtime-contract.md`

## Product truth used

- Formal bundle input remains exact CET4 1,180/108/301 with real full-track
  approval and identified-human QC.
- A build report is operational raw state, not approval, deployment, device or
  readiness evidence.
- Formal retained output must be attributable to one exact repository commit
  and operator without exposing secrets or machine-local paths.

## Implementation hypothesis changed

- `--apply` now requires Node 22.13.0, clean `main` exactly equal to
  `origin/main`, and an identified `github:`, `team:` or `external:` operator.
- Dry-run remains available on topic branches and records failed write-safety
  state plus null operator; it cannot impersonate an applied report.
- `formal-release-bundle-build-report.v2` binds repository commit, profile
  ID/hash, bundle/release/parent/content, approval/audit hashes, audio manifest
  and QC-index hashes, canonical execution start/completion and exact
  write-safety observation.
- The report exposes only the retained output directory basename, not an
  absolute machine-local path.
- CloudBase writes remain false and gate eligibility remains false.

## Workspace boundary and read scope

- Active truth/source read: listed specs/contracts and formal builder/tests.
- Generated/dependency/cache/archive read: backend dependencies and temporary
  generated 1,180/108/301 fixture; neither is product truth and fixture roots
  are deleted.
- External card workspace and control plane: none.

## Files changed

- Formal bundle builder and tests.
- Runtime boundary, release contract, README, HR-46/GT-39 and harness mirrors.
- `docs/agent-runs/2026-08-23-formal-bundle-report-identity.md`: this record.

## Commands run

- Focused builder tests -> 7/7 passed.
- Combined builder/classifier/closed-beta/public-launch tests -> 67/67 passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> 296/296 passed.
- `python3 scripts/test_learning_events_contract.py` -> 17/17 passed.
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`.
- Node 22.13.0 local gates -> 24/24 passed, zero exception; report
  `exports/local-gates/formal-bundle-report-identity-v2-dev.json`.
- `git diff --check` -> passed.
- PR checks -> pending after publication.

## Validation results

- Apply succeeds only with safe Node/main/origin/operator dependencies.
- Topic/dirty/diverged apply and missing operator fail before assembly output.
- Dry-run remains temporary and report v2 records null operator plus exact
  observed write-safety.
- A shallow checkout without `origin/main` records a null remote ref and unsafe
  dry-run state; retained apply still fails closed.
- Applied report contains only output basename and all required hashes.
- Actual core verifier still accepts the complete generated formal fixture.

## Binary evidence

- Evidence manifest: N/A. All generated fixture bytes are temporary and deleted.
- Archive: N/A.

## Agent review status

- Reviewer: Codex primary exact-diff and gate review.
- Status: passed local exact-diff and full-gate review.
- Blocking findings: none.

## User-visible UI impact

- None.

## Card make external workspace impact

- None. No content, approval, audit, audio or QC record was read or changed.

## Risks and open questions

- Report v2 is not yet registered as CET4 content evidence and remains
  `gate_eligible=false`.
- Real approval/QC, receiver environment and devices remain absent.

## Follow-up

- Rebase after PR #517 merges, finish full validation, publish and auto-merge.
- Register exact CET4 content/QC evidence semantics over applied report v2 and
  its tracked bundle artifacts.
