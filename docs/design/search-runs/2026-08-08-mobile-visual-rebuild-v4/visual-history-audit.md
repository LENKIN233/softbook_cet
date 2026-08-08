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
- The audit covers every post-cutover commit on all accessible refs that
  directly changed mobile visual design, interaction presentation, responsive
  containment, mobile visual governance, or exact mobile proof evidence.
- Adjacent accepted Learning, audio, Space, Auth, and platform artifacts were
  reviewed because they constrain the next mobile design. PC Web is treated as
  its own platform authority and not copied into mobile.
- Pure backend, release, content-production, and unrelated Web implementation
  commits were excluded. Archived legacy prose was not reopened as active truth,
  in accordance with `spec/workspace-boundary.json`.
- The uncommitted v4 working tree is reviewed as an output family below, but it
  is not misrepresented as part of the commit audit.

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
| Flow truth | `5b59224` | Corrected signed-out Learning/Space flow and removed false progress/location assurances while still consuming the now-revoked reset mapping. | Keep truthful flow/copy; discard the visual mapping. |
| Dedicated Auth branch | `afd083a`, `93d0219` | Designed and implemented a dedicated login gate before the app shell on a side branch not merged into `origin/main`. | The current platform spec retains the product boundary; the branch's exact UI is not mobile visual authority. |
| Cross-platform containment topic | `d9658a4` → `1978db3` → `e9bb383` → `7109472` → `42b29bb` | A Mine-only patch expanded after a real Statistics screenshot still showed a nested dashboard and contaminated automation trace. The corrective diff introduced phone/tablet classification, route scrolling at large text, Android opaque surfaces, quieter Statistics, and reduced inactive-tab elevation. | Proves earlier review scope was too narrow. Reflow and state lessons are reusable; visual result is not. |
| Main containment merge | `4db0dfb` | Product code matches the corrective topic while run-record text changed. Statistics moved from a squeezed four-column strip to vertical ledger blocks and routes gained accessibility scrolling. | Closed some overflow, but stayed inside the later-rejected visual family. |
| Aurora topic | `65bdd2d`, `830e063` | Added current-library coloring, Aurora blobs, transparent chrome, bright CTAs, intrinsic Flip height, and large-text Space stacking. | Large-text stacking is useful. Aurora, translucent fields, and accent-everywhere styling are rejected. |
| Current main visual runtime | `7960ebd` | Product code matches the Aurora topic; it is the current `origin/main` runtime visual state. | The later product-owner veto explicitly revokes it as mobile design authority. It is not a leadership-ready baseline to polish. |
| Editorial v2 branch | `d8a7f95` → `76d2a6e` → `ebcc151` → `5d182b2` | Eight records converged on warm paper, deep plum, coral/orange edge, attached action, and cabinet-like Space. Later containment patches were mainly max-width/overflow/media-rule changes; tablet, full supporting routes, dark mode, and motion were not proven. | PR #481 closed unmerged and unaccepted; the whole visual package is vetoed. |
| v3 creation | `46f212e` | Froze earlier rejected families and generated fifteen search directions; the conditional winner used navy/rose/lime, a Soft Spine device, cut corners, layered edges, and an address aperture. No RN code changed. | Search evidence only, never accepted authority. |
| v3 record repairs | `56e85b3`, `0d9a8bd`, `5069752` | Added PR/run evidence, exact Flip token wording, and strict-gate records. | Improved auditability, not product visual quality. |
| v3 audience-boundary incident | `de700d0` | Found that a combined proof exposed reviewer, QA, and implementation narration to the learner and assistive copy despite an earlier scanner pass; split learner and reviewer documents and strengthened scanning. | Preserve physical audience separation and fail-closed scanning as a P0 requirement. |
| v3 freeze | `df0cf9d` | Recorded explicit product-owner rejection of the exact v3 learner/reviewer evidence pair and removed any revival path. | All fifteen directions remain rejected even if a technical review or pairwise comparison passed. |

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

## Preserve, Redraw, And Forbid

### Preserve

- All product truths listed above.
- Real Swipe commit/cancel/reduced-motion/alternate-action behavior.
- Formal attached-audio lifecycle and card ownership.
- Fail-closed learner error copy and physical learner/reviewer separation.
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
