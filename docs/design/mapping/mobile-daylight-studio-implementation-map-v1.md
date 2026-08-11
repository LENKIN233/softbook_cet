# Mobile Daylight Studio V1 Implementation Map

## Design authority

Consume the accepted learner proof and interaction atlas named in `docs/design/decisions/mobile-daylight-studio-v1.md`. This map does not authorize production changes until the design PR is merged.

## Token mapping

- stable brand: violet `#6047C6` / deep `#46309F`;
- sample current hall: canonical index 1 hue from `spec/visual-language.json#implementation_hypothesis.palette.library_identity_hex_defaults`; the HTML expresses the exact default as RGB and marks `data-canonical-hall-index="1"` to avoid treating coral as a generic current-state color;
- page and task: `#F6F5FF` and opaque white;
- body ink: `#1C1630`; secondary ink `#443A59`; muted `#665D78`;
- flip confident: mint `#22C58B`; flip review: amber `#F5B100`;
- radii: 13–18 controls, 20–30 focal surfaces; circles only for dots/avatars/switch thumbs.

## Surface mapping

- app chrome and routes → mobile app shell and top-level navigation;
- learning heading/progress/current task → `LearningSurface` and shared progress region;
- 2×2 choice/result/continuation → existing choice interaction family;
- flip/audio/reveal/two assessments → existing flip family and explicit audio control;
- lock/elimination/swipe → their existing family components, using atlas silhouettes;
- topic/group/box/card and later-learning zone → `SpaceSurface` hierarchy;
- ledger → Statistics surface; account, membership, auth sheets → Mine/Auth surfaces.

The generic `当前馆 / 当前组 / 当前盒` labels are design-proof placeholders, not a replacement taxonomy. Production must resolve the canonical names and hierarchy from `spec/knowledge-map.json` and `spec/box-catalog.json`; it must never rename those owners from the design file. The seven small hall dots keep the canonical identity order, while only index 1 may dominate this exact sample screen.

## Responsive mapping

Phone uses compact vertical rhythm and a safe-area floating bottom navigation. Tablet uses a left rail and broad single-column Learning canvas. Desktop adds a bounded contextual region beside the task. Space may use a two-column topic/content composition from tablet upward.

## Verification expectations

Verify 320/360/393/430 phone widths, tablet portrait/landscape, desktop web, dynamic type, safe areas, IME/back, reduced motion, VoiceOver/TalkBack labels, and no document-level horizontal overflow. Real iOS, Android, and web startup/interaction proof is required before the implementation PR can merge.

## Prohibited reinterpretation

Do not substitute black/grey theme, translucent glass, paper surfaces, full-width bottom bars, independent audio card families, four-level self-assessment, red review state, or generic dashboard modules.
