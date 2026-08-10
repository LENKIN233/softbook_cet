# Agent Run Record: Mobile dependency advisories

## Task summary

- Date: 2026-08-10
- Branch: `infra/mobile-dependency-advisories-2026-08`
- PR: pending publication
- Summary: Restore the required dependency-security gate after the live npm advisory feed exposed one fixable `js-yaml` advisory and two unpatched `image-size` advisories inherited by `main`. Preserve each transitive `js-yaml` consumer's major-version contract, govern the unpatched build-time parser risk with two exact, seven-day, fail-closed exceptions, and require protected human approval for every future dependency-audit policy change.

## Referenced specs

- `spec/authority-map.json`
- `spec/requirement-memory.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `spec/release-operational-policy.json`

## Product truth used

- None. This repair does not change CET4/6 Learning, Space, membership, content, interaction, visual design, native runtime behavior, or release readiness.
- A green dependency-security result is point-in-time delivery evidence. It is not a zero-vulnerability claim, deployment evidence, formal approval, or launch evidence.

## Implementation hypothesis changed

- Scoped npm overrides keep `@istanbuljs/load-nyc-config` on patched `js-yaml@3.15.1`, while `@eslint/eslintrc`, `cosmiconfig`, and `eslint` use patched `js-yaml@4.3.1`. No consumer is forced across its declared major-version contract.
- The exact mobile lock is regenerated with Node `22.13.0` / npm `10.9.2`; a clean `npm ci` must reproduce the graph and postinstall compatibility normalization.
- `image-size@1.2.1` remains reachable only through Metro `0.84.3` in the bounded development/build toolchain and is not shipped in the installed iOS or Android runtime. No learner or network bytes feed the parser. Current build inputs are source-reviewed repository files or lock-and-integrity-bound dependency assets; this limits exposure but does not claim the build-time denial-of-service risk is unreachable.
- The two exact high-severity `image-size` advisories are therefore visible exceptions only through `2026-08-17`. They remain package/severity bound, cannot cover critical or different advisories, fail when expired or resolved, and must be removed immediately when upstream publishes a patched release.
- `security/dependency-audit-policy.json`, its semantic validator, and its regression test are added to the trusted-base formal-approval classifier's exact sensitive set. This PR changes the already-sensitive classifier itself, and future exception or validator additions, edits, renames, removals, or bypass attempts must take the protected human approval path rather than automatic approval.

## Workspace boundary and read scope

- Active source read: the referenced delivery/harness specs, dependency validator/tests/policy, mobile package manifests, PR workflow, and prior dependency-advisory run records.
- Dependency read: the clean installed mobile dependency tree and current npm audit graph were inspected only to resolve and validate the advisory boundary.
- External read: GitHub Advisory API records for `GHSA-5P2G-FCMC-QVQQ`, `GHSA-W3RX-R6R6-PGPR`, and `GHSA-5P4M-2WFM-XMQJ`, plus current npm registry metadata for `image-size` and `js-yaml`.
- Generated/cache read: ignored `node_modules` created by `npm ci`; it is not source or authority.
- External content workspace: `/Users/lenkin/programing/card make` was not read or modified.

## Files changed

- `apps/mobile/package.json`: add four parent-scoped `js-yaml` overrides preserving the required 3.x/4.x split.
- `apps/mobile/package-lock.json`: bind the four transitive consumers to `3.15.1` or `4.3.1` with registry integrity metadata, without changing the `image-size` package or unrelated direct ranges.
- `security/dependency-audit-policy.json`: add two exact `image-size` exceptions expiring `2026-08-17`, each bound to the observed package, high severity, no-patched-release state, and bounded build-toolchain exposure.
- `scripts/classify_formal_approval_scope.mjs` and `scripts/test_classify_formal_approval_scope.mjs`: classify the dependency-audit policy, semantic validator, and validator regression as exact sensitive governance and regress the protected-approval boundary.
- `docs/agent-runs/2026-08-10-mobile-dependency-advisories.md`: preserve diagnosis, evidence, review, non-claims, expiry, and handoff.

## Commands run

- GitHub Advisory API reads for all three advisory IDs.
- `npm view image-size version versions --json` and `npm view js-yaml version versions --json`.
- Exact Node `22.13.0` / npm `10.9.2` `npm install --package-lock-only --ignore-scripts` and `npm ci` in `apps/mobile`.
- `npm ls js-yaml image-size --all`.
- `node scripts/test_validate_dependency_security.mjs`.
- `node scripts/validate_dependency_security.mjs`.
- `node --test scripts/test_classify_formal_approval_scope.mjs` plus direct classification of this six-path diff.
- Future-date projection of the live audit report through `validateTargetReport(..., 2026-08-18T00:00:00Z)`.
- `git ls-files` extension scan for tracked JXL, HEIF, HEIC, AVIF, and ICNS inputs.
- `npm run lint -- --quiet`, `npm run typecheck`, and `npm test -- --runInBand --watchAll=false --no-watchman` in `apps/mobile`.
- `python3 scripts/validate_harness.py --mode local` and `python3 scripts/validate_harness.py`.
- Exact Python `3.12.13`, Node `22.13.0`, Ruby `3.3.12`, and Bundler `2.4.22` `./scripts/run_local_gates --profile dev`.
- `git diff --check`.

## Validation results

- GitHub lists `js-yaml` first patched versions `3.15.1` and `4.3.1`; the clean installed graph contains exactly those versions at their four scoped consumers and no vulnerable `js-yaml` advisory remains.
- GitHub lists no first patched release for either `image-size` advisory; npm registry latest remains `2.0.2`. A forced registry upgrade or `npm audit fix --force` would not resolve the vulnerability and was not used.
- Clean `npm ci`: 869 packages installed; the six existing `minimatch@3` compatibility normalizations completed.
- Dependency policy regression passed. Live dependency-security validation passed both mobile and CloudBase targets with exactly the two governed `image-size` advisories and zero policy errors.
- The same live report projected to `2026-08-18T00:00:00Z` failed closed with exactly two `expired_exception` findings.
- The repository has no tracked `.jxl`, `.heif`, `.heic`, `.avif`, or `.icns` asset. This is supporting inventory only because `image-size` detects formats by bytes rather than relying on extensions; it is not used as an unreachability proof.
- The trusted classifier marks the dependency-audit policy, validator, regression test, and this PR's exact six-path scope sensitive, so the formal workflow requires the protected human path.
- Mobile lint and typecheck passed. Jest passed `45/45` suites and `437/437` tests.
- Local harness passed with the expected `PARTIAL`, `selected=15`; full `python3 scripts/validate_harness.py` passed.
- Final local `dev` profile after the protected-classifier correction passed `24/24`; report: `exports/local-gates/20260810T041420Z-7960ebd2-dev-34220/report.json`. This generated report is not a remote required check or launch evidence.
- `git diff --check` passed.

## Binary evidence

- Evidence manifest: N/A.
- Archive: N/A.

## Agent review status

- Reviewer: independent Codex sub-agent plus primary-agent security review.
- Status: Passed (P0=0, P1=0) after corrections.
- Blocking findings: none.
- Review summary: Independent final review verified the exact six-path scope, scoped override graph and lock integrity, precise bounded build-toolchain exposure rationale, live advisory state, seven-day fail-closed expiry, and the exact protected-sensitive classifier boundary for the policy, validator, and validator regression. Classifier 10/10, live validation, future-date expiry projection, full harness, and diff check all passed; the reviewer approved exact staging.

## User-visible UI impact

- N/A. No user-visible UI, copy, layout, interaction, motion, navigation, or product runtime surface changed; no design artifact or design review checklist is triggered.

## Card make external workspace impact

- N/A. No card candidate, approval, import, audio asset, payload, or sibling-workspace file changed.

## Risks and open questions

- The two exceptions are not a claim that `image-size` is safe. They expose and time-box a build-time denial-of-service risk that currently has no patched npm release.
- Any route from external, learner, or network input into Metro asset parsing, an advisory severity change, or an upstream fixed release requires immediate reassessment rather than waiting for expiry. File extensions are not a sufficient format boundary.
- Both exceptions expire after `2026-08-17`; an expired or resolved exception fails the required gate. A separate tracked follow-up must investigate upstream replacement, a reviewed fork, or removal from the Metro chain if no fix ships.
- This security prerequisite must merge independently. Unrelated PRs must then update to the new `main` and rerun exact-head review, required checks, and protected approval.

## Follow-up

- Publish the focused PR and merge only after all required checks and the protected formal approval pass.
- Monitor both GitHub advisories and the npm package daily through expiry; remove the exceptions immediately when a patched release exists.
