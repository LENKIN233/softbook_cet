# Mobile UX Architecture v5 — Browser Evidence

## Evidence boundary

- Replay window: `2026-08-09 10:48–11:41 CST`.
- Browser surface: Codex in-app Chromium browser, using the browser's real click, fill, keyboard, drag, Back, Forward, viewport, accessibility-tree, screenshot, and layout-measurement paths.
- Served source: a fresh read-only HTTP process rooted at this worktree on `http://127.0.0.1:4175/`.
- Result class: `browser_scenario` only. This evidence can support browser DOM semantics, interaction transitions, focus behavior, responsive containment, and source/learner separation. It cannot prove native safe areas, native IME behavior, System or Predictive Back, VoiceOver, TalkBack, native audio, store SDK behavior, canonical service acknowledgement, process restore, private content delivery, PC Web parity, or release readiness.
- No DOM or application-state mutation was used to manufacture a pass. Every learner transition was reached through visible controls or a real pointer drag. Read-only evaluation was used only to measure geometry, focus, visibility, and overflow.

The architecture gate remains blocked because many required ledger rows still have no exact rendered scenario, every native column remains blocked, and PC Web per-state mapping remains incomplete.

## Frozen source hashes

The replay used these exact source bytes:

| Artifact | SHA-256 |
| --- | --- |
| `grayscale-proofs/architecture-flow.js` | `0615d24ec6395f8aa6b221a2475a3c523dc55579dd9b25f0d9e3c4cdb0af1099` |
| `grayscale-proofs/architecture.css` | `0c51ff4a69d8c7497b9e709ac1fa5678b9053788f92b15affa536a21a9c4caa3` |
| `grayscale-proofs/ios-phone.html` | `c1c04bcee78e3f2a9389935623f80bac3f2ead67cd88a0361820bc9247edbafa` |
| `grayscale-proofs/android-phone.html` | `34cbd43ac6b37e9df2efa733f61436820cfd394a1ed638db80969fa1274fd7b2` |
| `grayscale-proofs/ipados-tablet.html` | `f6c13ccec90e620529026fdbb05bd57a5a4a44b7ed5b5e67e8885ef6b0a7621e` |
| `grayscale-proofs/android-tablet.html` | `8731c5cd0bf1ba4b70f4956d3e560960f15eabab5e2d64fe425e903c8f7a1b7f` |
| `access-profile-proofs/access-standard.html` | `368ee171b1a737fef413afbe1341f256384ce931be22e547ab9682b31f294d8d` |
| `access-profile-proofs/access-standard.js` | `9761e5967462f7d7baae094dae6ceee838a55ea148672ba584a4dd34c9bc0293` |
| `access-profile-proofs/access-managed.html` | `d25b447fde5f45ad629a04e00e034a2eb87b605f5ebd3a83586806713109199e` |
| `access-profile-proofs/access-managed.js` | `1b6c4bf83d605b8ed9b998de6794a6ceada1e26abe0907eac2ce1b5141817434` |
| `access-profile-proofs/access-proofs.css` | `aad2ef81fb1eb0055fde76a8505281d12f30a7bac6705cb646a162440d88ed41` |
| `grayscale-ux-state-contract.md` | `0b02496c1e28f10a061012098d27f4e47c6c64c896f969c30b1d679b44a8c311` |
| `platform-architecture.md` | `7fbddae5ce3821ad487201607e646cfb806cffebb2932b299e9b92eddadcb4d8` |

## Pre-correction failures retained as regression context

The correction was not accepted on appearance alone. Earlier exact replays found the following blocking failures:

- the signed-out iPad surface collapsed to approximately `36px` because a hidden navigation column still reserved width;
- incorrect Lock and Elimination answers were presented as successful outcomes;
- browser timers locally fabricated Trial and Premium outcomes;
- a sleeping current card could return unchanged to Learning;
- Space used progress/time buckets instead of stable knowledge ownership;
- formal commerce and managed access shared one switchable proof;
- learner-source comments contained reviewer guidance;
- horizontal clipping was concealed instead of prevented.

All of those paths were rechecked against the frozen sources below. This history is reviewer context, not a claim that the earlier artifacts were acceptable.

## Auth and Trial boundary

Exact iOS phone replay at `390×844`:

1. Entered `138`; submit retained the value, set `aria-invalid=true`, focused the phone field, and announced `请检查手机号是否为 11 位。`.
2. Entered a valid 11-digit number; successful send moved to the SMS-code screen.
3. Entered an incomplete code; submit retained `12`, set `aria-invalid=true`, focused the code field, and announced `请输入完整的 6 位验证码。`.
4. Requested a resend; the control first became `正在重新发送…`, then `5 秒后可重新发送`, and remained disabled against duplicate requests.
5. Entered a complete code. The immediate state disabled code, verify, resend, and edit actions while showing `正在确认…`.
6. Authentication then moved to `正在准备当前学习`; only the subsequent successful Learning-session scenario rendered the first card and `当前学习已准备好`.

