# Mobile UX Architecture v5 — Browser Evidence

## Evidence boundary

- Replay window: `2026-08-09 11:52–13:46 CST`.
- Browser surface: Codex in-app Chromium, using real fill, click, pointer drag, keyboard, browser Back/Forward, focus, viewport, accessibility-tree, screenshot, and layout-measurement paths.
- Served source: a fresh read-only HTTP process rooted at this worktree on `http://127.0.0.1:4175/`.
- Result class: `browser_scenario` only. It can support rendered learner semantics, interaction transitions, focus behavior, navigation snapshots, and responsive containment. It cannot prove canonical service acknowledgement, process recovery, native safe areas, native IME, System/Predictive Back, VoiceOver/TalkBack, native audio, store SDK behavior, PC Web parity, or release readiness.
- No DOM or application-state mutation was used to manufacture a pass. Learner transitions came from visible controls or a real pointer drag. Read-only page evaluation measured only geometry, focus, text, state attributes, and overflow.
- The platform HTML files use versioned CSS/JS references (`v=ux-architecture-v5-strict-4`) so the frozen replay cannot silently reuse an earlier cached stylesheet or flow script.

The architecture gate remains blocked. This is a corrected grayscale architecture subset, not a visual candidate, implementation mapping, native product, or approval to enter React Native implementation.

## Frozen source hashes

| Artifact | SHA-256 |
| --- | --- |
| `grayscale-proofs/architecture-flow.js` | `efd5a53645db9c65a4075a74d73fa73ec823393a685fcb48ae8f5ffe0015f4ce` |
| `grayscale-proofs/architecture.css` | `9d5d851a2349b6aa78e4ea11d4b80e57e2eb4fe4b5d9d0c52c09a044612001e3` |
| `grayscale-proofs/ios-phone.html` | `c65f2bd5534acc936c837f44fa6b68f50d9f302537bae582f986672eff183e95` |
| `grayscale-proofs/android-phone.html` | `c69be0e4984f1f78096af06daac1ec22b1b02c3540c84e347a2a3036113a8e4a` |
| `grayscale-proofs/ipados-tablet.html` | `823d3a51ed7b6fdf04264963d66cfd29e806afc4e04b719bc5ffc3f443936a67` |
| `grayscale-proofs/android-tablet.html` | `ce7e2f289863b0f9c3389f727898c6e581661ee7061b97e09f0d9054b5d924da` |
| `access-profile-proofs/access-standard.html` | `368ee171b1a737fef413afbe1341f256384ce931be22e547ab9682b31f294d8d` |
| `access-profile-proofs/access-standard.js` | `9761e5967462f7d7baae094dae6ceee838a55ea148672ba584a4dd34c9bc0293` |
| `access-profile-proofs/access-managed.html` | `d25b447fde5f45ad629a04e00e034a2eb87b605f5ebd3a83586806713109199e` |
| `access-profile-proofs/access-managed.js` | `1b6c4bf83d605b8ed9b998de6794a6ceada1e26abe0907eac2ce1b5141817434` |
| `access-profile-proofs/access-proofs.css` | `aad2ef81fb1eb0055fde76a8505281d12f30a7bac6705cb646a162440d88ed41` |
| `grayscale-ux-state-contract.md` | `72f1f7b3290d92c24e35c4f0268ddcdc770fdd8074cce086eedf65139af9d5e7` |
| `platform-architecture.md` | `7fbddae5ce3821ad487201607e646cfb806cffebb2932b299e9b92eddadcb4d8` |

## Failed parent checkpoint and strict corrections

Independent review of parent commit `592681c540569a9763009cd9109b092d1f288377` returned `fail_architecture_checkpoint`. The strict replay did not inherit its coverage claims. It specifically corrected and rechecked:

