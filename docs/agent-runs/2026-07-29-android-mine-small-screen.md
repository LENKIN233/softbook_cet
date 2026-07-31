# Agent Run Record: Android Mine small-screen containment

## Task summary

- Date: 2026-07-29
- Branch: `fix/android-mine-small-screen`
- PR: pending dependency on PR #461
- Summary: Removes overlapping account, route, and membership objects from Mine on a 320dp Android phone viewport while preserving the accepted quiet account-object hierarchy and membership semantics.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/platform-contract.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `docs/design/design-harness.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`

## Product truth used

- Mine supports Learning and does not become the product center. Its focal object is one quiet account card.
- Account and membership state belong to the same account object; phone identity, current continuity, route shortcuts, and membership action are subordinate regions.
- Trial gives complete card library, physical space, and algorithm access for 3-7 days; free and premium access semantics are unchanged by this layout pass.
- Membership entitlement is server-owned and shared across platforms. This run changes no entitlement, trial start, purchase, or recovery behavior.
- Phone touch targets must be at least 44dp and body copy must be at least 13sp.

## Implementation hypothesis changed

- Mine enters compact mode at viewport width `<= 340dp` or viewport height `<= 720dp`.
- Compact Mine preserves the account header and continuity/status strips, but the primary Learning shortcut no longer repeats a large centered `当前卡` hero and three metadata pills already represented above.
- Learning, Space, and Statistics remain explicit route actions; compact cards use bounded heights and 13sp route detail copy.
- The compact membership region reuses the profile membership pill as its heading, then shows benefits and the applicable trial/purchase action without another repeated membership header.
- Trial and purchase buttons now retain a 44dp minimum touch target, including the trial-available state.

## Workspace boundary and read scope

- Active truth/source read: the specs and accepted design artifacts listed above, Mine and membership composition in `apps/mobile/App.tsx`, related App tests, and the shared Maestro flow.
- Generated/dependency/cache/archive read: Android emulator screenshots and native accessibility bounds were inspected as local validation evidence.
- External workspace read: none. `/Users/lenkin/programing/card make`, card candidates, approvals, audio, and imports were not read or changed.

## Files changed

- `apps/mobile/App.tsx`: adds compact Mine viewport selection; compacts the account header, continuity, route actions, and membership host; removes repeated primary-action subregions only in compact mode; restores 13sp route/body copy and 44dp membership actions.
- `apps/mobile/__tests__/App.test.tsx`: covers the compact Mine viewport boundary while retaining the existing Mine account/route/membership behavior suite.
- `docs/agent-runs/2026-07-29-android-mine-small-screen.md`: records authority, implementation mapping, validation, and remaining gaps.

## Commands run

