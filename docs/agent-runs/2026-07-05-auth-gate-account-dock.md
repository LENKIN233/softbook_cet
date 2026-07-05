# Agent Run Record: Auth gate account dock

## Task summary

- Date: 2026-07-05
- Branch: `codex/fix/mobile-quality-followup-20260705-9`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile quality reset by tightening the phone verification dock used by the signed-out Learning and Mine gates. This pass fixes the real app Auth input-field layout, keeps the gate attached to the retained current object/account object, and refreshes real iPhone simulator screenshots for Auth and Mine signed-out states.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Users must authenticate with phone + SMS code before Learning.
- Guest learning before authentication is not supported.
- Auth should preserve Learning / Space / Statistics / Mine continuity instead of becoming a technical login page.
- Mine is an account layer and must not compete with Learning as the product center.
- Membership / trial information belongs to the account object and must stay non-invasive.
- User-facing UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, queue, cache, payload, or TODO language.

## Implementation hypothesis changed

- `PhoneSmsPanel` now gives the phone-number field a stable height and centered text alignment so the placeholder and entered phone number no longer collide with the field border in real iOS screenshots.
- The request-code dock now has a slightly stronger account-confirmation affordance through larger CTA height, clearer label size, and more stable inner spacing.
- Existing behavior and selectors are preserved: `auth-phone-input`, `auth-request-code-button`, `auth-code-input`, `auth-submit-button`, `auth-gate-keyboard-dismiss-target`, `auth-request-inline-dock`, and `auth-code-inline-dock`.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted mobile core reset artifacts, `apps/mobile/App.tsx`, App tests, Auth/Mine Maestro screenshot flows, iOS smoke flow, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: adjusts the Auth phone-input dock and request-code CTA sizing while preserving auth logic and test IDs.
- `docs/agent-runs/artifacts/2026-07-05-auth-gate-account-dock-simulator.png`: real iPhone 17 Pro simulator signed-out Learning/Auth screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-05-auth-gate-code-sent-simulator.png`: real iPhone 17 Pro simulator Auth code-sent screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-05-auth-gate-mine-signed-out-simulator.png`: real iPhone 17 Pro simulator Mine signed-out screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-05-auth-gate-mine-code-sent-simulator.png`: real iPhone 17 Pro simulator Mine code-sent screenshot evidence.
- `docs/design/app-screenshots/current-real-app/auth.png`: refreshed current real app signed-out Auth screenshot.
- `docs/design/app-screenshots/current-real-app/auth-code-sent.png`: refreshed current real app Auth code-sent screenshot.
- `docs/design/app-screenshots/current-real-app/mine-signed-out.png`: refreshed current real app Mine signed-out screenshot.
- `docs/design/app-screenshots/current-real-app/mine-code-sent.png`: refreshed current real app Mine code-sent screenshot.
- `docs/agent-runs/2026-07-05-auth-gate-account-dock.md`: this run record.

## Commands run

- `npx --prefix apps/mobile prettier --write apps/mobile/App.tsx` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false App.test.tsx App.remoteFallback.test.tsx` -> passed, 48 tests; expected mocked sync warning logs only.
- `npm --prefix apps/mobile start -- --reset-cache` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-auth-screenshot.yaml` in `apps/mobile` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/design/app-screenshots/current-real-app/auth.png` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-05-auth-gate-account-dock-simulator.png` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-mine-signed-out-screenshot.yaml` in `apps/mobile` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/design/app-screenshots/current-real-app/mine-signed-out.png` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-05-auth-gate-mine-signed-out-simulator.png` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-auth-code-sent-screenshot.yaml` in `apps/mobile` -> passed after rerunning serially. A prior parallel attempt conflicted with another Maestro flow on the same simulator and failed with `only one gesture can be performed at a time`; this was a validation orchestration issue, not an app failure.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/design/app-screenshots/current-real-app/auth-code-sent.png` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-05-auth-gate-code-sent-simulator.png` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-mine-code-sent-screenshot.yaml` in `apps/mobile` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/design/app-screenshots/current-real-app/mine-code-sent.png` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-05-auth-gate-mine-code-sent-simulator.png` -> passed.
- `file docs/design/app-screenshots/current-real-app/auth.png docs/design/app-screenshots/current-real-app/auth-code-sent.png docs/design/app-screenshots/current-real-app/mine-signed-out.png docs/design/app-screenshots/current-real-app/mine-code-sent.png docs/agent-runs/artifacts/2026-07-05-auth-gate-account-dock-simulator.png docs/agent-runs/artifacts/2026-07-05-auth-gate-code-sent-simulator.png docs/agent-runs/artifacts/2026-07-05-auth-gate-mine-signed-out-simulator.png docs/agent-runs/artifacts/2026-07-05-auth-gate-mine-code-sent-simulator.png` -> passed, all 1206 x 2622 PNG.
- `git diff --check` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-smoke.yaml` in `apps/mobile` -> passed.

## Validation results

- Focused App Jest: pass, 48 tests.
- Full mobile Jest: pass, 26 suites and 163 tests.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile visible metadata leak scan: pass through Jest pretest.
- Design artifact metadata leak scan: pass.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass with full `python3 scripts/validate_harness.py` and with `--skip-remote-guard`.
- Maestro selector validation: pass.
- Whitespace diff check: pass.
- Auth screenshot flow: pass on iPhone 17 Pro simulator.
- Auth code-sent screenshot flow: pass on iPhone 17 Pro simulator.
- Mine signed-out screenshot flow: pass on iPhone 17 Pro simulator.
- Mine code-sent screenshot flow: pass on iPhone 17 Pro simulator.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-05-auth-gate-account-dock-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-05-auth-gate-code-sent-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-05-auth-gate-mine-signed-out-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-05-auth-gate-mine-code-sent-simulator.png`
  - `docs/design/app-screenshots/current-real-app/auth.png`
  - `docs/design/app-screenshots/current-real-app/auth-code-sent.png`
  - `docs/design/app-screenshots/current-real-app/mine-signed-out.png`
  - `docs/design/app-screenshots/current-real-app/mine-code-sent.png`

