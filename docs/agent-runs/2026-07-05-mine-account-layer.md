# Agent Run Record: Mine account layer quieting

## Task summary

- Date: 2026-07-05
- Branch: `codex/fix/mobile-quality-followup-20260705-13`
- PR: N/A at record creation
- Summary: Continued the mobile app quality reset by reshaping logged-in Mine from a dashboard-like profile page into a quieter account layer. The account object now leads with study-route continuity, learning counters are low-weight status chips, and membership actions are attached as a compact account dock.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
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

- Mine supports the CET learning flow; it is not the product center, a statistics dashboard, or a complex settings surface.
- The focal object for Mine is the account card.
- Account rows carry phone, membership, route, and restore/purchase state.
- Membership may be visible, but the membership action must remain clear and non-invasive.
- Learning remains the primary study path, Statistics remains the ledger surface, and Space remains the physical hierarchy surface.
- User-visible UI and screenshots must not expose agent, harness, spec, metadata, runtime, mock, prototype, seed, fixture, debug, repo path, raw API, or TODO language.

## Implementation hypothesis changed

- `MineSurface` now leads the logged-in account card with study-route continuity copy instead of making the masked phone number the first-read headline.
- The phone number remains visible in the identity row, preserving account clarity without turning Mine into a contact/profile detail page.
- The four learning state metrics remain present and test-addressable, but render as small account status chips instead of dashboard numerals.
- The primary Mine route action is quieted from a black CTA block into an account-attached row.
- Trial membership is compressed into a horizontal account dock, keeping benefits and purchase/trial actions visible without becoming a large promotional card.

## Workspace boundary and read scope

- Active truth/source read: task-relevant specs listed above, accepted mobile reset decision/mock/mapping, `apps/mobile/App.tsx`, App tests, Mine screenshot Maestro flow, iOS smoke flow, and current real app screenshots.
- Generated/dependency/cache/archive read: simulator screenshots were inspected only as validation evidence.
- External workspace read: none. This run did not touch `/Users/lenkin/programing/card make`, card candidate content, approvals, imports, or payload production.

## Files changed

- `apps/mobile/App.tsx`: quiets Mine account hierarchy, metric strip, primary action, and membership compact dock.
- `docs/agent-runs/artifacts/2026-07-05-mine-account-layer/mine-real-app.png`: real iPhone 17 Pro simulator Mine screenshot evidence.
- `docs/design/app-screenshots/current-real-app/mine.png`: refreshed current real app Mine screenshot.
- `docs/agent-runs/2026-07-05-mine-account-layer.md`: this run record.

## Commands run

- `npm --prefix apps/mobile exec prettier -- --write apps/mobile/App.tsx` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false App.test.tsx` -> passed, 47 tests; pretest visible metadata leak scan passed.
- `npm --prefix apps/mobile start -- --reset-cache` -> started Metro for simulator validation.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-mine-screenshot.yaml` in `apps/mobile` -> passed.
- `xcrun simctl io 9B086605-1D68-40C4-A849-D0DFF42468ED screenshot docs/agent-runs/artifacts/2026-07-05-mine-account-layer/mine-real-app.png` -> passed.
- `cp docs/agent-runs/artifacts/2026-07-05-mine-account-layer/mine-real-app.png docs/design/app-screenshots/current-real-app/mine.png` -> passed.
- `sips -g pixelWidth -g pixelHeight docs/agent-runs/artifacts/2026-07-05-mine-account-layer/mine-real-app.png docs/design/app-screenshots/current-real-app/mine.png` -> passed, both 1206 x 2622.
- `git diff --check` -> passed.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed, 26 suites and 163 tests; expected mocked sync warning logs only.
- `npm --prefix infra/cloudbase/functions/softbook-api test` -> passed, 11 tests.
- `python3 scripts/validate_harness.py` -> passed.
- `python3 scripts/validate_harness.py --skip-remote-guard` -> passed.
- `JAVA_HOME=/opt/homebrew/opt/openjdk PATH=/opt/homebrew/opt/openjdk/bin:$PATH maestro --device 9B086605-1D68-40C4-A849-D0DFF42468ED test e2e/maestro/ios-smoke.yaml` in `apps/mobile` -> passed.

## Validation results

