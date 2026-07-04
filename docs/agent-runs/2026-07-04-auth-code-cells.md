# Agent Run Record: Auth code cells

## Task summary

- Date: 2026-07-04
- Branch: `codex/fix/mobile-quality-followup-20260703-12`
- PR: N/A at record creation
- Summary: Continued the user-visible mobile quality reset by replacing the auth code-sent long input with a compact short-code cell object. The signed-out Learning gate and Mine account gate now present the SMS code as a focused 4-6 digit confirmation surface while preserving the existing auth behavior and Maestro selector contract.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/account-sync-contract.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/card-system.json`
- `spec/visual-language.json`
- `spec/runtime-boundaries.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mocks/mobile-core-surface-reset-v1.html`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `docs/design/canon.md`
- `docs/design/search-runs/2026-06-30-mobile-app-quality-reset/current-real-app-blind-audit.md`

## Product truth used

- Softbook CET is a single-card flow product; auth is not a separate form page and must remain attached to the current learning/account object.
- Protected routes keep the user's current object and return target visible during SMS verification.
- User-visible UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.
- Visual output must inherit the accepted mobile core reset language and answer the design review checklist before delivery.

## Implementation hypothesis changed

- `PhoneSmsPanel` renders the code-sent state as six short-code cells over the existing hidden `auth-code-input` TextInput, keeping the stable selector and native one-time-code input path.
- The code entry object is visually separated from the resend row and keeps the submit CTA attached to the same row, making the verification step read as a compact app control rather than a generic long form.
- The helper copy now explicitly frames the code as a `4-6 位短码` and keeps the existing return target.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted mobile core reset design artifacts, current real app auth screenshots, `apps/mobile/App.tsx`, and auth-related Maestro flows.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: replaces the visible code-sent long input with short-code cells while preserving `auth-code-input`.
- `docs/agent-runs/artifacts/2026-07-04-auth-code-cells-auth-code-sent-simulator.png`: real iPhone 17 Pro simulator Learning auth code-sent screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-04-auth-code-cells-mine-code-sent-simulator.png`: real iPhone 17 Pro simulator Mine auth code-sent screenshot evidence.
- `docs/design/app-screenshots/current-real-app/auth-code-sent.png`: refreshed current real app Learning auth code-sent screenshot.
- `docs/design/app-screenshots/current-real-app/mine-code-sent.png`: refreshed current real app Mine auth code-sent screenshot.
- `docs/agent-runs/2026-07-04-auth-code-cells.md`: this run record.

## Commands run

- `npx prettier --write App.tsx` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed after replacing unsupported `StyleSheet.absoluteFillObject` usage with explicit absolute positioning.
- `npm test -- --runInBand --watchAll=false App.test.tsx` in `apps/mobile` -> passed, 47 tests; pretest metadata leak scan passed.
- `npm start -- --reset-cache` in `apps/mobile` -> started Metro for simulator validation.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance light` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test e2e/maestro/ios-auth-code-sent-screenshot.yaml auth-code-sent` in `apps/mobile` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test e2e/maestro/ios-mine-code-sent-screenshot.yaml mine-code-sent` in `apps/mobile` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-04-auth-code-cells-auth-code-sent-simulator.png docs/design/app-screenshots/current-real-app/auth-code-sent.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-04-auth-code-cells-mine-code-sent-simulator.png docs/design/app-screenshots/current-real-app/mine-code-sent.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/design/app-screenshots/current-real-app/auth-code-sent.png docs/design/app-screenshots/current-real-app/mine-code-sent.png` -> passed, both 1206 x 2622.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro test e2e/maestro/ios-smoke.yaml` in `apps/mobile` -> passed, including tapping `auth-code-input`, entering `2468`, submitting auth, Learning, Space, Statistics, and Mine.
- `npm run lint -- --quiet` in `apps/mobile` -> passed.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run metadata-leak-scan` in `apps/mobile` -> passed.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `git diff --check` -> passed.
- `npm test -- --runInBand --watchAll=false` in `apps/mobile` -> passed, 26 suites and 163 tests; pretest metadata leak scan passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_auth_code_cells_pr_body.md --changed-file apps/mobile/App.tsx --changed-file docs/agent-runs/2026-07-04-auth-code-cells.md --changed-file docs/agent-runs/artifacts/2026-07-04-auth-code-cells-auth-code-sent-simulator.png --changed-file docs/agent-runs/artifacts/2026-07-04-auth-code-cells-mine-code-sent-simulator.png --changed-file docs/design/app-screenshots/current-real-app/auth-code-sent.png --changed-file docs/design/app-screenshots/current-real-app/mine-code-sent.png` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_auth_code_cells_pr_body.md` -> passed.

