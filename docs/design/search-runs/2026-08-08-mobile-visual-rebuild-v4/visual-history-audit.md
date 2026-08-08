# Mobile Visual History Audit — 2026-08-08

## Verdict

No accessible commit or current mobile design output is qualified as the next
mobile visual authority. `origin/main@7960ebd` still renders the later-vetoed
Aurora family; the editorial branch was closed without acceptance; v3 was
explicitly rejected; v4 ends with eight no-advance candidates. None is ready
for a leadership review, implementation mapping, or React Native rebuild.

## Audit Scope And Limit

- The accessible repository history begins at root commit `b7e6d26`. That
  commit states that older history was preserved outside the active history
  cutover. Pre-2026-07-10 visual work therefore cannot be reconstructed as
  individual commits from this active repository; its checked-in artifacts and
  implementation snapshot were reviewed instead.
- The audit covers every unique post-cutover diff on all refs accessible at
  this review revision that directly changed mobile visual design, learner-visible copy,
  interaction presentation, responsive containment, mobile visual governance,
  or exact mobile proof evidence. Merge commits whose relevant diff is already
  represented by their source commit are de-duplicated rather than counted as a
  second design decision.
- Adjacent accepted Learning, audio, Space, Auth, and platform artifacts were
  reviewed because they constrain the next mobile design. PC Web is treated as
  its own platform authority and not copied into mobile.
- Pure backend, release, content-production, and unrelated Web implementation
  commits were excluded. Archived legacy prose was not reopened as active truth,
  in accordance with `spec/workspace-boundary.json`.
- The v4 no-promotion cohort is bound to `4e0780a` and is reviewed as an output
  family below; later review-correction commits do not change its candidate UI.

The audit used `git log --all`, path-scoped history, `git show --stat`,
`git show --name-status`, and content diffs rather than relying on commit
subjects alone.

## Product Truth And Implementation Hypothesis

### Product Truth Retained Across The History

- Learning is system-sequenced and single-card, with one current CET task,
  action, feedback, recovery, and continuation.
- The four top-level routes remain `学习 / 空间 / 统计 / 我的`.
- The five Learning interactions keep distinguishable operation shapes.
- Flip alone uses exactly `有把握` in mint and `再回看` in amber.
- Space remains library → group → box → card. Favorite is a tag and sleep/wake
  is a reversible physical-space state.
- iOS and Android have equal mobile priority, and tablet needs a dedicated
  composition.
- Auth is a successive gate before Learning. Unknown accounts are not shown a
  signed-in shell or a false claim that progress has already been preserved.
- Learner surfaces expose no review, repository, transport, test, or internal
  implementation language.
- A separately accepted exact design must precede later user-visible RN work.

### Repeatedly Mistaken For Product Truth

Glass, Aurora fields, Outfit, very large display type, floating capsules,
universal 28px radii, fixed 393px phone frames, exact hex values, paper/editorial
objects, decorative spines, large whitespace, pane ratios, and current RN
screens are all `implementation_hypothesis`. Their appearance in a canon,
mapping, previous implementation, green check, or pairwise result does not make
them permanent product identity.

## Commit Audit

