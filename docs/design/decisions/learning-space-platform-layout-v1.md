# Learning + Space Platform Layout Decision v1

## 当前任务引用的 spec

- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/decisions/learning-space-direction-decision-v1.md`
- `docs/design/decisions/learning-card-rhythm-decision-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`

## Decision

Accept platform-specific layouts for Learning and Space. Do not stretch the phone UI to tablet or pc web.

## Product Truth

- Top-level navigation remains `learning / space / statistics / mine`.
- Learning remains system-sequenced single-card flow.
- Space remains top-level physical hierarchy.
- PC means web on personal-computer-sized screens, not a native desktop client.

## Tablet Layout

### Learning

Use a two-pane composition:

```text
left 68%: current addressed card object and interaction plane
right 32%: address aperture, light tools, study continuity cue, Space return cue
bottom: same top-level navigation order in a restrained rail or capsule
```

Rules:

- primary card object still owns first read;
- interaction silhouette must not become a dashboard;
- side context cannot become module selection;
- touch remains primary, keyboard support may exist as secondary.

### Space

Use a shelf + inspector composition:

```text
left 62%: library / group / box hierarchy with current box focus
right 38%: selected card or box inspector
bottom or side: same top-level navigation order
```

Rules:

- hierarchy stays visible;
- selected card keeps original box ownership;
- favorite remains tag;
- sleep zone remains a state area, not a replacement library.

## PC Web Layout

### Learning

Use a centered workbench:

```text
center max-width: current card object and interaction plane
left rail: top-level navigation
right rail: address aperture, tools, keyboard hints, Space continuity
```

Rules:

- keyboard and mouse mappings preserve interaction meaning without forcing literal touch gestures;
- current card object stays visually dominant;
- no multi-card grid or module-first picker as the default entry.

### Space

Use a map workbench:

```text
left rail: library / group tree
center: current box and card objects
right panel: selected object inspector, favorite tag, sleep / wake action
```

Rules:

- Space can take advantage of width, but cannot become a table or analytics board;
- box inspect is primary, arbitrary drag reassignment remains disallowed;
- return-to-Learning stays visible.

## Breakpoint Guidance

- phone: `<= 599px`, single column, floating capsule navigation;
- tablet: `600px - 1023px`, two-pane layout;
- pc web: `>= 1024px`, workbench with side rails.

These are implementation hypotheses. Product truth is the device-class-specific information architecture, not exact pixel breakpoints.

## Design Review Checklist Answers

Q1: Current library remains the only dominant accent across all device classes.

Q2: Learning focal object remains the current card; Space focal object remains current box or selected card.

Q3: Learning preserves interaction silhouettes; Space preserves hierarchy -> focus -> inspector silhouette.

Q4: No forbidden patterns are introduced; this is a layout decision document.

Q5: No rendered viewport is included in this artifact; containment is delegated to implementation mapping and mocks.

Q6: Learning remains system-sequenced; module selection is not promoted to primary path.
