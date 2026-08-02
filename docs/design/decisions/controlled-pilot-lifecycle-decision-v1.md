# Controlled Pilot Lifecycle Decision v1

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/membership.json`
- `spec/visual-language.json`
- `infra/cloudbase/controlled-pilot-v1-runtime-contract.md`
- `docs/design/design-harness.md`

## Decision

Adopt the `cpl-01` Attached Pilot Slip synthesis from `docs/design/search-runs/2026-08-01-controlled-pilot-lifecycle/` for iOS and Android controlled-pilot states.

The design has six authority-bearing state groups:

1. Signed-out and unvalidated session-restoration states use one dedicated phone/SMS authentication surface. Learning, Space, Statistics, Mine, and the four-item navigation are not mounted or visible.
2. After authentication and required account hydration succeed, the product shell opens at Learning. Learning shows a fixed “CET4 受控试点” identity and no track chooser.
3. The first valid card carries a neutral attached slip stating that the experience has started; it does not block, ask for confirmation, or display a ticking countdown.
4. After the fifth server-confirmed Learning or review event, the completed card settles into a compact Space address aperture and a receipt offers exactly review, Space, and continue, with continue dominant.
5. Mine shows pilot identity, server-provided start/end/remaining time, and the no-payment operational-grant message. It exposes no purchase action.
6. Account deletion is a quiet authenticated Mine action with one bounded confirmation sheet. A failed request leaves the account and shell intact; an accepted request clears the local account state and returns to the dedicated login boundary with a neutral cleanup-pending notice.

## Authentication Entry Contract

- Authentication is an app-entry boundary, not a content card repeated inside each product route.
- Signed-out users see exactly one dedicated login surface with the product identity, phone number, SMS-code progression, primary action, and quiet legal/support copy.
- The login surface has no floating product navigation, no preview of four tappable product pages, no retained-card claim, and no trial-start message.
- While a stored session is being restored or canonical account hydration is unresolved, the app remains outside the product shell and shows a quiet bounded restoration/retry state.
- Successful authentication and hydration enter Learning. Login alone does not start the trial; only the first valid Learning Session may do so.
- Logout, invalidation, account deletion, or terminal session restoration failure atomically removes the product shell and returns to the same dedicated login boundary.

## Account Deletion Contract

- The action lives after the main Mine account and entitlement objects. It is visually secondary to learning, Space, membership state, and logout.
- Opening the action does not mutate data. One confirmation sheet names the irreversible account, Learning, and Space impact and offers exactly “保留账户” and “确认删除账户”.
- The destructive action is disabled while the request is in flight. Dismissal, route changes, and repeated taps cannot submit duplicate client requests.
- A request failure keeps the authenticated shell and confirmation sheet available, preserves all local state, and offers a retry without displaying a raw service error.
- A `202` acceptance means deletion is queued, not completed. The client clears its local authenticated state, removes the product shell, and returns to the dedicated login surface with “账户删除已提交；数据清理完成前暂不能重新登录”.
- The client does not invent deletion progress, poll an unavailable status route, or claim completion before the service permits a new registration.

## Product Truth vs Implementation Hypothesis

`product_truth`: dedicated authenticated app entry, trigger timing, 120 consecutive hours, fixed track, five-confirmed-event boundary, exact completion destinations, server-authoritative entitlement, no payment, and Space semantics.

`implementation_hypothesis`: a two-step phone/SMS form inside one entry surface, restoration-state composition, attached-slip component boundaries, a short settle transition, receipt layout, and account-state rows. These may change only if the accepted visual and interaction outcomes remain intact.

## Law of One

- One active-library accent on Learning and completion.
- One focal current card or completion receipt per state.
- One dominant next action: card operation during Learning, “继续下一轮” after the round.
- Pilot identity and entitlement use neutral glass/ink, not a new library accent.

## State Matrix

| State | Learning | Mine | Forbidden |
|---|---|---|---|
| Signed out | not mounted; dedicated login entry only | not mounted | four tabs, per-route login cards, product previews |
| Restoring/unvalidated session | not mounted; quiet restore/retry entry state | not mounted | optimistic shell entry, stale route restoration |
| Before valid card | no start notice | available identity only | timer, consumed-trial copy |
| Trial active | first-card slip once; later cards keep only identity | start, end, remaining time | local calculation, urgency countdown |
| Free after expiry | stable free subset message only when access is affected | free state and pilot history summary | purchase button, fake premium |
| Pilot premium | uninterrupted Learning | operationally granted eligibility | self-service grant |
| Revoked/expired grant | server state reflected after reconciliation | calm state and support copy | destructive base-membership wording |
| Deletion confirmation | current shell remains mounted behind one bounded sheet | irreversible impact, cancel, confirm | immediate local wipe, hidden consequence, duplicate submit |
| Deletion request failed | current account remains active | fixed safe failure copy and retry | logout, state loss, raw service error |
| Deletion accepted | not mounted; dedicated login entry only | cleanup-pending notice | “删除完成”, product navigation, immediate re-login promise |

## Failure and Recovery

- If content or session preparation fails, no start slip appears.
- If authentication, session restoration, or required account hydration fails, stay on the dedicated entry boundary; never reveal or retain the four-tab shell behind an error card.
- If the fifth event is pending confirmation, keep the resolved card state and do not show the completion receipt yet.
- If an offline replay or cross-device reconciliation repeats an already-counted event, do not replay completion motion.
- If entitlement time cannot be refreshed, display the last server-confirmed value with a quiet refresh state; do not invent remaining time.
- If account deletion is not accepted, do not log out or clear local state. If it is accepted, do not retain any authenticated route behind the cleanup-pending notice.

## Accepted Evidence

- Search run: `docs/design/search-runs/2026-08-01-controlled-pilot-lifecycle/`
- Rendered design: `docs/design/mocks/controlled-pilot-lifecycle-v1.html`
- Motion contract: `docs/design/interaction-motion/controlled-pilot-lifecycle-v1.md`
- Implementation map: `docs/design/mapping/controlled-pilot-lifecycle-implementation-map-v1.md`

## Design Review Checklist

Q1: One coral library accent; pilot state stays neutral.

Q2: Authentication object, current card, completed-round receipt, and Mine account object are the respective focal objects.

Q3: Single-card Learning and library/group/box/card Space continuity remain explicit.

Q4: No reward, dashboard, carousel, fake payment, gradient text, internal language, or signed-out four-tab navigation.

Q5: 393 x 852 proof, wrapping, 44-point targets, no horizontal overflow; the deletion sheet keeps its cancel and confirm actions visible.

Q6: No new self-assess state; mint/amber authority and no-red-review rule remain unchanged.

## AP-22 / VL-AP-07

The authentication-entry, Learning-visible, and account-deletion changes have an accepted design correction, rendered proof, interaction/motion artifact, and implementation mapping. The account-deletion state extends the accepted Mine account object and dedicated login boundary without introducing a new surface direction. This PR remains design-only; user-visible code must be delivered later in a separate PR.

## AP-23

The design adds no four-level self-assessment and does not use red for “再回看”. Existing 有把握 = mint / 再回看 = amber authority remains intact.
