# Agent Run Record: Mine auth readiness screenshots

## Task summary

- Date: 2026-07-01
- Branch: `codex/fix/mine-auth-readiness-screenshots`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile app quality reset by refreshing stale Mine auth screenshots from the real iOS simulator. The previous `current-real-app` Mine signed-out and code-sent images still showed empty-input SMS actions as active primary buttons; the refreshed screenshots now match the readiness-aware app behavior already implemented in `PhoneSmsPanel`.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
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

- Authentication is required before personalized Learning, Space, Statistics, and Mine state can be exposed.
- The primary login method is phone SMS code.
- Mine is the account and membership object; signed-out and code-sent states must still behave like real app form states, not static presentation screens.
- User-visible controls should reflect whether the next action is actually available; empty phone or empty code states must not look like active primary completion states.
- User-visible UI and screenshot evidence must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- No React Native implementation changed in this run.
- The `current-real-app` Mine signed-out screenshot was refreshed from the real iOS simulator after readiness-aware `PhoneSmsPanel` behavior.
- The `current-real-app` Mine code-sent screenshot was refreshed from the real iOS simulator after readiness-aware `PhoneSmsPanel` behavior.
- The refreshed screenshot set now shows empty phone and empty code actions as visually demoted disabled controls, matching the actual app behavior.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, `apps/mobile/e2e/maestro/ios-mine-signed-out-screenshot.yaml`, `apps/mobile/e2e/maestro/ios-mine-code-sent-screenshot.yaml`, current real app screenshots, and refreshed simulator screenshot artifacts.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `docs/agent-runs/artifacts/2026-07-01-mine-auth-request-readiness-simulator.png`: real iOS simulator Mine signed-out screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-01-mine-auth-submit-readiness-simulator.png`: real iOS simulator Mine code-sent screenshot evidence.
- `docs/design/app-screenshots/current-real-app/mine-signed-out.png`: current real app Mine signed-out screenshot.
- `docs/design/app-screenshots/current-real-app/mine-code-sent.png`: current real app Mine code-sent screenshot.
- `docs/agent-runs/2026-07-01-mine-auth-readiness-screenshots.md`: this run record.

## Commands run

- `npm start -- --reset-cache` in `apps/mobile` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-signed-out-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-01-mine-auth-request-readiness-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-01-mine-auth-request-readiness-simulator.png docs/design/app-screenshots/current-real-app/mine-signed-out.png` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-code-sent-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-01-mine-auth-submit-readiness-simulator.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-01-mine-auth-submit-readiness-simulator.png docs/design/app-screenshots/current-real-app/mine-code-sent.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-01-mine-auth-request-readiness-simulator.png docs/design/app-screenshots/current-real-app/mine-signed-out.png docs/agent-runs/artifacts/2026-07-01-mine-auth-submit-readiness-simulator.png docs/design/app-screenshots/current-real-app/mine-code-sent.png` -> passed, all 1206 x 2622.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `git diff --check` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 162 tests.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_mine_auth_readiness_screenshots_pr_body.md --changed-file docs/design/app-screenshots/current-real-app/mine-signed-out.png --changed-file docs/design/app-screenshots/current-real-app/mine-code-sent.png --changed-file docs/agent-runs/artifacts/2026-07-01-mine-auth-request-readiness-simulator.png --changed-file docs/agent-runs/artifacts/2026-07-01-mine-auth-submit-readiness-simulator.png --changed-file docs/agent-runs/2026-07-01-mine-auth-readiness-screenshots.md` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_mine_auth_readiness_screenshots_pr_body.md` -> passed.

## Validation results

- Mine signed-out screenshot flow: pass on iPhone 17 Pro simulator.
- Mine code-sent screenshot flow: pass on iPhone 17 Pro simulator.
- Screenshot dimensions: pass, all 1206 x 2622.
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
  - `docs/agent-runs/artifacts/2026-07-01-mine-auth-request-readiness-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-01-mine-auth-submit-readiness-simulator.png`
  - `docs/design/app-screenshots/current-real-app/mine-signed-out.png`
  - `docs/design/app-screenshots/current-real-app/mine-code-sent.png`

## Design review checklist

- Q1 Law of One: Mine auth states keep the neutral account surface as the dominant tone. Disabled empty-input actions are demoted instead of competing with active primary actions.
- Q2 Focal object: The focal object remains account continuity. First-read path is Mine header -> account object -> SMS verification panel -> readiness-aware action -> floating chrome.
- Q3 Silhouette: Mine remains an account object with attached auth form state; this run refreshes evidence only and does not introduce another page, modal, or card stack.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, gradient text, gamification chrome, full-width tabbar, serif, or removed self-assess token appears in the refreshed screenshots.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshots confirm Mine signed-out and code-sent states fit without horizontal overflow, clipped labels, primary action overlap, or bottom chrome collision.
- Q6 Surface-specific: This is Mine/Auth evidence only. It preserves SMS login semantics and does not alter Learning sequencing, Space hierarchy, Statistics behavior, membership rules, or flip self-assess semantics.
- AP-22: The six design review questions are answered here before PR delivery.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after screenshot inspection, Mine screenshot flows, typecheck, metadata scans, selector validation, harness validation, and whitespace check.
- Blocking findings: none known.

## User-visible UI impact

- Yes. The committed real-app screenshot set now reflects the current app's readiness-aware Mine SMS states, removing stale evidence where empty phone/code actions appeared as active primary controls.
- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, and `spec/visual-language.json`.
- Implementation mapping: Mine auth surface -> `PhoneSmsPanel` in `apps/mobile/App.tsx`; screenshot evidence -> `docs/design/app-screenshots/current-real-app/mine-signed-out.png` and `docs/design/app-screenshots/current-real-app/mine-code-sent.png`.
- Interaction/motion source: N/A; no interaction or motion code changed in this run.
- Learning microcopy basis: no visible Learning-copy change.
- Unimplemented gap: This run verifies light-mode phone Mine signed-out and code-sent screenshots. Dark-mode and tablet Mine auth screenshots remain follow-up evidence.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- This is a screenshot evidence refresh, not a new code behavior change. The underlying readiness behavior is covered by existing app tests from the Auth readiness work; this run verifies the Mine screenshots against the real simulator.

## Follow-up

- Continue real-app quality passes on Mine membership hierarchy, dark mode, tablet containment, and remaining authenticated account states.
