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

The design has four authority-bearing states:

1. Learning shows a fixed “CET4 受控试点” identity and no track chooser.
2. The first valid card carries a neutral attached slip stating that the experience has started; it does not block, ask for confirmation, or display a ticking countdown.
3. After the fifth server-confirmed Learning or review event, the completed card settles into a compact Space address aperture and a receipt offers exactly review, Space, and continue, with continue dominant.
4. Mine shows pilot identity, server-provided start/end/remaining time, and the no-payment operational-grant message. It exposes no purchase action.

## Product Truth vs Implementation Hypothesis

`product_truth`: trigger timing, 120 consecutive hours, fixed track, five-confirmed-event boundary, exact completion destinations, server-authoritative entitlement, no payment, and Space semantics.

`implementation_hypothesis`: attached-slip component boundaries, a short settle transition, receipt layout, and account-state rows. These may change only if the accepted visual and interaction outcomes remain intact.

## Law of One

- One active-library accent on Learning and completion.
- One focal current card or completion receipt per state.
- One dominant next action: card operation during Learning, “继续下一轮” after the round.
- Pilot identity and entitlement use neutral glass/ink, not a new library accent.

## State Matrix

| State | Learning | Mine | Forbidden |
|---|---|---|---|
| Before valid card | no start notice | available identity only | timer, consumed-trial copy |
| Trial active | first-card slip once; later cards keep only identity | start, end, remaining time | local calculation, urgency countdown |
| Free after expiry | stable free subset message only when access is affected | free state and pilot history summary | purchase button, fake premium |
| Pilot premium | uninterrupted Learning | operationally granted eligibility | self-service grant |
| Revoked/expired grant | server state reflected after reconciliation | calm state and support copy | destructive base-membership wording |

## Failure and Recovery

- If content or session preparation fails, no start slip appears.
- If the fifth event is pending confirmation, keep the resolved card state and do not show the completion receipt yet.
- If an offline replay or cross-device reconciliation repeats an already-counted event, do not replay completion motion.
- If entitlement time cannot be refreshed, display the last server-confirmed value with a quiet refresh state; do not invent remaining time.

## Accepted Evidence

- Search run: `docs/design/search-runs/2026-08-01-controlled-pilot-lifecycle/`
- Rendered design: `docs/design/mocks/controlled-pilot-lifecycle-v1.html`
- Motion contract: `docs/design/interaction-motion/controlled-pilot-lifecycle-v1.md`
- Implementation map: `docs/design/mapping/controlled-pilot-lifecycle-implementation-map-v1.md`

## Design Review Checklist

Q1: One coral library accent; pilot state stays neutral.

Q2: Current card, completed-round receipt, and Mine account object are the respective focal objects.

Q3: Single-card Learning and library/group/box/card Space continuity remain explicit.

Q4: No reward, dashboard, carousel, fake payment, gradient text, or internal language.

Q5: 393 x 852 proof, wrapping, 44-point targets, no horizontal overflow.

Q6: No new self-assess state; mint/amber authority and no-red-review rule remain unchanged.

## AP-22 / VL-AP-07

The Learning-visible change has accepted design direction, rendered proof, search-run evidence, interaction/motion artifact, and implementation mapping. This PR remains design-only; user-visible code must be delivered later in a separate PR.

## AP-23

The design adds no four-level self-assessment and does not use red for “再回看”. Existing 有把握 = mint / 再回看 = amber authority remains intact.
