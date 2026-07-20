# Release readiness records

This directory records operational launch state. It does not replace product
truth in `spec/`, test results, formal content approval, or external account
verification.

The tracked contracts start fail-closed:

- `launch-readiness.v1.json` fixes the release scope and records launch gates.
- `external-account-readiness.v1.json` records external account capabilities.
- `scripts/validate_launch_readiness.mjs` derives readiness from those records.

Changes to launch contracts, evidence, readiness validators, or the formal
approval workflow are classified by trusted default-branch code in
`.github/workflows/formal-approval.yml`. Those changes require the protected
`formal-product-owner-approval` GitHub Environment before the `formal-approval`
check can pass. That environment requires `github:LENKIN233` and disables
administrator bypass. A `verified_by` value inside the pull request is metadata
only; it is not the authenticated product-owner approval. Branch protection
requires the final `formal-approval` status, while the full Harness and weekly
repository-health run independently verify the Environment configuration.
Those remote checks also require `main` as the default branch, enabled
auto-merge, automatic deletion of merged topic branches, and squash-only merge
methods. A mismatch fails closed instead of relying on an administrator merge.
The weekly and manually dispatched remote health run uses the repository secret
`REPO_HEALTH_TOKEN`, scoped only to this repository with `Administration: read`
and `Actions: read`; the built-in Actions token cannot read branch protection.
The secret is injected only when the scheduled or manually dispatched workflow
runs trusted `refs/heads/main` code. Pull requests, pushes, and dispatches from
any other ref cannot access it; untrusted remote dispatches fail closed.

A gate can be `passed` only when it contains every evidence type defined by the
validator. Evidence is structured, identifies its verifier and verification
time, and binds a tracked `repo://<path>` artifact to its byte size and SHA-256.
Each required evidence type must use a distinct artifact. The CLI rejects
symlinks, re-hashes every artifact, and limits ordinary Git evidence records to
1 MiB.

External account capabilities and the approved box/card coverage reports must be
verified by the tracked product owner, `github:LENKIN233`. Evidence from Apple,
Tencent Cloud, payment portals, filing systems, or security vendors must first
be archived as a redacted repository artifact; never commit secrets or private
account data. Large or restricted remote assets must use an
`agent-run-evidence.v1` manifest, which is independently downloaded and hashed by
the required `evidence-archive` gate. Evidence and account verification must be
refreshed within 180 days of the validation run.

Green CI does not create evidence, approve content, verify an external account,
or make the product launch-ready. If schedule and a gate conflict, move the
release date; do not delete the gate or reduce its required evidence.
