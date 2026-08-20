# Mobile Metro security refresh

## Task summary

- Date: 2026-08-20
- Branch: `fix/mobile-image-size-expiry-20260820`
- PR: https://github.com/LENKIN233/softbook_cet/pull/509
- Summary: Remove the two expired `image-size` dependency exceptions by pinning the React Native compatible Metro family to `0.84.5`, whose package graph no longer contains `image-size`, while preserving React Native `0.85.2` and the existing mobile product/runtime behavior.

## Referenced specs

- `AGENTS.md`
- `spec/authority-map.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `security/dependency-audit-policy.json`
- `docs/agent-runs/2026-08-10-mobile-dependency-advisories.md`

## Product truth used

- No product definition changes. Learning, Space, membership, content, interactions, and release semantics remain unchanged.
- Dependency installation and repository checks are engineering evidence only; they do not create content approval, deployment, device, closed-beta, or launch evidence.

## Implementation hypothesis changed

- `@react-native/metro-config@0.85.2` declares compatible `metro-config` and `metro-runtime` ranges in the `0.84.x` line.
- The previous lock selected Metro `0.84.3`, whose `metro` package depended on vulnerable `image-size@1.2.1`.
- Exact overrides now keep `metro`, `metro-config`, and `metro-transform-worker` on `0.84.5`. The resolved `0.84.5` Metro graph removes `image-size` and its unused `queue` dependency without upgrading React Native or crossing the compatible Metro minor line.
- Because the vulnerable package is absent, both expired advisory exceptions are removed instead of renewed.

## Workspace boundary and read scope

- Active source: delivery/harness/run-record authorities, dependency policy and validator, mobile package manifest and lock, prior dependency-advisory record, and PR workflow.
- Dependency/vendor scope: npm registry metadata, the clean lock-resolved mobile tree, and live npm audit output were inspected only for this security repair; `node_modules` remains ignored generated state.
- External content workspace: `/Users/lenkin/programing/card make` was not read or modified for this dependency fix.

## Files changed

- `apps/mobile/package.json`: exact Metro `0.84.5` overrides.
- `apps/mobile/package-lock.json`: lock-resolved Metro family refresh and removal of `image-size`/`queue`.
- `security/dependency-audit-policy.json`: remove the two expired `image-size` exceptions.
- `docs/agent-runs/2026-08-20-mobile-metro-security-refresh.md`: durable task evidence.

## Commands run

- `npm view image-size version versions dist-tags --json`
- `npm view metro@0.84.5 dependencies --json`
- `npm view metro-config@0.84.5 dependencies --json`
- `npm view metro-transform-worker@0.84.5 dependencies --json`
- `npx --yes -p node@22.13.0 -p npm@10.9.2 npm --prefix apps/mobile install --package-lock-only --ignore-scripts`
- `npx --yes -p node@22.13.0 -p npm@10.9.2 npm --prefix apps/mobile ci`
- Mobile brace-expansion compatibility, lint, typecheck, and full Jest suite.
- `npm --prefix apps/mobile ls metro metro-config metro-transform-worker image-size --all`
- `node scripts/test_validate_dependency_security.mjs`
- `node scripts/validate_dependency_security.mjs`
- Repository harness, Agent review, design gate, and diff checks recorded below.

## Validation results

- Clean Node `22.13.0` / npm `10.9.2` install passed with 867 packages and zero vulnerabilities.
- Resolved mobile graph contains Metro `0.84.5` consistently and contains no `image-size` package.
- Mobile lint and typecheck passed.
- Mobile Jest passed 46/46 suites and 512/512 tests.
- Brace-expansion compatibility checks passed.
- Dependency-policy regressions passed.
- Live dependency security passed mobile, Web, and CloudBase with zero vulnerabilities, advisories, or policy errors.
- Full `python3 scripts/validate_harness.py` passed with `HARNESS VALIDATION OK` under Node `22.13.0` and the bundled Python runtime.
- `./scripts/run_local_gates --profile dev --base origin/main` passed 24/24 gates, including 512 mobile tests, 12 Web tests plus production build, and 272 backend tests; report: `exports/local-gates/mobile-metro-security-refresh-dev.json`.
- Agent-run evidence validation and the 10 formal-approval classifier regressions passed.
- No exception was added, extended, or substituted for a fix.

## Agent review status

- Reviewer: Codex
- Status: Passed locally.
- Findings: The fix stays inside the React Native compatible Metro `0.84.x` family, removes rather than suppresses the vulnerable transitive package, leaves the application dependency versions and product code unchanged, and keeps the sensitive dependency policy on the protected formal-approval path.

## User-visible UI impact

- None. No screen, interaction, visual state, copy, navigation, or runtime behavior is intentionally changed.

## Card make external workspace impact

- None. No card candidate, review, approval, audio, or content handoff file is changed.

## Risks and open questions

- npm advisory data is time-varying; required CI remains the current authority for the published head.
- The dependency policy edit is sensitive governance and therefore still requires protected product-owner approval before merge.
- iOS and Android release jobs remain required to prove native release compatibility for the exact PR head.

## Follow up

- Publish a focused PR, complete protected approval and all required checks, merge it before rebasing the full-track runtime PR, then rerun that PR's exact-head checks.
