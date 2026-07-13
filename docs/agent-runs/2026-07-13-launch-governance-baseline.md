# Agent Run Record: Launch Governance Baseline

## Task summary

- Date: 2026-07-13
- Branch: `infra/launch-governance-baseline`
- PR: pending
- Summary: Replace the rejected all-in-one production foundation with one auditable launch-governance slice. This run fixes the release scope, keeps every launch gate fail-closed, requires structured hash-bound evidence, and does not claim that the product is launch-ready.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/platform-contract.json`
- `spec/membership.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- CET4 and CET6 remain in scope for iOS, Android, and PC Web; release parity cannot be reduced to make the date.
- Login remains required before learning, membership is shared across release targets, and all release targets must support purchase.
- The five-day launch-plan trial and fixed monthly/yearly product identifiers remain unchanged.
- Production content requires formal user approval. Green validators, candidate state, or a passing CI run are not approval.

## Implementation hypothesis changed

- Operational readiness is recorded in two strict JSON contracts under `docs/release/` and derived by one Node validator.
- Every gate owns a code-defined evidence-type set. A gate cannot pass by deleting a requirement, using a string placeholder, or supplying only partial evidence.
- Evidence binds a tracked repository artifact to byte size, SHA-256, verification time, and verifier identity. The CLI rejects symlinks and re-hashes every artifact; remote binaries remain behind the separate evidence-manifest gate.
- External account capabilities and approved box/card coverage evidence require the tracked product owner `github:LENKIN233` as verifier.
- The existing authenticated archive verifier now streams through bounded `curl` instead of buffering a 162 MB asset through `fetch().arrayBuffer()`.

## Workspace boundary and read scope

- Active truth/source read: the referenced specs, current delivery workflow and PR template, harness governance mirrors, release archive index, and agent-run conventions.
- Generated/dependency/cache/archive read: required-check outputs, GitHub Release metadata, and the archived 162,388,780-byte pre-cutover evidence asset only for verification.
- External workspace read: none; `/Users/lenkin/programing/card make` was not edited or treated as approved content.

## Files changed

- `docs/release/README.md`: define readiness records, evidence handling, and the no-quality-reduction rule.
- `docs/release/launch-readiness.v1.json`: fix launch scope and record five pending plus five blocked gates, with zero passed gates.
- `docs/release/external-account-readiness.v1.json`: record every required external capability as unverified.
- `scripts/validate_launch_readiness.mjs` and test: validate fixed scope, exact gate/capability sets, evidence shape, ownership, status derivation, repository hashes, and fail-closed CLI behavior.
- `.github/workflows/pr-gates.yml`, `.github/pull_request_template.md`, `spec/repo-delivery-contract.json`, and harness mirrors: execute and record the launch check inside the already-required `validate-harness` job.
- `scripts/validate_agent_run_evidence.mjs`: stream authenticated archive hashing with HTTPS restriction, timeout, retry, expected-size bound, bounded stderr, and cross-host credential isolation; the token is supplied through stdin rather than process arguments.
- `README.md`: expose the release-governance entry point.

## Commands run

- `node --test scripts/test_validate_launch_readiness.mjs` -> 15 tests passed.
- `node scripts/validate_launch_readiness.mjs` -> valid and intentionally `ready: false`; 5 pending, 5 blocked, 0 passed.
- `python3 scripts/validate_harness.py` -> passed, including live `main` protection validation.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- Mobile lint, typecheck, and Jest -> passed; 29 suites and 187 tests.
- Development CloudBase API `npm test` -> 14 tests passed.
- `node scripts/validate_dependency_security.mjs` -> policy passed; the existing time-bounded CloudBase `lodash.set` high-severity exception remains and is not represented as zero vulnerabilities.
- `GITHUB_TOKEN="$(gh auth token)" node scripts/validate_agent_run_evidence.mjs --verify-remote` -> passed after streaming the authenticated Release asset.
- Independent Release download -> SHA-256 `6214759f93c30e645f61a12d537c844e9022581d3d36a8ba1548d5f6addb9f23`, 162,388,780 bytes, 391 archive entries.
- `git lfs fsck` -> passed.

## Validation results

- Negative coverage rejects deleted gates/capabilities, string or partial evidence, malformed passed/ready evidence, placeholder or mutable URLs, reused evidence artifacts, oversized ordinary-Git evidence, stale/future verification, mismatched repository hashes, untracked repository evidence, repository symlinks, status drift, non-owner account approval, and non-owner formal content coverage approval.
- The tracked readiness report is valid but not ready. No external account, capability, or launch gate is marked ready/passed.
- Existing product, mobile, backend, repository-protection, LFS, and archived-evidence checks passed locally.
- Repository health must be rerun after commit and upstream creation; its pre-commit run correctly reported the dirty worktree and missing branch upstream.
- GitHub Actions has not run this branch. The known account billing/spending-limit condition remains a remote validation blocker until a new run proves otherwise.

## Binary evidence

- Evidence manifest: N/A; this change creates no new binary evidence.
- Archive: existing `history-cutover-2026-07-10` Release asset was authenticated and hash-verified; no archive was modified.

## Agent review status

- Reviewer: Codex
- Status: Pending
- Blocking findings: remote required checks have not executed on this branch; repository health still needs the clean committed branch and upstream check.

## User-visible UI impact

- None. No screen, copy, component, state, interaction, navigation, or visual artifact changed.

## Card make external workspace impact

- None. No card JSON, MP3, candidate PR, QC record, or formal approval record changed.
- The approved-production-content gate requires product-owner-verified box/card coverage and audio/content integrity evidence; candidate validation cannot satisfy it.

## Risks and open questions

- `github:LENKIN233` is intentionally fixed as product owner for this repository. Changing that identity requires a reviewed governance change.
- External evidence must be redacted into tracked repository records; large or restricted remote artifacts must use the independently verified `agent-run-evidence.v1` archive path.
- The remote archive verifier requires `curl`, which is present on current local and GitHub-hosted runners.
- The existing CloudBase dependency exception and Ruby advisories discovered during the rejected PR audit require separate focused remediation; this PR does not conceal or mix those dependency changes.

## Follow-up

- Open this branch as a Draft PR and keep it blocked until every required GitHub job actually executes and passes.
- After this slice merges, rebuild the production API as a separate PR with durable SMS abuse limits, checksum-protected migrations, content/card membership validation, immutable signed releases, real PostgreSQL integration, and no skipped production tests.
- Handle mobile `/v2`, infrastructure, Web, payments, audio, content publication, and release evidence as later independent slices; do not restore the rejected all-in-one PR.
