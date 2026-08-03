# Agent Run Record: CET4 Controlled Pilot Contract

## Task summary

- Date: 2026-08-01
- Branch: `cross/controlled-pilot-contract`
- PR: https://github.com/LENKIN233/softbook_cet/pull/472
- Summary: Defined the pre-beta CET4 controlled-pilot product truth, made the first valid Learning Session the only atomic 120-hour trial trigger, added isolated gate-ineligible pilot artifact validators, and preserved the formal CET4 closed-beta 1,180-card/301-audio whole-track threshold.

## Referenced specs

- `AGENTS.md`
- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/box-catalog.json`
- `spec/evals.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `infra/cloudbase/learning-session-v1-runtime-contract.md`
- `infra/cloudbase/bootstrap-v2-runtime-contract.md`
- `infra/cloudbase/content-manifest-v1-runtime-contract.md`
- `infra/cloudbase/release-bundle-v1-runtime-contract.md`

## Product truth used

- `product_truth`: The controlled pilot is a pre-beta CET4 product proof for 30–50 invited iOS and Android users. Web is internal acceptance only, payment is unavailable, and all pilot artifacts are `gate_eligible=false`.
- `product_truth`: Trial begins only when a valid authenticated Learning Session has validated content, selected a card, persisted its cursor, and is ready to return successfully. The server writes immutable `trial_started_at` and `trial_expires_at` exactly 120 hours apart; login and failed sessions do not consume trial time.
- `product_truth`: A dedicated phone/SMS login surface precedes the entire product shell. Before authenticated session restoration and required account hydration succeed, Learning, Space, Statistics, Mine, and their four-item navigation are neither mounted nor reachable; logout or invalidation returns to the same single entry boundary.
- `product_truth`: Pilot content is exactly 120 formally approved CET4 cards with an approved stable 60-card free subset, the fixed seven-library distribution, at least two boxes per library, all five core interactions, zero unmapped cards, zero duplicate IDs, and QC for every referenced audio asset.
- `product_truth`: Repository development cards, external candidate rows, fixtures, and dry-run projections are not approved pilot cards. The current development-source count of ten cards therefore does not satisfy the pilot gate.
- `product_truth`: Formal CET4 closed beta remains exactly 1,180 cards, 301 audio references, and one whole-track final approval.
- `product_truth`: The controlled-pilot bundle must bind the exact 120-card `card make` scoped quality audit. The current candidate's 120 disclosed `synthetic_source` findings are explained source risks, not a basis for a true-exam claim; any missing disclosure, unknown risk, scope drift, hard blocker, content risk or review gap fails publication.
- `product_truth`: Every positive multiple of the cumulative account-and-track canonical `server_sequence` is one server-gated round boundary. Day-scoped progress is not round authority. The next card cannot be selected until the authenticated client explicitly acknowledges the exact server receipt; duplicate events, midnight rollover, restart, offline replay, and cross-device reads cannot duplicate or skip the boundary.
- `product_truth`: The receipt's read-only review action resolves only ordered `review_card_ids` returned by the server from the canonical latest per-card event projection. The mobile client cannot infer review content from local results or expose a dead review action in server scheduling mode.
- `product_truth`: The completion aperture resolves only server-owned `space_card_id`, equal to the active-content card from the canonical event whose `server_sequence` is the exact `completed_count` boundary. Phase grouping and client/device time cannot author the shown Space address.

## Implementation hypothesis changed

