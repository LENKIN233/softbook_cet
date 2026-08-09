# Mobile Visual Rebuild V4 — Exact Browser Evidence

## Evidence Boundary

- Date: 2026-08-08.
- Audience: reviewer evidence only.
- Exact cohort: `candidate-proofs/mvn-01-native-focus.html` through
  `candidate-proofs/mvn-08-adaptive-workspace.html`.
- Harness: `candidate-proofs/reviewer-gallery.html` loads each exact learner
  document in a same-origin iframe; the gallery itself is not learner UI.
- This evidence measures browser behavior. It is not a native safe-area, IME,
  OS text-scaling, VoiceOver/TalkBack, physical-device, or production-audio
  result.

## Narrow 200 Final

### Reproduction URL

Serve the repository root at `http://127.0.0.1:4173`, then open:

```text
http://127.0.0.1:4173/docs/design/search-runs/2026-08-08-mobile-visual-rebuild-v4/candidate-proofs/reviewer-gallery.html?platform=<ios|android>&viewport=narrow&route=learning&interaction=<flip|multiple_choice|lock|elimination|swipe>&text=large
```

The reviewer gallery's `narrow` state sets each iframe to exactly 320 × 844
CSS pixels. Its `text=large` query is propagated to the learner URL; the shared
learner runtime applies `body.large-text`, and `learner-core.css` defines that
state as `font-size: 200%`.

### Matrix

- 8 exact candidates;
- 2 platform hypotheses: iOS and Android;
- 5 Learning interaction families;
- 80 total initial-state frames at 320 × 844 with browser text at 200%.

For every iframe, the real browser inspection measured:

- `window.innerWidth`, document `clientWidth`, and document `scrollWidth`;
- `body.large-text` and `data-audience="learner"`;
- exactly one visible `learning` route and the requested interaction family;
- all visible button/input/select/textarea rectangles;
- minimum target height, horizontal viewport escape, and clipped control
  content.

Failure conditions were any width other than 320, `scrollWidth > clientWidth`,
missing large-text/audience state, wrong or multiple visible routes/interactions,
no visible controls, an iOS target below 44px, an Android target below 48px, a
control rectangle outside the 320px viewport, or clipped control content.

### Result

- Cases: 80 / 80 passed.
- `innerWidth = clientWidth = scrollWidth = 320` in every case.
- Minimum visible-control height: iOS 44px; Android 48px.
- Horizontal out-of-bounds controls: 0.
- Clipped control labels/content: 0.
- Route/interaction mismatches: 0.

This closes only the exact browser 320px + 200% reflow floor. It does not satisfy
the blueprint's broader native survival bar, so the candidates remain
quarantined comparison evidence and none advances.

## Phone Terminal Evidence

The final exact-browser interaction pass also exercised every candidate at
390 × 844 for iOS and Android. It found no horizontal page overflow, no primary
CTA/bottom-navigation overlap, 44px iOS and 48px Android active-control floors,
and 2 × 2 multiple-choice layout. These terminal states remain browser-framed
hypotheses, not native-device evidence.

## Tablet Lock Evidence

For `mvn-08` only, the exact 1024 × 768 Lock state kept its CTA within the first
viewport at y=671–719 on iOS and y=689–737 on Android. This does not substitute
for complete tablet proof across the other candidates, interactions, routes, or
native platforms.
