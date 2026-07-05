# Agent Run Record: Mine account gate compaction

## Task summary

- Date: 2026-07-05
- Branch: `codex/fix/mobile-quality-followup-20260705-14`
- PR: N/A at record creation
- Summary: Continued the mobile app quality reset by reshaping Mine signed-out and code-sent states from a form-like auth page into a compact account gate attached to the Mine account object.

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

- Mine is an account support surface for CET preparation continuity; it is not a standalone login form page or a general settings hub.
- The focal object for Mine is the account card. Signed-out and code-sent states should remain attached to that account object.
- Account confirmation protects learning records, physical space position, and membership entitlement under one account.
- User-visible UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, TODO, or similar internal language.

## Implementation hypothesis changed

- `AuthGate` keeps Mine-specific account header, continuity chips, and phone/SMS controls inside one compact account gate.
- Mine no longer uses the generic route gate's vertical space distribution. Removing the forced `space-between`/large `minHeight` treatment prevents the signed-out state from reading as an unfinished form page.
- The retained account ledger remains visible and test-addressable, but its explanatory header is visually suppressed for Mine so the account card reads as account object -> continuity chips -> action dock.
- The phone request and SMS code states use compact horizontal action docks for Mine, preserving existing auth handlers and testIDs.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted mobile reset decision/mock/mapping, `apps/mobile/App.tsx`, App tests, Mine signed-out/code-sent Maestro flows, iOS smoke flow, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: compacts Mine signed-out/code-sent account gate, retained account ledger, phone request dock, and SMS code dock.
- `docs/agent-runs/artifacts/2026-07-05-mine-account-gate/mine-signed-out-real-app.png`: real iPhone 17 Pro simulator Mine signed-out screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-05-mine-account-gate/mine-code-sent-real-app.png`: real iPhone 17 Pro simulator Mine code-sent screenshot evidence.
- `docs/design/app-screenshots/current-real-app/mine-signed-out.png`: refreshed current real app Mine signed-out screenshot.
- `docs/design/app-screenshots/current-real-app/mine-code-sent.png`: refreshed current real app Mine code-sent screenshot.
- `docs/agent-runs/2026-07-05-mine-account-gate.md`: this run record.

## Commands run

- `apps/mobile/node_modules/.bin/prettier --write apps/mobile/App.tsx` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false --testNamePattern="mine"` -> passed, 6 Mine-focused tests; pretest visible metadata leak scan passed.
- `npm --prefix apps/mobile start -- --reset-cache` -> started Metro for simulator validation.
- `env JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-signed-out-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-05-mine-account-gate/mine-signed-out-real-app.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-05-mine-account-gate/mine-signed-out-real-app.png docs/design/app-screenshots/current-real-app/mine-signed-out.png` -> passed.
- `env JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-mine-code-sent-screenshot.yaml` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-05-mine-account-gate/mine-code-sent-real-app.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-05-mine-account-gate/mine-code-sent-real-app.png docs/design/app-screenshots/current-real-app/mine-code-sent.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-05-mine-account-gate/mine-signed-out-real-app.png docs/agent-runs/artifacts/2026-07-05-mine-account-gate/mine-code-sent-real-app.png docs/design/app-screenshots/current-real-app/mine-signed-out.png docs/design/app-screenshots/current-real-app/mine-code-sent.png` -> passed, all 1206 x 2622.
- `git diff --check` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `env JAVA_HOME='/Applications/Android Studio.app/Contents/jbr/Contents/Home' maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.

## Validation results

- Focused Mine App Jest: pass, 6 tests.
- Full mobile Jest: pass, 26 suites and 163 tests.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile visible metadata leak scan: pass through Jest pretest.
- Design artifact metadata leak scan: pass.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass with full `python3 scripts/validate_harness.py` and with `--skip-remote-guard`.
- Maestro selector validation: pass.
- Whitespace diff check: pass.
- Mine signed-out screenshot flow: pass on iPhone 17 Pro simulator.
- Mine code-sent screenshot flow: pass on iPhone 17 Pro simulator.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-05-mine-account-gate/mine-signed-out-real-app.png`
  - `docs/agent-runs/artifacts/2026-07-05-mine-account-gate/mine-code-sent-real-app.png`
  - `docs/design/app-screenshots/current-real-app/mine-signed-out.png`
  - `docs/design/app-screenshots/current-real-app/mine-code-sent.png`

## Design review checklist

- Q1 Law of One: Mine signed-out/code-sent states now use the same quiet account object grammar as logged-in Mine. They do not introduce a second login-page visual language or a separate form page family.
- Q2 Focal object: First-read path is account object -> account continuity chips -> compact phone/SMS action dock -> floating chrome. The phone/SMS controls are attached to the account object instead of becoming the page's only purpose.
- Q3 Silhouette: Mine is not a Learning interaction silhouette and not a generic auth screen. It follows the mobile reset account-layer silhouette: account card, retained continuity chips, compact controls, and floating tab chrome.
- Q4 Forbidden patterns: Refreshed screenshots show no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, pure black/white page, or removed self-assess token.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshots confirm signed-out and code-sent Mine content fits at 1206 x 2622 without clipped text, overlap, horizontal overflow, excessive internal stretch, or bottom chrome collision.
- Q6 Surface-specific: This pass is Mine-only. It keeps Learning as the primary sequenced flow, Statistics as the ledger surface, Space as the physical hierarchy surface, and does not alter flip self-assess.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, focused and full App tests, typecheck, lint, metadata scans, CloudBase function tests, harness validation, Mine screenshot flows, and iOS smoke flow.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. Mine signed-out and code-sent states now read as account continuity states rather than a standalone login form page.
- Existing phone request, code entry, resend, and submit controls remain visible and operable through existing testIDs.
- Existing auth business logic, repository mode handling, keyboard accessory, and route return copy are reused.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, and `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`.
- Implementation mapping: account object -> `mine-profile-card`; account header -> `auth-mine-account-header`; continuity chips -> `auth-retained-ledger` / `auth-retained-ledger-row`; phone request dock -> `auth-request-inline-dock` / `auth-phone-input` / `auth-request-code-button`; SMS code dock -> `auth-code-inline-dock` / `auth-code-input` / `auth-submit-button`.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-05-mine-account-gate/mine-signed-out-real-app.png` -> `docs/design/app-screenshots/current-real-app/mine-signed-out.png`; `docs/agent-runs/artifacts/2026-07-05-mine-account-gate/mine-code-sent-real-app.png` -> `docs/design/app-screenshots/current-real-app/mine-code-sent.png`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing phone, code, resend, submit, keyboard, and route handlers are reused.
- Physical-space source: N/A; this PR does not change Space UI.
- Learning microcopy basis: N/A; this PR does not change Learning UI copy or card content.
- Unimplemented gap: This pass covers light-mode signed-out and code-sent Mine phone auth states. Dark mode, tablet containment, recovery prompt visual treatment, remote-auth error state, and post-trial/premium Mine states remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- `PhoneSmsPanel` remains shared with route object gates. This pass gates the tighter horizontal dock styles behind `accountDock`, and focused/full tests plus iOS smoke passed.
- Future passes should capture dark-mode Mine signed-out/code-sent states and remote-auth error states so these variants are not left behind.

## Follow-up

- Continue quality passes on dark mode, tablet containment, recovery/error states, and post-trial/premium Mine variants.
