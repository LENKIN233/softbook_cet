# Agent Run Record: CloudBase smoke record lifecycle

## Task summary

- Date: 2026-07-28
- Branch: `infra/cloudbase-smoke-cleanup`
- PR: https://github.com/LENKIN233/softbook_cet/pull/452
- Summary: Make every allowlisted CloudBase dev auth/write smoke own an exact, resumable cleanup lifecycle so passed, failed, and interrupted acceptance runs cannot silently leave test identity and learning records.

## Referenced specs

- `spec/authority-map.json`
- `spec/runtime-boundaries.json`
- `spec/harness-architecture.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `infra/cloudbase/mobile-runtime-contract.md`

## Product truth used

- Remote acceptance must preserve authenticated learning, membership, learning-event, daily-progress, and physical-space contracts.
- A CloudBase dev smoke is development evidence only. It is not production readiness, launch readiness, formal content approval, or a production account-deletion surface.
- Product behavior, formal card content, and approval state are unchanged.

## Implementation hypothesis changed

- A real dev auth/write smoke starts only from a clean identity/account baseline and uses one or two lifecycle-assigned `19xxxxxxxxx` phones.
- The lifecycle persists a mode-`0600` exact-ID deletion plan before its first delete, rejects count drift or unowned documents, supports partial-delete retry, and verifies every collection returns to the recorded baseline.
- The deployment manager owns cleanup around both live contract smokes. The Maestro parent owns cleanup across its delegated contract smoke and UI flow. A direct iOS manual run remains attached until interruption so cleanup does not run before manual acceptance ends.

## Workspace boundary and read scope

- Active truth/source read: `AGENTS.md`, the referenced specs and runtime contract, CloudBase deployment/smoke code, iOS acceptance wrappers, gate catalog, workflow, related tests, and CloudBase documentation.
- Generated/dependency/cache/archive read: the ignored exact cleanup script and prior ignored CloudBase reports needed to recover the real document model and baseline invariants; no generated artifact is committed.
- External workspace read: none.

## Files changed

- `infra/cloudbase/smoke-record-lifecycle.mjs`: add allowlisted prepare, exact discovery, ownership/window/count validation, persisted plans, partial retry, exact deletion, baseline verification, redaction, and CLI.
- `infra/cloudbase/test-smoke-record-lifecycle.mjs`: cover ownership, drift rejection, persisted-plan retry, private manifests, lifecycle integration, and unmanaged-dev-smoke rejection.
- `infra/cloudbase/manage-softbook-api.mjs`: own one lifecycle around CET4 write and CET6 read/auth deploy smokes.
- `infra/cloudbase/smoke-softbook-api.mjs`: accept an explicit isolated phone, suppress raw phone logging, and reject unmanaged CloudBase dev auth/write smokes before network access.
- `infra/cloudbase/smoke-ios-runtime.sh`, `infra/cloudbase/smoke-ios-maestro-runtime.sh`: add self/external lifecycle ownership and cleanup-failure propagation.
- `.github/workflows/pr-gates.yml`, `scripts/local_gates/catalog.py`, `scripts/test_run_local_gates.py`: add lifecycle regressions to required/local gates.
- `infra/cloudbase/README.md`: document ownership, cleanup, and recovery semantics.

## Commands run

- `node --test infra/cloudbase/test-smoke-record-lifecycle.mjs` -> 11 tests passed.
- `node --check` for the lifecycle, deployment manager, and smoke CLI -> passed.
- `bash -n` for both iOS smoke wrappers -> passed.
- Node 22.13.0 combined lifecycle/device regressions -> 25 tests passed.
- `python3 -m unittest discover -s scripts -p 'test_*.py'` -> 94 tests passed.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed with partial/local completeness.
- Mobile Node 22.13.0 lint -> 0 errors and 14 pre-existing inline-style warnings; typecheck -> passed; Jest -> 39 suites and 371 tests passed.
- CloudBase function `npm test` -> 137 tests passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `scripts/run_local_gates --profile dev` -> aggregate report failed before command gates because the host reports Python 3.9 instead of 3.12 and this managed Codex process cannot start nested network isolation; the catalog commands were run directly.
- Read-only CloudBase preflight -> failed before its first remote read because `tcb` is absent from this process PATH; no remote write was attempted.

## Validation results

- Pure cleanup planning rejects account ownership violations and collection-count drift before deletion.
- A simulated partial deletion resumes from the persisted exact plan and produces a redacted mode-`0600` completed manifest.
- The real CloudBase environment was not written during implementation or unit testing.
- Local Harness, backend, mobile, selector, runner, and lifecycle regressions pass. GitHub required checks are pending.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: Codex
- Status: Passed
- Blocking findings: none.
- Review summary: reviewed target allowlisting, clean-main preparation, complete account/auth inventory, phone/account ownership, exact rate-limit cardinality, timestamp windows, collection deltas, atomic plan persistence, partial-delete retry, exact-ID commands, post-delete baseline verification, completed-manifest redaction, shell trap failure propagation, deployment rollback interaction, Maestro parent ownership, and all readiness non-claims.

## User-visible UI impact

- N/A. No product screen, interaction, visual authority, or design artifact changed.

## Card make external workspace impact

- N/A. The external content workspace was not read or modified.

## Risks and open questions

- A hard kill before the first cleanup discovery leaves a prepared manifest without an exact ID plan; recovery still fails closed if document ownership or counts are ambiguous.
- The current process cannot run a read-only CloudBase baseline check because the `tcb` executable is unavailable; the next real deployment/acceptance run still rechecks the baseline before any smoke write.
- CoreSimulatorService remains unavailable to the current managed Codex process, so this change does not claim a passed real iOS/Maestro acceptance.
- The CloudBase runtime remains development-only and is not the planned production service.

## Follow-up

- Complete local review and all repository gates, then open a PR with this record.
- After merge, run one real iOS Maestro acceptance from a host process with CoreSimulator access and verify the lifecycle restores the zero identity/account baseline.