## Validation results

- Focused App Jest: pass, 47 tests.
- Mobile lint: pass.
- Mobile typecheck: pass.
- Mobile visible metadata leak scan: pass.
- Design artifact metadata leak scan: pass.
- Auth code-sent screenshot flow: pass on iPhone 17 Pro simulator.
- Mine code-sent screenshot flow: pass on iPhone 17 Pro simulator.
- Real screenshot dimensions: pass, both refreshed screenshots are 1206 x 2622.
- Strict iOS Maestro smoke: pass on iPhone 17 Pro simulator, including real SMS code input through the preserved selector.
- Mobile full Jest: pass, 26 suites and 163 tests.
- CloudBase API tests: pass, 11 tests.
- Maestro selector validation: pass.
- Full harness validation: pass.
- Whitespace check: pass.
- PR design gate: pass.
- Agent review gate: pass.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-04-auth-code-cells-auth-code-sent-simulator.png`
  - `docs/agent-runs/artifacts/2026-07-04-auth-code-cells-mine-code-sent-simulator.png`
  - `docs/design/app-screenshots/current-real-app/auth-code-sent.png`
  - `docs/design/app-screenshots/current-real-app/mine-code-sent.png`

## Design review checklist

- Q1 Law of One: The auth code-sent state keeps one quiet current-route accent bound to the active Learning or Mine object. The short-code cells use the same accent only for the active cell and do not introduce competing subject colors.
- Q2 Focal object: The first-read path is current object -> phone verification -> sent-code row with compact cells and attached submit action -> bottom route chrome. The user's return target remains visible.
- Q3 Silhouette: The surface matches the accepted mobile core reset silhouette of object-attached auth rather than a standalone account form. The change narrows the code entry to a short control inside the existing auth object.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product term appears in the refreshed screenshots.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshots confirm the header, current object, phone field, resend row, short-code cells, submit action, helper copy, and floating tab bar fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Learning stays system-sequenced and does not expose module selection as the primary path. This run does not alter Statistics or flip self-assess.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- VL-AP-07: The visual output includes universal Q1-Q4 and conditional Q5-Q6 answers in this run record and PR body.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, screenshot flows, strict iOS smoke, App/full Jest, typecheck, lint, metadata scans, selector validation, API tests, whitespace check, and full harness validation.
- Blocking findings: none known.

## User-visible UI impact

- Yes. Learning and Mine SMS code-sent states now present a compact app-style short-code entry control instead of a generic long code field.
- Auth state, request-code behavior, verify-code behavior, return target, hidden native one-time-code input, and stable Maestro selector are unchanged.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, `spec/visual-language.json`, and `docs/design/search-runs/2026-06-30-mobile-app-quality-reset/current-real-app-blind-audit.md`.
- Implementation mapping: auth code-sent dock -> `apps/mobile/App.tsx` / `PhoneSmsPanel`; hidden native input target -> `auth-code-input`; screenshot evidence -> `docs/design/app-screenshots/current-real-app/auth-code-sent.png` and `docs/design/app-screenshots/current-real-app/mine-code-sent.png`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing request-code, verify-code, keyboard dismiss, and route return handlers are reused.
- Physical-space source: N/A; this run does not alter Space.
- Card content handoff/validation: N/A; this run does not alter card payload import, dry-run, audit, runtime smoke, or coverage delta.
- Unimplemented design gaps: Light-mode iPhone 17 Pro signed-out/code-sent states are covered. Dark code-sent states, small-phone containment, tablet containment, dynamic type, and remote SMS failure edge states remain follow-up quality passes.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The hidden TextInput is intentionally preserved to keep native one-time-code behavior and automated selector coverage; strict iOS smoke verified it is tappable and accepts input.
- Smaller phones, dark mode, tablet, and accessibility dynamic type screenshots should be covered in follow-up quality passes.

## Follow-up

- Continue user-visible quality passes on remaining auth edge states, dark/tablet containment, and one-screen cohesion gaps across Learning, Space, Statistics, and Mine.
