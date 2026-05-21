# Agent Run Records

Agent run records are durable project context for significant agent-authored work.
They preserve what was changed, which specs were used, what was verified, and
what remains risky after context compression.

They do not create product truth. Product truth remains in `spec/*` owner files.
Run records explain how a task used those owners.

## When to create one

Create a run record for PR-bound work that changes any of these surfaces:

- repository governance
- harness or CI behavior
- user-facing UI or design authority
- runtime, backend, or mobile behavior
- card content handoff boundaries
- multi-file refactors

Local-only work may omit a committed run record only when the user explicitly
asks for no PR. The final answer should still state the same facts.

## Required filename

Use:

```text
docs/agent-runs/YYYY-MM-DD-<short-slug>.md
```

## Required PR body reference

Every PR governed by this policy must include:

```markdown
## Agent run record

- Run record: docs/agent-runs/YYYY-MM-DD-<short-slug>.md
```

## What not to include

Do not include hidden chain-of-thought, secrets, tokens, credentials, private user
data, or raw logs that contain sensitive material. Record facts, commands,
validation results, decisions, risks, and follow-up items.

## Template

Use `docs/agent-runs/TEMPLATE.md`.
