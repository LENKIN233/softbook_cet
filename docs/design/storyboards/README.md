# Storyboard Artifacts

## 当前任务引用的 spec

- `spec/interactions.json`
- `spec/space-operations.json`
- `spec/visual-language.json`
- `docs/design/design-harness.md`

## Purpose

This folder holds accepted motion storyboards for interaction flows, spatial transitions, and state changes.

Storyboards are the bridge between product semantics and animation implementation. They show what changes, why the motion helps the user understand it, and what fallback exists when motion is reduced.

## Required Contents

Each artifact must state:

- start state;
- user action;
- system feedback;
- end state;
- semantic reason for the motion;
- duration range and easing family when known;
- interruptibility;
- reduce-motion fallback;
- failure states or cancellation behavior.
