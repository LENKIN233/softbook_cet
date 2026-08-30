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

`apps/web` is an independent React + Vite entry that reuses the mobile repository's platform-neutral auth, bootstrap, learning, event, membership, Space, content-manifest, and evaluation repositories. Space derives its visible hierarchy directly from each card's validated `space_metadata` rather than display placeholders. The browser shell uses a left route rail, one center focal object, and a bounded context rail. Development mode may exercise repository-local structured cards; production requires one all-or-nothing HTTPS remote profile with an explicit Web client kind and public manifest keyring.

This implementation hypothesis does not turn repository-local cards into approved content and does not establish a production Web runtime.

## Implemented Surface Mapping

| Accepted surface | Repository implementation | Evidence |
|---|---|---|
| Auth object | phone field, code field, validation, safe error copy, and neutral first-time/returning copy that waits for account state before claiming continuity | browser flow and `App.test.tsx` |
| Flip | reveal, exactly two mint/amber self-assess choices, immediate attached result with no redundant confirmation step | browser flow and tests |
| Multiple choice | 2 x 2 desktop choice grid, persistent selected state, `1–4` shortcut | browser flow and tests |
| Lock | one bounded vertical lock rail with leading lock state, answer-bound progressive unlock, retry-in-place for a wrong choice, and keyboard-operable option buttons | browser flow and `App.test.tsx` |
| Elimination | reversible strike choices and explicit submit | browser flow |
| Swipe | one foreground card over a restrained deck, left/right trail choices, thresholded pointer drag, discrete alternatives, and left/right keyboard equivalence; every committed direction resolves immediately | browser flow and tests |
| Review | answer/analysis/exam-tip slip remains attached; the final card enters an explicit session-complete object and can start a bounded review deck | browser flow and tests |
| Space | actual library/group/box tree derived from card ownership; narrow viewports read the address shelf, open current-box tray, contained cards, attached favorite state, sleep alcove, and safe return action before the secondary hierarchy browser; free sees the stable accessible prefix as read-only preview, while trial/premium sees and can mutate the complete Space | browser flow, `App.test.tsx`, and `App.remote.test.tsx` |
| Statistics | quiet daily ledger with tabular counts | browser flow |
| Mine/membership | development first entry exercises the local trial; remote mode renders only canonical server entitlement and never starts a client trial; purchase/restore/delete controls remain explicitly disabled | browser flow and tests |
| Runtime boundary | exact browser-visible profile requires HTTPS base, `clientKind=web`, track and public keyring; access/refresh credentials are memory-only; production artifact excludes development cards | `runtime.test.ts`, `webStorage.test.ts`, build boundary scan |
| Remote domain slice | shared request/verify/refresh/logout, event replay before bootstrap, server session/completion/next, durable credential-free queues, cleanup-before-login, frozen exact queued answers, canonical Space/membership, route-stable Learning pending state, and independent persisted Space queued/rejected facts with confirmed only when both are empty | `remoteRuntime.ts`, `remoteRuntime.test.ts`, `App.remote.test.tsx` |
| Private Web audio | shared signed manifest/keyring parser plus full byte count and SHA-256 verification before explicit Blob playback; expiring URL is never a playback source | `webAudio.ts`, `webAudio.test.ts` |
| Accessibility | landmarks, labels, pressed/expanded state, focus-visible treatment, reduced-motion-safe discrete operations | axe-core smoke, keyboard browser flow, unit tests |

## Explicit Gap Table

