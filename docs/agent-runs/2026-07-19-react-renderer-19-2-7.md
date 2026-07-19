# Agent Run Record: React and renderer 19.2.7 alignment

## Task summary

- Date: 2026-07-19
- Branch: `fix/align-react-renderer-19-2-7`
- PR: https://github.com/LENKIN233/softbook_cet/pull/423
- Supersedes: Dependabot PR #409 as a coordinated peer-compatible update
- Summary: Upgrade React and `react-test-renderer` together to 19.2.7 so the renderer peer dependency is satisfied without changing React Native or product behavior.

## Referenced specs

- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- N/A. This is mobile JavaScript dependency and delivery work only.
- No product behavior, card content, formal content approval, membership state, or launch-readiness state changes.

## Implementation hypothesis changed

- React and `react-test-renderer` must remain on a peer-compatible patch pair.
- `react-test-renderer` 19.2.7 requires React `^19.2.7`; updating only the renderer, as in Dependabot PR #409, creates an invalid install graph against React 19.2.3.
- React Native 0.85.2 accepts React `^19.2.3`, so React 19.2.7 remains within its declared peer range.

## Workspace boundary and read scope

- Active source read: the referenced specs, mobile npm manifest and lock, required CI toolchain anchors, and Dependabot PR #409/#410 metadata and diffs.
- Generated/dependency/cache read: ignored `node_modules`, npm registry metadata, CocoaPods generated output, and ignored local-gate reports were used only for dependency and validation evidence.
- External workspace read: none; `/Users/lenkin/programing/card make` is outside this dependency-only change.

## Files changed

- `apps/mobile/package.json`: align React and `react-test-renderer` at 19.2.7.
- `apps/mobile/package-lock.json`: record the scoped React, renderer, and renderer-local `react-is` patch updates.
- `docs/agent-runs/2026-07-19-react-renderer-19-2-7.md`: record scope, evidence, validation, and review state.

## Commands run

- npm registry metadata queries -> confirmed `react-test-renderer` 19.2.7 requires React `^19.2.7`; React Native 0.85.2 accepts React `^19.2.3` and Node `^22.13.0`.
- npm registry metadata query for `@babel/preset-env` 8.0.2 -> confirmed it requires Node `^22.18.0 || >=24.11.0` and `@babel/core ^8`, so unrelated Dependabot PR #410 cannot be merged against the current Node 22.13/Babel 7 contract.
- Exact Node 22.13.0/npm 10.9.2 `npm install --package-lock-only --ignore-scripts` -> lock regenerated; unrelated npm metadata classification churn was excluded from the patch.
- Exact Node 22.13.0/npm 10.9.2 `npm ci` -> 873 packages installed and 0 vulnerabilities reported.
- Exact Node 22.13.0/npm 10.9.2 `npm ls react react-test-renderer react-is --depth=1` -> all React Native consumers deduplicated to React 19.2.7; renderer and its local `react-is` resolved to 19.2.7.
- Exact Node 22.13.0/npm 10.9.2 `npm run lint` -> passed with 14 pre-existing inline-style warnings and 0 errors.
- Exact Node 22.13.0/npm 10.9.2 `npm run typecheck` -> passed.
- Exact Node 22.13.0/npm 10.9.2 `npm test -- --runInBand` -> 29 suites and 187 tests passed.
- Ruby 3.3.12/Bundler `bundle exec pod install --project-directory=ios --deployment` -> passed and left tracked native locks unchanged.
- Exact Node 22.13.0 and Ruby 3.3.12 `scripts/run_local_gates --profile dev` -> 17/17 gates passed; report written only to ignored `exports/local-gates/`.
- Dependabot PR #410 -> closed with the concrete Node/core incompatibility recorded; its remote branch was deleted.
- Dependabot PR #409 -> closed only after replacement PR #423 existed; the comment records original head `6eb3e5f252f03f1387bdab78aee7b55e92e9f1a8`, the peer mismatch, and the supersession link.

## Validation results

- The npm install graph contains one compatible React 19.2.7 instance for React Native and renderer consumers.
- Mobile lint, typecheck, Jest, CocoaPods deployment validation, dependency audit, and complete local `dev` gates passed.
- The tracked worktree contains only the scoped manifest, lock, and this run record.
- GitHub required checks and the clean-runner iOS Release build/archive are pending on the replacement PR.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: Codex
- Status: Passed
- Blocking findings: None.
- Review summary: The patch resolves the reproduced peer mismatch by moving both ends of the contract within React Native's accepted range. The lock diff contains no unrelated package upgrades or metadata churn. Remote required checks remain mandatory before merge.

## User-visible UI impact

- N/A. No user-visible screen, copy, interaction, motion, or accessibility behavior changes.

## Card make external workspace impact

- N/A. No card payload, source, review, approval, or import boundary changes.

## Risks and open questions

- React is an application runtime dependency even for a patch update; clean-runner mobile tests, Release simulator build, and unsigned archive remain mandatory.
- Dependabot PR #409 was closed with its original head and replacement link recorded; it was not merged independently.
- PR #410 is intentionally deferred until a separately reviewed Node/Babel 8 migration updates the toolchain contract and all related Babel packages together.

## Follow-up

- Run the strict PR profile, require every GitHub check and applicable protected approval, then verify the post-merge `main` run.
