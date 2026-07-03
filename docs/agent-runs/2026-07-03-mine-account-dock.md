# Agent Run Record: Mine account dock

## Task summary

- Date: 2026-07-03
- Branch: `codex/fix/mobile-quality-followup-20260703-6`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile quality reset by refining Mine from a nested account/settings page into a quieter account object. The primary Learning return action now reads as the dominant command, secondary route actions are compact chips, and membership state is attached as an entitlement dock instead of a separate card inside the account card.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/membership.json`
- `spec/platform-contract.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/canon.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Mine is in v1 scope as profile/paywall/account support, but it must not become the product center or a settings dashboard.
- Account and membership state belong together, while Learning remains the primary route after reading account status.
- Membership trial, purchase, entitlement, restore/recovery, auth, sync, Learning, Space, and Statistics behavior are unchanged.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `MineSurface` keeps one account object but reduces nested-card feeling by turning `MembershipHostCard` into an attached entitlement dock with a top divider and transparent outer background.
- The primary `mine-go-learning` action now uses a dark active CTA, matching the return-to-Learning command weight used elsewhere.
- Secondary `mine-go-space` and `mine-go-statistics` actions now render as compact horizontal chips instead of tall cards.
- The Mine metric strip uses a subtle accent wash and lower-weight ledger treatment.
- Existing selectors and behavior are preserved: `mine-profile-card`, `mine-status-strip`, `mine-metric-*`, `mine-action-rail`, `mine-secondary-action-row`, `mine-go-learning`, `mine-go-space`, `mine-go-statistics`, `membership-host-card`, `membership-access-strip`, `membership-start-trial-button`, and `membership-purchase-button`.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, mobile core reset decision and mapping, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/canon.md`, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, Mine Maestro screenshot flow, iOS smoke flow, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: refines Mine account object styling, primary/secondary route action hierarchy, metric strip treatment, and membership entitlement dock while preserving behavior.
- `docs/agent-runs/artifacts/2026-07-03-mine-account-dock-simulator.png`: real iPhone 17 Pro simulator Mine screenshot evidence.
- `docs/design/app-screenshots/current-real-app/mine.png`: refreshed current real app Mine screenshot.
- `docs/agent-runs/2026-07-03-mine-account-dock.md`: this run record.

## Commands run

- `npx prettier --write App.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false App.test.tsx` in `apps/mobile` -> passed, 47 tests; pretest metadata leak scan passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm start -- --reset-cache` in `apps/mobile` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test e2e/maestro/ios-mine-screenshot.yaml` in `apps/mobile` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot ../../docs/agent-runs/artifacts/2026-07-03-mine-account-dock-simulator.png` in `apps/mobile` -> passed.
- `cp ../../docs/agent-runs/artifacts/2026-07-03-mine-account-dock-simulator.png ../../docs/design/app-screenshots/current-real-app/mine.png` in `apps/mobile` -> passed.
- `sips -g pixelWidth -g pixelHeight ../../docs/agent-runs/artifacts/2026-07-03-mine-account-dock-simulator.png ../../docs/design/app-screenshots/current-real-app/mine.png` in `apps/mobile` -> passed, both 1206 x 2622.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `python3 scripts/validate_harness.py` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test e2e/maestro/ios-smoke.yaml` in `apps/mobile` -> passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_mine_account_dock_pr_body.md --changed-file apps/mobile/App.tsx --changed-file docs/agent-runs/2026-07-03-mine-account-dock.md --changed-file docs/agent-runs/artifacts/2026-07-03-mine-account-dock-simulator.png --changed-file docs/design/app-screenshots/current-real-app/mine.png` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_mine_account_dock_pr_body.md` -> passed.

## Validation results

- Focused App Jest: pass, 47 tests.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Full mobile Jest: pass, 26 suites and 163 tests.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass.
- Maestro selector validation: pass.
- Whitespace diff check: pass.
- PR design gate: pass.
- Agent review gate: pass.
- Mine screenshot flow: pass on iPhone 17 Pro simulator.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-03-mine-account-dock-simulator.png`
  - `docs/design/app-screenshots/current-real-app/mine.png`

## Design review checklist

- Q1 Law of One: Mine uses a neutral account accent and one dark primary CTA. It does not introduce competing library colors, reward colors, or a paywall-first palette.
- Q2 Focal object: First-read path is route title -> account object -> identity/metric ledger -> primary Learning return -> secondary route chips -> membership entitlement dock -> floating chrome.
- Q3 Silhouette: Mine remains an account layer, not a settings dashboard or paywall page. Learning, Statistics, and Space silhouettes are not changed.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or paywall-first chrome appears in the refreshed screenshot.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshot confirms the account object, identity band, metric ledger, action rail, membership dock, and floating tab bar fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Mine keeps account and membership support subordinate to Learning. It does not turn membership into the main surface, and it does not change Learning sequencing, flip self-assess, Statistics tabular numbers, module role, Space hierarchy, auth, purchase, membership, or sync contracts.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, focused and full App tests, typecheck, lint, metadata scans, CloudBase function tests, harness validation, Mine screenshot flow, and iOS smoke flow.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. Mine now reads more like a single account object with attached actions and membership state instead of a stack of independent cards.
- The primary next user action is clearer: return to Learning. Space, Statistics, and membership controls remain available with lower weight.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping: account object -> `apps/mobile/App.tsx` / `mine-profile-card`; account rows -> `mine-profile-phone`, `mine-profile-today`, and `mine-status-strip`; membership action -> `membership-host-card` and `membership-access-strip`; primary return path -> `mine-go-learning`; secondary route actions -> `mine-go-space` and `mine-go-statistics`; screenshot evidence -> current real app Mine screenshot.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-03-mine-account-dock-simulator.png` -> `docs/design/app-screenshots/current-real-app/mine.png`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing route navigation, start-trial, and purchase handlers are reused.
- Physical-space source: N/A; this is Mine-only and does not change Space.
- Learning microcopy basis: no Learning UI copy changed. Mine visible copy remains design-backed account/support copy and avoids internal implementation terms.
- Unimplemented gap: Light-mode signed-in Mine after learning progress and check-in is covered. Dark mode, tablet containment, signed-out Mine, code-sent Mine, and post-trial/premium Mine variants remain follow-up screenshot work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The change preserves stable selectors used by Maestro and App tests, reducing behavior risk.
- Signed-out/code-sent/premium/free Mine variants should be covered by follow-up screenshot passes.

## Follow-up

- Continue quality passes on signed-out Mine, code-sent Mine, dark/tablet containment, and the remaining auth gate variants.
