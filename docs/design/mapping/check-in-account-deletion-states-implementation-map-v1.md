# Check-in and Account Deletion States Implementation Map v1

## 当前任务引用的 spec

- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/platform-contract.json`
- `spec/visual-language.json`
- `docs/design/decisions/check-in-account-deletion-states-v1.md`
- `docs/design/mocks/check-in-account-deletion-states-v1.md`

## Design artifact source

- `docs/design/decisions/check-in-account-deletion-states-v1.md`
- `docs/design/mocks/check-in-account-deletion-states-v1.md`
- `docs/design/mocks/check-in-account-deletion-states-v1.html`
- Mobile parent baseline: `docs/design/decisions/mobile-daylight-studio-v1.md`
- PC Web parent baseline: `docs/design/decisions/pc-web-core-surface-decision-v1.md`

## Product Truth

This map binds visible states to owned account facts. It does not create a wire schema, promise deployment, or turn a local visual state into evidence that a remote action occurred.

## Implementation Hypothesis

The labels below are UI projection names. Future implementation may rename internal code symbols, but it must preserve the state distinctions, first-read order, accessibility meaning, and truthful copy boundary.

## Mobile Statistics mapping

| Visible state | Required source fact | Required presentation | Future code surface |
|---|---|---|---|
| unavailable before learning | no confirmed same-day check-in and action not yet eligible | disabled check-in action; Learning continuation is primary | `apps/mobile/src/statistics/StatisticsSurface.tsx` |
| ready | explicit same-day action is eligible | one enabled `记录今天` action; no reward chrome | `StatisticsSurface` props and action dock |
| submitting | an exact attempt is in flight | disable duplicate press; keep ledger visible; announce busy state | `StatisticsSurface` plus `apps/mobile/App.tsx` orchestration |
| queued locally | an exact account/day command is durably pending | say `已保存，联网后确认`; do not render canonical confirmation | mutation queue projection into `StatisticsSurface` |
| confirmed | canonical same-day check-in is true | quiet completed control; date-bound acknowledgement | bootstrap/check-in reconciliation into `StatisticsSurface` |
| recoverable unknown | outcome is failed or ambiguous | `尚未确认` plus retry; no raw error | sync status projection and retry action |

The existing `hasCheckedInToday` / `canCheckInToday` pair is not sufficient to distinguish submitting, queued, and ambiguous outcomes. A future implementation PR must add an explicit presentation projection instead of inferring those states from counters or generic sync text.

## Mobile Mine mapping

| Visible state | Required source fact | Required presentation | Future code surface |
|---|---|---|---|
| confirmation | authenticated account and deletion action selected | account-attached sheet; consequence list; `保留账户` and one destructive confirmation | `MineSurface` in `apps/mobile/App.tsx`, preferably through an extracted account-privacy surface |
| submitting | request sent, outcome not known | prevent a second submission; keep consequence visible; live status announcement | Mine account sheet plus account-deletion repository state |
| accepted | deletion request accepted and session no longer usable | replace authenticated shell with signed-out success object; say cleanup may continue | auth coordinator + root shell replacement |
| recoverable unknown | no confirmed accepted response | preserve account object; retry safely; no claim about erasure status | Mine sheet and idempotent repository retry |

Future mobile implementation must bind the request to the active signed session, clear signed-in presentation only after accepted semantics, and never preserve an operable cached account shell after acceptance.

## PC Web Statistics mapping

- Extend `apps/web/src/App.tsx#StatisticsSurface` from read-only counts to the six visible state projections above.
- Keep the daily ledger as the center focal object. Put the current check-in action/state at the bottom of that object; use the context rail only for a short explanation and the route back to Learning.
- Keyboard order is ledger summary -> check-in/retry action -> Learning continuation. Submitting and completed controls are disabled but still expose their state text.
- At 1024px and 200% zoom, the action remains inside the ledger and no horizontal scroll is required to reach it.
- Implemented in `apps/web/src/App.tsx#StatisticsSurface` with `ready`, `submitting`, `queued`, `confirmed`, and recoverable error projection from `WebRemoteSnapshot.checkInSync`; unavailable remains the explicit non-remote state.
- `apps/web/src/remoteRuntime.ts#checkInToday` writes the account/day command to the durable mutation queue before replay and canonical bootstrap confirmation.

