# Learning + Space Phone Frames v1

## 当前任务引用的 spec

- `spec/product-core.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/decisions/learning-space-direction-decision-v1.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`
- `docs/design/physical-space/space-model-v1.md`
- `docs/design/mapping/learning-space-implementation-map-v1.md`

## Target Surface

- Surface: Learning and Space
- Device class: phone
- Frame: `393 x 852`
- Current library: current
- Display accent: display accent, used as the only dominant accent on both frames
- Rendered asset: `docs/design/mocks/learning-space-phone-frames-v1.html`

## Product Truth

Learning remains a system-sequenced single-card flow. Space remains a top-level physical hierarchy with library / group / box / card structure. These phone mocks do not authorize new product operations.

## Implementation Hypothesis

The accepted `Addressed Exam Object` direction is represented as two exact phone frames:

- Learning frame: current card object is first read, interaction plane is a 2x2 multiple-choice grid, tools are secondary, and the address aperture stays compact.
- Space frame: current box is first read, parent context remains visible, sibling cards are inspectable, favorite and sleep are states on card objects rather than replacement boxes.

## First-Read Path

Learning:

```text
current library chip -> current card object -> 2x2 answer grid -> secondary tools -> address aperture -> floating navigation
```

Space:

```text
library/group context -> current box focus -> card objects and states -> sleep zone -> return to Learning -> floating navigation
```

## Dark-Mode Rendering Proof

The rendered asset contains both day and night frames. The night frame keeps the same hierarchy instead of inventing a second layout:

- same current card object and current box object;
- same dominant display accent;
- rim-light / low-alpha panels replace day shadow emphasis;
- no pure `#000` / `#fff` text or surface dependency.

## Accessibility Contrast Proof

The mock uses text colors that clear WCAG AA against their immediate surfaces:

| Pair | Foreground | Background | Ratio | Result |
|---|---:|---:|---:|---|
| primary text on day panel | `#12121A` | `#F8F8FB` | 17.1:1 | pass |
| muted text on day panel | `#4F5062` | `#F8F8FB` | 7.6:1 | pass |
| primary text on night panel | `#F2F2FA` | `#1C1C2A` | 13.9:1 | pass |
| muted text on night panel | `#BDBDD0` | `#1C1C2A` | 8.2:1 | pass |
| current chip text on low-alpha day chip | `#6B2D00` | `#EEF3F4` | 8.6:1 | pass |
| current chip text on low-alpha night chip | `#FFD7BA` | `#31251F` | 9.4:1 | pass |

Low-alpha library chips use ink chosen for the computed chip background, not the raw accent hue.

## Known Gaps

- This artifact is a rendered mock, not RN code.
- It does not decide tablet or pc web layout; those are handled by `docs/design/decisions/learning-space-platform-layout-v1.md`.
- It does not encode motion behavior; motion is handled by `docs/design/storyboards/learning-space-motion-prototype-v1.md`.

## Design Review Checklist Answers

Q1: Current library is represented by the anonymous current-library slot, and the display accent is the only dominant accent. Other libraries are absent or demoted to low-weight labels.

Q2: Learning focal object is the current card. Space focal object is the current box. First-read paths are explicit above.

Q3: Learning frame uses the multiple-choice silhouette: prompt top plus 2x2 option grid. Space uses hierarchy -> box focus -> card-state silhouette.

Q4: No forbidden patterns are used: no gradient text, gamification chrome, full-width bottom tabbar, removed self-assess tokens, or serifs.

Q5: Phone frame containment is fixed at `393 x 852`; safe-area top, bottom capsule nav, and CTA/option areas stay inside the frame.

Q6: The Learning frame is multiple-choice, so it uses auto scoring and does not show flip self-assess. Module selection is not exposed as the primary path.
