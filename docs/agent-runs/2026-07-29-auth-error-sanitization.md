# Agent Run Record: Mobile auth error sanitization

## Task summary

- Date: 2026-07-29
- Branch: `fix/auth-error-sanitization`
- PR: pending
- Summary: Replaced direct rendering of runtime exception messages with a fail-closed user-copy boundary and added an integration regression for native credential-storage failures. No backend, database, content, or visual layout was changed.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/account-sync-contract.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`

## Product truth used

- Learning requires phone-plus-SMS authentication; a native storage failure must leave the login gate retryable and must not expose implementation details.
- User-visible raw exceptions, native module names, API details, debug language, and runtime metadata are blockers.
- The login gate remains the attached account object defined by the accepted mobile core surface reset; this change does not alter its hierarchy, layout, or interaction silhouette.

## Implementation hypothesis changed

- All exception-derived visible copy now passes through one fail-closed boundary.
- Known bounded remote operation errors map to stable Chinese task copy.
- Unknown exceptions are rendered only when they are concise Chinese user copy with no control characters, English implementation vocabulary, paths, URLs, status codes, or internal-system terms; otherwise the caller-owned fallback is used.

## Workspace boundary and read scope

- Active truth/source read: task-relevant authentication, runtime, visual-language, delivery, evaluation, accepted design decision, implementation mapping, mobile app, credential store, and tests.
- Generated/dependency/cache/archive read: the installed `react-native-keychain` package path was listed only to locate the repository Jest mock; no dependency implementation was used as product truth.
- External workspace read: none. `/Users/lenkin/programing/card make` was not touched.

## Files changed

- `apps/mobile/src/runtime/userFacingError.ts`: central fail-closed exception-to-copy boundary.
- `apps/mobile/App.tsx`: consume the central boundary instead of maintaining permissive inline filtering.
- `apps/mobile/__tests__/userFacingError.test.ts`: native, stack, path, status, Unicode-control, known-remote, and safe-copy coverage.
- `apps/mobile/__tests__/App.test.tsx`: prove a missing native credential module remains a retryable Chinese login error without leaking module names.
- `docs/agent-runs/2026-07-29-auth-error-sanitization.md`: durable implementation and validation record.

## Commands run

- `cd apps/mobile && npm test -- --runInBand __tests__/userFacingError.test.ts __tests__/App.test.tsx` -> 88 tests passed.
- `cd apps/mobile && npm run typecheck` -> passed.
- `cd apps/mobile && npm run lint` -> passed with pre-existing inline-style warnings; a new control-regex warning was removed before final validation.
- `cd apps/mobile && npm test -- --runInBand` -> 44 suites and 420 tests passed.
- `python3 scripts/validate_harness.py --format text` -> passed.
- `node --test scripts/test_check_design_metadata_leaks.mjs && node scripts/check_design_metadata_leaks.mjs` -> 3 scanner tests and the repository scan passed.
- `node scripts/validate_dependency_security.mjs` -> zero known mobile or CloudBase API vulnerabilities.
- `scripts/run_local_gates --profile dev` -> 19/20 passed and one documented dev-only exception: local Node 25.9.0 differs from pinned Node 22.13.0. Report: `exports/local-gates/20260729T065507Z-d479f5f5-dev-89458/report.json` (generated report, not committed release evidence).

## Validation results

- `TurboModuleRegistry`, `RNKeychain`, Keychain errors, Java/Objective-C exceptions, stack traces, URLs, HTTP status details, internal Chinese terms, control characters, and non-Error values all fail closed to caller-owned copy.
- The App integration test rejects the native module names from rendered output and retains the existing retryable auth error dock.
- Existing remote request-code, verify-code, parser-failure, persistence, sync, content-manifest, Space, Learning, and accessibility-adjacent test coverage remains green.
- The local gate report is not a substitute for GitHub required checks, Agent review, native release builds, or launch readiness.

## Binary evidence

- Evidence manifest: N/A; no geometry, styling, motion, image, or layout changed.
- Archive: N/A.

## Agent review status

- Reviewer: Codex
- Status: passed locally; GitHub Agent review pending
- Blocking findings: none in the local implementation and tests.
- Review summary: The previous substring denylist could expose unknown native and English exceptions. The replacement is centralized and fail-closed, while retaining only explicit operation mappings and narrowly safe Chinese copy.

## User-visible UI impact

- Error copy can change only when an exception would previously have exposed raw internal details; it now uses the existing stable Chinese fallback in the same accepted error dock.
- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md` and `docs/design/mocks/mobile-core-surface-reset-v1.html`.
- Implementation mapping: `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, account object / login gate, implemented in `apps/mobile/App.tsx`.
- Unimplemented gaps: no layout or motion gap was introduced. Simulator and real-device auth verification remain part of the later closed-beta device acceptance run.
- Design review: Q1 active-library accent is unchanged; Q2 the account object remains focal and the error stays attached; Q3 no interaction silhouette changes; Q4 no forbidden pattern was introduced; Q5 containment and safe-area geometry are unchanged and copy is bounded to 120 characters; Q6 is not applicable because Learning, flip, and Statistics behavior did not change.
- AP-22: Q1-Q6 are answered above and will be copied to the PR body.
- AP-23: self-assess remains exactly two states, mint `有把握` and amber `再回看`; this PR does not touch it.

## Card make external workspace impact

- N/A. No candidate cards, approvals, audio, or content handoff were read or changed.

## Risks and open questions

- This closes visible exception leakage at current App call sites; future user-visible surfaces must use the same boundary instead of rendering `Error.message` directly.
- Native iOS/Android login smoke is still required for release acceptance and cannot be replaced by Jest.

## Follow-up

- Complete required repository gates, open the PR, record the PR URL and passed Agent review, and allow merge only after all required GitHub checks are green.
- After the separately accepted audio design PR merges, implement the native audio player on a fresh `main`-based branch.