| Parent failure | Corrected exact behavior |
| --- | --- |
| Required check-in family absent | Added nine check-in states; operated ready/pending and rendered acknowledgement/refresh/reconciled presentations, while service-origin and exact-retry rows remain blocked |
| Wrong Lock order exposed `下一张` | Wrong order retains all four vertical lock rows, offers explanation and adjustment, and exposes no next-card action |
| iOS top-level tabs polluted route history | iOS top-level switching creates no app-history entry and each iOS destination now owns a separate route-local stack; Android browser Back restores the prior top-level destination |
| `BUY-02` falsely counted from “opening purchase service” | `BUY-02` remains `blocked_origin_unproven`; no platform or shared browser cell is covered |
| Elimination/Swipe lost learner-vs-correct context | Wrong Elimination shows actual and intended removals; wrong Swipe shows chosen and correct direction/meaning in text |
| Compound states hid untested branches | Resend availability/pending, favorite/duplicate, sleep/wake, reconciliation/process restore, labelled/reduced-motion/keyboard Swipe, large-text/assistive Stats, and connected-error/offline states are separate rows |
| Pending Auth states dropped focus | send, resend, verify, and session-preparation pending statuses are focusable and receive focus |
| Generic access proof inflated four platform columns | Generic access evidence has its own `Shared access-profile browser` column and is never copied into an OS-framed column |
| Trial presentation omitted a time boundary | Scenario shows `完整试用 · 剩余 7 天` and `8 月 16 日 23:59`; canonical entitlement/date origin remains unproved |

These are regression results, not a declaration that all 160 semantic states are covered.

Exact review of strict-3 commit `2a09309e3b2bc85003d2e68b5a65196f4e9c0fcd` then found one residual P1: a single global iOS stack made the first App Back appear inert after `Learning → 查看所在空间 → 回到学习 → Space tab`. Strict-4 replaced that stack with destination-owned route-local stacks. The exact failed path was replayed again: returning to Space restored the same card, one App Back moved visibly to `选择一个馆`, focus moved to that heading, and the root exposed no further Back control. No top-level tab was popped.

## Auth, session entry, and Trial presentation

Exact iOS phone replay at `390×844`:

1. Valid phone submission rendered a focused `正在发送验证码…` status; duplicate submit was unavailable.
2. Code entry preserved the phone and provided edit/resend actions.
3. After countdown completion, one resend activation rendered focused `正在重新发送验证码…`; duplicate resend was unavailable.
4. Complete-code submit rendered focused `正在确认验证码…` with code, verify, resend, and edit actions disabled.
5. Successful verification moved to a focused `正在准备当前学习` heading. Only the following scenario transition rendered `让步句中的主句` and `当前学习已准备好`.
6. Mine rendered `完整试用 · 剩余 7 天` plus `8 月 16 日 23:59` with `overflowX=0`.

The same visible phone/code path was operated before the signed-in responsive measurements in the three other platform documents. Invalid-phone, invalid/expired-code, Auth offline, canonical account restore, real Learning-session creation, Trial activation, and persisted Trial dates were not re-proved on the frozen bytes. The displayed Trial is therefore a presentation scenario, not `MEM-02` canonical-origin coverage.

## Five interaction families

All five families were operated in the iOS document. An accepted incorrect answer in Four-choice, Elimination, or Swipe is a truthful auto-scored result and may continue; a wrong Lock pattern is uniquely unresolved and cannot progress.

| Family | Exact operation and result |
| --- | --- |
| Flip | Revealed the same card, chose `有把握`, observed focused save-pending, then `已保存`; Android tablet separately exercised `再回看` |
| Four-choice | Correct `B. however` resolved as correct; wrong `A. therefore` rendered `你的答案，不正确` and `B. however，正确答案`, with one `下一张` |
| Lock | Wrong full order retained `the team / continued / Although / the task was difficult`, rendered `顺序还需要调整`, and had `下一张` count `0`; explanation and adjustment stayed on the same card; exact correction rendered `顺序正确` and one next action |
| Elimination | Wrong subset rendered learner removal `Although` and intended removals `Although` plus `the task was difficult`, then one next action |
| Swipe | Two inert back cards and one operable top card were present with trails `← 不符合 / 符合 →`; a real 24px drag returned to centre with `已回到中间，尚未作答`; wrong labelled choice rendered actual `向左 / 不符合` and correct `向右 / 符合`, then one next action |

