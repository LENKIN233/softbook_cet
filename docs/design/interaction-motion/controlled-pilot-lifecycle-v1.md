# Controlled Pilot Lifecycle Interaction and Motion v1

## 当前任务引用的 spec

- `spec/product-core.json`
- `spec/membership.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `infra/cloudbase/controlled-pilot-v1-runtime-contract.md`
- `docs/design/design-harness.md`

## Target Interaction

Learning lifecycle states around the existing card interactions: first-valid-card notice, server-confirmed fifth-event round completion, transition to review or Space, and continue to the next server-selected card.

## Operation Model

- A valid card becomes ready: show the current card and attach the start slip in the same committed visual state.
- A non-fifth confirmed event: continue the existing resolve -> settle -> continue rhythm.
- A fifth confirmed event: resolve the card, settle it toward its Space address, then reveal the completion receipt.
- Review and Space are secondary destinations; continue is the primary destination and only then requests the next server selection.
- Entitlement changes are read-only visual states reconciled from server data.

## Feedback Model

- Start slip: “体验已开始 · 连续 120 小时”, with exact start/end detail deferred to Mine.
- Pending event: keep resolved card feedback and a quiet “正在确认” line; no completion receipt.
- Confirmed fifth event: “这一轮已放好” plus the actual compact address.
- Reconciliation: no repeated animation or duplicate receipt for an already-counted event.

## Failure / Recovery State

- Session or cursor failure: do not show trial-start feedback.
- Event confirmation failure: keep the resolved card and offer retry through the existing sync recovery pattern.
- Space route failure: keep the completion receipt and allow retry; do not discard confirmation.
- Entitlement refresh failure: show last-confirmed server time and a quiet retry state; never calculate a replacement locally.

## Motion Intent and Timing Range

- Start slip attach: 160–220ms, ease-out, translate 8–12 points and fade from 0.7 to 1.
- Fifth-card settle: 180–240ms, ease-out, translate 12–18 points toward the address aperture with no rotation or scale celebration.
- Receipt reveal: 140–190ms after settle, opacity plus at most 6 points vertical movement.
- Route transition after explicit action: 180–260ms using the existing app transition family.

Motion exists only to explain attachment, confirmation, and location. It never counts down, celebrates, or plays from a duplicate event.

## Interruptibility

- Backgrounding, route changes, or reduced motion can interrupt any transition and snap to the final committed state.
- Returning to a confirmed completion restores the receipt without replaying settle motion.
- Pressing a valid destination during receipt reveal completes the visual state immediately before navigation.

## Reduce-Motion Fallback

- Start slip appears attached with no movement.
- Completed card and Space aperture appear in their final positions simultaneously.
- Receipt appears without opacity animation.
- State meaning remains fully expressed by copy, hierarchy, and address.

## Low-Burden CET Learning

The motion explains why the experience began and where a completed card lives. It adds no tutorial, reward loop, score, timer spectacle, manual filing step, or extra acknowledgement.
