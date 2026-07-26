# Agent Run Record: Brace Expansion Advisory Repair

## Task summary

- Date: 2026-07-25
- Branch: `fix/brace-expansion-advisory`
- PR: `#444` (`https://github.com/LENKIN233/softbook_cet/pull/444`)
- Summary: remove the temporary `GHSA-MH99-V99M-4GVG` exception by
  replacing every vulnerable mobile-tooling copy of `brace-expansion` with
  official release `5.0.8`, while preserving the CommonJS API required by
  `minimatch@3`.

## Referenced specs

- `spec/authority-map.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- This dependency repair does not change product scope, learning behavior,
  membership, content, interaction, or physical-space semantics.
- A green dependency check is delivery evidence only. It is not production
  deployment, formal content approval, or launch readiness.

## Implementation hypothesis changed

- The mobile lockfile overrides all `brace-expansion` consumers to official
  npm release `5.0.8`, the first patched version in the GitHub advisory.
- A deterministic postinstall normalizer adapts the one known
  `minimatch@3` CommonJS import from a callable default export to the named
  `expand` export used by `brace-expansion@5`.
- The normalizer reads exact `minimatch@3` paths and versions from
  `package-lock.json`. Missing packages, version mismatch, source drift,
  ambiguous prior edits, a non-5.0.8 dependency, or a missing named export
  fail the install.
- Integration tests load every legacy minimatch copy plus the modern ESM
  package path, cover representative expansion semantics, and assert the
  patched `maxLength` resource bound.

## Workspace boundary and read scope

- Active source read: dependency policy and validators, mobile package
  manifests, PR workflow, local-gate catalog, recent run record, and the
  referenced delivery specs.
- Dependency read: installed minimatch and brace-expansion package metadata
  and source were inspected only to define the compatibility boundary.
- Generated/cache read: ignored local-gate reports and temporary npm package
  inspection files were used for validation only.
- External workspace read: none. `/Users/lenkin/programing/card make` was not
  read or modified.

## Files changed

- `apps/mobile/package.json`, `apps/mobile/package-lock.json`: pin official
  `brace-expansion@5.0.8`, run deterministic normalization after install, and
  include compatibility verification in mobile tests.
- `scripts/normalize_minimatch_brace_expansion.mjs`: fail-closed,
  lockfile-driven `minimatch@3` CommonJS compatibility normalization.
- `scripts/verify_minimatch_brace_expansion.mjs`,
  `apps/mobile/scripts/verify-modern-minimatch.mjs`: legacy, modern ESM,
  expansion-semantics, and memory-bound integration coverage.
- `scripts/test_validate_dependency_security.mjs`: normalizer idempotency,
  source-drift, ambiguity, duplicate-import, and lockfile selection fixtures.
- `security/dependency-audit-policy.json`: remove the resolved temporary
  advisory exception.
- `.github/workflows/pr-gates.yml`: install the exact mobile dependency tree
  and execute compatibility tests inside the required dependency-security job.

## Commands run

- GitHub advisory API for `GHSA-MH99-V99M-4GVG` -> confirmed affected range
  `<=5.0.7` and first patched release `5.0.8`.
- `npm view brace-expansion@5.0.8 ...` -> confirmed Node support, package
  exports, and official integrity.
- Two local `file:` adapter approaches were rejected because a clean
  `npm ci` either produced an incomplete lock or invalid nested symlinks.
- A full lockfile regeneration was rejected because it upgraded unrelated
  wide dependency ranges. The final lock was regenerated from `HEAD` and
  changes only the advisory dependency family.
- `cd apps/mobile && npm ci` -> clean install passed; postinstall normalized
  all six `minimatch@3` copies; npm reported zero vulnerabilities.
- `node scripts/test_validate_dependency_security.mjs` -> passed.
- `node scripts/validate_dependency_security.mjs` -> both targets passed with
  zero advisories and zero policy exceptions.
- `cd apps/mobile && npm run lint` -> zero errors and 14 pre-existing
  inline-style warnings.
- `cd apps/mobile && npm run typecheck` -> passed.
- `cd apps/mobile && npm test -- --runInBand --no-watchman` -> 39 suites and
  371 tests passed.
- `cd infra/cloudbase/functions/softbook-api && npm test` -> 108 tests passed.
- `python3 scripts/validate_harness.py` -> full Harness passed.
- Node 22.13.0 `./scripts/run_local_gates --profile dev --output
  exports/local-gates/brace-expansion-advisory-dev.json` -> 18/18 passed.
- The first strict PR profile collected all 30 gates and exposed one local
  clone issue: the main-only fetch refspec omitted the already-pushed topic
  branch's remote-tracking ref. An exact topic refspec was added locally and
  the branch was fetched without changing repository files.
- Exact Python 3.12.13, Node 22.13.0, and Ruby 3.3.12
  `./scripts/run_local_gates --profile pr --base origin/main --pr 444
  --output exports/local-gates/brace-expansion-advisory-pr-passed.json` ->
  complete 30/30 passed with zero exceptions, skipped, or deferred gates.

## Validation results

- The final lock contains one registry-backed `brace-expansion@5.0.8` tarball
  with SHA-512 integrity and no 1.x, 5.0.7, local-adapter, or extraneous entry.
- Every legacy minimatch path loads after a clean install and retains brace,
  range, nested, empty-option, and dollar-prefix behavior.
- The modern minimatch ESM import resolves its named expansion dependency.
- The official 5.0.8 `maxLength` guard bounds accumulated expansion output.
- A second normalizer run is idempotent. Unknown or ambiguous upstream source
  fails rather than silently skipping the compatibility patch.
- Tracked worktree changes after validation are limited to this task.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: Codex
- Status: Passed locally for the current diff.
- Blocking findings: none.

## User-visible UI impact

- Design artifact: N/A.
- Interaction or physical-space artifact: N/A.
- Impact: no user-visible UI, copy, navigation, interaction, or runtime product
  behavior changed.
- Unimplemented gap: production deployment and product launch work remain
  outside this dependency repair.

## Card make external workspace impact

- N/A. No candidate cards, approvals, audio, or exported payload changed.

## Risks and open questions

- The compatibility normalizer intentionally depends on the known
  `minimatch@3` source shape. An upstream change fails install and requires
  review.
- Remove the override and normalizer when no locked dependency requires the
  legacy callable API.
- This change secures the repository toolchain; it does not deploy any product
  runtime.

## Follow-up

- Re-run the strict PR profile after this final run-record-only commit.
- Merge only after all GitHub required checks pass.
