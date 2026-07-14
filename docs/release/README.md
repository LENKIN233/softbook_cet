# Release readiness records

This directory records operational launch state. It does not replace product
truth in `spec/`, test results, formal content approval, or external account
verification.

The tracked contracts start fail-closed:

- `launch-readiness.v1.json` fixes the release scope and records launch gates.
- `external-account-readiness.v1.json` records external account capabilities.
- `scripts/validate_launch_readiness.mjs` derives readiness from those records.

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
