# Agent Run Record: Mine account object quality pass

## Task summary

- Date: 2026-06-30
- Branch: `codex/fix/mine-account-object-quality`
- PR: https://github.com/LENKIN233/softbook_cet/pull/275
- Summary: Continued the user-visible mobile app quality reset by converting Mine from an account/settings dashboard into one account-and-membership object. This pass records a real iOS simulator screenshot and keeps account, route actions, progress state, and membership actions inside the same one-screen app grammar.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/membership.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/search-runs/2026-06-30-mobile-app-quality-reset/current-real-app-blind-audit.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Mine supports the learning flow. It must not become the product center, a settings center, or a dashboard.
- Membership is shared across surfaces; trial starts on first counted learning entry and unlocks the complete card library, physical space, and review capability.
- User-visible UI must not leak agent, harness, spec, validator, metadata, runtime, mock, prototype, seed, fixture, debug, raw exception, API route, repo path, or TODO language.
- Mine should hold account, membership, restore purchase, and route state quietly without interrupting Learning.

## Implementation hypothesis changed

- The Mine surface now presents `账号与权益` as the focal account object.
- Phone, daily status, sync state, and learning route are rendered as account rows instead of a generic profile panel.
- Progress metrics and route actions remain available but are attached inside the same account object, with lower visual weight.
- The membership host now reads as an attached membership module, with shorter app-fit summary copy and a horizontal trial/member action row that stays visible above the tab bar.
- App tests now assert the account-object copy and guard against the old long membership explanation returning.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, Maestro iOS flows, current real app screenshots, and recent mobile app quality run records.
- Generated/dependency/cache/archive read: real simulator screenshots were inspected only as validation evidence, not product truth.
- External workspace read: none. No card candidate content, approval batch, import, or `/Users/lenkin/programing/card make` artifact was modified.

## Files changed

- `apps/mobile/App.tsx`: converts Mine into a single account object with account rows, compact metrics, attached route actions, and attached membership controls.
- `apps/mobile/__tests__/App.test.tsx`: asserts the new Mine object copy and prevents the old long trial explanation from returning.
- `docs/agent-runs/artifacts/2026-06-30-mine-account-object-quality-simulator.png`: source simulator capture for this pass.
- `docs/design/app-screenshots/current-real-app/mine.png`: records the current real app Mine screenshot.
- `docs/agent-runs/2026-06-30-mine-account-object-quality.md`: records this run.

## Commands run

- `npx prettier --write App.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false App.test.tsx` in `apps/mobile` -> passed, 44 tests.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-06-30-mine-account-object-quality-simulator.png` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 159 tests.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `git diff --check` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.

## Validation results

- Focused App Jest: pass, 44 tests.
- Mobile full Jest: pass, 26 suites and 159 tests.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Mobile visible metadata leak scan: pass through Jest pretest.
- Design artifact metadata leak scan: pass.
- Maestro selector validation: pass.
- Harness validation: pass.
- CloudBase API tests: pass, 11 tests.
- Whitespace check: pass.
- Mine screenshot flow: pass on iPhone 17 Pro simulator.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-06-30-mine-account-object-quality-simulator.png`
  - `docs/design/app-screenshots/current-real-app/mine.png`

## Design review checklist

- Q1 Law of One: Mine stays neutral and quiet. It uses shell accent only for account identity and membership action emphasis, without competing with the active Learning/Space library color model.
- Q2 Focal object: The focal object is the account card. First-read path is route header -> account object -> account rows -> compact metrics and route actions -> attached membership module.
- Q3 Silhouette: The surface no longer reads as separate account/settings/dashboard blocks. It presents as one account object with attached state and actions.
- Q4 Forbidden patterns: No visible metadata, harness, debug, route, fixture, repo, runtime, raw id, TODO, removed self-assess token, or same-PR design authority was introduced. A draft phrase containing `入口` was caught by the visible metadata guard and removed before delivery.
- Q5 Layout containment: The real iPhone 17 Pro simulator screenshot confirms the account object, account rows, metrics, route actions, membership chips, membership CTAs, and bottom chrome fit in one viewport without incoherent overlap.
- Q6 Surface-specific: This is Mine-only. It preserves membership trial semantics, restore/purchase controls, route actions, and tabular learning counts; it does not alter Learning sequencing, Space hierarchy, Statistics ledger, or flip self-assess semantics.
- AP-22: Design review checklist is answered here before PR delivery.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after real simulator screenshot inspection, focused and full mobile tests, lint, typecheck, metadata scans, selector validation, harness validation, CloudBase API tests, Mine screenshot flow, and iOS smoke.
- Blocking findings: none known.

## User-visible UI impact

- Yes. The Mine tab now presents account and membership as one quiet account object instead of a generic account/settings dashboard.
- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/search-runs/2026-06-30-mobile-app-quality-reset/current-real-app-blind-audit.md`, and `spec/visual-language.json`.
- Implementation mapping: account object -> `mine-profile-card`; account rows -> `mine-profile-phone`, `mine-profile-today`, and account-row values; progress metrics -> `mine-metric-*`; route actions -> `mine-go-learning`, `mine-go-space`, and `mine-go-statistics`; membership module -> `membership-host-card`, `membership-start-trial-button`, and `membership-purchase-button`; screenshot evidence -> `docs/design/app-screenshots/current-real-app/mine.png`.
- Unimplemented gap: This pass improves phone Mine. Tablet capture, dark-mode capture, and membership-state transition motion still require separate accepted proof before implementation.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The screenshot evidence is light-mode iPhone 17 Pro simulator coverage. React tests and Maestro smoke cover behavior, but this pass does not include separate tablet or dark-mode capture.

## Follow-up

- Continue app-quality passes on remaining secondary states and motion polish, using real simulator screenshots as the acceptance bar.
