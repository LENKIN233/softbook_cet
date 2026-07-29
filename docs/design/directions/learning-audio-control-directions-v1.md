# Learning Audio Control Directions v1

## 当前任务引用的 spec

- `spec/requirement-memory.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`
- `docs/design/decisions/learning-card-rhythm-decision-v1.md`

## Product Truth

Audio is a card resource, not an interaction family. It never auto-plays, does not require front-side subtitles, and must remain secondary to the current CET task.

## Shared Constraints

- The current library uses indigo as its only strong accent.
- The addressed current card remains the focal object.
- The control must fit inside the card object at a 320dp phone width.
- Visible states use human language, never cache, URL, hash, runtime, provider, or download terminology.
- No waveform animation, playback queue, speed picker, scrubber, or background-media chrome.

## Direction A — Editorial Margin Note

The play action appears as a quiet text row beneath the task, similar to an annotation in an exam workbook.

- Strength: strongest content authority and lowest decorative weight.
- Risk: looks passive and can be missed when audio is the primary front-side material.
- Rejected fragment: a thin divider makes the audio feel detached from the card object.

## Direction B — Attached Audio Chip

A compact rounded chip sits inside the task plane. Its icon, short verb, and restrained progress ring behave as one attached card resource.

- Strength: clear one-tap action without becoming a transport bar.
- Strength: supports waiting, playing, paused, and retry copy in the same footprint.
- Risk: a saturated fill would compete with the question; use tinted material and an indigo rim instead.
- Accepted direction.

## Direction C — Transport Shelf

A small shelf beneath the card contains play, elapsed time, and a progress line.

- Strength: familiar media control.
- Risk: creates a second focal plane, resembles a podcast player, and increases operation burden.
- Rejected completely for the closed-beta Learning surface.

## Decision Input

Direction B wins because it makes the explicit action unmistakable while preserving the current card as the only focal object. Direction A contributes its editorial restraint. Direction C contributes no visible transport chrome.

## Design Review Checklist

- Q1: The current library is visually explicit; indigo is the single strong accent.
- Q2: The current exam card remains focal. First read is task → attached audio chip → quiet card tools → shell chrome.
- Q3: Core interaction silhouettes remain unchanged because audio is an optional resource attached inside the current interaction.
- Q4: No forbidden patterns: no gradient text, gamification, full-width tab bar, pure black/white, serif, or removed self-assess tokens.
- Q5: The accepted chip must remain contained at 320dp with safe-area and no horizontal overflow.
- Q6: Learning remains system-sequenced; flip still has exactly `有把握` / `再回看`, and audio adds no self-assessment.
- AP-22: These six answers are recorded before rendering the mock.
- AP-23: This direction does not change the two-state mint/amber flip self-assess model.