The same visible phone/code/login path was operated in all four platform documents before their signed-in layout measurements. The timer is only a design-scenario adapter; it does not prove server verification, canonical bootstrap, or Trial persistence.

## Five interaction families

The complete iOS browser sequence used visible controls only:

| Family | Operated branches | Observed truth |
| --- | --- | --- |
| Flip | reveal; `有把握`; separate replay with `再回看` | reveal exposed exactly the two authorised judgements; submission showed `正在保存这次作答…` before `已保存` |
| Four-choice | wrong `A. therefore`; correct `B. however` | wrong branch rendered `这次答案不正确` and accessible selected/correct labels; correct branch rendered `回答正确` |
| Lock | wrong order; exact correct order | wrong branch rendered `这次顺序不正确`; correct branch rendered `顺序正确`; neither skipped the pending state |
| Elimination | wrong subset; exact correct subset | wrong branch rendered `这次保留的主干不正确`; correct branch rendered `主干已找到` |
| Swipe | real 24px pointer drag; labelled correct and wrong alternatives | short drag returned to centre with `尚未作答`; `符合` resolved correct and `不符合` resolved incorrect, each after pending |

Every accepted result exposed one `下一张`. Selecting it first rendered `正在准备下一张`, then a newly prepared family. No incorrect branch unlocked a success state.

At `320×844` and `360×800`, Four-choice remained a `2×2` grid. At 320px its four buttons were `120×49`; at 360px they were `140×49`. No unauthorized single-column exception appeared.

## Attached tools, focus, and completion truth

- Hint and peek toggles retained focus on their renamed controls (`收起提示`, `收起查看`).
- Favorite rendered `正在保存…` before `已喜欢` and returned focus to that control.
- Completion pending focused the status; accepted results focused the result region.
- The audio-absent card rendered no audio control. Audio-present/playback states were not fabricated and remain blocked.
- Statistics rendered dated activity (`8 月 9 日`, `8 月 8 日`, `8 月 7 日`) with tabular numeric glyphs and no check-in control or streak fiction.

## Learning and Space continuity

- `查看所在空间` opened the same current card at `仔细阅读馆 → 长难句里的主干 → 找出主语和谓语 → current card`.
- The root-to-card path was operated through library, group, box, and card. App Back moved one depth at a time: `查看卡片 → 选择学习盒 → 选择知识分组`.
- Browser Back moved `选择知识分组 → 选择一个馆`; browser Forward restored `选择知识分组` without a route loop.
- Sleeping the current `让步关系判断` card rendered a disabled `正在保存…` state, then `唤醒卡片`. Returning to Learning selected `让步句中的主句`; the sleeping card did not reappear as current.
- Learning and Space favorite/sleep operations never changed membership.

Mutation failure, retry, exact duplicate acknowledgement, sleeping-zone aggregation, external Space deep links, and canonical reconciliation remain unproved browser states.

## Dialog, Back, and origin behavior

- Opening the membership sheet made the background inert and focused its heading.
- `Shift+Tab` from the first action wrapped to `暂时不用`; `Tab` from the last action wrapped to `继续订阅`.
- Escape closed an idle sheet and returned focus to `查看完整体验`.
- During purchase or restore pending, all sheet actions were disabled and Escape left the dialog open.
- Purchase ended with an honest unavailable/retry result. Restore ended with an honest unavailable/retry result. Neither locally set Premium.
- Sign-out and delete-account confirmation cancellation returned focus to their exact invokers.

Native System/Predictive Back, process death, IME-driven focus movement, and native assistive-technology focus remain blocked.

## Responsive and platform measurements

All values are CSS pixels from the browser viewport. `overflowX` is `documentElement.scrollWidth - clientWidth`.