| Phase | Commit(s) | Diff-grounded finding | Authority consequence |
| --- | --- | --- | --- |
| History cutover | `b7e6d26` | Root snapshot already contained the June mobile reset, Aurora glass, floating capsule navigation, universal large radii, one 393 × 852 proof family, the active design canon, and the large RN implementation. The visual-language file itself classified most of those choices as hypotheses. | Snapshot is useful for product and interaction history, but its visual package was later rejected. |
| Design governance | `623c663`, `8b66e9f` | Split design validation into dedicated harness layers and added formal approval gates. | Keep the governance. A green validator or approval job still cannot substitute for product-owner acceptance of one exact learner artifact. |
| Attached audio | `baf9a8d` | Added the accepted attached audio states: ready → preparing → playing/paused → error/retry; audio remains owned by the current card. | Preserve the UX state model. Redraw the old capsule/Aurora presentation. |
| Safe error copy | `f3c1b52` | Added fail-closed user-facing error mapping that blocks raw URLs, paths, tokens, and system details. | Preserve as a learner-truth and leakage boundary. |
| Compact Learning | `db7233d` | Added `<=340` / `<=720` compact branches, collapsed repeated location/context, compressed spacing, and bounded answer detail to recover 320dp operability. | The containment technique is evidence, not a visual direction. It also shows the cost of fixing a fixed composition after the fact. |
| Compact Mine | `f0410d7` | Added more compact branches, truncation, smaller objects, and overflow control for Mine. | Do not reuse the compressed card stack as design. Required information must reflow rather than disappear behind truncation. |
| Real Swipe | `253ae12` | Added pointer-following gesture, distance/velocity commit, cancel return, reduced-motion behavior, accessible actions, and labelled alternatives. | Preserve the interaction mechanism and re-skin it inside the next accepted system. |
| Native audio | `be327f7` | Connected verified card-owned playback with explicit initiation, pause/interruption, failure containment, and stop-on-card-change. | Preserve behavior; do not use browser speech synthesis or the old visual shell as replacement evidence. |
| Flow truth | `5b59224` | Corrected signed-out Learning/Space flow and removed false progress/location assurances while still consuming the now-revoked reset mapping. Its post-auth runtime starts Trial automatically. `60ac531` changes only the unmerged controlled pilot to first-valid-Learning-session start; it does not supersede `origin/main` or the active formal `first_entry_counted_as_membership_trial` contract. | Keep truthful signed-out flow/copy and discard the visual mapping. Do not infer one formal trigger from the pilot branch; exact learner copy waits for the owner contract/canonical state. |
| Pre-pilot persisted-session states | `f9969f4`, `6f08942` | Added restored-session loading, logout failure, entitlement-read failure, authorization expiry, offline Space mutation recovery, and visible sync outcomes. The UX correctly preserves local work and distinguishes retryable transport from rejected identity, but copy repeatedly narrates services, servers, and synchronization. | Preserve loss prevention and recoverability; rewrite status copy and redraw the history-cutover shell. |
| Auth/bootstrap runtime cutover | `018e77d`, `ea6c3b4` | Replaced older sessions with bounded v2 authentication and canonical account hydration. Visible states cover expired code, partial local credential cleanup, entitlement/bootstrap failure, retained login, retry, and fail-closed Learning. | Runtime truth is reusable; “服务恢复/上传本地状态/服务端权益” narration is not learner copy or visual authority. |
| Durable Learning/daily/Space cutover | `db91a6c`, `9f23502`, `a8b4610`, `a081ce6`, `d8b45be` | Added answer-record pending/retry/confirmed, server-issued next-card gating, check-in pending/failure, Space mutation queue/confirm/recovery, and terminal conflict restoration. These commits visibly overexposed queue, server confirmation, login context, and canonical-state mechanics. | Preserve the state distinctions and no-data-loss behavior. Replace the technical status stream with task-centered consequences and recovery actions. |
| Dedicated Auth branch | `afd083a`, `93d0219`, proof `6edd77e` | Designed, implemented, and regression-locked a dedicated login gate before the app shell on a side branch not merged into `origin/main`. | The current platform spec retains the product boundary; the branch's exact UI is not mobile visual authority. |
| Controlled-pilot lifecycle design family | `e71df8f` / patch-identical `2f344cd`, then `17bbc72`, `2122142`, `1ce332e` | Added eight lifecycle candidates, rendered proof, motion/decision/mapping artifacts, then clarified that empty scheduling is not completion and bound review/address to server-owned cards. | Pilot state sequencing is useful. The gate-ineligible lifecycle, Aurora-derived visual package, and implementation narration cannot define formal membership or the next mobile identity. |
| Controlled-pilot Auth/recovery branch | `538c7db`, `439a664`, `2b42b47`, `3886bda`, `1b7af2f`, `51c2157` | Separated the signed-out gate, classified hydration/login/resend failures, added large-text reflow and phone correction, and kept resend failure distinct from invalid-code state. Several screens simultaneously exposed requirement/implementation narration as learner copy. | Preserve the recovery state machine and reflow lessons. Reject the Aurora shell and rewrite all visible copy; this branch never reached `origin/main`. |
| Controlled-pilot trial/entitlement branch | `60ac531`, `1b7cd43`, `1d014e8`, `22ec872`, `8eb3c41`, `4defd19` | Bound trial start to a valid first Learning session, revalidated expiry/entitlement, cleared stale task state, and distinguished pilot entitlement. The pilot explicitly had no payment and exposed server/operator/cross-platform implementation language. | Preserve server-owned timing and refresh semantics only. Pilot access is gate-ineligible and cannot define formal membership, purchase, or learner copy. |
| Controlled-pilot Learning/Space continuity | `08519c7`, `a2bd1be`, `64832dc`, `a827a9b`, `03b6dce`, `96a99d0`, `1090a41`, `b8f007c` | Distinguished no scheduling from completion, kept server-owned review/round receipts, opened the correct Space card, serialized continuation, and removed invented `0/1`-style progress claims. | Reuse truthful async/continuity states. The card-heavy Aurora presentation and operational copy have no visual authority. |
| Controlled-pilot deletion lifecycle | `25ed18f`, `f315afa` | Defined confirmation, pending, failure-with-session-preserved, and accepted-but-not-yet-finished deletion. Only a server `202` removes the product shell; failure neither logs out nor clears local data. | Preserve the high-risk state machine. Redraw the sheet and write learner language from scratch. |
| Controlled-pilot claim integrity | `378c3d4` | Prohibited unsupported official-content, frequency, pricing, and renewal claims in the pilot experience. | Promote the honesty lesson into review; it does not endorse the branch's visuals. |
| Controlled-pilot internal-build and local continuity | `9ec314c`, `4f3a6b6` | Hid fake purchase/restore controls when no remote purchase capability exists; kept its fixed SMS code development-only; persisted local rounds/review across restarts; and made completion offer secondary review, the owning Space card, and one primary continuation. | Preserve capability guarding, action hierarchy, and task continuity. An internal build and fixed code are never product authority, and its membership/action visuals require a fresh formal design. |
| Cross-platform containment topic | `d9658a4` → `1978db3` → `e9bb383` → `7109472` → `42b29bb` | A Mine-only patch expanded after a real Statistics screenshot still showed a nested dashboard and contaminated automation trace. The corrective diff introduced phone/tablet classification, route scrolling at large text, Android opaque surfaces, quieter Statistics, and reduced inactive-tab elevation. | Proves earlier review scope was too narrow. Reflow and state lessons are reusable; visual result is not. |
| Main containment merge | `4db0dfb` | Product code matches the corrective topic while run-record text changed. Statistics moved from a squeezed four-column strip to vertical ledger blocks and routes gained accessibility scrolling. | Closed some overflow, but stayed inside the later-rejected visual family. |
| Aurora topic | `65bdd2d`, `830e063` | Added current-library coloring, Aurora blobs, transparent chrome, bright CTAs, intrinsic Flip height, and large-text Space stacking. | Large-text stacking is useful. Aurora, translucent fields, and accent-everywhere styling are rejected. |
| Current main visual runtime | `7960ebd` | Product code matches the Aurora topic; it is the current `origin/main` runtime visual state. | The later product-owner veto explicitly revokes it as mobile design authority. It is not a leadership-ready baseline to polish. |
| Editorial v2 branch | `d8a7f95` → `76d2a6e` → `ebcc151` → `5d182b2` | Eight records converged on warm paper, deep plum, coral/orange edge, attached action, and cabinet-like Space. Later containment patches were mainly max-width/overflow/media-rule changes; tablet, full supporting routes, dark mode, and motion were not proven. | PR #481 closed unmerged and unaccepted; the whole visual package is vetoed. |
| v3 creation | `46f212e` | Froze earlier rejected families and generated fifteen search directions; the conditional winner used navy/rose/lime, a Soft Spine device, cut corners, layered edges, and an address aperture. No RN code changed. | Search evidence only, never accepted authority. |
| v3 record repairs | `56e85b3`, `0d9a8bd`, `5069752` | Added PR/run evidence, exact Flip token wording, and strict-gate records. | Improved auditability, not product visual quality. |
| v3 audience-boundary incident | `de700d0` | Found that a combined proof exposed reviewer, QA, and implementation narration to the learner and assistive copy despite an earlier scanner pass; split learner and reviewer documents and strengthened scanning. | Preserve physical audience separation and fail-closed scanning as a P0 requirement. |
| v3 freeze | `df0cf9d` | Recorded explicit product-owner rejection of the exact v3 learner/reviewer evidence pair and removed any revival path. | All fifteen directions remain rejected even if a technical review or pairwise comparison passed. |

