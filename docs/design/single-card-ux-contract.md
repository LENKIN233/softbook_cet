# Softbook CET Single-Card UX Contract

## Product Truth

Single-card flow means the learner works through one current CET card with a
clear task, clear feedback, and low operation cost. It does not mean every control, explanation, statistic, navigation option, and state must fit into one static screen.

The flow is valid only when the user can operate it.

## Non-Goals

Single-card flow is not:

- one screen that contains the whole product
- a dashboard with a card in the middle
- a module picker as the primary path
- a dense information poster
- a screenshot-only composition with no touch priority
- a card carousel that hides the next action
- a stats page disguised as learning

## Required Interaction Structure

Every Learning card state must define:

- `current_card`: the single focal object.
- `primary_task`: what the user should do now.
- `primary_action`: the strongest available action.
- `secondary_actions`: at most three low-noise actions.
- `feedback_state`: what changed after action.
- `escape_or_recovery`: skip, back, retry, or safe exit when applicable.
- `space_continuity`: how the card position or state relates to Space.

If a state cannot name these fields, it is not ready for visual implementation.

## Operable Layout Model

The minimum operable phone layout is:

- top context: light progress and current library, never a dashboard.
- focal card: the main reading or interaction object.
- action zone: stable thumb-reachable primary action area.
- feedback layer: appears after action, not before it steals attention.
- continuity cue: a small connection to Space when relevant.

This can scroll when content requires it. The rule is not "everything above the
fold"; the rule is "the current task and primary action are always findable."

## Touch Priority

Primary action must be visually and spatially dominant. Secondary actions must
not compete with the current card task.

Do not present more than one primary decision at the same time. For `flip`,
self-assess remains exactly two choices: `有把握` and `再回看`.

## Feedback Rules

Feedback should answer:

- Did my action register?
- What is the result?
- What can I do next?
- Did this change where the card belongs in Space?

Feedback must not expose algorithms, queues, sync details, metadata, or raw
runtime failures.

## Learning To Space Continuity

Space is not a side page for storage. A Learning action may create or reveal:

- a library identity
- a group or box address
- a favorite tag
- a sleep or wake state
- a current-card position

The UI should make this continuity legible without turning Learning into a map
screen.

## Review Checklist

Before accepting a Learning or core interaction design:

- Is there exactly one focal card or interaction object?
- Is the primary task visible without reading system explanation?
- Is the primary action thumb-reachable on phone?
- Are secondary actions quiet and bounded?
- Does feedback explain learner outcome rather than internal process?
- Does the screen avoid dashboard density?
- Does the design preserve the system-sequenced learning path?
- Does it state the Learning to Space continuity when relevant?

If any answer is no, the artifact remains `candidate_exploration` or becomes
`quarantined`.