| Boundary | Current status | Required before production claim |
|---|---|---|
| Remote SMS authentication | repository request/verify/refresh/logout and memory-only Web session are connected | prove receiver SMS delivery, revocation and browser runtime results |
| Canonical bootstrap and scheduler | event replay precedes authenticated bootstrap; shared `/v2/learning/session` and selection-bound completion ack/next are connected | prove receiver content/session execution and recovery in a real browser |
| Learning events/progress | credential-free event outbox persists in browser storage and blocks canonical read until replay; check-in UI intentionally remains outside this slice | add the accepted check-in UI and prove browser recovery/runtime results |
| Space sync | credential-free queue and shared `/v2/space/actions` are connected; visible favorite/sleep updates only after durable enqueue, retryable failures remain queued, persisted terminal 409 quarantine remains rejected across reload, and confirmed requires ack plus fresh bootstrap | prove receiver conflict/offline recovery in a real browser |
| Membership/payment | remote UI state comes only from canonical server entitlement; no client trial start exists in remote mode; purchase/restore remain unavailable | implement Web purchase/restore and prove payment evidence |
| Audio | signed manifest/keyring, private full-byte download, size/SHA-256 verification and explicit Blob playback are connected | inject the real public keyring and prove private browser playback/listening QC |
| Formal content | development structured cards only | approved `card make` payload, import/audit/smoke and coverage evidence |
| Account deletion | visible action remains unavailable | remote deletion/recovery flow and policy evidence |
| Responsive proof | PC workbench remains three-column at 1024px; 760px and below preserve the floating route capsule; 393px auth, Learning feedback, lock, swipe, and current-box Space were re-exercised without clipped primary actions | dedicated 200% zoom proof plus repeatable no-horizontal-task-loss audit |
| Screen reader/manual accessibility | automated axe smoke and semantic DOM pass | named screen-reader and full keyboard completion record |
| Hosting/security | CSP meta and safe runtime-config template exist | production headers, narrowed connect policy, domain/TLS/deployment/SLO/recovery evidence |
| Tablet | no implementation | dedicated accepted tablet design and implementation proof |

## Browser Review

- Earlier local-development browser evidence re-exercised Auth, all five Learning silhouettes, immediate flip resolution, explicit five-card completion, one-card review entry, the real Space hierarchy, and local trial/membership context after the acceptance correction. It is not remote-runtime evidence.
- The corrected Space proof showed `听力 / 逻辑关系 / 转折关系` with exactly its two owned cards while sibling libraries, groups, and boxes remained browsable in the hierarchy.
- Development styling loaded under a nonce-bound CSP after the earlier meta policy had blocked Vite's injected development style element.
- Production-build inspection proves the local source identifier and representative development card prompts are absent from emitted HTML/JS/CSS.
- Left-arrow keyboard input selected the left swipe state; automated tests also prove Enter reveal and `1–4` selection.
- Visual inspection found and corrected light-mode contrast weaknesses for labels, support copy, error copy, self-assessment colors, tree focus, and destructive actions.
- Visual inspection found and corrected retained scroll position between consecutive cards.
- This quality pass re-exercised `393 x 852`, `1024 x 900`, `1280 x 720`, and `1440 x 900`. It verified the intentional two-line auth title, compact desktop current-card object, answer-bound lock rows, single-card swipe deck, fixed mobile continuation action above the floating route capsule, and current-box-first narrow Space composition. The separate 200% zoom proof remains open.

## Design Review Checklist Answers

Q1: Coral is the one dominant library accent in Learning and the current Space path. Mint and amber are reserved for the two authorized flip self-assess outcomes.

Q2: Every route keeps one first-read focal object: current card, current box, daily ledger, or account object. Navigation and context rails remain secondary.

Q3: Flip, 2 x 2 choice, progressive vertical lock rail, reversible elimination, and a foreground swipe card with directional trails each change the center silhouette. Space retains tree, owning box, contained objects, sleep alcove, and inspector; narrow viewports promote the current box ahead of the secondary tree.

Q4: Tests scan all operable routes for internal metadata names; visible errors stay user-safe. The build adds a restrictive baseline CSP and keeps secrets out of `runtime-config.js`.

Q5: Browser evidence now covers the reference desktop, 1280px, 1024px, and 393px narrow viewport without horizontal task loss or a primary action hidden behind the route capsule. A dedicated 200% zoom record remains explicitly open.

Q6: Flip exposes exactly two self-assess choices; Statistics stays tabular; Learning remains sequential and never introduces a module picker.

## Status

Repository implementation is suitable for implementation review and CI. The authenticated remote vertical slice is implemented but has no receiver Web deployment, SMS, payment, account-deletion, private-audio runtime, monitoring, or launch evidence; it does not change the launch-readiness result.