- Added strict local validators for `controlled-pilot-profile.v1`, `controlled-pilot-bundle.v1`, `pilot-content-release.v1`, `pilot-entitlement-command.v1`, and `pilot-outcome-report.v1`.
- Added exact schema, count, coverage, mapping, audit, timestamp, decision-threshold, and formal-delivery rejection tests.
- Updated the product-contract harness to preserve the new Learning Session trial authority and added regression HR-45 plus golden task GT-37.
- Tightened the authentication owner/mirrors and GT-10 so future implementations cannot repeat one login gate inside each of the four product pages.
- This PR does not implement remote persistence, a pilot publisher, entitlement storage, account-deletion cleanup, mobile wiring, deployment, approved content import, or real-device evidence.
- The 2026-08-02 continuation adds the missing `pilot-round-continue.v1` authority: an exact authenticated idempotent command, deterministic receipt, account-scoped continuation record, and scheduler prohibition on selecting the next card before acknowledgement. Backend and mobile implementation remain in later PRs.
- The 2026-08-03 product-flow audit adds ordered unique `review_card_ids` to `pilot-round-completion.v1`, derived from canonical latest `answer_grade=review_needed` projections in active card-source order.
- The 2026-08-03 completion-continuity audit adds exact `space_card_id` to `pilot-round-completion.v1`, derived from the canonical event at the boundary sequence so offline replay, cross-device reads, phase grouping and clock drift cannot misidentify the compact Space address.
- The 2026-08-03 content-evidence audit replaces the summary-only pilot audit descriptor with a path/hash-bound `card-make-quality-audit-v1` scoped report contract, exact 120-card scope/corpus digests and the only permitted explained risk: disclosed synthetic training content that must not be represented as true-exam material. Publisher byte verification remains in the runtime PR.

## Workspace boundary and read scope

- Active repository truth/source read: only the referenced specs, runtime contracts, formal delivery validator, product-contract harness, controlled-pilot implementation and tests.
- External workspace read: `/Users/lenkin/programing/card make` was inspected read-only only to identify the distinction between candidate/seed material and approved export payloads. No external files were modified and no candidate content was counted as approved pilot content.
- Generated, dependency, cache, and archive paths were not used as product authority.

## Files changed

- Product truth and ownership: `spec/requirement-memory.json`, `spec/product-core.json`, `spec/account-sync-contract.json`, `spec/membership.json`, `spec/runtime-boundaries.json`, `spec/authority-map.json`, `AGENTS.md`.
- Authentication entry mirror: `spec/platform-contract.json`, `spec/evals.json`, and `scripts/harness_validator/sections/product_contract_mirrors.py`.
- Runtime contracts: `infra/cloudbase/controlled-pilot-v1-runtime-contract.md`, Learning Session, bootstrap, content manifest, and formal release-bundle contracts.
- Validation: `infra/cloudbase/controlled-pilot-v1.mjs`, its backend unit test, `spec/evals.json`, and `scripts/harness_validator/sections/product_contract_mirrors.py`.
- Durable context: this run record.

## Commands run

- `node --check infra/cloudbase/controlled-pilot-v1.mjs` -> passed.
- `node --test infra/cloudbase/functions/softbook-api/test/controlled-pilot-v1.test.js` -> passed, 6 tests.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 212 tests.
- `python3 -m py_compile scripts/harness_validator/sections/product_contract_mirrors.py` -> passed.
- `python3 scripts/validate_harness.py` -> passed, `HARNESS VALIDATION OK`.
- `jq empty` over all modified JSON specs -> passed.
- `git diff --check` -> passed.
- 2026-08-02 continuation: JSON parsing, `git diff --check`, and `python3 scripts/validate_harness.py` -> passed after adding the five-card round owner/mirror/eval checks.
- 2026-08-02 continuation: clarified the round count as the cumulative canonical learning projection `server_sequence`; daily `progress.total_completed_count` remains daily feedback only, preventing midnight rollover from reopening or skipping a boundary.
- 2026-08-02 continuation: bound Mine's remaining-time presentation to server-derived `trial_remaining_seconds` on membership, Bootstrap, and Learning Session reads; clients may format the value but cannot derive it from device time.
- 2026-08-02 continuation: recorded the runtime topic-branch implementation state and exact Learning Session/Bootstrap response fields without treating repository implementation as deployment evidence.
- 2026-08-02 product-entry correction: added the dedicated-login/app-shell owner and mirror checks after the user rejected the four-page repeated-login flow.
- 2026-08-03 round-review correction: JSON parsing, harness validation, and diff checks cover the new server-authoritative review-content rule; runtime and mobile remain separate later PR changes.
- 2026-08-03 content-evidence audit: `node --check infra/cloudbase/controlled-pilot-v1.mjs`, the controlled-pilot contract tests (6/6), `python3 scripts/validate_harness.py`, and `git diff --check` passed. The isolated worktree reused the primary worktree's installed backend module path; its first unqualified test invocation failed only because that worktree had no local `ts-fsrs` install and is not counted as a product failure or passing run.
- `./scripts/run_local_gates --profile dev --base origin/main --verbose` -> `PASSED_WITH_EXCEPTION`, 23/24 passed; only the declared toolchain exception applied, and all executed harness, mobile, Web, backend, metadata, launch-contract, and build checks passed. Report: `exports/local-gates/20260801T072526Z-5b592247-dev-54469/report.json`.
- PR checks: pending.

