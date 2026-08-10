# Agent Run Record: Web build dependency audit

## Task summary

- Date: 2026-08-10
- Branch: `infra/web-build-dependency-security`
- PR: #491
- Base at implementation start: `origin/main@12d04aa836f07ee4bfdb5175dabcc2d760693f2d`
- Final rebased validation base: `origin/main@afde8fe81f422ec2b07186da66c448eb16ba01c2` (PR #476 squash merge)
- Summary: Remove the patchable high-severity `nanoid` advisory from the Web build graph and close the required dependency-security gate gap that omitted the Web target and all dev/build dependencies.

## Referenced specs

- `spec/authority-map.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`

## Product truth used

- None. This repair does not change CET4/6 Learning, Space, membership, content, interaction, visual design, native runtime behavior, or release readiness.
- A passing dependency-security result is point-in-time delivery evidence. It is not deployment evidence, formal approval, launch evidence, or a timeless zero-vulnerability claim.

## Implementation hypothesis changed

- The dependency policy now covers every npm dependency class in the lockfile graphs for `apps/mobile`, `apps/web`, and `infra/cloudbase/functions/softbook-api`, including dev and build dependencies.
- The validator explicitly includes npm's prod, dev, optional, and peer dependency classes; it fails closed if the policy stops requiring dev/build coverage.
- The Web lock binds the existing PostCSS-compatible `nanoid` range to patched `3.3.18`. No direct dependency or exception is added.
- The required dependency-security job installs and caches all three audited lockfile trees before running the central policy validator.

## Workspace boundary and read scope

- Active source read: the referenced delivery and harness specs, dependency policy and validator, PR workflow, Web/mobile/backend package manifests and lockfiles, and the preceding mobile dependency advisory run record.
- Dependency read: clean ignored `node_modules` trees and npm audit dependency paths were inspected only to reproduce and verify the advisory boundary.
- External read: GitHub Advisory API record for `GHSA-2V37-7H3G-55P8` / `CVE-2026-67213` and npm registry metadata for `nanoid@3.3.18`.
- Generated/cache read: ignored dependency trees, Web `dist`, and local-gate reports were used only as validation outputs; none is source or authority.
- External content workspace: `/Users/lenkin/programing/card make` was not read or modified.

## Files changed

- `.github/workflows/pr-gates.yml`: cache and install the Web and backend dependency trees in the required dependency-security job in addition to mobile.
- `apps/web/package-lock.json`: update only the `node_modules/nanoid` lock stanza from `3.3.16` to `3.3.18`, preserving unrelated optional-platform metadata.
- `security/dependency-audit-policy.json`: require all npm dependency classes and add the Web target with no advisory exceptions.
- `scripts/validate_dependency_security.mjs`: audit the complete graph with explicit `--include=prod`, `--include=dev`, `--include=optional`, and `--include=peer` arguments, and fail closed if the policy disables that scope.
- `scripts/test_validate_dependency_security.mjs`: regress the full-graph arguments, exact target set, Web path, and fail-closed policy flag.
- `docs/agent-runs/2026-08-10-web-build-dependency-audit.md`: preserve the scope, evidence, validation, review, and non-claims for this governance change.

## Commands run

- GitHub Advisory API read for `GHSA-2V37-7H3G-55P8`.
- Exact Node `22.13.0` / npm `10.9.2` `npm view nanoid@3.3.18`, lock-only update, and clean `npm ci` runs.
- Rebase of the signed provisional commit onto final `origin/main@afde8fe81f422ec2b07186da66c448eb16ba01c2`.
- Full and production-only `npm audit --json` comparisons in mobile, Web, and backend targets.
- `node scripts/test_validate_dependency_security.mjs`.
- `node scripts/validate_dependency_security.mjs`.
- Web `npm run lint`, `npm run typecheck`, `npm test -- --run`, and `npm run build`.
- `python3 scripts/validate_harness.py`.
- `./scripts/run_local_gates --profile dev --base origin/main`.
- `git diff --check`.

## Validation results

- GitHub identifies `nanoid <3.3.17` as vulnerable; the Web graph previously resolved `3.3.16` through `vite@8.2.0 -> postcss@8.5.25 -> nanoid@3.3.16`.
- The clean Web lock now resolves `nanoid@3.3.18`; full `npm audit` reports zero Web vulnerabilities and no exception was introduced.
- The focused change rebased without conflict onto the actual PR #476 squash result; its parent is the final `origin/main@afde8fe81f422ec2b07186da66c448eb16ba01c2`, not the PR head or a projected merge SHA.
- Live central dependency-security validation passes all three targets. Web and backend report zero vulnerabilities; mobile still exposes exactly the two separately governed high-severity `image-size` advisories with zero policy errors.
- Web lint and typecheck passed; Vitest passed `2/2` files and `12/12` tests; the production build and development-content exclusion check passed.
- The first isolated Web test attempt correctly failed because the new worktree did not yet contain the required shared mobile TypeScript dependency tree. After the same shared `npm ci` prerequisite used by CI, the complete Web suite passed.
- The first full-harness invocation used a narrowed PATH that selected the system Python and omitted `gh`, and also exposed that hooks had initially been installed from the parent worktree. Hooks were installed from this topic worktree and the harness was rerun with Python `3.12.13`, Node `22.13.0`, and `gh` available; full harness passed.
- Final post-rebase local `dev` gates passed `24/24`; report: `exports/local-gates/20260810T071916Z-97243ca7-dev-71541/report.json`. This ignored report is not a remote required check or launch evidence.
- `git diff --check` passed.

## Binary evidence

- Evidence manifest: N/A.
- Archive: N/A.

## Agent review status

- Reviewer: independent Codex dependency-security sub-agent plus primary-agent review.
- Status: Passed (P0=0, P1=0) after final post-#476 exact-tree review.
- Blocking findings: none. The earlier documentation-only P1 was corrected before final review.
- Review evidence: verified the exact six-path diff against `origin/main@afde8fe81f422ec2b07186da66c448eb16ba01c2`, proposed implementation tree `f0d5633f76583903c2ede788f86bc710835b7639`, minimal `nanoid` lock repair, explicit all-class fail-closed audit, exact policy targets, three-target workflow install/cache wiring, tests, run record, and the inherited PR #476 repository-health correction.
- Review boundary: this status permits only amending the existing signed commit with this review block. After amendment, parent SHA, signature, clean workspace, six-path diff, and final tree must be reconfirmed. Merge remains gated by remote required checks and real protected product-owner approval.

## User-visible UI impact

- N/A. No user-visible UI, copy, layout, interaction, motion, navigation, product runtime surface, or design artifact changed.

## Card make external workspace impact

- N/A. No card candidate, approval, import, audio asset, payload, or sibling-workspace file changed.

## Risks and open questions

- npm advisories are time-varying. The required gate must continue to query the live registry and must not be treated as a permanent zero-risk certificate.
- The two existing mobile `image-size` exceptions remain visible and expire after `2026-08-17`; this PR does not expand, renew, or otherwise change them.
- PR #476 has merged, and this branch is now based on its exact squash result. The final exact-tree review, remote required checks, and protected approval must bind the published amended head.
- This security prerequisite must merge before PR-A is rebound. Any later `main` advancement requires PR-A to rebase and rebind again.

## Follow-up

- Complete the final exact-tree review, publish the focused PR, and merge only after all required checks and real protected product-owner approval pass.
- Continue monitoring the remaining mobile advisory exceptions through expiry without treating this Web fix as their resolution.
