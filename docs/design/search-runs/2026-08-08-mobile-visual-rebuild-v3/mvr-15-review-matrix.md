# MVR-15 Independent UI/UX Review Matrix

> **Product-owner rejection — 2026-08-08**
> The product owner rejected the exact `mvr-15` visual direction after the
> repaired pair passed technical review. Learner SHA `41a2143a…` and reviewer
> SHA `13bc7dff…` remain frozen historical rejection evidence. This human
> decision supersedes the conditional technical recommendation and forbids RN
> consumption or in-place mutation of the proof pair.

> **P0-09 quarantine correction — 2026-08-08**
> The previously frozen proof `98c1b28c…` is invalidated as current evidence.
> Its review cockpit and learner surface shared one page, and reviewer/QA/
> implementation language leaked into visible and assistive product copy. The
> old metadata-check PASS was a false negative because inline dynamic copy was
> not scanned. It must not be used for leadership demo, implementation, or
> acceptance. The final learner preview (`41a2143a…`) and reviewer harness
> (`13bc7dff…`) passed a fresh independent P0-09 boundary/leakage review and
> fresh code-native P0/P1 review. The old SHA remains quarantined. The later
> product-owner rejection controls the lifecycle of the repaired pair.


## Current Verdict

`mvr-15` is `rejected` by the product owner. It is not accepted, not promoted,
and does not authorize implementation.

The old SHA `98c1b28c…` is `quarantined` and its P0-09 classification is FAIL.
The repaired learner preview (`41a2143a…`) and reviewer harness (`13bc7dff…`)
passed a new independent P0-09 boundary/leakage review and a new code-native
P0/P1 review. No earlier technical PASS transfers to the new pair, and the new
technical PASS does not override the later product-owner rejection.

### Phase 3 Fresh Independent Review — Frozen Technical Evidence

- Exact learner SHA:
  `41a2143a5c011f08b4dd5cdedf04044e7836fc96dba254a9b0309ad430516722`.
- Exact reviewer SHA:
  `13bc7dff3cab1f699155d9a1143be266916b1562fe49873aa717d510e48820eb`.
- Verdict: P0-09 PASS; code-native P0 findings 0; code-native P1 findings 0.
- Boundary evidence: the learner file is self-contained, declares learner
  audience, mounts one app and zero reviewer nodes, and has no fetch, dynamic
  execution, style/script, or DOM dependency on the reviewer harness. The
  reviewer file declares reviewer audience; its marked learner template is
  byte-identical to the learner preview template.
- Real browser evidence: the current pair passed the complete choice -> result
  -> Space -> return -> next-card path, Statistics/check-in, Mine/logout, phone
  and short-code request, all reviewer states, console checks, 44 x 44 targets,
  and the 29-frame 100/130/160/200% containment audit without prompt/reviewer
  leakage or horizontal overflow.
- Scanner evidence: 20/20 regression tests plus full-tree metadata scanning
  pass. Learner documents fail closed on missing or fake markers; reviewer-only
  CSS/JavaScript remains outside learner scope only when reviewer audience is
  explicit; the real pair has an automated dependency and template-parity
  check.
- Boundary of this result: representative-person studies were not run and the
  product owner rejected the visual direction. React Native parity, native
  platform/assistive-technology, and release work must not start from this
  candidate. This result does not promote it.

### Phase 2 Final Correction Delta — Invalidated Historical Snapshot

Phase 2 corrects the six Phase 1 HTML blockers and the later-discovered surface
coverage gaps. The current code-native proof now provides:

- truthful empty/selected/correct/incorrect choice behavior, a second real
  fixture on `下一张`, and committed result -> Space -> result continuity;
- bounded four-route navigation with live Statistics and Mine destinations;
- repository-bound flip, multiple-choice, lock, elimination, and swipe
  silhouettes, with explicit audio remaining an enhancement of flip;
- one state-derived audio label/clock, measured double focus treatment, raised
  learner-facing type, exact contrast tokens, and a stable non-color
  spine/address cue;
- dedicated Auth, Statistics, Mine, membership, check-in, error/retry, and
  platform-composition hypothesis states;
