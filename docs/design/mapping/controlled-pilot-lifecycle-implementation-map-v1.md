# Controlled Pilot Lifecycle Implementation Map v1

## 当前任务引用的 spec

- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `infra/cloudbase/controlled-pilot-v1-runtime-contract.md`

## Accepted Design Sources

- `docs/design/decisions/controlled-pilot-lifecycle-decision-v1.md`
- `docs/design/mocks/controlled-pilot-lifecycle-v1.html`
- `docs/design/interaction-motion/controlled-pilot-lifecycle-v1.md`
- `docs/design/search-runs/2026-08-01-controlled-pilot-lifecycle/`

## Region Mapping

| Design region | Future code surface | Source of truth | Notes |
|---|---|---|---|
| Fixed pilot identity | Learning and Mine header chrome | controlled-pilot profile + product copy | no selector or unavailable entry |
| Attached start slip | Learning surface state layer | successful valid session response | never triggered by login or account browsing |
| Completion receipt | Learning round-boundary surface | server-confirmed total completion count | shown once per new multiple of five |
| Space aperture | receipt address region + Space route | reconciled Space state | no local filing or reordering |
| Review link | existing review destination | server-selected review state | quiet secondary action |
| Continue button | Learning next-round continuation | explicit user action, then next session request | only primary action |
| Mine time ledger | account/entitlement object | server-provided timestamps and remaining duration | client formats; does not invent eligibility |
| No-payment copy | Mine entitlement state | controlled-pilot product contract | no purchase CTA |

## State Ownership

- Server owns trial start/end, entitlement, confirmed completion count, next card selection, and Space state.
- Client owns presentation, accessible formatting, animation interruption, and reduced-motion rendering.
- Client must not start the trial, count a round locally, grant eligibility, or derive access from its own clock.

## Accessibility Mapping

- Identity chip is descriptive text, not a button.
- Start slip is announced after the card heading without moving focus.
- Completion receipt receives a heading; the two secondary actions precede the primary continue button in reading order, while visual weight still makes continue dominant.
- Time rows expose full date/time strings and do not rely on color.
- All actions have at least 44-point targets and support enlarged text without horizontal scrolling.

## Implementation PR Boundary

The implementation PR must be separate from this design-only PR. It must reference this map, show iOS and Android screenshots for all authority states, answer the design checklist and AP-22/AP-23, and record any visual gap rather than designing in RN code.

## Unimplemented Gaps

- Exact component names and file boundaries remain implementation hypotheses.
- Dynamic type, screen reader, weak network, offline replay, cross-device reconciliation, private audio, and device-matrix evidence remain pending.
- No Web implementation is authorized by this map.
