# Agent Run Record: brace-expansion security fix

## Task summary

- Date: 2026-07-21
- Branch: `fix/brace-expansion-audit`
- PR: pending
- Summary: Restore the dependency-security gate after npm began reporting
  `GHSA-3JXR-9VMJ-R5CP` against transitive mobile development dependencies on
  the post-merge `main` run for PR #434.

## Referenced specs

- `spec/authority-map.json`
- `spec/harness-architecture.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`

## Product truth and implementation boundary

- Product truth is unchanged. This fix does not alter learning behavior,
  content, membership, visual design, runtime contracts, or launch readiness.
- The implementation change updates six locked transitive
  `brace-expansion` nodes from `1.1.14` to patched `1.1.16`.
- No vulnerability exception or allowlist entry is added. `package.json` and
  direct dependency ranges remain unchanged.

## Trigger and diagnosis

- PR #434 passed dependency security at commit `de300f34`.
- Its squash merge `124dcefc` then failed post-merge `main` workflow run
  `29781415370`, job `88483283927`, because npm audit newly reported high
  severity advisory `GHSA-3JXR-9VMJ-R5CP` for `brace-expansion <1.1.16`.
- Local `npm audit --json` reproduced one high-severity advisory across six
  nested development-tool nodes and reported a lockfile-only fix.

## Files changed

- `apps/mobile/package-lock.json`: lock the six affected transitive nodes to
  `brace-expansion@1.1.16` without changing unrelated package metadata.
- `docs/agent-runs/2026-07-21-brace-expansion-security-fix.md`: this record.

## Commands run

- Node/npm were pinned through
  `/Users/lenkin/.nvm/versions/node/v22.13.0/bin`, matching CI.
- `npm audit fix --package-lock-only --ignore-scripts` -> 0 vulnerabilities;
  unrelated npm lock metadata normalization was removed from the diff.
- `npm ci` -> 873 packages installed, 0 vulnerabilities.
- `node scripts/test_validate_dependency_security.mjs` -> passed.
- `node scripts/validate_dependency_security.mjs` -> mobile and CloudBase API
  both passed with 0 reported vulnerabilities and no exceptions.
- `npm run lint` -> passed with 0 errors and 14 pre-existing inline-style
  warnings.
- `npm run typecheck` -> passed.
- `npm test -- --runInBand` -> 34 suites and 251 tests passed.
- `PATH=/Users/lenkin/.nvm/versions/node/v22.13.0/bin:/opt/homebrew/opt/ruby@3.3/bin:$PATH
  ./scripts/run_local_gates --profile dev` -> 18/18 passed with no safe
  exceptions; report:
  `exports/local-gates/20260720T214911Z-124dcefc-dev-7456/report.json`.
- `PATH=/Users/lenkin/.nvm/versions/node/v22.13.0/bin:/opt/homebrew/opt/ruby@3.3/bin:$PATH
  ./scripts/run_local_gates --profile pr --base origin/main --pr 435` -> first
  run passed 29/30 and failed only `repo-health-strict` because this
  single-branch clone had no local remote-tracking ref for the already-pushed
  topic branch. This report is retained and is not treated as a pass:
  `exports/local-gates/20260720T215042Z-f7c0e3e0-pr-10152/report.json`.
- Added the exact temporary topic fetch refspec and fetched
  `origin/fix/brace-expansion-audit`; the unchanged strict PR profile then
  passed 30/30 with no safe exceptions:
  `exports/local-gates/20260720T215155Z-f7c0e3e0-pr-14482/report.json`.

## Agent review status

- Reviewer: Codex
- Status: Passed for the current lockfile-only diff.
- Blocking findings: none after removing unrelated npm lock metadata
  normalization and rerunning exact-toolchain dependency, lint, typecheck,
  Jest, and local gate validation.

## User-visible UI impact

- N/A. No user-visible code or design artifact changed.

## Card make external workspace impact

- N/A. The external content workspace was not read or modified.

## Risks and non-claims

- The affected packages are development tooling, but the repository correctly
  treats an unapproved high-severity advisory as a failing gate.
- A green audit is point-in-time evidence from the current registry advisory
  feed; it is not a permanent zero-vulnerability claim.
- This fix does not complete the `learning-events.v2` backend ledger or any
  product launch gate.
