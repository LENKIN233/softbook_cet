# Agent Run Record: Mine account work area

## Task summary

- Date: 2026-07-06
- Branch: `codex/fix/mobile-quality-followup-20260706-39`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile quality reset by expanding the signed-in Mine page into a one-screen account work area. The account object, route status, and membership actions now use the available phone workspace instead of appearing as a short settings-like panel with unused lower space.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/canon.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Mine owns account and payment/membership attribution.
- Mine must not become a settings center.
- Membership access should be clear but non-invasive, and it must not turn the main Mine screen into a paywall.
- Membership/trial state remains shared across app surfaces.
- This run does not change the membership trial trigger, purchase state, restore-purchase behavior, login state, sync state, or card content.
- User-visible UI must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, TODO, or similar internal language.

## Implementation hypothesis changed

- The signed-in Mine account object should fill the available phone work area as one quiet account surface.
- Route status and account actions should sit inside the account object instead of leaving a top-heavy card and a blank lower half.
- The primary continue-learning card can be larger because it is a route continuation action, while the membership strip stays attached and non-invasive near the bottom.
- Existing selectors, copy, account state derivation, metrics, membership behavior, restore purchase, route navigation, and sync behavior are preserved.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted mobile core reset mapping, design canon, `apps/mobile/App.tsx`, focused Mine test, Mine screenshot flow, iOS smoke flow, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: expands the signed-in Mine profile panel, route dock, action rail, and action cards into a one-screen account work area.
- `apps/mobile/__tests__/App.test.tsx`: locks Mine profile and route dock layout behavior through the integrated app surface.
- `docs/design/app-screenshots/current-real-app/mine.png`: refreshed current real app light Mine screenshot.
- `docs/design/app-screenshots/current-real-app/dark/mine.png`: refreshed current real app dark Mine screenshot.
- `docs/agent-runs/artifacts/2026-07-06-mine-account-work-area/mine-real-app.png`: archived real iPhone 17 Pro simulator light Mine evidence.
- `docs/agent-runs/artifacts/2026-07-06-mine-account-work-area/mine-real-app-dark.png`: archived real iPhone 17 Pro simulator dark Mine evidence.
- `docs/agent-runs/2026-07-06-mine-account-work-area.md`: this run record.

## Commands run

- `npm --prefix apps/mobile exec prettier -- --write App.tsx __tests__/App.test.tsx` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false __tests__/App.test.tsx --testNamePattern="mine page keeps profile status and route actions in one screen after login"` -> passed; pretest visible metadata leak scan passed.
- `npm --prefix apps/mobile start -- --reset-cache` -> started Metro for simulator validation.
- `npm --prefix apps/mobile run ios -- --udid 9B086605-1D68-40C4-A849-D0DFF42468ED` -> passed.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance light` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-screenshot.yaml` under light simulator appearance -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/design/app-screenshots/current-real-app/mine.png` -> passed.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance dark` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-screenshot.yaml` under dark simulator appearance -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/design/app-screenshots/current-real-app/dark/mine.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/design/app-screenshots/current-real-app/mine.png docs/design/app-screenshots/current-real-app/dark/mine.png` -> passed, both 1206 x 2622.
- `cp docs/design/app-screenshots/current-real-app/mine.png docs/agent-runs/artifacts/2026-07-06-mine-account-work-area/mine-real-app.png` -> passed.
- `cp docs/design/app-screenshots/current-real-app/dark/mine.png docs/agent-runs/artifacts/2026-07-06-mine-account-work-area/mine-real-app-dark.png` -> passed.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/design/app-screenshots/current-real-app/mine.png docs/design/app-screenshots/current-real-app/dark/mine.png docs/agent-runs/artifacts/2026-07-06-mine-account-work-area/mine-real-app.png docs/agent-runs/artifacts/2026-07-06-mine-account-work-area/mine-real-app-dark.png` -> passed, all 1206 x 2622.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` under light simulator appearance -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook-cet-pr-body-mine-account-work-area.md` -> passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook-cet-pr-body-mine-account-work-area.md --changed-file ...` -> passed.

## Validation results

- Focused Mine Jest: pass.
- Light Mine screenshot flow: pass on iPhone 17 Pro simulator.
- Dark Mine screenshot flow: pass on iPhone 17 Pro simulator.
- Real screenshot dimensions: pass, all current and archived Mine screenshots are 1206 x 2622.
- Whitespace diff check: pass.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Full mobile Jest: pass, 26 suites and 163 tests.
- Design artifact metadata leak scan: pass.
- Maestro selector validation: pass.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass with full `python3 scripts/validate_harness.py` and with `--skip-remote-guard`.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- Agent review gate: pass.
- PR design gate: pass.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-06-mine-account-work-area/mine-real-app.png`
  - `docs/agent-runs/artifacts/2026-07-06-mine-account-work-area/mine-real-app-dark.png`
  - `docs/design/app-screenshots/current-real-app/mine.png`
  - `docs/design/app-screenshots/current-real-app/dark/mine.png`