### Inspected Runtime-Only Exclusions

The path scan also inspected `9794caa` (request deadlines), `d479f5f`
(manifest/session binding), `c7f7641` (native audio cache), `da232f8` (manifest
foundation), and `5d51962` (beta-entitlement operations). They add no unique
learner-visible component, copy, or geometry diff, so they are runtime
constraints rather than visual phases. `d479f5f` still constrains future audio:
the attached control must fail closed until the selected card and approved
URL-free descriptor match, but it contributes no visual authority.

## Controlled-Pilot Side-Branch Findings

The commits above live on the controlled-pilot contract/design/mobile refs, not
on `origin/main`. They inherit the later-vetoed Aurora family: translucent
panels, large radii, nested cards, and explanation-heavy screens. Their value is
therefore state-machine evidence, not a visual baseline.

Five high-signal commits establish the reusable boundary precisely:

| Commit | Reusable UX fact | What must not be inherited |
| --- | --- | --- |
| `3886bda` | Dynamic Type uses scrolling, wrapping, and non-truncated titles so phone and CTA remain reachable. | The rounded glass login card and its exact composition. |
| `1b7af2f` | Code entry offers an accessible “change phone” recovery that clears the challenge/code/error before returning to phone entry. | The exact button styling and implementation-oriented short-code copy. |
| `51c2157` | Resend failure does not invalidate the prior code or paint the code input as wrong; submission remains available. | Any copy that equates transport failure with credential rejection. |
| `8eb3c41` | Entitlement stages and first-valid-session timing are server-owned; the controlled pilot has no learner purchase path. | Server/operator/cross-platform narration and any attempt to generalize the pilot's time/card limits to formal membership. |
| `f315afa` | Confirmation changes nothing; failure preserves session/data; only accepted deletion leaves the shell and shows truthful pending cleanup. | The existing modal/sheet visuals or a false “deleted” completion claim. |

