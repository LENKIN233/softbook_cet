# Controlled Pilot Lifecycle Interaction and Motion v1

## 当前任务引用的 spec

- `spec/product-core.json`
- `spec/membership.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `infra/cloudbase/controlled-pilot-v1-runtime-contract.md`
- `docs/design/design-harness.md`

## Target Interaction

Authentication entry, account deletion, and Learning lifecycle states around the existing card interactions: dedicated phone/SMS entry, validated shell transition, first-valid-card notice, server-confirmed fifth-event round completion, transition to review or Space, continue to the next server-selected card, and a truthful return to the entry boundary after deletion is accepted.

## Operation Model

- Signed out: render only the dedicated authentication object. Phone and code steps replace each other inside that object; do not animate or reveal the four-tab shell behind it.
- Restoring a stored session: keep one quiet entry-boundary status. Only validated authentication plus required account hydration may replace it with the Learning shell.
- Authentication failure: retain the current form state and attach the error near its field/action; do not route to Learning, Space, Statistics, or Mine.
- Authentication success: crossfade the entry object to authenticated Learning chrome after hydration succeeds. This transition never shows trial-start feedback by itself.
- A valid card becomes ready: show the current card and attach the start slip in the same committed visual state.
- A valid session with no selection and no round receipt: replace the card region with the bounded availability object. “重新检查” enters the existing quiet loading state and either replaces the object with a server-selected card/receipt or restores it without celebration.
- A non-fifth confirmed event: continue the existing resolve -> settle -> continue rhythm.
- A fifth confirmed event: resolve the card, settle it toward its Space address, then reveal the completion receipt.
- Review and Space are secondary destinations; continue is the primary destination and only then requests the next server selection.
- Review replaces the receipt with the ordered server-returned review cards in a read-only sequence; it creates no event and returns to the same receipt. An empty list stays on the receipt with calm “当前没有待复习内容” feedback.
- Entitlement changes are read-only visual states reconciled from server data.
- Account deletion opens one bottom confirmation sheet over Mine. Cancel closes it without mutation. Confirm remains in place while the service request is pending.
- A failed deletion request keeps the sheet open and restores the confirm action. An accepted request immediately replaces the entire authenticated shell with the dedicated entry boundary and a cleanup-pending notice.

## Feedback Model

- Start slip: “体验已开始 · 连续 120 小时”, with exact start/end detail deferred to Mine.
- Pending event: keep resolved card feedback and a quiet “正在确认” line; no completion receipt.
- Confirmed fifth event: “这一轮已放好” plus the actual compact address.
- Reconciliation: no repeated animation or duplicate receipt for an already-counted event.
- Deletion pending: “正在提交删除请求…” stays inside the confirmation object; the underlying Mine surface does not change.
- Deletion accepted: “账户删除已提交” and “数据清理完成前暂不能重新登录”; never “账户已删除”.
- No selection: “当前没有待处理的卡”; optionally “下次可回看 · {server time}”. Never “本轮学习已走完”, `0/0`, or “重新练这轮卡”.

## Failure / Recovery State

- Session or cursor failure: do not show trial-start feedback.
- Event confirmation failure: keep the resolved card and offer retry through the existing sync recovery pattern.
- Space route failure: keep the completion receipt and allow retry; do not discard confirmation.
- Entitlement refresh failure: show last-confirmed server time and a quiet retry state; never calculate a replacement locally.
- Deletion request failure: keep the account authenticated, show “暂时无法提交删除请求。你的账户和学习数据没有改变。” and allow retry or cancel.
- Availability refresh failure: retain the no-selection object and show the existing safe Learning retry error; do not synthesize a card, completion, or next-due time.

## Motion Intent and Timing Range

- Authentication step replacement: 160–220ms crossfade or 6–10 point vertical settle; keyboard focus and field values remain stable.
- Entry-to-shell transition: 180–260ms crossfade after validated hydration; no tab capsule moves through the signed-out frame.
- Start slip attach: 160–220ms, ease-out, translate 8–12 points and fade from 0.7 to 1.
- Fifth-card settle: 180–240ms, ease-out, translate 12–18 points toward the address aperture with no rotation or scale celebration.
- Receipt reveal: 140–190ms after settle, opacity plus at most 6 points vertical movement.
- Route transition after explicit action: 180–260ms using the existing app transition family.
- Deletion sheet: 180–240ms bottom settle with a simultaneous scrim fade. On accepted `202`, use the standard 180–260ms shell-to-entry crossfade; no progress animation or success celebration.

Motion exists only to explain attachment, confirmation, and location. It never counts down, celebrates, or plays from a duplicate event.

## Interruptibility

- Backgrounding, route changes, or reduced motion can interrupt any transition and snap to the final committed state.
- Returning to a confirmed completion restores the receipt without replaying settle motion.
- Pressing a valid destination during receipt reveal completes the visual state immediately before navigation.
- While deletion submission is pending, confirm and outside-tap dismissal are disabled. After acceptance, the shell transition cannot be interrupted back into an authenticated route.

## Reduce-Motion Fallback

- Phone/code steps replace with no spatial movement; entry-to-shell changes instantly after validated hydration.
- Start slip appears attached with no movement.
- Completed card and Space aperture appear in their final positions simultaneously.
- Receipt appears without opacity animation.
- State meaning remains fully expressed by copy, hierarchy, and address.
- The deletion sheet appears in its final position; accepted deletion replaces the shell instantly with the entry notice.

## Low-Burden CET Learning

The motion explains why the experience began and where a completed card lives. It adds no tutorial, reward loop, score, timer spectacle, manual filing step, or extra acknowledgement.
