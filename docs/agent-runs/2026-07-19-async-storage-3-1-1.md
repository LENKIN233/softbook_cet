# Agent Run Record: AsyncStorage 3.1.1 upgrade

## Task summary

- Date: 2026-07-19
- Branch: `fix/update-async-storage-3-1-1`
- PR: https://github.com/LENKIN233/softbook_cet/pull/420
- Summary: Upgrade the mobile AsyncStorage dependency from 3.0.2 to 3.1.1 and regenerate both JavaScript and iOS native dependency locks. This supersedes Dependabot PR #411, which omitted the required `Podfile.lock` update and therefore failed the iOS deployment-lock check.

## Referenced specs

- `spec/runtime-boundaries.json`
- `spec/account-sync-contract.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`

## Product truth used

- Account tokens remain in platform Keychain or Keystore and must not be stored in AsyncStorage.
- Versioned AsyncStorage remains the implementation boundary for non-sensitive `user-state.v2`, the auth revocation tombstone, and the independent mutation queue.
- No product behavior, approval state, launch readiness, or card-content truth changes in this run.

## Implementation hypothesis changed

- Replace `@react-native-async-storage/async-storage` 3.0.2 with 3.1.1 while preserving the existing persistence schemas and repository APIs.
- Keep the npm lock and CocoaPods lock synchronized so iOS `pod install --deployment` can reproduce the declared native module version.

## Workspace boundary and read scope

- Active truth/source read: the referenced specs, `apps/mobile/package.json`, `apps/mobile/package-lock.json`, `apps/mobile/ios/Podfile.lock`, mobile persistence tests, and PR #411 metadata/logs.
- Generated/dependency/cache/archive read: installed `node_modules` and generated CocoaPods metadata only to regenerate and validate ignored build output; no generated output is tracked.
- External workspace read: none; `/Users/lenkin/programing/card make` is outside this dependency-only change.

## Files changed

- `apps/mobile/package.json`: declare AsyncStorage 3.1.1.
- `apps/mobile/package-lock.json`: lock the 3.1.1 npm artifact and integrity hash.
- `apps/mobile/ios/Podfile.lock`: lock the 3.1.1 pod and podspec checksum.
- `docs/agent-runs/2026-07-19-async-storage-3-1-1.md`: record scope, validation, and review state.

## Commands run

- `./scripts/install_git_hooks.sh` -> repository hooks installed.
- `npx --yes --package node@22.13.0 --package npm@10.9.2 npm install --package-lock-only --ignore-scripts` -> package lock regenerated; 0 vulnerabilities.
- `npx --yes --package node@22.13.0 --package npm@10.9.2 npm ci` -> 873 packages installed; postinstall normalization completed; 0 vulnerabilities.
- `bundle exec pod install --project-directory=ios` -> AsyncStorage 3.1.1 installed and native lock regenerated.
- `npx --yes --package node@22.13.0 --package npm@10.9.2 npm run lint` -> passed with 14 pre-existing inline-style warnings and 0 errors.
- `npx --yes --package node@22.13.0 --package npm@10.9.2 npm run typecheck` -> passed.
- `npx --yes --package node@22.13.0 --package npm@10.9.2 npm test -- --runInBand` -> 29 suites and 187 tests passed.
- `bundle exec pod install --project-directory=ios --deployment` -> passed; lockfile is reproducible.
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`.
- `./scripts/run_local_gates --profile dev` -> complete `passed_with_exception`; 16/17 gates passed and the only safe exception was system Node 25.9.0 versus expected Node 22.13.0.
- `node scripts/validate_dependency_security.mjs` -> mobile and CloudBase API audits passed with 0 known vulnerabilities.

## Validation results

- Node/npm validation used the CI-pinned Node 22.13.0 and npm 10.9.2 toolchain.
- Persistence coverage passed, including `App.persistence`, `userStateStore`, `authSessionStore`, mutation queue, learning state, and space state tests.
- CocoaPods resolved exactly AsyncStorage 3.1.1 and accepted the committed lock in deployment mode.
- Full Harness passed.
- The complete `dev` local-gate report is `passed_with_exception`; its only exception is the documented dev-only system Node drift. Focused dependency installation and all mobile checks used exact Node 22.13.0/npm 10.9.2.
- Dependency security passed for both audited workspaces with 0 known vulnerabilities.
- GitHub required checks and Release build are pending.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: Codex
- Status: Passed
- Blocking findings: None

## User-visible UI impact

- N/A. No screen, text, interaction, visual artifact, or accessibility behavior changes.

## Card make external workspace impact

- N/A. No card payload, source, review, approval, or import boundary changes.

## Risks and open questions

- The workstation default Ruby is 2.6.10 while CI is pinned to Ruby 3.3. Local CocoaPods 1.15.2 deployment validation passed, but the GitHub iOS Release job remains authoritative for Ruby 3.3 and Xcode validation.
- Dependabot PR #411 must remain unmerged because its missing native lock deterministically fails `pod install --deployment`; it should be closed only after the replacement PR is accepted.

## Follow-up

- Commit, push, and open the replacement PR; run the PR-bound profile once a unique PR context exists and require all GitHub checks before merge.
- Close Dependabot PR #411 as superseded after the replacement PR merges.
