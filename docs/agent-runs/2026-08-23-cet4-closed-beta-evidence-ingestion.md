# Agent Run Record: CET4 closed-beta evidence ingestion

## Task summary

- Date: 2026-08-23
- Branch: `infra/cet4-closed-beta-evidence-ingestion-v1`
- PR: pending
- Summary: Add tracked repository evidence ingestion for the closed-beta
  evidence types whose type-specific semantics already exist, parameterize
  those semantics to the exact `cet4-closed-beta` target, and keep every
  unregistered gate type fail closed.

## Referenced specs

- `AGENTS.md`
- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/cet4-closed-beta-readiness.json`
- `spec/release-operational-policy.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `infra/cloudbase/learning-events-v2-runtime-contract.md`
- `infra/cloudbase/learning-session-v1-runtime-contract.md`
- `infra/cloudbase/release-bundle-v1-runtime-contract.md`

## Product truth used

- The CET4 formal closed beta remains exactly 1,180 cards, 108 boxes and 301
  audio assets on iOS, Android and PC Web.
- Formal evidence must bind one exact closed-beta release candidate, including
  receiver environment, retained-parent release, bundle/content/backend and
  client-build cohort.
- Existing type-specific semantic thresholds are reused; they are not weakened
  merely because the target is a closed beta.
- Candidate, pilot, dry-run, local simulation, ASR and technical audit remain
  ineligible.
- Public launch readiness remains separate and unchanged.

## Implementation hypothesis changed

- `validateGateEvidenceArtifact` now accepts an explicit `targetRelease` while
  retaining `2027-Q2` as the public-launch default.
- The closed-beta repository loader snapshots tracked files and commits, then
  rereads, size-checks and SHA-256 rehashes every outer semantic report and
  nested `repo://` raw artifact before parsing strict JSON.
- Evidence subject commits must be reachable from validated `HEAD`; every
  supported report must match the exact `cet4-closed-beta` candidate cohort.
- Registered closed-beta semantics are: formal production deployment, SMS
  provider smoke, all six Learning/scheduler report types and all five release
  operational report types.
- Production-deployment and SMS reports reuse their strict raw-report loaders;
  release operational evidence keeps the active non-regressing policy; Learning
  reports keep exact runtime-contract and scheduler-lockfile hashes.
- Space sync, CET4 content approval/QC, beta entitlement, private device/
  distribution and remaining security evidence have no registered semantics
  yet and are rejected before gate eligibility.
- Structural validation requires successful repository semantic validation
  whenever evidence is present. Recording one exact candidate without evidence
  remains allowed and never makes readiness true.

## Workspace boundary and read scope

- Active truth/source read: listed specs/contracts, closed-beta state/validator,
  public launch evidence semantic loader and tests.
- Generated/dependency/cache/archive read: none for focused evidence tests.
- External control plane: none. No CloudBase, SMS, distribution or device write.
- External card workspace: none.

## Files changed

- Closed-beta validator and tests: tracked repository ingestion, supported-type
  registry, candidate binding, tamper/reachability and unregistered-type guards.
- Launch evidence contract: explicit target-release parameter with unchanged
  public-launch default.
- Launch repository loader: exported shared strict raw loaders used by the
  closed-beta verifier.
- Readiness owner/state, runtime/harness/eval mirrors and release documentation:
  registered-types-implemented / unregistered-fail-closed boundary.
- `docs/agent-runs/2026-08-23-cet4-closed-beta-evidence-ingestion.md`: this
  record.

## Commands run

- Focused closed-beta readiness tests -> 10/10 passed, including one tracked
  FSRS evidence report, raw-byte tamper and unregistered Space evidence.
- Combined closed-beta, public-launch and formal-classifier tests -> 60/60
  passed after the final repository-path and candidate-reachability guards.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> 296/296 passed.
- `python3 scripts/test_learning_events_contract.py` -> 17/17 passed.
- `python3 scripts/validate_harness.py --mode full` ->
  `HARNESS VALIDATION OK` with remote guard included.
- `PATH=/Users/lenkin/.nvm/versions/node/v22.13.0/bin:$PATH
  ./scripts/run_local_gates --profile dev --base origin/main --output
  exports/local-gates/cet4-closed-beta-evidence-ingestion-v1-rebased-final.json` ->
  24/24 passed with zero exception.
- The first rebased aggregate run hit the existing 0.1-second harness
  process-group timeout attribution flake; the isolated 21/21 suite and final
  unchanged-code aggregate both passed.
- JSON/Node/Python syntax and `git diff --check` -> passed.
- PR checks -> pending publication.

## Validation results

- A tracked `learning-runtime-evidence.v1` FSRS report with
  `target_release=cet4-closed-beta` validates end-to-end against the exact
  scheduler runtime contract and lockfile hashes.
- Mutating its tracked raw bytes fails size/SHA-256 verification.
- An otherwise tracked `space-sync-test` remains ineligible because no
  closed-beta semantic contract is registered.
- The empty tracked baseline still validates and remains `ready=false`.
- Existing public-launch tests continue to pass with their default
  `target_release=2027-Q2` binding.

## Binary evidence

- Evidence manifest: N/A. Tests create temporary strict JSON only; no retained
  binary, screenshot, recording or device evidence.
- Archive: N/A.

## Agent review status

- Reviewer: Codex primary exact-diff and gate review.
- Status: passed local exact-diff and full-gate review.
- Blocking findings: none.

## User-visible UI impact

- None. No screen, component, copy, interaction, motion, navigation or visual
  token changes.

## Card make external workspace impact

- None. No card payload, approval, audio asset, audit or QC record changes.

## Risks and open questions

- Readiness intentionally cannot become true until every remaining evidence
  type has a strict semantic contract and actual evidence exists.
- Reusing registered semantics does not create receiver execution or human
  verification; it only makes future real evidence admissible.
- Receiver purchase/ownership, content/audio review, signing/distribution and
  real devices remain external inputs.

## Follow-up

- Finish validation, rebase after PR #515 auto-merges, publish and automatically
  merge this evidence-ingestion PR.
- Implement the next missing closed-beta semantics, prioritizing Space sync,
  beta entitlement and exact CET4 approval/audio-QC coverage.