## PC Web Mine mapping

- Replace the current disabled deletion placeholder in `apps/web/src/App.tsx#MineSurface` with the four accepted states.
- Confirmation, submitting, and recoverable unknown stay attached to the account object in the center workbench. They are not browser-native alerts and do not move the action into an unrelated settings route.
- Accepted deletion removes the authenticated route rail and renders the existing phone-verification identity-gate silhouette with truthful cleanup-in-progress copy.
- Keyboard focus enters the confirmation heading, consequence copy, safe secondary action, then destructive action. It never relies on hover or color alone.
- Implemented in `apps/web/src/App.tsx#MineSurface`, `AccountDeletionStatusSurface`, and the same identity-gate silhouette used by `AccountDeletionRecoverySurface`; accepted removes the authenticated route rail, while unknown and cleanup-required remain explicit retry surfaces.
- A refreshed requesting marker never opens ordinary login. Its bounded recovery uses credential-omitting, redirect-rejecting dedicated `account_deletion_recovery` SMS challenges for the marker-owned phone and never creates a general auth session. Exact pending permits accepted cleanup; exact none only permits fresh registration after old local queues clear and never claims acceptance or completion.
- `apps/web/src/remoteRuntime.ts`, `apps/web/src/webAccountDeletionRecovery.ts`, `apps/web/src/webAccountDeletionState.ts`, and `apps/web/src/webStorage.ts` bind dedicated recovery responses, same-session quarantine, exact 202 acceptance, cross-tab transactional durable queue cleanup, one atomic single-key marker/revision envelope, and a null-envelope write epoch that rejects a stale tab even after cleanup. Only the exact accepted or registration-ready revision authorizes queue removal; ordinary logout cannot erase an unknown deletion origin.

## Accessibility and containment

- Every state change has visible text and an announced status; color and spinner motion are supplementary.
- Submitting honors reduced motion and remains understandable with the indicator frozen.
- Destructive confirmation and retry controls meet the 44px target and retain visible focus.
- Phone proof must pass 320/360/393/430 widths, safe areas, dynamic type, and no clipped sheet action.
- PC Web proof must pass 1440 x 900, 1024px, 200% zoom, keyboard-only flow, and no document-level horizontal task loss.

## Intentional non-mapping

- The original design-only PR added no runtime code; the later PC Web implementation uses this mapping without changing its authorized silhouettes or truth distinctions.
- It does not authorize immediate-erasure copy, cancellation after acceptance, a separate deletion status dashboard, or a user-visible operation identifier.
- It does not prove receiver deployment, worker execution, deletion completion, real-device behavior, or Web hosting.

## Required future implementation evidence

- Mobile simulator screenshots for all six check-in and four deletion states at 393 x 852, plus 320px containment.
- Browser screenshots for the same state families at 1440 x 900 and 1024px/200% zoom remain pending real-browser evidence.
- Repository, controller, persistence, and rendered-state regressions for PC Web check-in/deletion are implemented under `apps/web/src/*.test.ts*`.
- Keyboard, screen-reader status, reduced-motion, duplicate-submit, ambiguous-retry, stale-session, and post-acceptance shell-removal tests.
- Exact gap table against this mapping and the rendered artifact.
- No raw internal language in visible or accessibility copy.

## Design review checklist

- Q1: Statistics and Mine have no current content library. One neutral brand-violet accent supports each surface; muted success or danger semantics appear only on the affected state and never act as a second library identity.
- Q2: Statistics focal object is the daily ledger, then check-in state/action, then navigation. Mine focal object is the account consequence panel; accepted deletion changes the focal object to the signed-out identity card.
- Q3: Neither surface is a core card interaction. They preserve the accepted supporting silhouettes: quiet ledger and account object, rather than borrowing flip/choice/lock/elimination/swipe shapes.
- Q4: No gradient text, gamification chrome, full-width bottom tabbar, serif, removed self-assess token, or raw internal copy is authorized.
- Q5: Phone frames require safe-area containment with no clipped CTA or floating navigation.
- Q6: Statistics uses tabular numerals and never becomes a trend, reward, or module-selection surface.

## AP-22 / VL-AP-07

All universal Q1-Q4 and applicable Q5-Q6 answers were recorded before rendering and rechecked against the final artifact. No visual-language or token delta is introduced.
