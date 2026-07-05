# Agent Run Record: Mine request dock

## Task summary

- Date: 2026-07-06
- Branch: `codex/fix/mobile-quality-followup-20260706-07`
- PR: N/A at record creation
- Summary: Continued the mobile visible-quality reset by refactoring the Mine signed-out phone request state. The account verification layer now presents the phone field and request-code action as a vertical, bounded operation object instead of a horizontally squeezed form row.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/account-sync-contract.json`
- `spec/product-core.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/canon.md`
- `docs/design/visual-reference.html`
- `docs/design/decisions/mobile-core-surface-reset-v1.md`
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`
- `spec/runtime-boundaries.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Phone plus SMS code is the primary login method.
- Authentication is required before protected learning, space, membership, and sync continuity can proceed.
- Mine is an account-support surface, not the product center; login must attach to the account object rather than become a generic standalone form.
- User-visible auth UI must not expose raw card ids, source metadata, agent/harness/spec/debug/runtime terms, internal remote error vocabulary, or implementation language.

## Implementation hypothesis changed

- Mine request-code state now reads as one account verification dock: status copy -> phone field -> full-width request action.
- The request action no longer shares a cramped horizontal row with the phone input.
- Existing auth behavior, `auth-phone-input`, `auth-request-code-button`, `auth-request-inline-dock`, route tabs, and code-sent behavior are preserved.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted mobile core reset design and mapping, current real app Mine signed-out screenshot, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, and Mine signed-out Maestro screenshot flow.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: changes account-docked phone request action row from horizontal to vertical, gives the phone field and request button full width, and adds a stable `auth-request-action-row` selector.
- `apps/mobile/__tests__/App.test.tsx`: adds assertions that Mine signed-out request state remains a vertical dock with a full-width request button.
- `docs/agent-runs/artifacts/2026-07-06-mine-request-dock/mine-signed-out-real-app.png`: real iPhone 17 Pro simulator light Mine signed-out screenshot evidence.
- `docs/agent-runs/artifacts/2026-07-06-mine-request-dock/mine-signed-out-dark-real-app.png`: real iPhone 17 Pro simulator dark Mine signed-out screenshot evidence.
- `docs/design/app-screenshots/current-real-app/mine-signed-out.png`: refreshed current real app light Mine signed-out screenshot.
- `docs/design/app-screenshots/current-real-app/dark/mine-signed-out.png`: added current real app dark Mine signed-out screenshot.
- `docs/agent-runs/2026-07-06-mine-request-dock.md`: this run record.

## Commands run

- `npm --prefix apps/mobile test -- --runInBand --watchAll=false --runTestsByPath __tests__/App.test.tsx` -> passed, 47 tests; pretest metadata leak scan passed. Expected mocked sync warning logs only.
- `npm --prefix apps/mobile start -- --reset-cache` -> started Metro for simulator validation.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance light` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home PATH=... maestro test apps/mobile/e2e/maestro/ios-mine-signed-out-screenshot.yaml` in light appearance -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-mine-request-dock/mine-signed-out-real-app.png` -> passed.
- `xcrun simctl ui 9B086605-1D68-40C4-A849-D0DFF42468ED appearance dark` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home PATH=... maestro test apps/mobile/e2e/maestro/ios-mine-signed-out-screenshot.yaml` in dark appearance -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-06-mine-request-dock/mine-signed-out-dark-real-app.png` -> passed.
- `sips -g pixelWidth -g pixelHeight ...` -> passed, both real simulator evidence screenshots are 1206 x 2622.
- `git diff --check` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites / 163 tests. Expected mocked sync warning logs only.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `JAVA_HOME=/Applications/Android Studio.app/Contents/jbr/Contents/Home PATH=... maestro test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.

## Validation results

- Focused App Jest: pass, 47 tests.
- Mine signed-out light screenshot flow: pass on iPhone 17 Pro simulator.
- Mine signed-out dark screenshot flow: pass on iPhone 17 Pro simulator.
- Real screenshot dimensions: pass, two evidence screenshots are 1206 x 2622.
- Whitespace diff check: pass.
- Selector and metadata-leak gates: pass.
- Full local gates: pass.
- iOS smoke flow: pass.

## Design review checklist

- Q1 Law of One: Mine request dock uses the account/auth accent as the single active signal; the request button stays quiet while the phone number is empty.
- Q2 Focal object: First-read path is route chrome -> Mine account object -> retained account chips -> request dock -> phone field -> request action.
- Q3 Silhouette: The request state now has a bounded vertical account-verification silhouette, not a horizontally squeezed form row.
- Q4 Forbidden patterns: No visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product term appears in the refreshed screenshots.
- Q5 Layout containment: Real iPhone 17 Pro simulator light and dark screenshots confirm the phone field, request action, account object, and floating tab bar fit without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: Mine remains an account-support object. Login is attached to account continuity and does not become a generic login page or product-center dashboard.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: Mine visible text was inspected in real screenshots; no user-visible internal implementation or design-process language was introduced.

## Agent review status

- Reviewer: Codex.
- Status: Passed after full local gates and real simulator screenshot review.
- Blocking findings: none.

## User-visible UI impact

- Yes. Mine signed-out state now presents phone entry and request-code action as one complete vertical operation object.
- The change fixes the prior form-like row where the phone field and `获取短码` action were squeezed together.
- Learning progression, review, statistics, space operations, auth semantics, membership, purchase, sync, and card content are unchanged.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, `docs/design/visual-reference.html`, and `spec/visual-language.json`.
- Implementation mapping: Mine account object -> `mine-profile-card`; request dock -> `auth-request-inline-dock`; request row -> `auth-request-action-row`; phone field -> `auth-phone-field-dock` / `auth-phone-input`; request action -> `auth-request-code-button`.
- Screenshot evidence mapping:
  - `docs/agent-runs/artifacts/2026-07-06-mine-request-dock/mine-signed-out-real-app.png` -> `docs/design/app-screenshots/current-real-app/mine-signed-out.png`
  - `docs/agent-runs/artifacts/2026-07-06-mine-request-dock/mine-signed-out-dark-real-app.png` -> `docs/design/app-screenshots/current-real-app/dark/mine-signed-out.png`
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing phone entry and request-code handlers are reused.
- Physical-space source: N/A; this run does not alter Space semantics.
- Learning microcopy basis: no visible-copy change in Learning. Mine auth visible copy is unchanged; only request-dock layout and containment changed.
- Unimplemented gap: Smaller-phone Mine signed-out containment, tablet Mine signed-out containment, phone-number-ready active request state, remote auth error visual state, and keyboard-open signed-out state remain follow-up evidence.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- The request dock is taller than before to avoid horizontal squeeze. Smaller phones and keyboard-open states should be covered in follow-up passes.
- Existing stable selectors were preserved and checked by Jest and Maestro.

## Follow-up

- Continue visible-quality coverage with smaller-phone Mine auth, active request-code state, keyboard-open auth state, remote auth failure states, and remaining protected-route auth gates.
