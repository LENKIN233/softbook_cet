# Agent Run Record: User-facing error copy

## Task summary

- Date: 2026-07-06
- Branch: `codex/fix/mobile-quality-followup-20260706-17`
- PR: N/A at record creation
- Summary: Continued the mobile visible-quality reset by removing remote HTTP status codes from user-visible auth and membership error copy. Request-code and verify-code failures now speak as app recovery states instead of exposing `401` / `503` style diagnostics, and light/dark real-app screenshots were refreshed for Learning auth and Mine auth error states.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
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

- Login is part of the app object flow, not a diagnostic console. Users should see recoverable account states, not raw remote status details.
- User-visible UI and screenshot artifacts must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, raw exception, or status-code language.
- Auth and Mine remain attached object states in the same one-screen app shell; this run does not introduce a new page, modal, or interaction family.

## Implementation hypothesis changed

- `getUserFacingErrorMessage` still recognizes internal remote error families, but maps them to status-code-free user copy.
- Auth request-code failure now renders `验证码暂时没发出。` rather than `验证码发送暂时失败（503）。`.
- Auth verify-code failure now renders `验证码暂时没通过。` rather than `验证码校验暂时失败（401）。`.
- Membership update failures now render without `（503）`.
- The App test metadata guard now rejects visible full-width or half-width parenthesized 3-digit status codes.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, `docs/design/canon.md`, current real app auth/Mine error screenshots, prior auth error run records, `apps/mobile/App.tsx`, `apps/mobile/__tests__/App.test.tsx`, and auth/Mine Maestro screenshot flows.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence. Temporary local HTTP stubs under `/tmp` were used only to trigger remote request-code and verify-code failures in the simulator.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, candidate card content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: removes status codes from user-facing remote error mappings.
- `apps/mobile/__tests__/App.test.tsx`: updates copy expectations and blocks visible parenthesized 3-digit status codes in rendered text.
- `docs/agent-runs/artifacts/2026-07-06-user-facing-error-copy/auth-error-light.png`: real iPhone 17 Pro simulator light Learning auth request-code error screenshot.
- `docs/agent-runs/artifacts/2026-07-06-user-facing-error-copy/auth-error-dark.png`: real iPhone 17 Pro simulator dark Learning auth request-code error screenshot.
- `docs/agent-runs/artifacts/2026-07-06-user-facing-error-copy/auth-verify-error-light.png`: real iPhone 17 Pro simulator light Learning auth verify-code error screenshot.
- `docs/agent-runs/artifacts/2026-07-06-user-facing-error-copy/auth-verify-error-dark.png`: real iPhone 17 Pro simulator dark Learning auth verify-code error screenshot.
- `docs/agent-runs/artifacts/2026-07-06-user-facing-error-copy/mine-auth-error-light.png`: real iPhone 17 Pro simulator light Mine auth request-code error screenshot.
- `docs/agent-runs/artifacts/2026-07-06-user-facing-error-copy/mine-auth-error-dark.png`: real iPhone 17 Pro simulator dark Mine auth request-code error screenshot.
- `docs/agent-runs/artifacts/2026-07-06-user-facing-error-copy/mine-verify-error-light.png`: real iPhone 17 Pro simulator light Mine auth verify-code error screenshot.
- `docs/agent-runs/artifacts/2026-07-06-user-facing-error-copy/mine-verify-error-dark.png`: real iPhone 17 Pro simulator dark Mine auth verify-code error screenshot.
- `docs/design/app-screenshots/current-real-app/auth-error.png`
- `docs/design/app-screenshots/current-real-app/auth-verify-error.png`
- `docs/design/app-screenshots/current-real-app/mine-auth-error.png`
- `docs/design/app-screenshots/current-real-app/mine-verify-error.png`
- `docs/design/app-screenshots/current-real-app/dark/auth-error.png`
- `docs/design/app-screenshots/current-real-app/dark/auth-verify-error.png`
- `docs/design/app-screenshots/current-real-app/dark/mine-auth-error.png`
- `docs/design/app-screenshots/current-real-app/dark/mine-verify-error.png`
- `docs/agent-runs/2026-07-06-user-facing-error-copy.md`: this run record.

