# Controlled Pilot Lifecycle Rendered Design v1

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/membership.json`
- `spec/visual-language.json`
- `infra/cloudbase/controlled-pilot-v1-runtime-contract.md`

## Authority

`controlled-pilot-lifecycle-v1.html` is the accepted phone rendering for the dedicated authentication entry, fixed pilot identity, first-card notice, five-card completion receipt, Space continuity, and Mine entitlement states. It is design evidence only and does not claim production behavior.

## Rendered States

- Signed-out phone entry with no Learning / Space / Statistics / Mine navigation.
- SMS-code verification inside the same dedicated entry boundary, also with no product navigation.
- First valid Learning card with attached non-blocking start slip.
- Confirmed fifth-card completion with exact three destinations.
- Mine during active trial with server-authoritative time display.
- Mine after expiry/free access with no payment action and operational eligibility message.
- Mine after operational continuation eligibility is granted, with no self-service action.
- Mine account deletion confirmation with the irreversible account, Learning, and Space impact visible before mutation.
- Deletion-request failure with the authenticated account preserved and a bounded retry.
- Dedicated login entry after an accepted deletion request, with cleanup-pending copy and no product navigation.
- Authenticated Learning availability object for `selection: null`: “当前没有待处理的卡”, optional server-provided “下次可回看” time, and one “重新检查” action. It contains no completion metrics, restart action, or round receipt.

## Product Truth vs Implementation Hypothesis

`product_truth`: dedicated authenticated app entry, no signed-out product navigation, visible pilot identity, trigger boundary, 120-hour duration, five-confirmed-event boundary, exact destinations, no payment, and server-owned entitlement.

`implementation_hypothesis`: glass thickness, slip overlap, exact copy wrapping, address aperture proportions, and motion timing. Future implementation may tune these only within the accepted hierarchy.

## Design Review Checklist

Q1: One active-library accent on Learning/completion; pilot account state is neutral.

Q2: Authentication object, current card, completion receipt, or account object is the single focal object for each frame.

Q3: Learning remains single-card and the completion frame preserves a compact physical Space address.

Q4: No dashboard, reward, tutorial, fake payment, gradient text, internal language, or repeated route-level login gate.

Q5: The existing 393 x 852 frame system also defines the no-selection object as the same contained, wrapping Learning status silhouette with a minimum 44-point retry action.

Q6: No self-assess change; no red review state.