- `npx prettier --write App.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm test -- --runInBand __tests__/App.test.tsx` in `apps/mobile` -> passed, 68 tests.
- `JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home maestro test apps/mobile/e2e/maestro/ios-smoke.yaml` with 1080x2340 emulator density overridden to 540 (320x693dp) -> passed the complete shared flow after the final 13sp and 44dp adjustments.
- The same shared flow at the emulator's native 440dpi (approximately 393x851dp) -> passed after the final typography adjustment.
- `adb shell uiautomator dump` at 320x693dp -> confirmed independent non-overlapping bounds for Mine route and membership actions.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 43 suites and 402 tests.
- `npm run lint -- --quiet && npm run typecheck && npm run metadata-leak-scan && npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 170 tests.
- `python3 scripts/validate_maestro_selectors.py && git diff --check` -> passed.
- `python3 scripts/validate_harness.py --format text` -> code and local layers passed, but the remote governance guard failed because GitHub now requires `android-release` while the matching expected-context update remains unmerged in PR #460.
- `python3 scripts/validate_harness.py --skip-remote-guard --format text` -> local harness passed with the expected partial-completeness notice; this is not treated as release readiness.
- 2026-07-31 serial-integration validation after rebasing the Mine-only commit onto compact-Learning head `6d403f364b250400bed1ef60a6342fd021f6750b`:
  - `python3 scripts/validate_harness.py --format text` -> `HARNESS VALIDATION OK`, including the remote governance guard after PRs #460 and #463 merged.
  - `cd apps/mobile && npm run lint -- --quiet && npm run typecheck` -> passed.
  - `cd apps/mobile && npm test -- --runInBand --watchAll=false` -> 44 suites and 423 tests passed.
  - `cd apps/mobile && npm run metadata-leak-scan && npm run design-metadata-leak-scan` -> both repository scans passed.
  - `git diff --check 6d403f364b250400bed1ef60a6342fd021f6750b...HEAD` -> passed; the Mine-only diff remains limited to the three files listed above.

## Validation results

- App focused Jest: pass, 68 tests.
- Mobile full Jest: pass, 43 suites and 402 tests.
- CloudBase API: pass, 170 tests.
- TypeScript, ESLint, visible metadata scan, design metadata scan, selector validation, and whitespace validation: pass.
- Local and full harness layers: pass after PRs #460 and #463 merged; the earlier deliberate remote/repository mismatch is closed.
- 320x693dp full shared Android flow: pass for login, trial, Space, all five Learning interactions, completion, Statistics, Mine, Mine -> Statistics, and return to Mine.
- 393x851dp full shared Android regression: pass for the same complete flow.
- 320dp compact Mine bounds after final layout: Learning `[78,912][1002,1106]`; Space `[78,1123][532,1355]`; Statistics `[549,1123][1003,1355]`; start trial `[689,1402][965,1550]`; purchase `[689,1567][965,1715]`.
- The two trial-available membership actions are 148 physical pixels high at density 540, equivalent to approximately 44dp.

## Binary evidence

- Evidence manifest: N/A. Screenshots were captured and inspected locally under `/tmp`; ordinary Git does not store generated visual evidence.
- Archive: N/A.

## Design review checklist

- Q1 Law of One: Mine remains neutral and quiet; the account accent is the only strong chromatic cue and the dark Learning shortcut remains the one primary route action.
- Q2 Focal object: the account card remains the focal object. First-read path is account identity -> continuity/status -> Learning shortcut -> Space/Today shortcuts -> membership.
- Q3 Silhouette: the accepted account object with attached rows and non-invasive membership action is preserved; compact mode removes repeated subregions rather than creating a dashboard.
- Q4 Forbidden patterns: no achievement chrome, gradient title, full-width tab bar, serif type, internal metadata, agent/runtime text, or new status machine is introduced.
- Q5 Layout containment: the 320x693dp emulator screenshot and native bounds show separate, tappable route and membership regions with no overlap; body copy is at least 13sp and applicable actions are at least 44dp.
- Q6 Surface-specific: Mine remains subordinate to Learning, Statistics remains the `今日` route, and membership behavior/authority is unchanged.
- AP-22: all six review questions are answered here before PR delivery, with local emulator rendering and native bounds inspected.
- AP-23: this run does not alter flip self-assessment; `有把握` remains mint and `再回看` remains amber.

## Agent review status

- Reviewer: Codex local self-review; independent PR Agent review pending.
- Status: pending PR Agent review.
- Blocking findings: none in compact Mine after the 320dp shared flow. PR creation remains sequenced behind PR #461 so the Mine diff can target `main` without duplicating the Learning change; the full harness now passes.

## User-visible UI impact

- Yes. Mine no longer overlaps its profile, shortcuts, benefit cards, or membership action at 320dp.
- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md` and `docs/design/mocks/mobile-core-surface-reset-v1.html`.
- Implementation mapping: `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md` Mine mapping: account object -> profile panel; account rows -> identity/status strips; membership action -> compact membership host.
- Unimplemented gap: physical Android device and dynamic-font visual evidence remain pending. This branch is stacked on PR #461 until the Learning compact dependency merges.

## Card make external workspace impact

- N/A. No card payload, approval, import, audio asset, or sibling `card make` file changed.

## Risks and open questions

- The 320dp proof is an Android emulator with a density override rather than a physical 320dp handset.
- The earlier full-harness governance ordering gap is closed; the remaining quality gaps are physical-device and dedicated visual-state evidence, not repository validation.
- Compact premium, free, recovery-prompt, error, and pending membership variants remain covered by behavior tests but need dedicated visual screenshots before beta readiness.
- This UI evidence does not prove production membership, SMS, database deployment, content approval, or audio readiness.

## Follow-up

- After PR #461 merges, rebase this locally validated stack onto its tree-equivalent `main` squash commit, re-sign commits, create the Mine-only PR, and complete required Agent review/checks.
- Add physical-device and dynamic-font evidence before beta release readiness.
