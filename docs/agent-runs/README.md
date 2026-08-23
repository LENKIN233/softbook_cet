# Agent Run Records (Frozen Archive)

This directory preserves historical agent-run records. New pull requests do not
add records here. The active delivery record is the concise pull request body,
exact-diff model review, and required checks. Real external operations use their
registered release, deployment, device, or provider evidence schema.

They do not create product truth. Product truth remains in `spec/*` owner files.
Run records explain how a task used those owners.

## New-record policy

Do not create a new tracked run record for ordinary repository work. Keep the
historical files immutable unless repairing a proven archive-integrity defect.

## Required filename

Use:

```text
docs/agent-runs/YYYY-MM-DD-<short-slug>.md
```

PRs no longer reference this directory as a merge gate.

## What not to include

Do not include hidden chain-of-thought, secrets, tokens, credentials, private user
data, or raw logs that contain sensitive material. Record facts, commands,
validation results, decisions, risks, and follow-up items.

## Binary evidence

Do not commit screenshots, screen recordings, or generated visual evidence.
Capture them under the ignored `docs/agent-runs/artifacts/` directory, publish
an immutable archive, and commit an `agent-run-evidence.v1` manifest under
`docs/agent-runs/evidence/`. The manifest records archive and per-file hashes so
the run remains auditable without growing ordinary Git history.
