# Agent Run Record: Repository Build Security And Concurrency

## Task summary

- Date: 2026-07-11
- Branch: `fix/remaining-health-findings`
- PR: https://github.com/LENKIN233/softbook_cet/pull/405
- Summary: Resolve the remaining repository-health findings around cross-path CocoaPods reproducibility, dependency security, CloudBase physical-space concurrency, iOS Release verification, privacy metadata, and local workspace hygiene.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/account-sync-contract.json`
- `spec/runtime-boundaries.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Account physical-space state remains server authoritative and explicit card actions retain their timestamps.
- Authentication, membership, learning, card interactions, and user-visible design behavior are unchanged.
- Repository governance and build reproducibility do not create new product truth.

## Implementation hypothesis changed

- CloudBase canonical physical-space reads, legacy migration, merge, and write-back now execute in one database transaction with SDK conflict retry.
- React Native Core, its native dependencies, and Hermes build from source so Pod checksums do not depend on downloaded prebuilt artifact paths.
- Mobile `npm ci` deterministically normalizes the Hermes podspec's clone path and CMake executable fields; exact upstream drift fails instead of being silently rewritten.
- Dependency security rejects unknown, critical, expired, mismatched, and stale exceptions. The only allowed advisory is the time-limited CloudBase `lodash.set` watch-path advisory.
- Repository health checks every linked worktree, stash, topic branch, missing upstream, and deleted upstream rather than only the current directory.
- CI and local mobile setup use Node 22.13 or newer, matching React Native 0.85.2, and Bundler 2.4.22, which remains compatible with local Ruby 2.6 while running correctly on the GitHub macOS runner's Ruby 3.4.

## Workspace boundary and read scope

- Active truth/source read: account sync and runtime contracts, CloudBase API and tests, iOS Pod configuration, CI, repository governance, dependency manifests, and health scripts.
- Generated/dependency read: installed React Native, Hermes, CloudBase SDK, CocoaPods, npm audit output, and temporary Xcode build products only for verification.
- Archive scope: existing cutover indexes and LFS objects were validated but not changed.
- External workspace: `/Users/lenkin/programing/card make` governance and candidate queue state only; no card content or approval data was edited.

## Files changed

- `infra/cloudbase/functions/softbook-api/`: SDK and transitive dependency updates, transactional space-state persistence, and a separate-instance concurrent-write regression.
- `apps/mobile/ios/`: source Pod selection, stable Hermes normalization contract, path-independent lockfile, and removal of an empty location privacy declaration.
- `apps/mobile/`: exact CLI dependency updates, Node 22.13 engine documentation, Bundler 2.4.22 lock metadata, and generated-Pods exclusions for ESLint and Jest.
- `scripts/normalize_hermes_podspec.mjs` and its test: deterministic normalization with exact upstream-drift rejection.
- `scripts/validate_dependency_security.mjs`, its test, and `security/dependency-audit-policy.json`: live npm advisory policy.
- `scripts/report_repo_health.mjs` and its test: all-worktree, stash, topic-branch, and upstream validation.
- `.github/workflows/pr-gates.yml`, `.github/dependabot.yml`, and the PR template: maintained Actions, explicit timeouts, Release iOS CI, dependency gates, and weekly dependency updates.
- `spec/account-sync-contract.json`, `spec/runtime-boundaries.json`, `spec/agent-harness.json`, and `spec/repo-delivery-contract.json`: transaction and delivery contracts.

## Commands run

- `npm ci`, `npm run lint -- --quiet`, `npm run typecheck`, and `npm test -- --runInBand --watchAll=false` in `apps/mobile`.
- `npm test` in `infra/cloudbase/functions/softbook-api`.
- `node scripts/test_validate_dependency_security.mjs`, `node scripts/test_normalize_hermes_podspec.mjs`, and `node scripts/validate_dependency_security.mjs`.
- `python3 scripts/validate_maestro_selectors.py` and `python3 scripts/validate_harness.py --skip-remote-guard`.
- `node scripts/test_report_repo_health.mjs` and strict local workspace-health validation.
- `bundle exec pod install --project-directory=ios --deployment` in the source worktree and a random-path fresh clone.
- `BUNDLE_JOBS=4 BUNDLE_RETRY=3 bundle install` with an exact Bundler 2.4.22 version check under local Ruby 2.6.
- Release simulator `xcodebuild` and unsigned Release `archive` with signing disabled.
- `node scripts/validate_agent_run_evidence.mjs`, `git lfs fsck`, `plutil -lint`, and `git diff --check`.

## Validation results

- Mobile: lint and typecheck passed; 29 Jest suites and 187 tests passed; mobile and design metadata-leak scans passed.
- Backend: 14 tests passed, including concurrent writes from separate CloudBase store instances.
- Dependency security: mobile has zero production advisories; the CloudBase advisory set exactly matches the one expiring exception.
- CocoaPods: deployment mode passed after a clean `npm ci`; the stable Hermes checksum is identical in the source worktree and random-path fresh clone.
- Native release: Release simulator build and unsigned device archive both succeeded with the normalized Hermes script phases.
- Fresh clone: hooks, LFS, both npm installs, exact Bundler 2.4.22, CocoaPods deployment, unchanged Bundler/Pod lockfiles, and a clean final worktree all passed at commit `8c833c645a965cf20d59253ea7ee84692300b2d7`.
- Repository governance: harness, health regressions, evidence index, LFS, plist, JSON/YAML, and whitespace checks passed.
- GitHub required checks: the initial PR run passed eight checks and exposed Ruby 3.4 incompatibility in the legacy Bundler 1.17.2 launcher before native compilation; the runtime-alignment fix now requires a complete rerun before merge.

## Binary evidence

- Evidence manifest: N/A.
- Archive: N/A.
- Xcode products and logs were written only to ignored or temporary paths; no screenshot, recording, generated report, or binary evidence is committed.

## Agent review status

- Reviewer: Codex
- Status: Passed
- Blocking findings: none
- Review summary: The initial fresh-clone check exposed remaining absolute Hermes and CMake paths, and the first GitHub iOS run exposed legacy Bundler and Node engine drift. The final normalizer, source builds, cross-Ruby Bundler lock, Node floor, and random-path deployment close those reproducibility gaps.

## User-visible UI impact

- None. Screens, copy, controls, interactions, navigation, and visual assets are unchanged.
- Design authority and design review checklist: not applicable to this build, backend, dependency, privacy-declaration, and governance work.

## Card make external workspace impact

- Tooling-only PR https://github.com/LENKIN233/card-make/pull/106 was validated and merged separately.
- The card workspace remains at five open draft candidate PRs and zero formal approvals.
- No card JSON, audio, candidate review evidence, or `reviews/approved_batches/` record changed.

## Risks and open questions

- `@cloudbase/database` still pulls vulnerable `lodash.set` for its realtime watch implementation, which this service does not call. The exact exception expires on 2026-08-10 and must be removed or renewed with fresh evidence.
- Source React Native and Hermes builds are slower than prebuilt artifacts; the macOS CI timeout is 60 minutes and the job must remain required.
- GitHub code scanning and secret scanning remain separate repository-capability decisions; Dependabot alerts and automated security fixes are enabled for both repositories.

## Follow-up

- Add `dependency-security` and `ios-release` to protected-branch required checks, then merge only after PR and post-merge `main` workflows are green.
- Revisit the CloudBase advisory before 2026-08-10 or when an upstream patched database package becomes available.
