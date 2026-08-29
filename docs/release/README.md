# Release readiness records

This directory records operational launch state. It does not replace product
truth in `spec/`, test results, machine content authorization, or external account
verification.

The tracked contracts start fail-closed:

- `launch-readiness.v1.json` fixes the release scope and records launch gates.
- `external-account-readiness.v1.json` records external account capabilities.
- `scripts/validate_launch_readiness.mjs` derives readiness from those records.

`spec/machine-acceptance.json` gives the model-and-harness system standing
authority over internal launch decisions. No human, user, product-owner click,
or protected-reviewer Environment is required. High-risk release acceptance
uses two isolated machine runs over the same immutable input; execution and
verification carry distinct machine principals and `run_id` values. Trusted
default-branch code, exact-head binding, task-relevant checks, branch protection,
and automatic merge remain enforced.
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
artifacts, each bounded to 16 MiB by the repository loader. Larger or restricted
remote evidence must be represented by an
`agent-run-evidence.v1` repository manifest that the required
`evidence-archive` gate has independently verified.

The `sms-provider-smoke` type has a dedicated semantic contract. A real
two-phase send plus independently signed receiver evidence produces a PII-free
`sms-provider-smoke.v2` raw report below
`docs/release/evidence/raw/`; a formal `launch-gate-evidence.v1` wrapper must
bind that report to the exact launch candidate, receiver environment, campaign,
execution window, receiver adapter and public-key fingerprint, independent
machine verifier/run, attestation, byte size, and SHA-256. The raw report alone
cannot satisfy the gate. The wrapper also remains ineligible until a
pre-existing receiver key registry and deployed IAM attestation are registered;
the current repository intentionally fails closed on that missing trust root.

The four CET4 formal content evidence types use a two-layer proof. A GitHub
Artifact Attestation for `trusted-media-run-receipt.v2` binds the fixed Card Make
main workflow that consumed all 301 audio byte sequences. The closed-beta
validator separately re-hashes and recomputes the exact authorization, model
review, zero-blocker audit, three runtime shards, 1180-card content payload,
release bundle, audio manifest, QC index, and all 27 formal QC records. An
attestation alone, a count-only report, or a path/hash-only summary cannot pass.

External account capabilities and the accepted box/card coverage reports must be
verified by the tracked machine authority, `service:softbook-machine-harness`.
Evidence from Apple,
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
identity fields and portal bytes are metadata. Provider control-plane, official
registry, and public-endpoint state remain objective external facts and fail
closed when absent even when machine acceptance is valid.

Green CI does not create external evidence, verify an external account, or make
the product launch-ready. Internal subjective acceptance is automated; objective
integrity, security, recoverability, deployment, and external-provider gates are
not removed to satisfy the schedule.