## Commands run

- `npm exec prettier -- --write App.tsx __tests__/App.test.tsx` from `apps/mobile` -> passed.
- `npm test -- --runInBand --watchAll=false __tests__/App.test.tsx` from `apps/mobile` -> passed, 47 tests; pretest metadata leak scan passed. Expected mocked sync warning logs only.
- `npm start -- --reset-cache` from `apps/mobile` -> started Metro for simulator validation.
- `python3 /tmp/softbook_auth_503_stub.py` -> started local 503 HTTP stub on `127.0.0.1:48731` for simulator-only request-code failure proof.
- `python3 /tmp/softbook_auth_verify_401_stub.py` -> started local verify-code HTTP stub on `127.0.0.1:48732`; request-code returns 200 and verify-code returns 401.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test /tmp/softbook-maestro-clear-state.yaml && SIMCTL_CHILD_SOFTBOOK_CET_REMOTE_BASE_URL='http://127.0.0.1:48731' xcrun simctl launch --terminate-running-process ... && maestro --device ... test apps/mobile/e2e/maestro/ios-auth-error-screenshot.yaml` -> passed in light and dark.
- The same 503 stub launch plus `apps/mobile/e2e/maestro/ios-mine-auth-error-screenshot.yaml` -> passed in light and dark.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test /tmp/softbook-clear-state.yaml && SIMCTL_CHILD_SOFTBOOK_CET_REMOTE_BASE_URL='http://127.0.0.1:48732' xcrun simctl launch --terminate-running-process ... && maestro --device ... test apps/mobile/e2e/maestro/ios-auth-verify-error-screenshot.yaml` -> passed in light and dark.
- The same 401 stub launch plus `apps/mobile/e2e/maestro/ios-mine-verify-error-screenshot.yaml` -> passed in light and dark.
- `sips -g pixelWidth -g pixelHeight ...` for the eight artifact screenshots and eight current screenshots -> passed, all 1206 x 2622.
- `git diff --check` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm run design-metadata-leak-scan` from `apps/mobile` -> passed.
- `npm run lint -- --quiet` from `apps/mobile` -> passed.
- `npm run typecheck` from `apps/mobile` -> passed.
- `npm test` from `infra/cloudbase/functions/softbook-api` -> passed, 11 tests.
- `npm test -- --runInBand --watchAll=false` from `apps/mobile` -> passed, 26 suites / 163 tests. Expected mocked sync warning logs only.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test apps/mobile/e2e/maestro/ios-smoke.yaml` -> passed.
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_user_facing_error_copy_pr_body.md` -> passed.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_user_facing_error_copy_pr_body.md --changed-file ...` -> passed after making Q6 surface-specific evidence explicit in the PR body.

## Validation results

- Focused App Jest: pass, 47 tests.
- Full mobile Jest: pass, 26 suites / 163 tests.
- Whitespace diff check: pass.
- Maestro selector validation: pass.
- Design metadata leak scan: pass.
- Mobile lint and typecheck: pass.
- Backend function tests: pass, 11 tests.
- Harness with and without remote guard: pass.
- Auth and Mine request-code error screenshot flows: pass in light and dark on iPhone 17 Pro simulator.
- Auth and Mine verify-code error screenshot flows: pass in light and dark on iPhone 17 Pro simulator.
- iOS smoke flow: pass.
- Screenshot dimensions: pass, 1206 x 2622.
- Agent review gate: pass.
- PR design gate: pass.

## Design review checklist