- Focused App Jest: pass, 47 tests.
- Full mobile Jest: pass, 26 suites and 163 tests.
- Mobile typecheck: pass.
- Mobile lint: pass.
- Mobile visible metadata leak scan: pass through Jest pretest.
- Design artifact metadata leak scan: pass.
- CloudBase function tests: pass, 11 tests.
- Harness validation: pass with full `python3 scripts/validate_harness.py` and with `--skip-remote-guard`.
- Maestro selector validation: pass.
- Whitespace diff check: pass.
- Mine screenshot flow: pass on iPhone 17 Pro simulator.
- iOS smoke flow: pass on iPhone 17 Pro simulator.
- Real screenshot evidence:
  - `docs/agent-runs/artifacts/2026-07-05-mine-account-layer/mine-real-app.png`
  - `docs/design/app-screenshots/current-real-app/mine.png`

## Design review checklist

- Q1 Law of One: Mine is an account support surface and uses the same quiet account accent only. It does not introduce a competing library accent or a second strong CTA color family.
- Q2 Focal object: First-read path is account object -> account identity/status rows -> quiet route actions -> compact membership dock -> floating chrome. Mine no longer starts as a statistics dashboard or phone-number detail page.
- Q3 Silhouette: Mine is not a Learning interaction silhouette. It follows the mobile reset object grammar for account layer: account card, account rows, low-weight controls, and floating tab chrome.
- Q4 Forbidden patterns: Refreshed screenshot shows no visible metadata, agent, harness, debug, runtime, repo, seed, fixture, TODO, raw API, gradient text, gamification chrome, full-width tabbar, serif, pure black/white page, or removed self-assess token.
- Q5 Layout containment: Real iPhone 17 Pro simulator screenshot confirms Mine content, route actions, membership dock, and floating tab bar fit at 1206 x 2622 without clipped text, overlap, horizontal overflow, or bottom chrome collision.
- Q6 Surface-specific: This pass is Mine-only. It keeps Learning as the primary sequenced flow, Statistics as the ledger surface, Space as the physical hierarchy surface, and does not alter flip self-assess.
- AP-22: The design review checklist six questions are answered here before PR delivery with real simulator screenshot evidence.
- AP-23: This run does not alter flip self-assess. The two-state model remains `有把握` = mint/confident and `再回看` = amber/review.
- VL-AP-07: This run includes the required visual checklist answers and refreshed current-real-app screenshot evidence.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally after code inspection, real screenshot inspection, focused and full App tests, typecheck, lint, metadata scans, CloudBase function tests, harness validation, Mine screenshot flow, and iOS smoke flow.
- Blocking findings: none known at record creation.

## User-visible UI impact

- Yes. Logged-in Mine now reads as an account support layer instead of a dashboard-like profile page.
- Route actions remain visible and operable through existing testIDs.
- Membership trial and purchase actions remain visible and operable through existing testIDs.

## Design source and implementation mapping

- Design source: `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, and `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`.
- Implementation mapping: account object -> `mine-profile-card`; account rows -> `mine-profile-phone` / `mine-profile-today`; route controls -> `mine-go-learning`, `mine-go-space`, and `mine-go-statistics`; membership action -> `membership-host-card`, `membership-access-strip`, `membership-start-trial-button`, and `membership-purchase-button`.
- Screenshot evidence mapping: `docs/agent-runs/artifacts/2026-07-05-mine-account-layer/mine-real-app.png` -> `docs/design/app-screenshots/current-real-app/mine.png`.
- Interaction/motion source: N/A; no new interaction family or motion implementation was added. Existing route, trial, purchase, and membership handlers are reused.
- Physical-space source: N/A; this PR does not change Space UI.
- Learning microcopy basis: N/A; this PR does not change Learning UI copy or card content.
- Unimplemented gap: This pass covers light-mode logged-in phone Mine. Signed-out Mine, code-sent Mine, dark mode, tablet containment, recovery prompt visual treatment, and post-trial/premium Mine states remain follow-up work.

## Card make external workspace impact

- N/A. This run did not modify card candidate content, approvals, imports, or `/Users/lenkin/programing/card make`.

## Risks and open questions

- `SummaryMetricCard` is shared by App-level summary metrics. The focused and full App tests passed, but future Statistics visual passes should confirm whether this shared compact style is still ideal everywhere it appears.
- Mine still contains several account concerns in one card. Future passes should refine signed-out/code-sent states and post-trial/premium membership states with dedicated screenshots.

## Follow-up

- Continue quality passes on signed-out/code-sent Mine states, dark mode, Space non-ideal states, and post-trial/premium Mine variants.