This side branch also gives direct evidence for the user's observed “prompt
leakage.” Learner-visible strings included requirement and operations language
such as “未登入时不展示学习、空间、统计和我的”, “产品页面会继续保持关闭”,
“服务端已确认本轮 5 张卡”, “时间与资格以服务端为准”, “运营依据试点记录发放”,
and “iOS 与 Android 共用”. These are grammatically valid strings, so the raw
exception/token scanner cannot catch them. The next gate needs a human semantic
copy review that asks whether each sentence helps the learner act or recover;
status-machine facts remain internal unless the learner needs a plain-language
consequence.

Formal purchase and restore UI can be found in the history-cutover snapshot,
but no isolated post-cutover commit establishes an independently accepted
mobile design for it. The pilot's no-payment UI is a different, gate-ineligible
state. Formal Paywall, purchase, restore, account mismatch, offline, and
entitlement-refresh surfaces therefore require fresh exact design authority.

Trial timing also has a scope boundary, not one merged evolution: current main
still carries the post-auth start introduced around `5b59224`, active formal
specs say `first_entry_counted_as_membership_trial`, and the unmerged pilot uses
first valid Learning session from `60ac531`. The next design must consume the
formal owner contract and canonical entitlement response; it must not borrow
pilot timing or expose a countdown/start claim before that authority is clear.

## Design Output Inventory