- Q1 Law of One: Error recovery stays inside the existing Learning auth object and Mine account object. It does not introduce a second strong accent or a diagnostic surface.
- Q2 Focal object: The first-read path remains route title -> retained card/account object -> phone/code action dock -> recovery dock -> floating chrome.
- Q3 Silhouette: The refreshed screenshots preserve the one-screen app shell and attached recovery state instead of a page-level error report.
- Q4 Forbidden patterns: The refreshed screenshots show no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, raw exception, status code, gradient text, gamification chrome, full-width tabbar, serif, removed self-assess token, or internal product term.
- Q5 Layout containment: Real iPhone 17 Pro simulator light and dark screenshots confirm the error dock, retry pill, code cells, CTA, and floating tab bar fit without clipped text, overlap, horizontal overflow, keyboard residue, or bottom chrome collision.
- Q6 Surface-specific: Auth remains an account/continuity recovery state attached to the current object. Mine remains account ownership recovery, not a generic settings or diagnostics page.
- AP-22: The design review checklist is answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: Error visible text was inspected in real screenshots; no user-visible internal implementation, remote status-code, or design-process language was introduced.

## Agent review status

- Reviewer: Codex.
- Status: Passed after full local gates and real simulator screenshot review.
- Blocking findings: none.

## User-visible UI impact

- Yes. Auth and Mine error states no longer show `401` / `503` style diagnostics to learners.
- Request-code and verify-code failures now read as recoverable app states that tell the user what to do next while preserving the current position.
- Normal login, Learning, Space, Statistics, Mine, membership, sync, and smoke behavior are unchanged.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`, `docs/design/canon.md`, and `spec/visual-language.json`.
- Implementation mapping: auth object recovery copy -> `getUserFacingErrorMessage`; rendered phone/code states -> `PhoneSmsPanel`; status-code guard -> `USER_VISIBLE_METADATA_PATTERN`; screenshot evidence -> current real app auth/Mine error light/dark screenshots.
- Screenshot evidence mapping:
  - `docs/agent-runs/artifacts/2026-07-06-user-facing-error-copy/auth-error-light.png` -> `docs/design/app-screenshots/current-real-app/auth-error.png`
  - `docs/agent-runs/artifacts/2026-07-06-user-facing-error-copy/auth-error-dark.png` -> `docs/design/app-screenshots/current-real-app/dark/auth-error.png`
  - `docs/agent-runs/artifacts/2026-07-06-user-facing-error-copy/auth-verify-error-light.png` -> `docs/design/app-screenshots/current-real-app/auth-verify-error.png`
  - `docs/agent-runs/artifacts/2026-07-06-user-facing-error-copy/auth-verify-error-dark.png` -> `docs/design/app-screenshots/current-real-app/dark/auth-verify-error.png`
  - `docs/agent-runs/artifacts/2026-07-06-user-facing-error-copy/mine-auth-error-light.png` -> `docs/design/app-screenshots/current-real-app/mine-auth-error.png`
  - `docs/agent-runs/artifacts/2026-07-06-user-facing-error-copy/mine-auth-error-dark.png` -> `docs/design/app-screenshots/current-real-app/dark/mine-auth-error.png`
  - `docs/agent-runs/artifacts/2026-07-06-user-facing-error-copy/mine-verify-error-light.png` -> `docs/design/app-screenshots/current-real-app/mine-verify-error.png`
  - `docs/agent-runs/artifacts/2026-07-06-user-facing-error-copy/mine-verify-error-dark.png` -> `docs/design/app-screenshots/current-real-app/dark/mine-verify-error.png`
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing request-code, verify-code, retry, and keyboard dismissal handlers are reused.
- Physical-space source: N/A; this run does not alter Space.
- Learning microcopy basis: N/A; this run does not alter Learning task microcopy. Auth recovery copy is design-backed user-facing error sanitization.
- Unimplemented gap: Light and dark phone request-code/verify-code error states are covered. Smaller phones, tablet containment, dynamic type, and post-auth transition motion remain follow-up evidence.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- Internal thrown errors and console warnings still retain remote status codes for engineering diagnosis; only user-facing copy is sanitized.
- The screenshot proof uses local HTTP stubs to exercise remote failures. The UI path is the same sanitized error mapper covered by App tests.