- frozen proof SHA-256
  `98c1b28c6cf87d85bd92fe637a8789f59975bae83907246497294d1f72f87471`
  with 29 named frames; iOS and Android each have exact 320 / 360 / 393 / 430
  frames, and recorded 100%/200% audits have no horizontal overflow or visible
  interactive target below 44 x 44. The 393 x 852 Statistics frame measures
  11.8% unexplained blank area;
- P0-17 design coverage for evaluation, assessment, favorite, and sleep/wake
  pending/error/retry with preserved committed truth; Auth coverage for
  phone-invalid, code-expired, resending/cooldown, and separate request/verify
  network failures; restored focus plus route-live announcements;
- Lock/Elimination result-to-continuation CTA handoff and Swipe below/past-
  threshold drag, cancel, keyboard, and reduced-motion labeled-button paths;
- a product radius system of 8 px controls, 12 px surfaces, 20 px focal
  objects, plus pills, with device shells, iOS IME top corners, keycaps, and
  circular icons explicitly named as hardware/graphic evidence exceptions.

The historical independent review of that now-invalidated revision was
complete and reported every implementation- and browser-verifiable Phase A
P0/P1 item as passed. Formal Phase
A promotion remains **blocked**, however, because `P0-01`, `P0-04`, `P0-10`,
`P1-01`, `P1-03`, and `P1-07` require representative-person studies or an
explicit product-owner decision that no agent or automated test may fabricate.
RN was not changed; real iOS/Android/tablet, safe area/IME/back,
VoiceOver/TalkBack, native async/persistence, and release evidence remain Phase
B.

The independent reviewer observed all 29 frames at 100%, 130%, 160%, and 200%:
zero horizontal overflow, control-text clipping, navigation escape, or visible
target below 44 x 44. Tablet workspace utilization was 72.4%–96.5%; all 191
visible controls had accessible names; roles/states, keyboard and reduced-motion
paths, focus/live recovery, async preservation, contrast, and console checks
passed. `#557BBE` is approved only for its current non-text graphic role, and
the prototype's displayed 45-second resend wait is intentionally time-compressed
for testing; both constraints must remain explicit in a later native handoff.

### Phase 1 Strict Review Snapshot — Preserved

The code-native HTML materially improves the evidence over the earlier raster
sketches. It now proves a useful bounded design scope: exact contrast values,
320 / 360 / 393 / 430 responsive compositions, 100–200% type-scale switching,
tablet portrait and landscape compositions, audio loading/error/retry states,
the two-state flip gate, and sleep/wake error presentation. Those are real
post-code gains and must not be reported as still absent.

Strict review nevertheless found six current design blockers: answer truth,
full-width bottom navigation, focus contrast, undersized base text, an audio
clock that does not follow state, and collection identity that still depends
too heavily on hue plus generic labels. Product-owner acceptance remains open.

## Evidence Reviewed

