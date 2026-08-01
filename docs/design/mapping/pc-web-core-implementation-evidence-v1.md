# PC Web Core Implementation Evidence v1

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/account-sync-contract.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`

## Design Authority

- `docs/design/decisions/pc-web-core-surface-decision-v1.md`
- `docs/design/mocks/pc-web-core-surfaces-v1.html`
- `docs/design/mapping/pc-web-core-implementation-map-v1.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/physical-space/space-model-v1.md`

## Product Truth

PC Web is a first-class target with the same core product meaning as iOS and Android. Learning remains a system-sequenced single-card flow, the five interaction families retain different operation shapes, audio remains attached, and Space remains a physical hierarchy rather than a favorites/sleep dashboard. Statistics and Mine are supporting routes. Flip self-assessment remains exactly `有把握` and `再回看`.

## Implementation Hypothesis

`apps/web` is an independent React + Vite entry that reuses the mobile repository's platform-neutral learning evaluation, local development session, and membership access. Space derives its visible hierarchy directly from each card's validated `space_metadata` rather than display placeholders. The browser shell uses a left route rail, one center focal object, and a bounded context rail. Development mode may exercise repository-local structured cards; production mode fails closed until an HTTPS runtime and remote authentication path are present.

This implementation hypothesis does not turn repository-local cards into approved content and does not establish a production Web runtime.

## Implemented Surface Mapping

| Accepted surface | Repository implementation | Evidence |
|---|---|---|
| Auth object | phone field, code field, validation, safe error copy, and neutral first-time/returning copy that waits for account state before claiming continuity | browser flow and `App.test.tsx` |
| Flip | reveal, exactly two mint/amber self-assess choices, immediate attached result with no redundant confirmation step | browser flow and tests |
| Multiple choice | 2 x 2 desktop choice grid, persistent selected state, `1–4` shortcut | browser flow and tests |
| Lock | three vertical labelled slots with native keyboard-operable selects | browser flow |
| Elimination | reversible strike choices and explicit submit | browser flow |
| Swipe | two directional states, discrete buttons, left/right keyboard equivalence | browser flow and tests |
| Review | answer/analysis/exam-tip slip remains attached; the final card enters an explicit session-complete object and can start a bounded review deck | browser flow and tests |
| Space | actual library/group/box tree derived from card ownership, selected owning box only, contained cards, inspector, favorite and owned sleep region | browser flow and tests |
| Statistics | quiet daily ledger with tabular counts | browser flow |
| Mine/membership | first authenticated entry starts the full trial; masked identity and membership stage remain visible; unconnected purchase/restore/delete controls are explicitly disabled; privacy boundary expands in place | browser flow and tests |
| Runtime boundary | external browser-visible config accepts HTTPS base only; missing production config is unavailable; no API key field; production artifact excludes development cards | `runtime.test.ts`, build boundary scan, production preview browser proof |
| Accessibility | landmarks, labels, pressed/expanded state, focus-visible treatment, reduced-motion-safe discrete operations | axe-core smoke, keyboard browser flow, unit tests |

## Explicit Gap Table

| Boundary | Current status | Required before production claim |
|---|---|---|
| Remote SMS authentication | UI exists; remote mode intentionally stops | connect `/v2` request/verify/refresh/logout and prove production SMS |
| Canonical bootstrap and scheduler | development session only | hydrate canonical bootstrap and `/v2/learning/session` with authenticated server selection |
| Learning events/progress | in-memory results only | durable queue, replay, check-in and recovery evidence |
| Space sync | in-memory favorite/sleep state only | authenticated `/v2/space/actions`, projection and offline recovery |
| Membership/payment | first authenticated entry starts the local full trial; purchase/restore remain explicitly unavailable | shared remote membership, Web purchase authority, restore and payment evidence |
| Audio | unavailable state is attached; playback is not implemented | signed manifest, private fetch, hash verification, cache/playback and listening QC |
| Formal content | development structured cards only | approved `card make` payload, import/audit/smoke and coverage evidence |
| Account deletion | visible action remains unavailable | remote deletion/recovery flow and policy evidence |
| Responsive proof | CSS has 1120px and 760px containment modes | dedicated 1024px and 200% zoom screenshots plus no-horizontal-task-loss audit |
| Screen reader/manual accessibility | automated axe smoke and semantic DOM pass | named screen-reader and full keyboard completion record |
| Hosting/security | CSP meta and safe runtime-config template exist | production headers, narrowed connect policy, domain/TLS/deployment/SLO/recovery evidence |
| Tablet | no implementation | dedicated accepted tablet design and implementation proof |

## Browser Review

- Real in-app browser re-exercised Auth, all five Learning silhouettes, immediate flip resolution, explicit five-card completion, one-card review entry, the real Space hierarchy, and trial/membership context after the acceptance correction.
- The corrected Space proof showed `听力 / 逻辑关系 / 转折关系` with exactly its two owned cards while sibling libraries, groups, and boxes remained browsable in the hierarchy.
- Development styling loaded under a nonce-bound CSP after the earlier meta policy had blocked Vite's injected development style element.
- Production-build inspection proves the local source identifier and representative development card prompts are absent from emitted HTML/JS/CSS.
- Left-arrow keyboard input selected the left swipe state; automated tests also prove Enter reveal and `1–4` selection.
- Visual inspection found and corrected light-mode contrast weaknesses for labels, support copy, error copy, self-assessment colors, tree focus, and destructive actions.
- Visual inspection found and corrected retained scroll position between consecutive cards.
- The available browser viewport was `1280 x 720`; it is useful implementation evidence but does not satisfy the separate required 1440 x 900, 1024px, or 200% zoom proofs.

## Design Review Checklist Answers

Q1: Coral is the one dominant library accent in Learning and the current Space path. Mint and amber are reserved for the two authorized flip self-assess outcomes.

Q2: Every route keeps one first-read focal object: current card, current box, daily ledger, or account object. Navigation and context rails remain secondary.

Q3: Flip, 2 x 2 choice, vertical lock slots, reversible elimination, and two-direction swipe each change the center silhouette. Space retains tree, owning box, contained objects, and inspector.

Q4: Tests scan all operable routes for internal metadata names; visible errors stay user-safe. The build adds a restrictive baseline CSP and keeps secrets out of `runtime-config.js`.

Q5: This is PC Web, not a phone-frame implementation. Desktop browser evidence exists, but 1024px and 200% zoom acceptance remain explicitly open.

Q6: Flip exposes exactly two self-assess choices; Statistics stays tabular; Learning remains sequential and never introduces a module picker.

## Status

Repository implementation is suitable for implementation review and CI. It is not deployable production parity and does not change the launch-readiness result.