## Design review checklist

- Q1 Law of One: Auth and Mine signed-out states are neutral account gates. They use the same single accent already present in the app shell and do not introduce a competing library or feedback color.
- Q2 Focal object: First-read path is retained current card or account object -> phone verification dock -> code/request action -> floating chrome. The gate remains attached to the user's return target instead of becoming a generic login page.
- Q3 Silhouette: This PR does not change a Learning interaction silhouette or Space hierarchy. Auth/Mine inherit the mobile core object grammar from the accepted reset artifact.
- Q4 Forbidden patterns: Refreshed screenshots show no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, game reward chrome, full-width tabbar, serif, pure black/white page, or removed self-assess token.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshots confirm the retained object, phone input, request CTA, code cells, account object, and floating tab bar fit at 1206 x 2622 without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Auth remains phone/SMS verification before Learning. Mine remains an account layer and does not become a settings dashboard or product center. Flip self-assess remains unchanged.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, focused and full App tests, typecheck, lint, metadata scans, CloudBase function tests, harness validation, Auth/Mine screenshot flows, and iOS smoke flow.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. Signed-out Learning/Auth and Mine account gates now show a stable phone-number field and request-code CTA.
- The fix removes the most visible Auth quality defect: placeholder/input text colliding with the field border.
- The gate still explains that the current card, position, record, and account state are preserved through verification.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md` and `docs/design/mocks/mobile-core-surface-reset-v1.html`.
- Implementation mapping: `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`; retained object -> `AuthGate` retained object block; account verification dock -> `PhoneSmsPanel`; account object -> Mine embedded AuthGate; floating chrome -> existing app shell.
- Screenshot evidence mapping: refreshed Auth/Mine current-real-app screenshots plus the four simulator artifacts listed above.
- Interaction/motion source: N/A; no Learning/core interaction or motion behavior changed.
- Physical-space source: N/A; this PR does not change Space UI or Space behavior.
- Learning microcopy basis: no visible Learning card microcopy changed. Auth copy remains product/spec-backed by `spec/account-sync-contract.json` and design-backed by the accepted mobile core object grammar.
- Unimplemented gap: This pass covers light-mode phone Auth/Mine signed-out and code-sent states. Space/statistics auth gates, dark mode, tablet containment, and richer keyboard accessory polish remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The code-sent helper copy remains compact at the bottom of the verification dock. It is contained in screenshots, but a future pass should make the code-entry dock feel more intentionally two-stage rather than only stable.
- This pass intentionally avoids changing authentication behavior, request timing, membership state, or remote/local repository modes.

## Follow-up

- Continue quality passes on Statistics quiet ledger and Detail resolved-card state.
