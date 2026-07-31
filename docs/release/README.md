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
1 MiB. Formal semantic reports may reference only re-hashable `repo://` raw
artifacts. Large or restricted remote evidence must be represented by an
`agent-run-evidence.v1` repository manifest that the required
`evidence-archive` gate has independently verified.

The `sms-provider-smoke` type has a dedicated semantic contract. A real
two-phase send produces a PII-free `sms-provider-smoke.v1` raw report below
`docs/release/evidence/raw/`; a formal `launch-gate-evidence.v1` wrapper must
bind that report to the exact launch candidate, receiver environment, campaign,
execution window, human verifier, independent attestation, byte size, and
SHA-256. The raw report alone cannot satisfy the gate.

External account capabilities and the approved box/card coverage reports must be
verified by the tracked product owner, `github:LENKIN233`. Evidence from Apple,
Tencent Cloud, payment portals, filing systems, or security vendors must first
be archived as a redacted repository artifact; never commit secrets or private
account data. Large or restricted remote assets must use an
`agent-run-evidence.v1` manifest, which is independently downloaded and hashed by
the required `evidence-archive` gate. Evidence and account verification must be
refreshed within 180 days of the validation run.

A ready external capability uses `external-capability-evidence.v1`, binds the
exact reachable repository commit, target release, policy hash, account and
capability, and satisfies the common plus capability-specific control-plane
checks from `spec/release-operational-policy.json`. The semantic report and each
referenced redacted raw artifact are tracked and re-hashed. The report fixes
`capability_eligible=true` and `gate_eligible=false`: it proves a reviewed
provider, registry, or public-endpoint capability record, and cannot replace
runtime, payment, distribution, compliance, or security launch gates. Report
identity fields and portal bytes are metadata; only the protected
`formal-product-owner-approval` Environment authenticates product-owner
approval for the exact pull request head.

Green CI does not create evidence, approve content, verify an external account,
or make the product launch-ready. If schedule and a gate conflict, move the
release date; do not delete the gate or reduce its required evidence.
