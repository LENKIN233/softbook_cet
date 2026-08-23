# Agent Run Record: CET4 closed-beta readiness

## Task summary

- Date: 2026-08-23
- Branch: `infra/cet4-closed-beta-readiness-v1`
- PR: pending
- Summary: Establish a separate, fail-closed CET4-only formal closed-beta
  readiness owner, state record, candidate schema, exact gates and structural
  validator without lowering or replacing the existing CET4+CET6 public-launch
  contract.

## Referenced specs

- `AGENTS.md`
- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/release-operational-policy.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `spec/doc-manifest.json`
- `infra/cloudbase/release-bundle-v1-runtime-contract.md`

## Product truth used

- The initial formal closed beta is CET4 only: exactly 1,180 cards, 108 boxes
  and 301 referenced audio assets.
- Product release targets remain iOS, Android and PC Web. The requested real
  iOS/Android device acceptance does not remove PC Web parity from product
  truth.
- Closed-beta premium access uses the audited receiver-operator
  `beta-entitlement.v1` path rather than weakening payment launch gates.
- Formal content use requires one exact full-track final user approval and one
  identified-human formal QC record for every audio asset.
- Receiver execution must cover real Auth, Bootstrap, Learning events,
  scheduler, Space sync, signed/private audio, beta entitlement and account
  deletion on one exact candidate cohort.
- Closed-beta readiness never implies public launch readiness and cannot lower
  CET6, payments, public distribution, compliance or the existing
  `docs/release/launch-readiness.v1.json` gates.

## Implementation hypothesis changed

- `spec/cet4-closed-beta-readiness.json` owns exact scope, candidate schema,
  dependencies, seven gates and the launch non-replacement boundary.
- `docs/release/cet4-closed-beta-readiness.v1.json` records the honest baseline:
  no candidate, zero evidence, zero ready dependencies, zero passed gates and
  `status=not_ready`.
- `cet4-closed-beta-release-candidate.v1` binds one reachable-style commit,
  receiver profile/environment, release plus retained parent, bundle/content,
  exact content approval/QC hashes, all three client builds and beta-entitlement
  campaign.
- The seven gates cover receiver runtime; Auth/deletion; canonical
  Learning/Space; approved CET4 content; beta entitlement; private distribution
  and device acceptance; and release recovery.
- Formal evidence ingestion is deliberately
  `not_implemented_fail_closed`. Structural evidence objects, pilot records,
  local smoke, simulations, ASR or technical audit cannot mark any gate ready.
- The validator permits recording one exact candidate before evidence, but
  keeps readiness false until later type-specific repository evidence ingestion
  is implemented and all dependencies/gates are complete.
- CLI validation loads the public launch record and requires the closed-beta
  non-replacement status claim to match its tracked state.

## Workspace boundary and read scope

- Active truth/source read: listed specs/contracts, current launch-readiness
  state and validator, formal release delivery contract, beta entitlement and
  release evidence policy.
- Generated/dependency/cache/archive read: none needed for the focused baseline
  validation.
- External control plane: none. No account, environment, distribution portal or
  device state was mutated.
- External card workspace: no payload, approval, audio asset or QC record was
  modified.

## Files changed

- New readiness owner and tracked state under `spec/` and `docs/release/`.
- New validator and negative test suite.
- Authority map, document manifest, runtime boundary and Agent read-path mirrors.
- Formal-approval classifier and PR-gate workflow registration.
- HR-45 / GT-38 regressions and product-contract harness mirror.
- CloudBase README and release-bundle contract non-replacement guidance.
- `docs/agent-runs/2026-08-23-cet4-closed-beta-readiness.md`: this record.

## Commands run

- Focused closed-beta readiness and formal-classifier tests -> 18/18 passed.
- Combined closed-beta, launch-evidence and formal-classifier tests -> 58/58
  passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> 296/296 passed.
- `python3 scripts/test_learning_events_contract.py` -> 17/17 passed.
- `python3 scripts/validate_harness.py --mode full` ->
  `HARNESS VALIDATION OK` with remote guard included.
- JSON parsing, Node/Python syntax and `git diff --check` -> passed.
- `PATH=/Users/lenkin/.nvm/versions/node/v22.13.0/bin:$PATH
  ./scripts/run_local_gates --profile dev --base origin/main --output
  exports/local-gates/cet4-closed-beta-readiness-v1-rebased.json` -> 24/24 passed
  with zero exception.
- PR checks -> pending publication.

## Validation results

- Tracked baseline validates and remains `ready=false`.
- 120-card/14-box/24-audio pilot scope, two-target mobile-only scope, deleted
  gates/dependencies and renamed launch ownership all fail closed.
- Candidate plus syntactically complete passed labels still fails while formal
  semantic ingestion is not implemented.
- One exact candidate may be recorded before evidence without becoming ready.
- Personal/development environment, missing retained parent, wrong content count
  and placeholder audio-QC hash all fail candidate validation.
- `--require-ready` exits nonzero against the honest tracked baseline.

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

- None. The readiness state records missing formal human review/QC but does not
  create, approve or mutate content evidence.

## Risks and open questions

- The state intentionally cannot become ready until type-specific repository
  evidence ingestion is implemented for its exact target and candidate schema.
- Existing launch evidence semantics are hard-bound to target `2027-Q2`; they
  must be parameterized carefully before reuse for `cet4-closed-beta` without
  weakening the public-launch contract.
- Receiver environment purchase/ownership, human content/audio review, signing
  credentials and real devices remain external inputs.

## Follow-up

- Finish validation, rebase after PR #514 auto-merges, publish and automatically
  merge this readiness-baseline PR.
- Implement closed-beta repository evidence ingestion by reusing registered
  type-specific semantics with exact `target_release=cet4-closed-beta` and the
  new candidate cohort, keeping every unregistered gate fail closed.
