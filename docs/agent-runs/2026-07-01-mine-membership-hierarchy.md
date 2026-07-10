# Agent Run Record: Mine membership hierarchy

## Task summary

- Date: 2026-07-01
- Branch: `codex/fix/mine-membership-hierarchy`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile app quality reset by tightening the authenticated Mine membership area. The previous membership card read like a dense progress/debug panel with a `1/4` count and competing actions. The refreshed implementation turns it into one account-state card with a clear trial primary action, a lightweight purchase action, and real iOS simulator screenshot evidence.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/membership.json`
- `spec/account-sync-contract.json`
- `spec/platform-contract.json`
- `spec/visual-language.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Mine is the account and membership object; it should preserve learning continuity instead of becoming a settings or analytics page.
- Trial starts only when the first counted learning entry happens, not on registration alone.
- Trial unlocks the complete card library, complete physical space, and stronger review capability together.
- Free state retains basic learning, while premium/trial are complete experience states.
- Purchase must remain reachable, but it should not compete with the learning-continuity primary action on the one-screen Mine surface.
- User-visible UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `MembershipHostCard` now presents membership as an account-state object instead of a progress counter.
- The `1/4 已开放` pill was replaced with a state chip (`基础可用`, `试用中`, `基础态`, `会员态`) that avoids fake precision.
- The access area now summarizes only the complete-experience benefits: `完整卡库`, `完整空间`, and `智能回看`.
- Trial-available actions now use one dominant `开始完整试用` button and a compact `直接开通` secondary action in the same row, avoiding a hidden or competing second large button.
- The Mine screenshot and its artifact were refreshed from a real iPhone 17 Pro simulator.
- The two affected local Maestro flows now tap the existing `auth-gate-keyboard-dismiss-target` before submitting SMS verification, matching the already established remote smoke pattern and preventing keyboard-covered submit taps.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, the affected Maestro flows, and current real app screenshot evidence.
- Generated/dependency/cache/archive read: simulator screenshots and Maestro debug screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: refined Mine membership hierarchy, state chip copy, benefit chips, and trial action layout.
- `apps/mobile/__tests__/App.test.tsx`: added Mine membership one-screen assertions and removed the `1/4` progress-counter expectation.
- `apps/mobile/e2e/maestro/ios-mine-screenshot.yaml`: reused the auth keyboard dismiss target before SMS submit.
- `apps/mobile/e2e/maestro/ios-smoke.yaml`: reused the auth keyboard dismiss target before SMS submit.
- `docs/agent-runs/artifacts/2026-07-01-mine-membership-hierarchy-simulator.png`: real iPhone 17 Pro simulator Mine screenshot evidence.
- `docs/design/app-screenshots/current-real-app/mine.png`: refreshed current real app Mine screenshot.
- `docs/agent-runs/2026-07-01-mine-membership-hierarchy.md`: this run record.

## Commands run

- `npx prettier --write App.tsx __tests__/App.test.tsx` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false App.test.tsx` in `apps/mobile` -> passed, 47 tests.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 162 tests.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `git diff --check` -> passed.
- `npm start -- --reset-cache` in `apps/mobile` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-screenshot.yaml` -> passed after the flow reused `auth-gate-keyboard-dismiss-target`.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-01-mine-membership-hierarchy-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-01-mine-membership-hierarchy-simulator.png docs/design/app-screenshots/current-real-app/mine.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-01-mine-membership-hierarchy-simulator.png docs/design/app-screenshots/current-real-app/mine.png` -> passed, both 1206 x 2622.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_mine_membership_hierarchy_pr_body.md --changed-file apps/mobile/App.tsx --changed-file apps/mobile/__tests__/App.test.tsx --changed-file apps/mobile/e2e/maestro/ios-mine-screenshot.yaml --changed-file apps/mobile/e2e/maestro/ios-smoke.yaml --changed-file docs/design/app-screenshots/current-real-app/mine.png --changed-file docs/agent-runs/artifacts/2026-07-01-mine-membership-hierarchy-simulator.png --changed-file docs/agent-runs/2026-07-01-mine-membership-hierarchy.md` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_mine_membership_hierarchy_pr_body.md` -> passed.

## Validation results

- Mine screenshot flow: pass on iPhone 17 Pro simulator, iOS 26.5.
- Strict iOS smoke: pass on iPhone 17 Pro simulator, iOS 26.5.
- Screenshot dimensions: pass, `1206 x 2622`.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile full Jest: pass, 26 suites and 162 tests.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Maestro selector validation: pass.
- Harness validation: pass.
- PR design gate validation: pass.
- Agent review PR body validation: pass.
- CloudBase API tests: pass, 11 tests.
- Whitespace check: pass.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-01-mine-membership-hierarchy-simulator.png`
  - `docs/design/app-screenshots/current-real-app/mine.png`

## Design review checklist

- Q1 Law of One: Mine remains about account continuity. The membership area now supports that object with a single dominant complete-trial action instead of a progress counter and two competing large buttons.
- Q2 Focal object: First-read path is Mine header -> account object -> learning continuity actions -> membership state. The state chip and benefit chips are subordinate to the primary action.
- Q3 Silhouette: The authenticated Mine surface remains one phone-screen app panel with attached sections, not a scrolling settings page or marketing membership page.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, gradient text, gamification chrome, full-width tabbar, serif, or removed self-assess token appears in the refreshed screenshot.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshot confirms the membership card, benefit chips, `开始完整试用`, compact `直接开通`, and bottom tab chrome fit without overlap or clipped labels.
- Q6 Surface-specific: This is Mine/Membership/Auth-flow evidence only. It preserves SMS login semantics, Learning sequencing, Space hierarchy, Statistics behavior, and flip self-assess semantics.
- AP-22: The six design review questions are answered here before PR delivery.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, Mine screenshot flow, strict iOS smoke, typecheck, lint, full Jest, metadata scans, selector validation, harness validation, PR body validators, API tests, and whitespace check.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Authenticated Mine now reads more like a mainstream app account surface: membership is a calm account-state module with one primary next action and one compact secondary purchase path.
- The old `1/4` style count is removed from visible copy, reducing fake-progress and internal-state leakage risk.
- The trial copy remains product-accurate: trial starts when learning is first counted, and complete card library, space, and review capability open together.
- The real app screenshot package now reflects this authenticated Mine state.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, and `spec/visual-language.json`.
- Implementation mapping: Mine membership surface -> `MembershipHostCard` and `MembershipActionGroup` in `apps/mobile/App.tsx`.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-01-mine-membership-hierarchy-simulator.png` -> `docs/design/app-screenshots/current-real-app/mine.png`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. The Maestro flow change reuses an existing auth keyboard dismiss target.
- Learning microcopy basis: no visible Learning-copy change.
- Unimplemented gap: Light-mode phone authenticated Mine membership hierarchy is verified. Dark mode, tablet, premium/free/recovery membership screenshots, and the remaining screenshot flows that still submit SMS without the shared keyboard dismiss target remain follow-up evidence.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- Original iPhone 17 Pro iOS 26.5 simulator showed intermittent XCUITest 500 errors before the flow recovered; the final Mine screenshot flow and strict smoke both passed on the same simulator.
- A temporary attempt on alternate simulators exposed environment/runtime differences and the existing need for the shared auth keyboard dismiss target. Final evidence uses the original simulator and passed flows.

## Follow-up

- Continue quality passes on premium/free/recovery membership states, dark mode/tablet containment, and remaining screenshot flows that should also reuse `auth-gate-keyboard-dismiss-target` before SMS submit.