Pending completion focused its status. Resolved content focused the result region. Hint and peek toggles returned focus to their renamed control in the earlier parent replay, but those exact tool rows were not promoted on these changed source bytes. Audio-absent was visible on the operated cards; attached-audio lifecycle remains blocked.

## Simple check-in

Exact iOS Statistics replay at `390×844`:

- The dated activity list showed `8 月 9 日`, `8 月 8 日`, and `8 月 7 日` with tabular numeric glyphs. This list does not satisfy the full `STATS-02` dated scale/today-marker/trend contract, so that row remains blocked.
- Ready state exposed one `签到` action and no streak, reward, leaderboard, or learning-derived check-in fiction.
- Activation rendered a focused `aria-busy=true` status.
- The presentation adapter then rendered `今天的签到已确认，正在更新状态…` and a focused non-busy confirmation. The reconciled surface exposes only `刷新状态`; there is no post-success “再次确认” control.

`CHECKIN-01/02` are recorded only as `observed_browser_presentation_only` because the static design adapter has no validated account/day read or durable command capture. `CHECKIN-03/04` remain `blocked_origin_unproven` because no strict acknowledgement or authoritative refresh occurred. `CHECKIN-05` remains `blocked_partial_scenario`; the misleading post-success repeat affordance remains absent in strict-4 rather than pretending it was an uncertain exact-command retry. Offline queueing, failure/retry, process recovery, account switch, and day-rollover rejection were not operated and remain blocked. Timers model the intended learner presentation only; they do not prove the undeployed remote check-in implementation hypothesis.

## Learning and Space continuity

- `查看所在空间` opened the same learner object at `仔细阅读馆 → 长难句里的主干 → 找出主语和谓语 → 让步句中的主句`.
- Library, group, box, and card were each operated through visible controls. The names represent knowledge ownership, not progress or time buckets.
- On a forced-scroll `390×500` iOS replay, the library page was scrolled to `90px`, `仔细阅读馆` was opened, and App Back restored `选择一个馆`, `scrollY=90`, exact focus on `data-library="仔细阅读馆"`, and `overflowX=0`.
- Favorite rendered a disabled `正在保存…` state before `已喜欢` with `aria-pressed=true`.
- Sleep rendered disabled pending, then `唤醒卡片`. In the strict-4 replay, sleeping current `转折关系中的连接词` and returning to Learning first rendered `正在准备下一张`, then selected `让步句的语序`; the sleeping current card was not locally reused.

Exact favorite duplicate, wake pending/resolved, mutation failure/retry, canonical mutation reconciliation, sleeping-zone aggregation, external Space deep links, and process/cross-device restoration remain blocked.

## Platform navigation behavior

- iOS: switching among top-level destinations does not create an app-history entry. Each destination retains a separate route-local stack. In the residual-failure replay, `Learning → 查看所在空间 → 回到学习 → Space tab → App Back` moved from the same Space card directly to `选择一个馆` on the first activation; the root then exposed zero Back controls and never popped to Learning.
- Android phone: after top-level navigation, browser Back restored Learning and focused `#learning-title` for `转折关系中的连接词`.
- iOS Space route-local Back restored the exact library object, focus, and scroll as recorded above.

These browser-history results support only the platform-framed HTML contract. Native edge swipe, System Back, Android Predictive Back, process death, and native route restoration remain blocked.

## Responsive and platform measurements

All values are CSS pixels. `overflowX` is `documentElement.scrollWidth - clientWidth`.

