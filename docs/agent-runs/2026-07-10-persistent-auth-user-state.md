# Agent Run Record: Persistent Auth And User State

## Task summary

- Date: 2026-07-10
- Branch: `module/persistent-auth-user-state`
- PR: pending
- Summary: Reimplement the archived persistence intent on the post-cutover baseline with a secure auth-session store and a separate versioned user-state store.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/account-sync-contract.json`
- `spec/runtime-boundaries.json`
- `spec/agent-run-record.json`

## Product truth used

- Authentication is required before learning and phone plus SMS code remains the primary login method.
- Learning state, physical-space state, and membership entitlement are synchronized; server entitlement wins.
- Offline mutations remain queued locally and replay independently after reconnect.

## Implementation hypothesis changed

- `AuthSessionStore` saves the phone-number session and token in the platform Keychain/Keystore under `auth-session.v1`; tokens never enter AsyncStorage.
- `UserStateStore` saves account-owned check-in, learning cursor, favorite tags, and sleep state in versioned AsyncStorage under `user-state.v1`.
- Invalid persisted payloads degrade to logged-out or empty user state. Transient storage read failures do not delete or overwrite unknown state.
- Membership is reloaded through `MembershipRepository` after auth restoration; it is not persisted as local authority.
- The mutation queue retains its independent storage key and lifecycle.

## Workspace boundary and read scope

- Active truth/source read: auth, membership, learning, space, sync repositories; runtime specs; current App tests and native dependency manifests.
- Archive read: `/Users/lenkin/Archives/softbook-cutover-2026-07-10/softbook-evidence/stash-0.patch` as read-only intent evidence.
- Archived code was not applied, cherry-picked, or copied as a module because it mixed token and membership state into AsyncStorage.
- External `card make` workspace read or write: none.

## Files changed

- `apps/mobile/src/persistence/authSessionStore.ts`: secure versioned auth-session storage.
- `apps/mobile/src/persistence/userStateStore.ts`: account-owned versioned non-sensitive user state.
- `apps/mobile/App.tsx`: restore, persist, cursor resume, server membership refresh, and logout cleanup wiring.
- `apps/mobile/__tests__/App.persistence.test.tsx`: relaunch, check-in, cursor, favorite/sleep, corruption, logout, and remote entitlement coverage.
- `apps/mobile/__tests__/authSessionStore.test.ts` and `apps/mobile/__tests__/userStateStore.test.ts`: store contracts and failure behavior.
- `apps/mobile/package.json`, lockfiles, and native Pods: `react-native-keychain@10.0.0` integration.
- `spec/runtime-boundaries.json`: runtime persistence hypothesis and authority boundaries.

## Commands run

- `npm ci` in `apps/mobile` -> passed from the committed lockfile.
- `npm test -- --runInBand --watchAll=false` -> passed 29 suites and 178 tests.
- `npm run typecheck` -> passed.
- `npm run lint -- --quiet` -> passed.
- `npm audit --omit=dev --json` -> existing production baseline remains 15 findings; `react-native-keychain` adds none.
- `bundle exec pod install` with the repository-locked CocoaPods 1.15.2 -> passed; `RNKeychain` is present in the native dependency graph.
- `python3 scripts/validate_harness.py` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- Metadata leak scan and backend test suite -> passed.
- Release simulator build with signing disabled -> passed.
- Release device archive with signing disabled -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook-persistence-pr-body.md` -> passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook-persistence-pr-body.md --changed-file apps/mobile/App.tsx` -> passed.

## Validation results

- Store and App persistence tests: passed.
- Full local engineering validation: passed.
- CI validation: pending.

## Binary evidence

- Evidence manifest: N/A.
- Archive: N/A.
- No screenshots or generated binary evidence are committed.

## Agent review status

- Reviewer: Codex
- Status: Passed
- Blocking findings: none

## User-visible UI impact

- None. Existing screens, copy, controls, and navigation are unchanged.
- Design artifact and design review checklist: N/A for a persistence-only runtime change.

## Card make external workspace impact

- None. Candidate PRs and formal approval state are unchanged.

## Risks and open questions

- The existing mobile dependency graph retains the pre-cutover production audit baseline; dependency remediation remains a separate scoped task.
- Keychain data may outlive an iOS reinstall by platform design, but explicit in-app logout clears the dedicated service record.

## Follow-up

- Open the persistence PR and merge only after all required remote checks pass.
