# Agent Run Record: Canonical Day And Mutation Replay Repair

## Task summary

- Date: 2026-07-25
- Branch: `fix/canonical-day-mutation-replay`
- PR: `#443` (`https://github.com/LENKIN233/softbook_cet/pull/443`)
- Summary: align mobile daily state with the fixed UTC+8 China product day,
  and prevent strict terminal physical-space rejections from permanently
  blocking later account mutations.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/account-sync-contract.json`
- `spec/runtime-boundaries.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `infra/cloudbase/space-actions-v2-runtime-contract.md`

## Product truth used

- Daily-level progress, bootstrap, and explicit check-in must refer to one
  China product day rather than a device or UTC calendar date.
- Physical-space state is server-authoritative after authentication. Favorite
  remains a tag and sleep remains an independent learning-eligibility action.
- A rejected device action cannot remain optimistic authority or block
  unrelated later account commands forever.
- Green local checks do not create deployment, content approval, or launch
  readiness.

## Implementation hypothesis changed

- Added one mobile UTC+8 day-key helper for bootstrap, check-in, statistics,
  persistence tests, and Mine presentation.
- Preserved strict CloudBase error codes in remote physical-space failures.
- Classified only `space_card_not_in_content` and
  `space_action_id_conflict` as terminal immutable-action rejections.
- Added a bounded, credential-free local quarantine. A terminal command is
  written there before active FIFO removal; later mutations then continue.
- Excluded quarantined actions from optimistic overlays, refreshed canonical
  bootstrap, and surfaced a user-facing recovered-state diagnosis.
- Kept content-version mismatch, unknown HTTP errors, transport failures,
  malformed responses, authorization, and cancellation outside the terminal
  removal path.

## Workspace boundary and read scope

- Active truth/source read: the referenced specs and runtime contract; mobile
  App, time, remote HTTP, physical-space, mutation queue, focused tests,
  Harness contract mirrors, and PR delivery validators.
- Generated/dependency/cache/archive read: ignored local-gate JSON and logs
  were read only to confirm validation status.
- External workspace read: none. `/Users/lenkin/programing/card make` was not
  read or modified.

## Files changed

- `spec/account-sync-contract.json`, `spec/runtime-boundaries.json`,
  `spec/evals.json`: own and test the corrected day and terminal-replay
  boundaries.
- `security/dependency-audit-policy.json`: retain newly published
  `GHSA-MH99-V99M-4GVG` as a visible high-severity exception through
  2026-08-01 because no API-compatible patched 1.x release exists.
- `infra/cloudbase/space-actions-v2-runtime-contract.md`: document exact
  terminal and retryable mobile behavior.
- `scripts/harness_validator/sections/product_contract_mirrors.py`: mirror the
  owner and runtime contracts.
- `apps/mobile/src/shared/chinaDay.ts`, `apps/mobile/App.tsx`: use one UTC+8
  product day and reconcile terminal space-action outcomes.
- `apps/mobile/src/runtime/remoteHttpError.ts`,
  `apps/mobile/src/space/spaceStateRepository.ts`: retain a strict remote error
  code for classification.
- `apps/mobile/src/sync/mutationQueue.ts`,
  `apps/mobile/src/sync/mutationQueueRepository.ts`: durably quarantine only
  exact terminal actions and continue the active FIFO.
- Mobile tests: cover UTC+8 rollover, strict code parsing, durable quarantine,
  persistence failure, continuation, retryable 409 retention, App recovery,
  canonical rollback, and credential exclusion.

## Commands run

- `python3 scripts/validate_harness.py --mode local --format text` -> passed;
  completeness correctly remained partial because remote delivery was not run.
- `cd apps/mobile && npm test -- --runInBand --no-watchman` -> 39 suites and
  371 tests passed.
- `cd apps/mobile && npm run typecheck` -> passed.
- `cd apps/mobile && npm run lint` -> zero errors and 14 pre-existing
  inline-style warnings.
- `cd infra/cloudbase/functions/softbook-api && npm test` -> 108 tests passed.
- Node 22.13.0 `./scripts/run_local_gates --profile dev --output
  exports/local-gates/canonical-day-mutation-replay-node22-dev.json` ->
  complete 18/18 passed.
- The first strict PR profile exposed new registry advisory
  `GHSA-MH99-V99M-4GVG`, pending review state, Ruby path drift, and a missing
  local remote-tracking ref. The branch ref and Ruby 3.3 path were corrected;
  the advisory remains visible under a one-week exception rather than being
  reported as zero vulnerabilities.
- `git diff --check` -> passed before this record and will be repeated during
  closeout.

## Validation results

- Beijing `00:00` now rolls to the new day at `16:00Z`; year rollover and
  invalid instants are covered.
- A removed-card or action-ID-conflict 409 is quarantined without credentials,
  removed from the active queue only after quarantine persistence, and no
  longer overlays canonical state.
- If quarantine persistence fails, the original active command remains
  byte-equivalent and replayable.
- Later account mutations replay after a terminal action; content-version and
  unknown failures remain active and retain FIFO ordering.
- App-level coverage proves the optimistic favorite is cleared by refreshed
  canonical bootstrap and the recovered state is visible without internal
  metadata leakage.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: Codex
- Status: Passed locally for the reviewed branch diff.
- Blocking findings: none.

## User-visible UI impact

- Design artifact:
  `docs/design/decisions/mobile-core-surface-reset-v1.md`.
- Physical-space artifact:
  `docs/design/physical-space/space-state-baseline-v1.md`.
- Implementation mapping:
  `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
  plus the existing `SpaceStatusRail` state in `apps/mobile/App.tsx`.
- Impact: no geometry, color, navigation, card silhouette, or interaction
  changed. Existing sync status now states when an obsolete action was not
  applied and canonical space state was restored.
- Unimplemented gap: no visual capability was added; real-device release QA
  and production deployment remain pending.

## Design review checklist

- Q1 Law of One/current library: the current CET library and single accent
  ownership are unchanged.
- Q2 focal object/first-read path: Learning's card and Space's physical object
  remain focal; the status rail remains secondary.
- Q3 interaction silhouette: single-card Learning and shelf/box Space
  silhouettes are unchanged.
- Q4 forbidden patterns: no forbidden gradient, gamification chrome, extra
  navigation, or decorative container was added.
- Q5 containment/safe area: no dimensions, overflow, viewport, or safe-area
  behavior changed; the existing bounded status rail contains the new copy.
- Q6 surface rule: Learning, statistics, flip behavior, and module ownership
  are unchanged.
- AP-22: all six design-review questions above were answered before delivery.
- AP-23: self-assess remains exactly two states, mint `有把握` and amber
  `再回看`.

## Card make external workspace impact

- N/A. No candidate cards, approvals, audio, or exported payload changed.

## Risks and open questions

- The backend and mobile integration remain repository-local and undeployed.
- Quarantine is bounded local diagnostic evidence and is cleared on logout; it
  is not a server acknowledgement or analytics pipeline.
- `GHSA-MH99-V99M-4GVG` remains a high-severity dependency finding in the
  React Native Jest/tooling chain. The exception expires on 2026-08-01 and must
  be removed as soon as an API-compatible maintenance release is available.
- Production observability should count terminal rejection codes after
  deployment without logging card text, phone numbers, or credentials.

## Follow-up

- Run the strict PR profile for `#443`, then merge only after the recorded
  review and all required GitHub checks pass.
