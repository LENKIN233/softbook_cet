# Agent Run Record: production deployment evidence

## Task summary

- Date: 2026-08-23
- Branch: `infra/production-deployment-evidence-v1`
- PR: https://github.com/LENKIN233/softbook_cet/pull/514
- Summary: Register fail-closed type-specific `production-deployment`
  launch-gate semantics over real receiver delivery report v2 deploy/verify
  output, the exact delivery profile and exact release bundle, while rejecting
  pilot, dry-run, simulation and unretained-release substitutions.

## Referenced specs

- `AGENTS.md`
- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/runtime-boundaries.json`
- `spec/release-operational-policy.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `infra/cloudbase/release-bundle-v1-runtime-contract.md`

## Product truth used

- A deployed function, CLI success status, local smoke, pilot release or
  in-memory simulation cannot independently satisfy a launch gate.
- Formal gate evidence must match the one launch-level release-candidate
  commit/profile/environment/release/bundle/backend/client-build cohort.
- Remote reports and all nested raw artifacts must be tracked strict JSON,
  regular files, size/SHA-256 rechecked and bound to a reachable commit.
- A release without a verified retained parent cannot meet the existing
  `rollback-target-retained` production-deployment check.
- Execution operator metadata does not replace independent verification or the
  protected product-owner environment.

## Implementation hypothesis changed

- `production-deployment` is no longer an unsupported generic semantic type.
  Its measurement contract requires four distinct roles: applied formal deploy
  report, passed formal verify report, exact delivery profile and exact release
  bundle.
- The validator recomputes the deterministic backend deployment ID from the
  exact commit, full profile and function topology rather than trusting the
  reported ID.
- Deploy and verify reports must agree on clean exact `main`, receiver
  profile/environment, execution operator, backend ID and full collection
  catalog. Their execution windows must fit the outer evidence window and
  verify must start after deploy completes.
- The API function must have the exact provider-specific runtime variable name
  set, handler/runtime/timeout, signing key ID, production/cloudbase modes, SMS
  provider and no fixed SMS code. The account-deletion
  worker must have its exact handler/runtime/timeout/timer and zero variables.
- Verify must bind the active CET4 release, 1,180 cards, 301 QC-passed audio
  assets, healthy API route, zero imported user data and the bundle's verified
  retained parent release.
- The core bundle verifier now returns the exact bundle-byte SHA-256; formal
  verify reports carry it and the launch validator binds it to the tracked raw
  bundle and launch-candidate subject.
- The formal verify raw report now includes a bounded retained-parent summary
  only after the receiver adapter has verified that retained release.

## Workspace boundary and read scope

- Active truth/source read: listed specs/contracts, launch validator and tests,
  receiver delivery report v2 implementation, receiver adapter retained-release
  verification and current release-bundle validators.
- Generated/dependency/cache/archive read: backend dependencies installed from
  the tracked lockfile for tests; not product truth.
- External control plane: no CloudBase write, deployment or evidence capture.
- External card workspace: not read or modified in this increment.

## Files changed

- `scripts/lib/launch_evidence_contract.mjs`: exact production-deployment
  measurements and raw deploy/verify/profile/bundle semantic validation.
- `scripts/validate_launch_readiness.mjs`: strict tracked raw-role loader and
  production-deployment evidence plumbing.
- `scripts/test_validate_launch_readiness.mjs`: valid end-to-end tracked
  fixture plus dry-run, pilot, unretained, profile/operator/catalog and byte
  tamper negatives.
- `infra/cloudbase/release-delivery-v1.mjs`, `deliver-release.mjs` and tests:
  exact verified bundle-byte hash plus verified retained-parent summary for
  formal verify reports.
- Runtime boundary, release contract, README, evals and harness mirrors:
  registered semantics and explicit external-execution boundary.
- `docs/agent-runs/2026-08-23-production-deployment-evidence.md`: this record.

## Commands run

- `node --test scripts/test_validate_launch_readiness.mjs` -> 40/40 passed.
- Focused formal/pilot receiver delivery tests -> 18/18 passed, including
  signing-key/runtime/store/SMS-provider remote drift rejection.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> 296/296 passed.
- `python3 scripts/test_learning_events_contract.py` -> 17/17 passed.
- `python3 scripts/validate_harness.py --mode full` ->
  `HARNESS VALIDATION OK` with remote guard included.
- Changed JSON parsing, Node syntax and `git diff --check` -> passed.
- `PATH=/Users/lenkin/.nvm/versions/node/v22.13.0/bin:$PATH
  ./scripts/run_local_gates --profile dev --base origin/main --output
  exports/local-gates/production-deployment-evidence-v1-final.json` -> 24/24
  passed with zero exception.
- PR checks -> pending publication.

## Validation results

- Exact tracked raw artifacts validate end-to-end; mutating one raw verify file
  fails its byte-size/SHA-256 binding.
- Dry-run deploy, controlled-pilot schema, unretained parent, profile change,
  operator mismatch and incomplete collection catalog all fail closed.
- Backend deployment identity is independently recomputed from profile and
  commit.
- An initial release with `parent_release_id=null` remains ineligible for
  production-deployment evidence.
- No formal evidence file, launch gate transition or release candidate is
  created by these tests.

## Binary evidence

- Evidence manifest: N/A. No retained binary, screenshot, recording or device
  evidence is produced.
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

- This validator makes future real receiver reports admissible; it does not
  create those reports or prove a deployment.
- A formal RC needs at least two releases so the selected release has a
  verified retained rollback parent.
- The other four `production-environments` evidence types and all remaining
  product/content/device/recovery gates keep their existing requirements.

## Follow-up

- Finish full validation after PR #513 merges, rebase this branch onto the new
  `main`, publish and automatically merge the follow-up PR.
- In the receiver environment, deploy and publish release A, publish release B,
  verify B with retained A, then record independently verified tracked raw
  evidence for this registered semantic contract.