| Document and viewport | Exact observations |
| --- | --- |
| iOS phone `320×844` | `overflowX=0`; minimum visible control height `44`; Four-choice `2×2`; bounded nav bottom `836` |
| iOS phone `360×800` | `overflowX=0`; Four-choice `2×2`; bounded nav `x=12`, `w=336`, bottom `792` |
| iOS phone `390×844` | `overflowX=0`; minimum visible control height `48`; bounded nav `w=366` |
| iOS phone `430×932` | `overflowX=0`; main `w=428`; bounded nav `w=406` |
| iOS phone landscape `844×390` | `overflowX=0`; main uses full `844`; bottom nav `x=142`, `w=560`, `h=70`; page scroll height `574` |
| Android phone `390×844` | `overflowX=0`; minimum visible control height `48`; bounded nav `w=366`, `h=74` |
| Android phone `430×932` | `overflowX=0`; main `w=428`; bounded nav `w=406` |
| Android phone landscape `844×390` | `overflowX=0`; left rail `x=8`, `w=72`, `h=374`; main `x=88`, `w=756`; page scroll height `574` |
| iPadOS signed out `1024×768` | `overflowX=0`; hidden nav width `0`; auth surface `x=132`, `w=760`; no reserved hidden column |
| iPadOS ready `1024×768` | sidebar `208`; main `x=236`, `w=760`; empty context width `0`; minimum target height `44` |
| iPadOS result `1024×768` | main/context tracks `436 + 320`; context appears only when useful; `overflowX=0` |
| iPadOS compact `800×768` / `761×768` | main and context stack at widths `764` / `725`; bounded bottom nav `w=560`; `overflowX=0` |
| Android tablet signed out `1024×768` | `overflowX=0`; hidden rail width `0`; auth surface `w=760` |
| Android tablet ready `1024×768` | rail `160`; main `x=212`, `w=760`; minimum target height `48`; `overflowX=0` |
| Android tablet compact `800×768` / `761×768` | main widths `764` / `725`; bounded bottom nav `w=560`, `h=82`; `overflowX=0` |

The page runtime emitted no browser-console errors during the completed interaction replay. Native inset resolution, display zoom, 200% text, real software keyboards, reduced-motion OS preference, and cutout/notch devices remain blocked.

## Formal commerce proof

`access-profile-proofs/access-standard.html` was operated at `320×844` and measured again at `1024×768`:

- Learning and Space each presented their own access limit and preserved the exact origin in the comparison dialog.
- purchase pending disabled purchase, restore, and cancel; Escape did not close it;
- the purchase scenario ended `当前无法打开购买服务，购买没有完成`, with retry and no access change;
- restore pending likewise blocked interruption, then ended `没有找到可找回的购买`;
- cancel from Space returned to `这张卡片放在哪里` and focused `查看完整位置`;
- no local Premium state was produced;
- `overflowX=0` at both widths; minimum visible target height was `48`.

Store success, store cancellation, offline store, account mismatch, entitlement refresh, and canonical Premium activation remain blocked.

## Managed read-only access proof

`access-profile-proofs/access-managed.html` was operated at `320×844` and measured again at `1024×768`:

- base access and additional complete access were displayed separately;
- refresh pending disabled both actions and could not be dismissed with Escape;
- deterministic browser scenarios rendered active, refresh-error-with-last-known-access, and absent/revoked states;
- the error preserved the last confirmed complete access; the absent state preserved base access;
- visible controls and full page text contained no purchase, restore, self-grant, self-revoke, grant-code, or redemption path;
- `overflowX=0` at both widths; minimum visible target height was `48`.

This is a managed-access interaction proof, not receiver-operator evidence or a canonical entitlement result.

## Audience and leakage boundary

- The four platform learner HTML files carry an explicit learner audience and structural learner root.
- Formal and managed access are separate source documents with no query/profile switch.
- External learner JavaScript is included in the fail-closed metadata scanner.
- Non-empty learner HTML comments are rejected; reviewer process language is allowed only in explicit reviewer documents; raw metadata remains rejected everywhere it is disallowed.
- Scanner tests passed `36/36`; the full scanner reported `PASS: No metadata leaks detected in design visual artifacts.` The added regression also proves that a referenced external learner script is scanned while an explicit reviewer-only external script remains outside learner-copy rules.
- Rendered learner DOM and accessible names contained no reviewer guidance, internal state keys, profile switch, runtime predicate, or test/process narration.

## Remaining blockers

The following are deliberately not converted to `covered_browser_scenario`:

- offline, expired-session, mismatch, duplicate-completion, completion-failure, mutation-failure, and process-restore states;
- attached-audio ready/preparing/playing/paused/completed/interrupted/error states;
- complete Free restrictions, real Trial duration/persistence, membership-end reminder, and canonical Premium;
- real store success/cancel/offline/account-mismatch/entitlement refresh;
- real receiver-managed grant/revoke and audit evidence;
- 200% text, OS reduced motion, real IME, native Back, VoiceOver, TalkBack, safe areas, cutouts, and native tablets;
- per-state PC Web mapping to the accepted Focused Workbench;
- visual-system selection or product-owner design acceptance.

Any one of those required blocked rows keeps the architecture gate blocked.
