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
| Dedicated authentication entry | `AppShell` pre-shell branch + one authentication surface | active/restored auth session and canonical hydration status | no top-level product route is mounted or visible |
| Phone/SMS progression | authentication surface form state | auth repository challenge and session result | one entry surface; code state replaces phone state rather than opening a product page |
| Session restoration/retry | pre-shell restoration state | session coordinator + required bootstrap hydration | remains outside product shell until validated |
| Authenticated shell transition | `AppShell` root boundary | valid session + required canonical hydration | enters Learning; login does not start trial |
| Fixed pilot identity | Learning and Mine header chrome | controlled-pilot profile + product copy | no selector or unavailable entry |
| Attached start slip | Learning surface state layer | successful valid session response | never triggered by login or account browsing |
| Completion receipt | Learning round-boundary surface | server-confirmed total completion count | shown once per new multiple of five |
| Space aperture | receipt address region + Space route | reconciled Space state | no local filing or reordering |
| Review link | existing review destination | server-selected review state | quiet secondary action |
| Continue button | Learning next-round continuation | explicit user action, then next session request | only primary action |
| Mine time ledger | account/entitlement object | server-provided timestamps and remaining duration | client formats; does not invent eligibility |
| No-payment copy | Mine entitlement state | controlled-pilot product contract | no purchase CTA |
| Account deletion row | authenticated Mine account actions | active remote auth session | secondary to learning and entitlement; unavailable while account hydration is unresolved |
| Deletion confirmation sheet | one bounded modal/sheet state | explicit user action | names account, Learning, and Space impact; cancel and confirm only |
| Deletion request result | pre-shell boundary or retained Mine sheet | authenticated `POST /v2/account/deletion` result | `202` exits shell with pending notice; failure preserves account and local state |

## State Ownership

- Server owns trial start/end, entitlement, confirmed completion count, next card selection, and Space state.
- Client owns presentation, accessible formatting, animation interruption, and reduced-motion rendering.
- The authentication/session coordinator owns whether the product shell may mount. Route selection is downstream of that gate and cannot expose a signed-out route-specific login state.
- Client must not start the trial, count a round locally, grant eligibility, or derive access from its own clock.

## Accessibility Mapping

- Identity chip is descriptive text, not a button.
- The login screen has one heading, explicit field labels, keyboard-friendly phone/SMS inputs, visible error text, and one primary action per step. No hidden navigation destination is announced before authentication.
- Session restoration announces one bounded progress state; failure exposes retry and return-to-login without placing focus in an unavailable product route.
- Start slip is announced after the card heading without moving focus.
- Completion receipt receives a heading; the two secondary actions precede the primary continue button in reading order, while visual weight still makes continue dominant.
- Time rows expose full date/time strings and do not rely on color.
- All actions have at least 44-point targets and support enlarged text without horizontal scrolling.
- The deletion sheet has an explicit heading, descriptive irreversible-impact text, initial focus on the heading, and reading order of explanation, cancel, then destructive confirmation. Pending state announces once and disables duplicate submission.

## Implementation PR Boundary

The implementation PR must be separate from this design-only PR. It must reference this map, show iOS and Android screenshots for all authority states, answer the design checklist and AP-22/AP-23, and record any visual gap rather than designing in RN code.

## Unimplemented Gaps

- Exact component names and file boundaries remain implementation hypotheses.
- Receiver-environment evidence for account-deletion acceptance, worker completion, blocked re-login during cleanup, and clean re-registration remains pending.
- Dynamic type, screen reader, weak network, offline replay, cross-device reconciliation, private audio, and device-matrix evidence remain pending.
- No Web implementation is authorized by this map.
