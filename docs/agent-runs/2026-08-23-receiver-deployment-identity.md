# Agent Run Record: receiver deployment identity

## Task summary

- Date: 2026-08-23
- Branch: `infra/receiver-deployment-identity-v2`
- PR: https://github.com/LENKIN233/softbook_cet/pull/513
- Summary: Bind formal and controlled-pilot receiver deployments to one
  deterministic backend deployment identity derived from the exact repository
  commit, complete receiver profile and fixed API/worker topology, inject that
  non-secret identity into the API function, and remotely reread it after deploy
  and during verify.

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
- `infra/cloudbase/controlled-pilot-v1-runtime-contract.md`

## Product truth used

- A receiver deployment is not proved by a repository test, dry-run, simulated
  CloudBase runner, CLI success string or self-declared report status.
- Formal evidence must bind one exact reachable repository commit, receiver
  profile/environment and backend deployment cohort without exposing runtime
  secrets.
- The personal development environment remains forbidden for formal or pilot
  receiver delivery.
- Controlled-pilot reports remain `gate_eligible=false` even when the remote
  deployment identity is exact.

## Implementation hypothesis changed

- `backend-deployment-identity.v1` is a deterministic SHA-256 identity over the
  exact clean repository commit, the fully validated public receiver profile,
  and the fixed `softbook-api` plus account-deletion-worker runtime topology.
- Formal `receiver-delivery-report.v2` and controlled-pilot
  `controlled-pilot-receiver-delivery-report.v2` expose the expected identity.
- Every v2 report records canonical start/completion timestamps; apply and
  verify require an identified `github:`, `team:` or `external:` operator.
- Deploy injects `SOFTBOOK_BACKEND_DEPLOYMENT_ID` into `softbook-api` only.
  The account-deletion worker remains free of every custom runtime variable.
- After both functions deploy, the command rereads `softbook-api` from the
  CloudBase control plane and requires the exact deployment ID, handler,
  runtime and timeout. Formal and pilot verify repeat the same remote check.
- Public reports retain only the deployment ID and runtime variable names;
  secret values are discarded.

## Workspace boundary and read scope

- Active truth/source read: the listed specs/contracts, formal and pilot
  delivery commands, receiver adapter, launch-evidence contract, delivery tests
  and current CloudBase CLI environment/authentication behavior.
- Generated/dependency/cache/archive read: backend dependencies were installed
  from the tracked lockfile for tests and are not product truth.
- External control-plane read: the logged-in CloudBase account was queried
  read-only. It still exposes only the explicitly forbidden personal
  development environment; no receiver deployment was attempted.
- External card workspace: only current formal-review tool availability and
  exact 1,180-card/108-box/301-audio scope were read; no content or verdict was
  changed.

## Files changed

- `infra/cloudbase/deliver-release.mjs`: deterministic deployment identity,
  report v2, runtime injection and exact remote API-function inspection.
- `infra/cloudbase/deliver-controlled-pilot.mjs`: shared identity and remote
  inspection while preserving pilot gate ineligibility.
- Formal/pilot delivery tests: profile/commit scoping, remote drift failure and
  secret-value non-disclosure.
- `spec/runtime-boundaries.json`, release/pilot runtime contracts and CloudBase
  README: authority, implementation and remaining external evidence boundary.
- Product contract mirror: protects the new runtime-boundary identity.
- `docs/agent-runs/2026-08-23-receiver-deployment-identity.md`: this record.

## Commands run

- Focused formal/pilot receiver delivery tests -> 17/17 passed before the final
  full validation run.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> 295/295 passed.
- `python3 scripts/test_learning_events_contract.py` -> 17/17 passed.
- `python3 scripts/validate_harness.py --mode full` ->
  `HARNESS VALIDATION OK` with remote guard included.
- JSON parse, Node syntax and `git diff --check` -> passed.
- `PATH=/Users/lenkin/.nvm/versions/node/v22.13.0/bin:$PATH
  ./scripts/run_local_gates --profile dev --base origin/main --output
  exports/local-gates/receiver-deployment-identity-v2-operator-final.json` ->
  24/24 passed with the exact required deployment Node version.
- PR checks -> pending publication.

## Validation results

- Same commit and validated profile reproduce the same deployment ID.
- Changing either repository commit or receiver environment changes the ID.
- Runtime deployment contains the ID and still excludes
  `SOFTBOOK_SMS_DEV_CODE`.
- Remote API inspection fails on a mismatched ID or function shape.
- Apply and verify reports cannot be created without an identified operator;
  all reports bind canonical execution start and completion timestamps.
- Public inspection output includes secret variable names where operationally
  useful but never their values.
- No CloudBase write, deployment, publication, launch-gate evidence or release
  candidate was created by this repository change.

## Binary evidence

- Evidence manifest: N/A. No retained binary, screenshot, recording or device
  evidence is produced.
- Archive: N/A.

## Agent review status

- Reviewer: Codex primary exact-diff and gate review.
- Status: passed local exact-diff and full-gate review.
- Blocking findings: none.

## User-visible UI impact

- None. No screen, component, copy, interaction, navigation, motion or visual
  token changes.

## Card make external workspace impact

- None. No card payload, approval, audio asset, audit or QC record changes.

## Risks and open questions

- A deterministic ID and successful remote control-plane reread do not prove a
  deployment occurred until real receiver reports exist.
- `production-deployment` launch evidence still needs a registered
  type-specific semantic wrapper over real deploy and verify reports.
- Receiver profile/secrets, formal content/audio evidence and real iOS/Android
  devices remain external inputs.

## Follow-up

- Finish validation, publish and automatically merge this PR.
- Register exact `production-deployment` launch evidence semantics over the v2
  deploy/verify reports without accepting dry-run, pilot or simulation output.
