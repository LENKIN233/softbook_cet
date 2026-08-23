# Agent Run Record: formal release bundle builder

## Task summary

- Date: 2026-08-23
- Branch: `infra/formal-release-bundle-builder-v1`
- PR: https://github.com/LENKIN233/softbook_cet/pull/517
- Summary: Add the missing dry-run-first assembler that can turn already
  approved exact CET4 content, audit, human audio QC and private bytes into a
  fully core-verified `release-bundle.v1` without creating approval, QC,
  deployment or readiness evidence.

## Referenced specs

- `AGENTS.md`
- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/card-system.json`
- `spec/box-catalog.json`
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
- `infra/cloudbase/release-bundle-v1-runtime-contract.md`

## Product truth used

- The formal CET4 closed-beta payload is exactly 1,180 cards, 108 boxes and 301
  referenced audio assets.
- Formal content requires one exact `full_track_final` user approval bound to
  the same card/box/corpus scope and exact quality-audit bytes.
- Every referenced audio asset requires an identified-human formal QC entry
  passing all ten audio/product checks.
- Candidate content, pilot approval, dry-runs, simulations, ASR and technical
  audio audit cannot create or replace formal approval or QC.
- A local bundle build does not deploy, publish or create readiness evidence.

## Implementation hypothesis changed

- `scripts/build_formal_release_bundle.mjs` accepts a validated CET4-only
  `closed_beta` profile, exact formal payload, full-track approval, bound audit,
  audio-QC directory, asset root, output/release IDs and timestamps.
- It independently checks exact 1,180/108/301 membership, unique card/asset
  identity, 301 card audio references, exact approval card/box/corpus scope,
  zero hard/content/review blockers, empty missing-card audit scope and audit
  byte hash.
- It reuses the human-QC collector: one QC index entry per asset, identified
  non-Agent reviewer, all ten checks, per-card coverage and exact asset hash.
- It assembles content, approval, audit, private audio, deduplicated QC records,
  audio manifest, QC index and `release-bundle.v1` only inside a temporary root.
- The existing `verifyReleaseBundleDirectory` must verify the complete staged
  directory before any output can remain. A missing verification result fails.
- Dry-run deletes the staging directory. `--apply` retains a verified directory
  only when the target does not already exist.
- Parent release is optional for initial A and must be distinct when supplied
  for later B; remote retained state remains receiver-verify authority.
- `formal-release-bundle-build-report.v1` is fixed to no CloudBase writes and
  `gate_eligible=false`.

## Workspace boundary and read scope

- Active truth/source read: listed specs/contracts, formal release validator,
  publisher and controlled-pilot assembler patterns.
- Generated/dependency/cache/archive read: backend dependencies installed from
  the tracked lockfile for focused tests; temporary generated fixture bundles
  are deleted.
- External card workspace: not read or modified. Tests use generated non-release
  fixture cards/audio/QC only.
- External control plane: none.

## Files changed

- Formal release bundle builder and full-scope tests.
- Release runtime contract, CloudBase README and runtime-boundary status.
- Backend PR workflow registration and formal-approval classifier.
- HR-46 / GT-39 evals and harness contract mirrors.
- `docs/agent-runs/2026-08-23-formal-release-bundle-builder.md`: this record.

## Commands run

- Focused builder tests -> 5/5 passed, including one complete default core
  verifier run over generated 1,180/108/301 fixture data.
- Combined builder and formal-classifier tests -> 15/15 passed.
- Combined builder, classifier, closed-beta and public-launch tests -> 65/65
  passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> 296/296 passed.
- `python3 scripts/test_learning_events_contract.py` -> 17/17 passed.
- `python3 scripts/validate_harness.py` ->
  `HARNESS VALIDATION OK` with remote guard included.
- `PATH=/Users/lenkin/.nvm/versions/node/v22.13.0/bin:$PATH
  ./scripts/run_local_gates --profile dev --base origin/main --output
  exports/local-gates/formal-release-bundle-builder-v1-rebased.json` -> 24/24
  passed with zero exception.
- Node/JSON/Python syntax and `git diff --check` -> passed.
- PR checks -> pending publication.

## Validation results

- Dry-run invokes core verification and leaves no requested output directory.
- Apply keeps the exact verified tree and all expected payload/audio/QC files.
- Missing user approval, drifted audit bytes, missing human QC and empty core
  verification all fail closed.
- The complete generated fixture passes the actual formal bundle core verifier,
  not only an injected test double.
- Builder report remains gate-ineligible and reports zero CloudBase writes.

## Binary evidence

- Evidence manifest: N/A. Generated fixture MP3 bytes and bundle directories
  exist only under temporary test roots and are deleted.
- Archive: N/A.

## Agent review status

- Reviewer: Codex primary exact-diff and gate review.
- Status: passed local exact-diff and full-gate review.
- Blocking findings: none.

## User-visible UI impact

- None. No screen, component, copy, interaction, motion, navigation or visual
  token changes.

## Card make external workspace impact

- None. The builder defines a future consumer contract but does not read,
  create, approve or alter card-workspace artifacts.

## Risks and open questions

- No real formal approval or 301-asset human QC exists yet, so no real bundle
  was assembled.
- A verified local bundle is not receiver publication or retained-parent proof.
- Receiver environment, signing/SMS secrets and real devices remain external.

## Follow-up

- Finish full validation, rebase after PR #515 auto-merges, publish and
  automatically merge this builder PR.
- When formal card-workspace evidence exists, build release A then retained-
  parent release B, deploy/publish/verify in the receiver and bind the real
  reports into closed-beta readiness.