## Design review checklist

- Q1 Law of One: Mine has no current library learning subject. The screen keeps neutral account materials as the main identity and avoids introducing any second strong learning-library color. The only stronger command emphasis is the route continuation action inside the account object.
- Q2 Focal object: First-read path is route title -> signed-in account object -> route status -> continue-learning action -> secondary Space/Today actions -> non-invasive membership strip.
- Q3 Silhouette: The screen preserves the Mine silhouette from the accepted mobile reset: account object, account rows, quiet membership entry, and ownership status. It is not a dashboard, long settings list, or paywall page.
- Q4 Forbidden patterns: Refreshed screenshots show no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, streak, XP, full-width tabbar, serif, pure black/white page, or removed self-assess token.
- Q5 Layout containment: Real iPhone 17 Pro light and dark simulator screenshots confirm the route header, account object, route dock, action rail, membership strip, safe area, and floating tab bar fit at 1206 x 2622 without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: This pass is Mine-specific. It keeps account/payment ownership as the screen purpose and avoids a settings-center or paywall-first structure. Learning flip self-assess, Space physical hierarchy, and Statistics tabular behavior are not changed.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real light/dark screenshot inspection, focused Mine test, full mobile gates, CloudBase tests, harness validation, and iOS smoke.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. The signed-in Mine page now reads as one contained account work area rather than a short profile/settings panel with a large unused lower region.
- The primary route continuation and secondary actions feel attached to the account object.
- Existing account state, membership state, restore purchase, route navigation, sync, Learning, Space, Statistics, and card content behavior are unchanged.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, and `docs/design/canon.md`.
- Implementation mapping: account object -> `mine-profile-card`; account rows -> `mine-passport-stack`; route/action layer -> `mine-route-dock`, `mine-action-rail`, `mine-action-card-primary`, and `mine-action-card-secondary`; membership action -> `membership-access-strip`; code surface -> `apps/mobile/App.tsx`.
- Screenshot evidence mapping:
  - `docs/agent-runs/artifacts/2026-07-06-mine-account-work-area/mine-real-app.png` -> `docs/design/app-screenshots/current-real-app/mine.png`
  - `docs/agent-runs/artifacts/2026-07-06-mine-account-work-area/mine-real-app-dark.png` -> `docs/design/app-screenshots/current-real-app/dark/mine.png`
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing navigation handlers are reused.
- Physical-space source: N/A; this PR does not alter Space UI or physical-space rules.
- Learning microcopy basis: no visible-copy change. This pass changes Mine layout containment only.
- Unimplemented gap: This pass covers the signed-in phone Mine screen in light and dark. Signed-out, trial-expired, purchase/error/loading states, small-phone, tablet, dynamic type, and richer account/membership state transitions remain follow-up evidence.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The layout intentionally gives the existing account object more height instead of adding new settings content. Non-ideal account and membership states still need separate real-device screenshot evidence.
- Smaller phones and dynamic type still need a separate visual containment pass.

## Follow-up

- Continue visible-quality coverage on signed-out Mine, trial-expired/membership recovery states, small-phone/tablet containment, and cross-surface one-screen consistency.