| Document and viewport | Exact observations |
| --- | --- |
| iOS phone `320×844` | `overflowX=0`; minimum visible control height `44`; Four-choice `2×2`, each option `120×49`; nav `x=12`, `w=296`, `h=70`, bottom `836` |
| iOS phone `360×800` | `overflowX=0`; minimum visible control height `44`; Four-choice `2×2`, each option `140×49`; nav `x=12`, `w=336`, bottom `792` |
| iOS phone `390×844` | `overflowX=0`; minimum visible control height `44`; nav `w=366`; Four-choice `2×2`; `查看所在空间` computed `white-space: nowrap`, height `44` |
| iOS phone `430×932` | `overflowX=0`; minimum visible control height `44`; nav `w=406`; Four-choice `2×2`, each option `171×49` |
| iOS phone landscape `844×390` | `overflowX=0`; minimum visible control height `44`; nav `x=142`, `w=560`, `h=70`, bottom `382`; Four-choice `2×2` |
| Android phone `390×844` | `overflowX=0`; minimum visible control height `48`; nav `x=12`, `w=366`, `h=74`; Four-choice `2×2` |
| Android phone `430×932` | `overflowX=0`; minimum visible control height `48`; nav `w=406`; Four-choice `2×2` |
| Android phone landscape `844×390` | `overflowX=0`; rail `x=8`, `w=72`, `h=374`; Four-choice `2×2` |
| iPadOS signed out `1024×768` | `overflowX=0`; hidden nav width `0`; auth surface `w=760` |
| iPadOS ready `1024×768` | sidebar `208`; main `w=760`; empty context width `0`; minimum target `44` |
| iPadOS Flip result `1024×768` | main/context tracks `436 + 320`; context appears only with useful result content |
| iPadOS compact `800×768` / `761×768` | nav `w=560`; main/context stack at `764` / `725`; `overflowX=0` |
| Android tablet signed out `1024×768` | `overflowX=0`; hidden nav width `0`; auth surface `w=760` |
| Android tablet ready `1024×768` | rail `160`; main `w=760`; minimum target `48`; `overflowX=0` |
| Android tablet compact `800×768` / `761×768` | nav `w=560`; main widths `764` / `725`; `overflowX=0` |

The page runtime emitted no console errors during the completed strict replay. Responsive containment alone is not per-state platform coverage. Native insets, display zoom, 200% text, real keyboards, OS reduced motion, assistive technology, and cutout/notch devices remain blocked.

## Shared access-profile browser proof

Formal commerce (`access-standard`) and receiver-managed access (`access-managed`) are physically separate HTML/JS documents. Both were previously operated at `320×844` and measured at `1024×768`; their hashes are unchanged in this replay.

The shared proof supports only these exact rows in the dedicated shared column: `SPACE-14`, `MEM-03`, `PAY-01`, `PAY-02`, `BUY-04`, `RESTORE-01`, `RESTORE-02`, `RESTORE-03`, `BETA-01`, `BETA-03`, `BETA-04`, and `COV-09`.

- Formal commerce preserved exact Learning/Space origin on cancel, disabled interruption during its presentation-level pending states, ended purchase as `当前无法打开购买服务，购买没有完成`, ended restore as `没有找到可找回的购买`, and never locally set Premium.
- Managed access separated base membership from additional complete access; refresh pending was non-dismissible; error retained last safe display; absent/revoked returned to base access; no purchase, restore, self-grant, self-revoke, grant-code, or redemption control existed.
- `BETA-04` is covered only because absent and revoked are observer-equivalent in the learner client. It does not prove an operator revoke or receiver audit record.

The following remain deliberately blocked despite learner-like surfaces: `MINE-01/02`, `PAY-03`, `BUY-01/02`, `BETA-02/05/06/07`, real purchase success/cancel/offline/account mismatch, entitlement refresh, canonical Premium, and receiver operations.

## Exact browser cells and presentation-only observations

