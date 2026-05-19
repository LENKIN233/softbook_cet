# Learning Card Rhythm Decision v1

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/directions/learning-card-rhythm-directions-v1.md`
- `docs/design/interaction-motion/learning-core-interactions-v1.md`

## Decision

Accepted design rhythm:

```text
Guided Addressed Card Rhythm
```

This accepts `Direction B: Addressed Object Rhythm`, with two constraints:

- Use `Direction A` for CET prompt and analysis authority.
- Use `Direction C` for speed and low operation burden.

## Product Truth

The accepted rhythm must preserve:

- Learning is the primary system-sequenced single-card flow.
- The user is guided by the system, not asked to manage modules first.
- The current card is a CET knowledge object with a visible but light spatial address.
- Core interactions keep their specified operation models and silhouettes.
- `hint_layer` remains attached to another interaction.
- Audio remains a content medium, never a separate interaction family.
- flip self-assess has exactly two states: `有把握` and `再回看`.
- User-facing states must not expose implementation metadata, data-source labels, internal identifiers, or queue/cache/runtime language.

## Implementation Hypothesis

The Learning surface should feel like:

> The system places one addressed CET card in front of the user, asks for one low-cost action, then quietly records the result and moves the card's learning state forward.

This is not a component tree. It is the state rhythm that future UI implementation must preserve.

## Accepted Rhythm

### 1. Place

The system presents one current card object with:

- current CET track and library context;
- one strong library accent;
- a short, human-readable location clue;
- no module picker, debug label, data source, or internal id.

The user should understand: "this is the card I need to handle now."

### 2. Focus

The interaction-specific task becomes first-action clear:

- `flip`: read front, then reveal back.
- `multiple_choice`: choose from a 2x2 option grid.
- `lock`: solve vertical lock rows.
- `elimination`: remove wrong candidates with visible strike state.
- `swipe`: choose direction on the top object.

Secondary tools remain visible but quiet.

### 3. Support

Support actions help without changing the task:

- `hint` reveals an attached layer and never solves the card.
- `peek` gives a small knowledge/location clue and does not open a management page.
- `favorite` marks the card as a tag state and does not move it into a box.

If support content is absent, do not show a placeholder panel.

### 4. Resolve

The card resolves according to its interaction:

- Auto-scored interactions show answer state and exam-oriented explanation.
- flip reveals the back and then offers only `有把握` / `再回看`.
- Wrong answers are corrections, not punishment states.
- Correct answers are confirmation, not reward bursts.

### 5. Settle

The result settles back into the current card's learning state:

- use human copy such as "已记录本次结果" or "稍后会自动同步";
- keep any retry action tied to continuing study;
- never expose internal transport, payload, source, cache, queue, or runtime wording.

The user should understand that the product handled the bookkeeping.

### 6. Continue

The next card or review step enters with continuity:

- the current card can move on without making the user inspect statistics;
- Space remains available as location continuation, not as a required detour;
- no primary module selection appears between cards.

## Non-Ideal State Rhythm

### Loading

Keep the current learning surface skeleton shaped like one card object. Do not replace it with a generic full-screen spinner unless the whole app shell is unavailable.

### Empty Or Temporarily Unavailable Card

Explain that the current study set is not ready and offer retry or return to the main Learning entry. Do not show seed, payload, card count, source id, or content handoff labels.

### Remote Or Sync Problem

Keep study continuity visible where possible:

- "网络恢复后会自动再试" is acceptable.
- "队列 / cache / payload / remote source / runtime config" is not user-facing copy.

### Permission Or Membership Gate

Gate the missing depth as product capability:

- complete card library;
- smarter guidance;
- physical space depth.

Do not describe entitlement checks, feature flags, or repository modes.

## Rejected Alternatives

### Pure Exam Page Rhythm

Rejected as primary because it can make spatial continuity feel like a footnote. Keep its prompt and analysis discipline.

### Pure Fast Action Rhythm

Rejected as primary because it can erase the addressed-card worldview and look like a generic drill app. Keep its speed.

### Engineering State Rhythm

Rejected completely. UI states must not be organized around card ids, data sources, queue status, runtime mode, repository names, or mock/seed labels.

## Acceptance Criteria For Future Implementation

A future Learning UI PR is aligned only if:

- the first read is one current card object, not a module chooser or system panel;
- primary action is the interaction, not `peek`, stats, sync, source, or Space management;
- support actions stay secondary and attached to the card object;
- flip uses only `有把握` / `再回看`;
- auto-scored interactions do not ask for self-assessment;
- no internal identifiers or data transport terms appear in user-visible copy;
- errors preserve learning continuity and do not expose implementation layers;
- design review checklist answers name this artifact or its successor.

## Design Review Checklist Answers

Q1: Current library accent remains the only strong accent; this artifact does not introduce a second color system.

Q2: Focal object is the current addressed CET card. First-read path is place -> focus -> support/resolve -> settle -> continue.

Q3: The rhythm requires the canonical silhouettes in `spec/visual-language.json#interaction_silhouettes`.

Q4: No forbidden visual patterns are introduced. Metadata-first UI and game reward chrome are explicitly rejected.

Q5: Not applicable; no phone frame is rendered in this decision.

Q6: flip keeps two self-assess states, stats are not introduced, and module selection is not the primary learning path.