| Output family | What remains useful | Current visual status |
| --- | --- | --- |
| Learning + Space direction, card rhythm, core motion | Current-object meaning, six-step Learning rhythm, low-cost action, truthful result/recovery, Learning ↔ Space continuity | Product/interaction structure remains useful; restrained glass, capsule navigation, apertures, and exact styling are not automatically mobile authority. |
| Space model, refinement, and shelf-desk search | Visible ownership hierarchy, current box focus, contained cards, favorite tag, sleep/wake under the owning box | Spatial truth remains. The exact shelf, glass/paper, floating capsule, and phone-only proof need new platform design. |
| Attached audio decision and motion | Explicit initiation, attached ownership, stable lifecycle, interruption, retry, reduced motion | Accepted UX semantics; visual control must be redrawn and bound to formal native playback evidence. |
| Leadership screenshot handoffs | Historical evidence of what the implementation rendered | Implementation/review evidence only; never a design source. |
| Mobile app quality reset / Aurora | Some responsive containment and quiet-supporting-route lessons | Promotion revoked; all candidate visuals and RN result rejected. |
| PC Web core | Its own accepted keyboard/workbench platform direction | PC Web only. A rail/workbench must not be copied into phone or tablet as an enterprise console. |
| Editorial v2 | One-task emphasis and attached-result intent | Closed, unmerged, and explicitly rejected as a mobile package. |
| Mobile visual rebuild v3 | Broad failure coverage, strict state matrix, audience separation lesson | All candidates rejected; frozen exact evidence may not be mutated or revived. |
| Mobile visual rebuild v4 | Real browser interaction loops, exact learner/reviewer separation, stronger leakage regression, 320px/browser-200% measurements, and limited structural fragments | Eight of eight do not advance. No accepted artifact, shortlist, provisional leader, or RN authority. |
| Controlled-pilot lifecycle search (`cpl-01`–`cpl-08`) | Empty-scheduling, first-valid-session, round-review, Space-return, and entitlement timing distinctions | Gate-ineligible pilot scope; Aurora-derived rendered family; no authority for formal membership, purchase, or the next mobile visual identity. |
| Controlled-pilot mobile branches | Auth/recovery, entitlement refresh, round continuity, deletion truth, and honest-claim state machines | Unmerged, pilot-only, Aurora-derived, and semantically leaky; preserve behavior lessons only and rebuild visuals/copy. |
| Membership / purchase / restore | Trial/Free/Premium product contract and a historical runtime surface | No separately accepted current mobile visual authority; formal purchase/restore must enter the next full state matrix. |

## Recurring Failure Patterns

1. **A hypothesis became “the canon.”** Glass, sparse fields, capsules, large
   radii, and one font/palette were copied forward even though the visual spec
   classified them as mutable.
2. **Semantic colors collide.** The current defaults assign mint both to the
   选词填空馆 identity and Flip `有把握`, and amber both to 语法馆 identity and
   Flip `再回看`, while also claiming feedback and library meanings are
   separate. The next exact design must resolve these collisions with tone,
   chroma, label, icon, shape, and location—not color alone—and a later accepted
   design-only update must reconcile the token source.
3. **“Has color” was mistaken for “normal app color.”** One accent tinted CTA,
   navigation, halo, material, and current object at once; later directions
   substituted paper orange or navy/rose/lime without a stable role system.
4. **Containers multiplied.** Card-inside-card, metric strips, attached slips,
   address apertures, floating pills, and equal panes created a heavy AI-template
   look. White space then became unused dead space rather than useful focus.
5. **Fixed composition came before stress.** 393px frames and absolute geometry
   were followed by compact branches, hidden copy, clipping, and route-wide
   scroll patches. 320px, large text, IME, long content, and recovery states must
   enter the composition stage.
6. **Platform differences stayed cosmetic.** iOS and Android commonly shared
   one structure with only transparency, radius, elevation, or selected-marker
   changes. Tablet was repeatedly a widened phone or a browser workspace.
7. **Space hierarchy was stated more often than shown.** Breadcrumbs and nested
   panels named the path but did not consistently make parent, current box, and
   contained card ownership visually legible.
