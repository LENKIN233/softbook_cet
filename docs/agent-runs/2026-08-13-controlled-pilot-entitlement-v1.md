# Agent Run Record: controlled pilot entitlement

## Task summary

- Date: 2026-08-13
- Branch: `module/controlled-pilot-entitlement-v1`
- PR: pending
- Summary: Implement a dry-run-first, receiver-operator controlled-pilot entitlement that atomically rederives base membership, stores its audit plus overlay, appears to clients as existing premium access, and never exposes a client grant route.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `infra/cloudbase/controlled-pilot-v1-runtime-contract.md`
- `infra/cloudbase/release-bundle-v1-runtime-contract.md`
- `infra/cloudbase/mobile-runtime-contract.md`

## Product truth used

- An invited controlled-pilot participant may receive continued complete access without payment only from a receiver operator.
- Pilot access is an independent, audited overlay and must not overwrite canonical base membership or be confused with formal closed-beta entitlement.
- Client-visible membership remains the existing `premium` state; `pilot_premium` is audit vocabulary, not a new UI state.
- Controlled-pilot artifacts and repository validation remain `gate_eligible=false` and cannot substitute for formal beta or launch evidence.

## Implementation hypothesis changed

- Added a separate `softbook_pilot_entitlements` collection whose active grant and append-only audit share one account-keyed record.
- Added an IAM-authenticated non-HTTP receiver-function invocation with an independent receiver-only command HMAC. It transactionally reads base membership, beta entitlement and pilot entitlement, rederives claimed stages, then writes only the pilot overlay.
- Added a dry-run-first operator CLI. Apply is restricted to clean `main` at `origin/main`, invokes the receiver transaction, and independently rereads the stored audit before reporting success.
- Added controlled-pilot-only Bootstrap revision tracking. Non-pilot Bootstrap keeps its former wire shape; updated clients normalize a missing pilot revision to zero.
- Bound active access to the exact configured pilot ID and immutable profile expiry without inventing an audit event at expiry.

## Workspace boundary and read scope

- Active truth/source read: the referenced specs and runtime contracts, CloudBase delivery/runtime implementation, mobile bootstrap/mutation persistence, and related tests.
- Generated/dependency/cache/archive read: installed CLI source only to confirm the local `tcb fn invoke --json` response contract; no archive was used as product truth.
- External workspace read: none. No candidate card content or approval state was created or modified.

## Files changed

- Membership/account-sync/runtime specs and the controlled-pilot contract document the operator-only overlay, revision semantics, undeployed status, and remaining receiver work.
- CloudBase function/runtime modules implement strict command validation, audit sequencing, atomic mutation, exact pilot/expiry checks, membership overlay, and controlled-pilot Bootstrap revision.
- Delivery, provisioning and smoke lifecycle code carries pilot runtime identity and includes the new collection in exact receiver inventory/cleanup.
- Mobile bootstrap and persisted revision boundaries accept the controlled-pilot revision while preserving the legacy non-pilot response.
- Tests cover stage rederivation, replay/collision behavior, exact pilot binding, expiry, atomic stale-stage rejection, CLI preflight/apply verification, deployment environment, Bootstrap and mobile compatibility.

## Commands run

- Focused pilot/CLI/API Node tests -> 71/71 passed after the transactional self-review fix.
- Full backend Node test run -> 267/267 passed under the required Node 22.13.0 runtime.
- Full mobile Jest run -> 46 suites / 499 tests passed.
- `npm run lint -- --quiet` and `npm run typecheck` in `apps/mobile` -> passed.
- `git diff --check`, JSON validation and Node syntax checks -> passed.
- `python3 scripts/validate_harness.py --mode local` and `python3 scripts/validate_harness.py` -> passed.
- `./scripts/run_local_gates --profile dev` with required Node 22.13.0 and Ruby 3.3.12 -> 24/24 passed.
- The first PR-profile local-gate run used the shell defaults Node 25.9.0 and Ruby 2.6.10 and therefore correctly reported toolchain drift; it also deferred PR-context gates because no PR existed yet and reported unrelated machine-wide worktree health. The matching-toolchain dev profile is the repository-local pre-PR result, not formal CI evidence.

## Validation results

- A stale or forged base stage is rejected inside the same transaction that would write the overlay; no pilot document is committed.
- Exact command replay is idempotent, event-ID content collisions fail closed, and an active grant cannot cross pilot IDs.
- The base membership record remains unchanged; beta is resolved before pilot stage validation.
- The client receives only existing `premium`; non-controlled runtime does not read or expose the pilot overlay.
- An active grant stops authorizing at exact profile expiry and its component revision advances monotonically without an unaudited mutation.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: Codex self-review, explicitly approved by the user
- Status: Passed locally; required PR checks pending
- Blocking findings: none after resolving two self-review findings. The first implementation used a pilot-document CAS after separately reading base membership, so the audited stages could race; apply now runs as one receiver database transaction and is independently reread by the CLI. The first internal invocation relied on receiver IAM alone; it now also requires an independent receiver-only command HMAC, preventing a client-capable function invocation from granting access.

## User-visible UI impact

- None. No screen, layout, visual state or interaction was added. The runtime intentionally maps pilot access to the existing `premium` client state.
- Design source / interaction artifact / design checklist: N/A because this change alters authorization and synchronization authority only.

## Card make external workspace impact

- None. This repository continues to consume only approved exported payloads; it did not produce candidate cards, approve a batch, or count development seeds as formal content.

## Risks and open questions

- Repository implementation is not deployed; a receiver-owned profile, secrets, IAM operator and environment execution are still required.
- All 24 referenced audio assets still require identified-human perceptual approval.
- The account-deletion collection lifecycle is covered, but the receiver deletion worker has not been executed.
- Real iOS and Android validation remains pending after receiver deployment.

## Follow-up

- Complete self-review, full gates, PR review and merge. Then proceed to receiver configuration/audio approval/deployment and real-device evidence without treating pilot artifacts as launch evidence.