| Ref | Evidence role | Durable observation |
| --- | --- | --- |
| C | [`mvr-15-soft-spine.html`](candidate-proofs/mvr-15-soft-spine.html#mvr-15) | Learner-only operable preview; SHA-256 `41a2143a5c011f08b4dd5cdedf04044e7836fc96dba254a9b0309ad430516722`. It mounts exactly one app and no reviewer cockpit. |
| C2 | [`mvr-15-review-harness.html`](candidate-proofs/mvr-15-review-harness.html#mvr-15) | Explicit reviewer-only 29-frame/state harness; SHA-256 `13bc7dff3cab1f699155d9a1143be266916b1562fe49873aa717d510e48820eb`. It is not a learner or leadership-demo route. |
| H | Historical combined proof; SHA-256 `98c1b28c6cf87d85bd92fe637a8789f59975bae83907246497294d1f72f87471` | Invalidated and quarantined after P0-09 semantic leakage was found. Its previous metadata and technical-pass conclusions do not transfer to C/C2. |

Early generated pre-code sketches were reviewed transiently, then excluded from
ordinary Git under the binary-evidence policy. They are not part of this durable
review, do not supersede C, and do not satisfy P0-08.

## Evidence Boundary

The content used by C is a repository-owned development fixture. That is
sufficient to test code-native composition against existing local data, but it
does not approve content for a formal beta, release, or launch cohort. Candidate
visual acceptance and formal content approval are separate decisions.

Likewise, production React Native work and physical-device execution are not
prerequisites for accepting a design artifact. The correct sequence is:

1. correct the design-proof blockers and obtain explicit product-owner
   acceptance of the exact candidate revision;
2. create a separate implementation PR that maps the accepted artifact to RN;
3. run real native assistive-technology and platform/device verification as
   implementation merge/release gates.

Representative-user task testing and code-native semantic/keyboard/focus/live
review belong to the corrected exact design proof before owner acceptance; they
do not require production RN. Real VoiceOver/TalkBack, device behavior, native
async, and persistence remain Phase B.

No step in that sequence has been skipped or inferred here.

## Pre-Code Snapshot Outcome

The raster-only review was blocked. It could illustrate composition, object
continuity, a proposed address aperture, and color-role intent, but it could not
prove content provenance, exact tokens, responsive behavior, actual state
changes, focus, targets, or platform behavior. The old raster-only P0/P1 counts
are therefore historical and must not be used as the current verdict.

## Phase 1 Post-Code Delta — Historical

The table below is preserved unchanged from the Phase 1 review. Its blocker
column is the input to Phase 2, not a current finding.

| Scope | Current HTML evidence | Delta verdict |
| --- | --- | --- |
| Source boundary | Choice and flip/audio states use repository-owned development fixtures; rasters remain excluded. | Closed for design-fixture use only; no formal content approval. |
| Exact contrast | The proof publishes exact foreground/background ratios for core text, collection colors, border, mint, and amber. | Core ledger present; focus-ring contrast remains a blocker. |
| Phone widths | Dedicated 320, 360, 393, and 430 CSS-width compositions are present, including single-column collapse at 320. | Closed for code-native design scope; not physical-platform evidence. |
| Type scaling | The interactive proof switches 100%, 130%, 160%, and 200%. | Reflow mechanism present; base 10–12 px text remains too small. |
| Tablet | Portrait 744 x 1133 and landscape 1133 x 744 compositions are present and are not a phone plus sidebar. | Closed for design composition scope; physical tablet validation is downstream. |
| Audio | Idle, loading, playing, error, and retry presentation are operable. | State coverage present; displayed elapsed time is not state-truthful. |
| Flip gate | The flip source reveals analysis before exactly `有把握` in mint and `再回看` in amber. | Closed for this design proof. |
| Space recovery | Active, sleeping, and wake-error states are switchable; the object remains owned by its holder. | Closed for static/operable design-state scope; server truth is downstream. |
| Mechanical checks | Search-run validator and metadata-leak checker pass on the current artifact set. | Closed for the checked revision only. |

## Phase 1 Strict Design Blockers — Historical

| ID | Blocker | Evidence | Required correction before owner acceptance |
| --- | --- | --- | --- |
| D-01 | Answer truth | Any option can be selected, or none selected, and `确认答案` still opens the same `答对了` result. The proof does not distinguish missing, wrong, and correct selection. | Disable submit until a selection exists; register the selected option; render truthful wrong/correct result, preserved selection, and matching analysis. |
| D-02 | Full-width bottom bar | The four destinations occupy a full-width device-bottom strip. It visually fuses app chrome with system-bottom chrome and revives the prohibited full-width tab-bar treatment. | Restore a bounded, intentional four-destination silhouette with safe-area separation and no covered content at every shown width/scale. |
| D-03 | Focus contrast | The focus ring uses a bright amber value, but the contrast ledger does not measure it against every white, pale, rose, indigo, mint, and amber surface on which it can appear. Several pairings are visibly weak. | Define surface-aware focus tokens and publish ≥3:1 non-text contrast for every composited focus pairing. |
| D-04 | Base type size | Multiple learner-facing labels and body regions begin at 10–12 px. Scaling to 200% does not make the 100% state acceptable. | Raise the base text hierarchy, then repeat 100–200% containment and action-reach checks. |
| D-05 | Audio clock truth | The state label can change to playing or error while the embedded `00:00 / 00:02` clock remains unchanged. State text and time therefore disagree. | Bind icon, busy/pressed state, elapsed time, duration, completion, and retry copy to one state source. |
| D-06 | Collection identity | The cross-collection proof changes hue and generic A/B labels while preserving nearly everything else. It does not establish a durable non-color collection cue. | Add a restrained non-color identity cue that survives grayscale and does not compete with the stable Softbook spine/address grammar. |

These are design-proof defects, not requests to begin RN implementation. The
candidate remains unpromoted until they are corrected and independently
re-reviewed.

## Phase 1 P0 Review — Historical

This table preserves the pre-correction classifications. The current delta is
recorded at the top and in `Phase 2 Current Gate Summary` below.

| ID | Current classification | Review finding |
| --- | --- | --- |
| P0-01 | Phase A evidence blocker | Representative-user task recognition has not been run against the exact code-native proof. It is required before design promotion and does not require RN implementation. |
| P0-02 | partial | One current task and one dominant action are present, but answer truth currently breaks the operation. |
| P0-03 | partial | Current task, result, recovery examples, and continuity are visible; the complete critical-state inventory is not covered. |
| P0-04 | partial | Multiple choice and flip are distinct; lock, elimination, and swipe are not part of C. |
| P0-05 | blocker | Flip semantics and audio recovery presentation are present; the audio clock is not truthful. |
| P0-06 | closed in HTML scope | Space shows current ownership, favorite, sleep, wake, and wake-error presentation without inventing a second collection. Runtime/server truth remains downstream. |
| P0-07 | partial | Learning ↔ Space actions are present, but exact identity/back-stack behavior belongs to implementation validation. |
| P0-08 | closed for development-fixture design proof | C uses repository-owned development fixtures. This is not formal content approval; A and B remain non-compliant composition sketches. |
| P0-09 | invalidated historical pass | The old checker missed dynamic and assistive learner copy. The old SHA is quarantined; the separate current pair passed a new review recorded above. |
| P0-10 | blocker | No product-owner acceptance exists and no promotion is claimed. |
| P0-11 | closed in HTML scope | 320 / 360 / 393 / 430 and both tablet orientations are present. Native safe-area, IME, and device behavior remain downstream. |
| P0-12 | blocker | 100–200% switching and reflow are present, but the base type hierarchy is undersized. |
| P0-13 | blocker | Core exact contrast is documented; focus contrast is incomplete. |
| P0-14 | partial | Several controls meet the intended geometry, but a complete target overlay and opposite-action audit are absent. |
| P0-15 | Phase A evidence blocker / Phase B downstream P0 | The exact proof still needs complete roles/names/states, keyboard/switch-equivalent paths, focus recovery, and live-update review before design promotion. Real VoiceOver/TalkBack operation remains a later native implementation P0. |
| P0-16 | partial | Icon/text redundancy exists for several states; grayscale, high-contrast, and reduced-motion parity are not proved. |
| P0-17 | partial | Audio error/retry and wake error are present; full network, duplicate-action, and server recovery require implementation testing. |
| P0-18 | Phase A evidence blocker / Phase B downstream P0 | Width compositions exist, but distinct iOS/Android system-chrome, safe-area, IME/back, focus, and screen-reader hypotheses still need complete review. Real native behavior requires the later implementation PR. |
| P0-19 | closed in Phase A HTML composition scope / Phase B downstream P0 | Dedicated tablet portrait/landscape design compositions are present; real native tablet containment, safe area, type, input/focus, and rotation remain implementation evidence. |
| P0-20 | Phase A evidence blocker / Phase B downstream P0 | Auth is absent from the current proof. Exact correction/error/recovery states must be linked before product-wide design promotion; native request/verify recovery remains implementation evidence. |
| P0-21 | blocker | Inline analysis order is present, but answer registration is not truthful. |
| P0-22 | partial | Design-state controls exist; process recreation and committed-state preservation are downstream implementation tests. |

## Phase 1 P1 Review — Historical

This table likewise preserves the pre-correction classifications.

| ID | Current classification | Review finding |
| --- | --- | --- |
| P1-01 | partial | Spine, layered edge, and address aperture are recognizable hypotheses; no-logo recognition remains a later validation item. |
| P1-02 | blocker | Brand/collection/semantic roles are separated in color, but collection identity is still palette-led. |
| P1-03 | blocker | The current object reads first, but the full-width bottom bar competes with the primary action and device chrome. |
| P1-04 | partial | Exact phone compositions exist; object/action occupancy and meaningless-blank ratios still need measured review after blocker correction. |
| P1-05 | partial | Space hierarchy is visible, though layered borders and holder depth remain visually dense. |
| P1-06 | blocker | Responsive reflow exists, but base type and focus treatment fail the strict visual/accessibility review. |
| P1-07 | Phase A evidence blocker | Result comprehension with representative users must be tested against the corrected exact proof before design promotion; production RN is not required. |
| P1-08 | partial | Low-cost continuity is represented; median real action paths require implementation. |
| P1-09 | Phase A evidence blocker | Statistics and Mine are absent. Exact linked surface/state proof is required before product-wide design promotion; it must not be invented by RN implementation. |
| P1-10 | Phase A evidence blocker / Phase B downstream P0 | Independent iOS/Android/tablet composition-hypothesis review is incomplete; physical native confidence follows the implementation PR. |
| P1-11 | partial | State causality is represented, but production motion and reduced-motion parity are not proved. |
| P1-12 | pass for search structure | `mvr-15` is registered, hard-filtered, pairwise-reviewed, and remains conditional; search structure does not equal acceptance. |

## Phase 1 Design-Acceptance Plan — Historical

Before the product owner can accept the exact design candidate:

1. correct D-01 through D-06 in the code-native proof;
2. re-run deterministic responsive, contrast, metadata, and search validators;
3. independently review the corrected answer states, navigation silhouette,
   focus system, type hierarchy, audio truth, and non-color collection cue;
4. complete exact roles/names/states, keyboard/switch-equivalent paths,
   focus/live-update behavior, and required interaction/surface state evidence;
5. run representative-user first-read, task, recovery, and result-comprehension
   sessions on the exact proof;
6. record the exact candidate revision and unresolved scope, including the
   remaining interaction silhouettes;
7. obtain an explicit human product-owner decision.

This stage does not require production RN code or physical-device execution.

## Phase 2 Historical Gate Summary — Superseded By P0-09 Quarantine

| Gate area | Current Phase 2 status |
| --- | --- |
| D-01 through D-06 | Corrected in the current HTML design-proof scope; the original findings remain above as historical evidence. |
| P0-02/03/05/07/11/12/13/14/20/21 | Passed independent technical review: truthful operation, Learning-Space return, 29 frames, exact iOS and Android 320/360/393/430 compositions, 100/130/160/200% width/type/target evidence, expanded Auth, and revised type/contrast/focus/audio states. |
| P0-04 | Five operable, structurally distinct silhouettes are present; the required five-person blurred-silhouette identification study remains unrun, so the formal gate is blocked. |
| P0-15/18/19 | Passed independent Phase A technical review for roles/names/states, keyboard/reduced-motion alternatives, focus/live recovery, route announcements, and deliberate iOS/Android/tablet composition hypotheses. Real VoiceOver/TalkBack and native platform evidence remain Phase B. |
| P0-17/22 | Evaluation, assessment, favorite, and sleep/wake pending/error/retry preserve committed truth; Auth adds phone-invalid, code-expired, resending/cooldown, and request/verify network recovery. These are deterministic design states; network/server/process persistence remains Phase B. |
| P1-02/04/05/06/08/09/10/11/12 | Passed independent technical review: authored color roles, bounded navigation, measured phone/tablet composition, revised focus/type, live Statistics/Mine, exact dual-platform width matrices, causal/reduced motion, and the 8/12/20-plus-pill product-radius system. |
| Phase A blockers | `P0-01`, `P0-04`, `P1-01`, `P1-03`, and `P1-07` await the specified representative-person studies; `P0-10` awaits exact product-owner acceptance. |
| Phase B blockers | RN parity, real iOS/Android/tablet, safe area/IME/back, VoiceOver/TalkBack, native async/persistence, and release evidence are not attempted by this design-only branch. |

## Downstream Implementation And Release Gates

Only after design acceptance, a separate implementation PR must provide:

- RN mapping without implementation-time visual invention;
- real iOS and Android safe areas, back behavior, IME, status/navigation chrome,
  and tablet orientation behavior;
- VoiceOver, TalkBack, keyboard/switch, live-region, and focus-order validation;
- runtime audio timing/loading/error/retry and sleep/wake server truth;
- duplicate-action, offline, retry, background/foreground, and restoration
  checks;
- full product Auth, Statistics, Mine, membership, and purchase recovery where
  required by release scope.

These remain blocking Phase B implementation merge/release evidence, but they
do not justify starting implementation before the design is accepted. Product-
owner design acceptance is not release approval and cannot waive them.

## Phase 1 Design Review Checklist Q1–Q6 — Historical

The answers below are preserved from the failed Phase 1 strict review. The
Phase 2 delta after them is the current checklist status.

### Q1 — Law of One

The rose current collection owns the primary task hue; the indigo collection
owns the separate flip/audio state; mint and amber remain self-assessment
semantics; green remains correctness. Softbook owns the light shell,
spine/address geometry, and small locator. This role split is clearer than the
rasters, but Q1 remains conditional because collection identity is still mostly
hue plus generic label.

### Q2 — Focal Object

The stacked current object remains the first read and its local action is close.
The full-width bottom bar creates a competing horizontal anchor and weakens the
intended object -> action -> continuity -> chrome order. Q2 is blocked until
the navigation silhouette is corrected.

### Q3 — Canonical Silhouettes

The code-native proof now distinguishes auto-scored multiple choice from flip,
and the flip reveals analysis before exactly two assessment choices. Lock,
elimination, and swipe are not shown. Q3 is partial and cannot be generalized to
all five interactions.

### Q4 — Forbidden Patterns

The mechanical metadata and search checks pass, and the rejected glass,
editorial-paper, dark-console, and gamified families are not revived. The
full-width bottom bar remains a concrete prohibited-pattern blocker.

### Q5 — Containment And Accessibility Layout

The proof now contains exact 320 / 360 / 393 / 430 widths, 100–200% scaling,
and dedicated tablet portrait/landscape compositions. This closes the
code-native composition scope. Base type and focus contrast still fail strict
review; native safe areas, AT, and physical-device behavior remain downstream.

### Q6 — Surface Rules

Flip uses exactly `有把握` in mint and `再回看` in amber. The auto-scored choice
flow does not insert those controls. However, it always advances to the same
correct result regardless of selection, so answer truth blocks Q6. Statistics
and primary module selection are not introduced by this proof.

## Phase 1 Independent Recommendation — Historical

Retain `mvr-15` as a conditional search leader only. Correct the six design
blockers in C, then repeat independent design review and request an explicit
product-owner decision. Do not call the current candidate accepted or promoted,
and do not begin RN implementation from this unaccepted artifact.

## Phase 2 Checklist — Historical Technical Result

- Q1: stable brand chrome/spine/address and public library naming provide a
  non-color cue alongside each current-library hue; independent technical
  review passed this construction. The formal no-logo recognition study remains
  open under P1-01.
- Q2: the current task remains focal and the corrected bounded navigation no
  longer behaves as a full-width device strip in the HTML proof.
- Q3: all five repository-bound silhouettes are present. Lock and Elimination
  hand the CTA to continuation only after result; Swipe covers below/past-
  threshold drag, cancel, keyboard, and reduced-motion button alternatives.
  This is not native gesture or production-motion evidence.
- Q4: the metadata/search checks pass on the current revision, corrected
  navigation no longer matches the prohibited full-width pattern, and product
  radii are limited to 8/12/20 plus pill with named hardware/graphic exceptions.
- Q5: 29 named frames include exact 320/360/393/430 matrices for both iOS and
  Android plus tablet orientations; recorded 100/130/160/200% audits show no horizontal
  overflow or target below 44 x 44, and Statistics blank area is 11.8%. Native
  containment remains Phase B.
- Q6: auto-scored flows do not use flip self-assessment; flip exposes exactly
  `有把握` / `再回看`; Statistics remains a restrained today ledger; no primary
  module picker is introduced.

The repaired pair passed this independent technical review, but the product
owner subsequently rejected the visual direction under `P0-10`. The final
lifecycle is therefore **rejected**, not conditionally blocked. Do not call it
accepted or promoted, do not run Phase B from it, and do not edit the frozen
proofs into a new candidate. A materially different replacement requires its
own exact proof and explicit product-owner acceptance.