## Validation results

- Pilot profile is CET4-only, receiver-bound, limited to 30–50 users, and gate-ineligible.
- Pilot bundle rejects any count other than 120/60 and rejects incomplete library, box, interaction, mapping, duplication, approval, audit, or audio-QC evidence.
- Pilot bundle validation rejects an omitted, renamed or miscounted synthetic-source disclosure before the runtime publisher reads evidence bytes.
- Trial product truth is identical across owner and mirror specs, and the harness rejects future drift.
- Formal `delivery-profile.v1` and `release-bundle.v1` validators reject pilot artifacts; their 1,180/301 thresholds were not changed.
- Outcome decisions are recomputed from aggregate counts and cannot advance when any threshold or P0 condition fails.
- Five-card completion is now contractually fail-closed: the cumulative canonical account-and-track `server_sequence` must be a positive multiple of five, Learning Session returns no next selection at an unacknowledged boundary, and only the exact server-derived continue receipt can release scheduling.
- The same receipt now carries deterministic ordered review card IDs, so “回看待复习内容” is functional in server mode without client-side inference or ordering.
- Authentication is now an app-entry boundary rather than a per-route placeholder: signed-out and unvalidated-restoration states expose one dedicated phone/SMS surface and no four-tab product navigation.

## Agent review status

- Reviewer: Codex
- Status: Passed
- Blocking findings: none
- Review summary: Verified owner/mirror consistency, exact pilot/formal release isolation, fail-closed schema keys and counts, timestamp chronology, private receiver environment rejection, stable command idempotency across dry-run/apply execution, aggregate outcome threshold recomputation, and honest non-claims. The review found and resolved two issues before pass: the known personal development environment is now rejected, and dry-run/apply mode was moved outside the immutable entitlement command so the command hash remains stable.

## User-visible UI impact

- None. This is the product-contract/schema PR only. It intentionally does not change React Native screens, navigation, copy, visuals, interaction implementation, or motion.
- Trial notification, five-card completion, and pilot membership UI require a separate accepted design-only PR before implementation.

## Card make external workspace impact

- Read-only inspection only; no candidate card, approval, audio, review, or report was created or modified.
- The later 120-card handoff must originate as an approved export payload from `/Users/lenkin/programing/card make`; this repository will only dry-run, import, audit, smoke-test, and report its coverage delta.

## Risks and open questions

- The five pilot schemas are local static validators, not a deployed publisher or service implementation.
- Trial timestamps are now product truth but current membership storage and clients have not yet been migrated; that work belongs to the later backend and mobile PRs.
- The original runtime implementation did not yet persist round continuation or gate the scheduler; this was found during mobile implementation review and must be added before the completion UI can claim cross-device idempotency.
- The current development card source contains only ten sample cards across CET4 and CET6, while the 120 formally approved CET4 pilot cards remain externally pending.
- Receiver CloudBase, real SMS, private audio, TestFlight, Android closed testing, account deletion worker, and real-device evidence remain external or later-phase blockers.

## Follow-up

- Merge this contract PR after required review and gates.
- Create a separate design-only PR for the CET4 pilot identity, non-blocking first-card trial notice, five-card completion object, and pilot membership state.
- Implement the receiver pilot publisher, timestamp persistence, entitlement store, deletion cleanup, and deployment tooling only after the contract is merged.
