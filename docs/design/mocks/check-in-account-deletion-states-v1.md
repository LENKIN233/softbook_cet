# Check-in and Account Deletion States v1

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/platform-contract.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/canon.md`

## Rendered asset

- `docs/design/mocks/check-in-account-deletion-states-v1.html`

## Source decision and mapping

- `docs/design/decisions/check-in-account-deletion-states-v1.md`
- `docs/design/mapping/check-in-account-deletion-states-implementation-map-v1.md`
- `docs/design/decisions/mobile-daylight-studio-v1.md`
- `docs/design/decisions/pc-web-core-surface-decision-v1.md`

## Target and coverage

- Phone: logical `393 x 852` frames for Statistics check-in unavailable, ready, submitting, queued, confirmed, and recoverable-unknown states; Mine account deletion confirmation, submitting, accepted, and recoverable-unknown states.
- PC Web: logical `1440 x 900` frames for the same state families, preserving route rail, one center focal object, and bounded context. Accepted deletion deliberately removes the authenticated shell.
- Current library: none. These are neutral supporting surfaces. Brand violet is the only dominant accent; success and destructive colors are narrow semantic state marks, not library identities.

## First-read paths

- Statistics: daily ledger -> check-in status/action -> return to Learning -> navigation.
- Mine confirmation: account consequence -> safe secondary action -> destructive confirmation -> chrome.
- Mine submitting: account consequence -> clear progress text -> disabled action.
- Mine accepted: signed-out result -> cleanup boundary -> return to phone verification.
- Mine failure/unknown: outcome not confirmed -> retry -> preserve account.

## Quarantine status

`accepted_authority`: rendered learner-visible and accessibility copy contains no internal process names, routes, credentials, identifiers, raw errors, or unfinished-work language. Reviewer notes remain outside the app frames.

## State truth boundaries

- `已保存，联网后确认` is not displayed as `今日已记录`.
- A retry after an unknown result continues the same monotonic check-in meaning.
- `删除申请已提交` is not displayed as `账户数据已全部删除`.
- Accepted deletion removes the signed-in shell and says cleanup may still be underway.
- An unknown deletion outcome never claims that either deletion or non-deletion is proven.

## Unimplemented or unproven gaps

- No mobile or Web product code changes are included.
- Tablet composition remains unproven.
- Simulator/browser behavior, dynamic type, keyboard, screen reader, remote request, deployment, worker execution, and completed erasure remain future evidence.

## Design review checklist

- Q1: No current library. Brand violet is the one dominant surface accent; semantic success/danger marks stay local to the affected status.
- Q2: Ledger or account consequence is singular and precedes action/state and chrome.
- Q3: These supporting surfaces intentionally use the accepted ledger/account silhouettes rather than any core interaction silhouette.
- Q4: No forbidden pattern appears. There is no gradient text, reward chrome, full-width tabbar, serif, removed self-assess token, or user-visible internal language.
- Q5: Phone frames are logical 393 x 852 with safe-area padding, contained sheets, and no clipped action or floating navigation.
- Q6: Statistics numerals are tabular and the surface contains no trend dashboard, reward, or module picker.

## AP-22 / VL-AP-07

Universal Q1-Q4 and applicable Q5-Q6 were answered before render and rechecked after render. The artifact inherits the accepted mobile and PC Web baselines without a token or canon delta.