8. **Technical pass was mistaken for design quality.** Several exact heads
   passed tests, layout checks, or agent review and still failed immediate human
   visual judgment. Operability is a floor, not aesthetic acceptance.
9. **Proof and native behavior diverged.** HTML/frame evidence did not establish
   safe area, IME, system back, true text scaling, native type rendering,
   VoiceOver/TalkBack, or physical-device quality.
10. **Reviewer and learner content were coupled.** Before `de700d0`, shared
    documents let internal narration enter visible and assistive user output.
11. **Sparse was treated as empty.** Fixed declarations that whitespace itself
    was the identity produced weak focal scale and unused half screens.
12. **Route chrome leaked.** The v4 adaptive-workspace candidate retained a
    Learning workspace title, 仔细阅读馆 context, and progress on Space and
    Statistics, making the app feel like one internal console rather than four
    distinct product routes.
13. **Valid Chinese still leaked internal thinking.** Requirement, server,
    operator, qualification, synchronization, and review explanations appeared
    as polished sentences, so keyword sanitization passed while the product
    still sounded like an implementation brief.
14. **“No geometry change” was treated as “no UI change.”** Runtime commits
    added or replaced authentication, hydration, queue, confirmation, retry,
    recovery, purchase-capability, and deletion states without independent
    visual/content review. Copy and state transitions are user-visible UI even
    when component structure is unchanged.

## Preserve, Redraw, And Forbid

### Preserve

- All product truths listed above.
- Real Swipe commit/cancel/reduced-motion/alternate-action behavior.
- Formal attached-audio lifecycle and card ownership.
- Fail-closed learner error copy and physical learner/reviewer separation.
- Controlled-pilot recovery semantics: correct-phone, resend-with-old-code,
  hydration retry, entitlement refresh, round continuity, and deletion pending.
- The technical strategy of removing fixed geometry and reflowing/stacking at
  large text, without hiding required information.
- v4 structural ingredients only: reachable phone action order, quiet Space
  containment, conditional tablet context separation, and subordinate default
  option/body density.

### Redraw

- Semantic color roles, especially product blue versus current-library color
  and the two library/self-assessment collisions.
- All navigation and action icons using SF Symbols on iOS and Material Symbols
  on Android.
- Phone Learning, all four route identities, Space containment, Auth recovery,
  Statistics dates/scales, Mine grouping, and conditional tablet panes.
- Typography with stable platform weights and large-text behavior.
- Causal motion, reduced motion, pressed/ripple states, and formal audio visuals.

### Forbid From The Next Visual Package

- Aurora/lilac/glass/blob identity, VisionOS-like floating capsules, universal
  oversized radii, and accent-everywhere styling.
- Warm paper + deep plum + orange/coral editorial package.
- Navy/rose/lime + Soft Spine + cut-corner/layered-edge package.
- Dark brick-red CTAs and current-library fills inherited across v4.
- Unicode/emoji icons, including a home symbol used to represent Space.
- Dashboard-first Statistics, a second-home Mine, ordinary-list Space, permanent
  empty tablet detail panes, and enterprise-workspace language.
- `overflow:hidden`, required-copy truncation, or hidden controls presented as
  evidence that containment is solved.
- Current RN screenshots, current main code, pairwise winners, CI, local gates,
  or agent self-review used as design authority.
- Any mixed learner/reviewer document or visible process narration.
- Requirement/operations prose disguised as learner copy, including server,
  operator, cross-platform implementation, gate, receipt, or review narration.
- RN implementation before exact phone/tablet/state evidence and explicit
  product-owner acceptance.

## Audit Consequence

The next round must not repair `origin/main@7960ebd` or combine the three
rejected packages. It must establish a new role-based palette, platform-native
navigation/iconography, route-specific information architecture, focused phone
composition, conditional tablet context, complete recovery states, and formal
audio/motion evidence. The actionable proposal is `next-synthesis-plan.md`.

## Stop Boundary

This audit is reviewer evidence, not a new accepted design. It authorizes only
the next design search and blocks any claim that the current mobile UI is ready
for leadership review or implementation continuation.
