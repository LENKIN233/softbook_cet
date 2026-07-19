# Agent Run Record: remote evidence archive verification

## Task summary

- Date: 2026-07-19
- Branch: `fix/align-react-renderer-19-2-7`
- PR: https://github.com/LENKIN233/softbook_cet/pull/423
- Trigger: strict PR profile timed out while verifying the 162 MB pre-cutover evidence archive.
- Summary: Preserve full remote SHA-256 and byte-size verification while using GitHub's authoritative Release asset digest when available, and make the fallback transfer terminate before its parent gate timeout.

## Referenced specs

- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- N/A. This is delivery Harness and historical evidence verification only.
- No product behavior, card content, formal content approval, membership state, or launch-readiness state changes.

## Implementation hypothesis changed

- A green remote-evidence gate must prove the current remote asset SHA-256 and byte size; an HTTP success or HEAD response is insufficient.
- GitHub Release asset metadata provides a server-calculated `sha256:` digest and byte size for an uploaded immutable asset identity. Matching both values against the committed index provides the same full-file integrity claim without repeatedly transferring 162 MB.
- Non-GitHub archives and GitHub assets without a digest still require full streamed SHA-256 validation.
- A fallback child transfer must end before the local gate's 180-second process-group timeout so failures remain structured and diagnosable.

## Workspace boundary and read scope

- Active source read: the referenced specs, evidence validator and tests, local-gate catalog and tests, evidence workflow, and the committed pre-cutover index.
- Generated/dependency/cache read: ignored local-gate logs were read only to diagnose the timeout; the archived screenshots were not loaded as active product context.
- Remote read: GitHub Release metadata and a 1 MiB byte-range probe were used to establish asset digest support, reachability, and observed transfer rate.
- External workspace read: none; `/Users/lenkin/programing/card make` is outside this Harness-only correction.

## Files changed

- `scripts/validate_agent_run_evidence.mjs`: resolve public or authenticated GitHub Release metadata, validate trusted asset identity/state/digest/size, report the verification method, and keep full-stream fallback below the parent timeout.
- `scripts/test_validate_agent_run_evidence.mjs`: cover authenticated and public digest paths, token isolation, repository-bound asset URLs, malformed digest rejection, and fallback timeout bounds.
- `scripts/test_run_local_gates.py`: pin the parent `evidence-remote` timeout used by the cross-file timeout contract.
- `.github/workflows/pr-gates.yml`: provide the job-scoped read-only GitHub token to avoid anonymous API rate-limit drift.
- `docs/agent-runs/2026-07-19-evidence-archive-verification.md`: record the failure, integrity reasoning, validation, and review state.

## Commands run

- Initial strict PR profile for PR #423 -> complete failure with 26/29 passed; `agent-review` rejected a partial Harness claim, `repo-health-strict` found the intentionally narrow fetch mapping lacked a topic upstream mapping, and `evidence-remote` timed out after 180 seconds.
- Full `python3 scripts/validate_harness.py` -> passed; the PR body was corrected to record full rather than local Harness validation.
- Explicit topic ref fetch plus topic-only fetch mapping -> restored a verifiable upstream without broadening daily fetches to old branches.
- Anonymous and authenticated full archive validation attempts -> both exceeded the 180-second parent timeout and were stopped; no pass was claimed.
- 1 MiB HTTPS range probe -> HTTP 206, 1,048,576 bytes in about 4.25 seconds at about 247 kB/s, proving the old 300-second per-attempt full download could not complete the 162 MB archive on the current connection.
- GitHub Release asset API -> returned uploaded asset ID 472504884, size 162,388,780, and digest `sha256:6214759f93c30e645f61a12d537c844e9022581d3d36a8ba1548d5f6addb9f23`, exactly matching the committed index.
- `node --test scripts/test_validate_agent_run_evidence.mjs` -> 8 tests passed.
- Anonymous `node scripts/validate_agent_run_evidence.mjs --verify-remote` -> passed in about 0.5 seconds and reported `github_release_asset_digest` for all 162,388,780 bytes.
- `python3 scripts/test_run_local_gates.py` -> 29 tests passed.

## Validation results

- The optimized path compares a full SHA-256 and exact byte size from trusted GitHub Release metadata; it does not substitute availability, partial bytes, or an unchecked cache for integrity.
- Tokens are only attached to the expected `api.github.com/repos/<owner>/<repo>/releases/assets/<id>` path; arbitrary hosts and cross-repository asset paths fail closed.
- Public repositories work without a token; CI receives the existing read-only repository token to avoid anonymous rate-limit drift.
- Fallback streaming remains available and its 150-second transfer cap is below the 180-second parent gate timeout.
- Complete strict PR profile and GitHub required checks are pending on the final PR head.

## Binary evidence

- Evidence manifest: N/A
- Archive: existing `history-cutover-2026-07-10` Release asset; this change does not create or replace binary evidence.

## Agent review status

- Reviewer: Codex
- Status: Passed
- Blocking findings: None.
- Review summary: The change strengthens determinism and diagnosis without weakening the integrity claim. It verifies the same SHA-256 and byte size against an uploaded, repository-bound GitHub asset and retains a bounded full-download fallback.

## User-visible UI impact

- N/A. No user-visible screen, copy, interaction, motion, or accessibility behavior changes.

## Card make external workspace impact

- N/A. No card payload, source, review, approval, or import boundary changes.

## Risks and open questions

- GitHub assets created before digest support fall back to streamed hashing and can still fail on slow networks; that failure is now bounded and reported rather than killed by the parent first.
- A GitHub API outage or invalid/missing uploaded asset state fails the gate closed.
- The evidence validator output gains an additive `remote_verifications` diagnostic field while retaining schema version `agent-run-evidence-validation.v1`.

## Follow-up

- Update the PR description to disclose this directly discovered Harness correction, run the final strict PR profile, then require all GitHub checks before merge.