The state ledger uses the following conservative mapping. `observed_browser_presentation_only` is a blocked result, excluded from exact coverage counts. A row not listed here remains blocked in that platform column.

| Column | Exact covered IDs | Presentation-only observed IDs |
| --- | --- | --- |
| iOS phone browser | `SHELL-08`, `AUTH-01`, `AUTH-03`, `AUTH-04`, `AUTH-05`, `AUTH-09`, `AUTH-12`, `LEARN-01`, `LEARN-07`, `LEARN-08`, `LEARN-13`, `FLIP-01`, `FLIP-03`, `FLIP-04`, `CHOICE-01..03`, `LOCK-01..03`, `LOCK-05`, `ELIM-01..03`, `SWIPE-01..03`, `SWIPE-06`, `TOOL-05`, `TOOL-07`, `AUDIO-00`, `SPACE-01..05`, `SPACE-07`, `SPACE-08` | `SHELL-03`, `AUTH-11`, `LEARN-02`, `LEARN-09`, `FLIP-05`, `CHOICE-04/05`, `LOCK-04`, `ELIM-05`, `SWIPE-05`, `TOOL-06`, `TOOL-08`, `CHECKIN-01/02` |
| Android phone browser | `SHELL-08`, `AUTH-01`, `AUTH-04`, `LEARN-07`, `LEARN-08`, `LEARN-13`, `FLIP-01`, `FLIP-03`, `FLIP-04`, `CHOICE-01` | `SHELL-03`, `AUTH-11`, `LEARN-02`, `LEARN-09`, `FLIP-05` |
| iPadOS browser | `AUTH-01`, `AUTH-04`, `LEARN-07`, `LEARN-08`, `LEARN-13`, `FLIP-01`, `FLIP-03`, `FLIP-04` | `SHELL-03`, `AUTH-11`, `LEARN-02`, `LEARN-09`, `FLIP-05` |
| Android tablet browser | `AUTH-01`, `AUTH-04`, `LEARN-07`, `LEARN-08`, `LEARN-13`, `FLIP-01`, `FLIP-03`, `FLIP-04` | `SHELL-03`, `AUTH-11`, `LEARN-02`, `LEARN-09`, `FLIP-06` |

Ranges in this table are shorthand only; the ledger still records one result per exact state row. The browser scenario proves the state presentation and transition, not the external canonical origin named by the contract.

## Audience and leakage boundary

- All four platform HTML files declare learner audience and a structural learner root.
- Formal and managed access are separate source documents with no query/profile switch.
- External learner JavaScript is included in the fail-closed metadata scanner.
- Non-empty learner HTML comments are rejected. Reviewer process language is allowed only in explicit reviewer documents. Raw metadata remains rejected where disallowed.
- Scanner regression passed `36/36`; the full scanner reported `PASS: No metadata leaks detected in design visual artifacts.`
- Rendered learner DOM and accessible names contained no reviewer guidance, state IDs, internal object keys, profile switch, runtime predicate, storage/queue narration, or test instructions.

## Remaining blockers

- Exact error, offline, retry, duplicate, interruption, and process-restore branches not listed above;
- canonical Learning/check-in/Space mutation acknowledgement and cross-device reconciliation;
- attached-audio ready/preparing/playing/paused/completed/interrupted/error;
- complete Free restrictions, real Trial activation/duration/persistence, membership-end reminder, and canonical Premium;
- real StoreKit/Google Play purchase, cancel, offline, restore, account mismatch, and entitlement refresh;
- real receiver-managed grant/revoke and audit evidence;
- 200% text, OS reduced motion, IME, VoiceOver, TalkBack, native Back, safe areas, cutouts, and physical tablets;
- every native iOS/Android per-state result and PC Web implementation mapping;
- brand/color direction, final visual system, accepted high-fidelity designs, and product-owner acceptance.

Any required blocked row keeps the architecture gate blocked.
