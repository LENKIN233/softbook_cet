# Agent Run Record: Launch Governance Baseline

## Task summary

- Date: 2026-07-13
- Branch: `infra/launch-governance-baseline`
- PR: [#413](https://github.com/LENKIN233/softbook_cet/pull/413) (Draft)
- Summary: Replace the rejected all-in-one production foundation with one auditable launch-governance slice. This run fixes the release scope, keeps every launch gate fail-closed, requires structured hash-bound evidence, and does not claim that the product is launch-ready. Fresh review also hardened remote archive credentials and made evidence artifacts distinct across the complete readiness record.

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
- Artifact URI and SHA-256 uniqueness is enforced within and across launch gates and external-account capabilities, so one report cannot satisfy unrelated evidence requirements.
- External account capabilities and approved box/card coverage evidence require the tracked product owner `github:LENKIN233` as verifier.
- The existing authenticated archive verifier now streams through bounded `curl` instead of buffering a 162 MB asset through `fetch().arrayBuffer()`.
- Archive authentication is restricted to trusted GitHub Release asset API URLs. Arbitrary HTTPS archives receive no GitHub authorization header, and the public CI path injects no token.
- The agent-review job reads the current PR body through a read-only GitHub API request, so a failed review gate can be rerun after review metadata changes without validating a stale event snapshot.

## Workspace boundary and read scope

- Active truth/source read: the referenced specs, current delivery workflow and PR template, harness governance mirrors, release archive index, and agent-run conventions.
- Generated/dependency/cache/archive read: required-check outputs, GitHub Release metadata, and the archived 162,388,780-byte pre-cutover evidence asset only for verification.
- External workspace read: none; `/Users/lenkin/programing/card make` was not edited or treated as approved content.

## Files changed

- `docs/release/README.md`: define readiness records, evidence handling, and the no-quality-reduction rule.
- `docs/release/launch-readiness.v1.json`: fix launch scope and record five pending plus five blocked gates, with zero passed gates.
- `docs/release/external-account-readiness.v1.json`: record every required external capability as unverified.
- `scripts/validate_launch_readiness.mjs` and test: validate fixed scope, exact gate/capability sets, evidence shape, global artifact uniqueness, ownership, status derivation, repository hashes, and fail-closed CLI behavior.
- `.github/workflows/pr-gates.yml`, `.github/pull_request_template.md`, `spec/repo-delivery-contract.json`, and harness mirrors: execute and record the launch check inside the already-required `validate-harness` job, and validate the live PR review body through a read-only API fetch.
- `scripts/validate_agent_run_evidence.mjs` and `scripts/test_validate_agent_run_evidence.mjs`: stream archive hashing with HTTPS restriction, timeout, retry, expected-size bound, bounded stderr, and host-bound credential isolation; any token is supplied through stdin rather than process arguments.
- `README.md`: expose the release-governance entry point.

## Commands run

- `node --test scripts/test_validate_launch_readiness.mjs scripts/test_validate_agent_run_evidence.mjs` -> 21 tests passed.
- `node scripts/validate_launch_readiness.mjs` -> valid and intentionally `ready: false`; 5 pending, 5 blocked, 0 passed.
- `python3 scripts/validate_harness.py` -> passed, including live `main` protection validation.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- Mobile lint, typecheck, and Jest -> passed; 29 suites and 187 tests.
- Development CloudBase API `npm test` -> 14 tests passed.
- `node scripts/validate_dependency_security.mjs` -> policy passed; the existing time-bounded CloudBase `lodash.set` high-severity exception remains and is not represented as zero vulnerabilities.
- `GITHUB_TOKEN="$(gh auth token)" node scripts/validate_agent_run_evidence.mjs --verify-remote` -> passed after streaming the authenticated Release asset.
- `env -u GITHUB_TOKEN node scripts/validate_agent_run_evidence.mjs --verify-remote` -> passed against the public Release without injecting a token.
- Live GitHub API PR-body fetch plus `python3 scripts/validate_agent_review.py --body-file <temp>` -> the current remote Pending body failed as expected; the reviewed final body passed.
- Ruby YAML parse and full harness validation -> passed after the live PR-body workflow change.
- Independent Release download -> SHA-256 `6214759f93c30e645f61a12d537c844e9022581d3d36a8ba1548d5f6addb9f23`, 162,388,780 bytes, 391 archive entries.
- Public-conversion preflight fetched 437 remote refs and 914 reachable commits; Gitleaks found only four reviewed `Podfile.lock` checksum false positives. The old-history bundle verified as complete with 475 refs and 879 commits and produced no secret findings. PR bodies, comments, reviews, and the 391-PNG evidence archive produced no secret findings.
- `git lfs fsck` -> passed.
- Strict repository health after push -> passed; 1 worktree, 0 dirty worktrees, 0 stashes, 1 topic branch, 0 missing upstreams, and 0 oversized blobs.

## Validation results

- Negative coverage rejects deleted gates/capabilities, string or partial evidence, malformed passed/ready evidence, placeholder or mutable URLs, reused evidence artifacts within or across contracts, oversized ordinary-Git evidence, stale/future verification, mismatched repository hashes, untracked repository evidence, repository symlinks, status drift, non-owner account approval, non-owner formal content coverage approval, arbitrary-host token forwarding, untrusted release asset URLs, and header injection through malformed tokens.
- The tracked readiness report is valid but not ready. No external account, capability, or launch gate is marked ready/passed.
- Existing product, mobile, backend, repository-protection, LFS, and archived-evidence checks passed locally.
- Repository health passed on the clean pushed branch after replacing the stale deleted-branch fetch refspec with this branch's remote-tracking ref.
- GitHub Actions run [29236210306](https://github.com/LENKIN233/softbook_cet/actions/runs/29236210306) created all nine jobs, but every job completed with zero steps. GitHub annotated them: `The job was not started because recent account payments have failed or your spending limit needs to be increased.` No remote test executed.
- After the repository became public, Actions run [29236279814 attempt 4](https://github.com/LENKIN233/softbook_cet/actions/runs/29236279814) executed real steps: seven jobs passed, including the 45-minute iOS Release job. `evidence-archive` failed because the history Release was temporarily drafted for public-conversion review; `agent-review` failed because this record and the PR body still correctly said Pending.
- Actions run [29297996875](https://github.com/LENKIN233/softbook_cet/actions/runs/29297996875) on reviewed commit `0518ec3` passed all eight technical jobs: harness, design, mobile, backend, dependency, repository health, evidence archive, and the 37-minute iOS Release build/archive. Only `agent-review` failed, as intended, because the PR body still recorded the pre-review Pending state.

## Binary evidence

- Evidence manifest: N/A; this change creates no new binary evidence.
- Archive: existing `history-cutover-2026-07-10` Release asset was authenticated and hash-verified; no archive was modified.

## Agent review status

- Reviewer: Codex
- Status: Passed
- Blocking findings: None. Fresh review found and fixed arbitrary-host token forwarding, cross-contract artifact reuse, and stale PR-body reads; local regression tests pass and all eight technical required jobs executed successfully on reviewed commit `0518ec3`.

## User-visible UI impact

- None. No screen, copy, component, state, interaction, navigation, or visual artifact changed.

## Card make external workspace impact

- None. No card JSON, MP3, candidate PR, QC record, or formal approval record changed.
- The approved-production-content gate requires product-owner-verified box/card coverage and audio/content integrity evidence; candidate validation cannot satisfy it.

## Risks and open questions

- `github:LENKIN233` is intentionally fixed as product owner for this repository. Changing that identity requires a reviewed governance change.
- External evidence must be redacted into tracked repository records; large or restricted remote artifacts must use the independently verified `agent-run-evidence.v1` archive path.
- The remote archive verifier requires `curl`, which is present on current local and GitHub-hosted runners.
- The repository and verified history Release are now public; GitHub Secret Scanning and Push Protection are enabled. The release bundle remains a deliberate complete-history archive rather than an active development ref.
- The existing CloudBase dependency exception and Ruby advisories discovered during the rejected PR audit require separate focused remediation; this PR does not conceal or mix those dependency changes.

## Follow-up

- Commit the live PR-body review gate and this Passed record, update the PR body, and require all nine jobs to pass again on the final SHA before merge.
- After this slice merges, rebuild the production API as a separate PR with durable SMS abuse limits, checksum-protected migrations, content/card membership validation, immutable signed releases, real PostgreSQL integration, and no skipped production tests.
- Handle mobile `/v2`, infrastructure, Web, payments, audio, content publication, and release evidence as later independent slices; do not restore the rejected all-in-one PR.
