# Agent Run Record: PC Web core implementation

## Task summary

- Date: 2026-08-01
- Branch: `module/pc-web-core-implementation`
- Base: merged `origin/main` at `6254b0ffa115692a59287ea17f6e452184530f13` after PC Web design PR #469.
- PR: https://github.com/LENKIN233/softbook_cet/pull/470
- Summary: adds a production-safe PC Web application scaffold and implements the accepted Auth, five Learning interactions, result, Space, Statistics, Mine, membership context, responsive shell, keyboard equivalence, automated accessibility smoke, CI and runtime fail-closed boundary.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/account-sync-contract.json`
- `spec/action-surface.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`

## Product truth used

- PC Web is a required first-class platform, not a stretched phone screen.
- Learning remains one system-selected current card and preserves five distinct interaction families.
- Flip has exactly `有把握` and `再回看`; audio remains attached rather than becoming an interaction family.
- Space retains library/group/box hierarchy, contained cards, favorite tags, sleep/wake under the owning box, and Learning continuity.
- Statistics and Mine remain supporting routes; membership interruption remains contextual.
- Candidate card production and approval remain in `/Users/lenkin/programing/card make`; this repository consumes payloads only after approval.

## Implementation hypothesis changed

- `apps/web` is a Vite + React + TypeScript application that reuses platform-neutral mobile domain modules rather than duplicating evaluation and membership semantics.
- Development mode uses the existing structured development source to exercise the shell. Production requires explicit HTTPS runtime configuration and otherwise stops before authentication.
- A responsive route rail / focal workbench / context rail composition preserves the accepted desktop design; exact production runtime wiring, hosting and device matrix remain future work.

## Workspace boundary and read scope

- Active truth/source read: referenced specs, accepted PC Web design decision/mapping, mobile platform-neutral learning/membership/display modules, CI workflow and delivery records.
- Generated/dependency/cache read: `apps/web/node_modules` and `apps/web/dist` only for install/build verification; both remain untracked.
- External workspace: `/Users/lenkin/programing/card make` was not modified and no payload was produced, approved or imported.

## Files changed

- `apps/web/`: application source, tests, styles, CSP-bearing HTML, safe runtime configuration template, lockfile and operational README.
- `apps/mobile/src/learning/sessionCore.ts`, `apps/mobile/src/learning/session.ts`: separates platform-neutral evaluation from local development content loading so production Web bundles cannot retain development cards.
- `.github/workflows/pr-gates.yml`: adds a Web quality job for clean install, locked shared-domain TypeScript context, lint, type-check, tests, build and production dependency audit.
- `scripts/local_gates/catalog.py` and governance mirrors: add Web gates locally and make `web-quality` a protected required check.
- `docs/design/mapping/pc-web-core-implementation-evidence-v1.md`: implementation mapping, evidence, design checklist and explicit production gaps.
- `docs/agent-runs/2026-08-01-pc-web-core-implementation.md`: this record.

## Commands run

- `npm install` in `apps/web` -> passed; lockfile created; 0 vulnerabilities.
- `npm run lint` -> passed.
- `npm run typecheck` -> passed.
- `npm test` -> 9/9 passed across two files, including auth, route order, flip semantics, Space state continuity, sign-out isolation, keyboard, metadata leak and axe-core checks.
- `npm run build` -> passed with Vite 8.2.0; production output approximately 210.92 kB JS / 66.38 kB gzip and 10.36 kB CSS / 3.00 kB gzip.
- Production-boundary scan after every Web build -> passed; the bundle excludes the local source identifier and development-card sentinels.
- `npm audit --omit=dev --audit-level=high` -> passed; 0 vulnerabilities.
- Workflow-equivalent clean dependency install (`apps/mobile`: `npm ci --ignore-scripts`; `apps/web`: `npm ci`) followed by Web lint, type-check, exact Node 22.13.0 tests, build and production audit -> passed; 9/9 tests and 0 vulnerabilities.
- Mobile `lint`, `typecheck`, metadata scan and Jest -> passed; 44 suites / 424 tests.
- In-app browser dev flow -> passed for Auth, flip, multiple choice, lock, elimination, swipe, attached result, Space, Statistics, Mine and keyboard left-arrow selection.
- In-app browser production preview -> passed fail-closed behavior with safe unavailable copy and no code field.
- `git diff --check` -> passed before final documentation update.
- `scripts/run_local_gates --profile dev` -> 23/24 passed with 0 failures; only the declared dev-only Node 25.9.0 versus 22.13.0 exception; report `exports/local-gates/20260731T234758Z-9e6645c9-dev-96194/report.json`.
- `python3 scripts/validate_harness.py --mode full --format text` -> passed, including live branch-protection comparison.
- `node scripts/report_repo_health.mjs --base origin/main --head HEAD` -> passed for all 33 changed files/blobs.
- GitHub branch protection -> `web-quality` added to strict required contexts after PR #469 merged.

## Validation results

- The five interaction families have distinct DOM and visual silhouettes; the flip branch exposes exactly two choices.
- Semantics expose navigation, main and complementary landmarks, accessible labels, pressed/expanded state and visible focus. Axe-core reports no automatically detectable violations with color contrast excluded because jsdom cannot measure computed contrast.
- Real browser review corrected light-mode contrast and consecutive-card scroll continuity.
- Runtime configuration accepts only HTTPS remote bases, exposes no API-key field, and production without valid configuration cannot enter the Learning shell.
- Platform-neutral session evaluation no longer statically imports the local development source; the production artifact contains no development card payload.
- The first exact-head `web-quality` run correctly exposed that the initial Web TypeScript include glob traversed unrelated React Native UI. The include boundary now covers Web source plus only transitively imported pure modules; a list-files check contains no mobile TSX or `react-native` resolution.
- The second exact-head `web-quality` run exposed Vite/Oxc loading the nearest `apps/mobile/tsconfig.json` while transforming the reused platform-neutral domain modules. The Web job now installs the mobile lockfile with lifecycle scripts disabled, providing the declared TypeScript-config context without performing native build work.
- CI now runs an independent Web quality path. Exact-head PR results remain pending.

## Binary evidence

- Evidence manifest: N/A.
- Archive: N/A.
- Reason: this implementation produces an unsigned static Web build, not a deployed artifact or signed mobile binary.

## Agent review status

- Reviewer: Codex.
- Status: local implementation review passed for the repository-local scope; exact-head PR agent review, formal product-owner approval, all CI checks and merge remain pending.
- Blocking findings fixed locally: light-mode label/support/error/self-assess contrast, retained scroll position, misleading local purchase mutation, missing production fail-closed behavior, development content in the production bundle, the over-broad Web TypeScript include boundary, and the missing locked transform context caught by clean CI.
- Open blocking boundaries: remote auth/runtime, sync, payments, formal content, audio, account deletion, hosting, 1024px/200% proof, full screen-reader proof and external launch evidence.

## User-visible UI impact

- Accepted design source: `docs/design/decisions/pc-web-core-surface-decision-v1.md` and `docs/design/mocks/pc-web-core-surfaces-v1.html`.
- Interaction/motion source: `docs/design/interaction-motion/learning-core-interactions-v1.md`.
- Physical-space source: `docs/design/physical-space/space-model-v1.md`.
- Implementation mapping: `docs/design/mapping/pc-web-core-implementation-evidence-v1.md`.
- Unimplemented gaps: recorded in the evidence map; production parity and launch readiness remain unclaimed.

## Card make external workspace impact

- N/A. No candidate content was generated, approved, modified or imported.

## Risks and open questions

- Production remote runtime and browser-safe auth are not wired; the application deliberately stops rather than downgrade.
- Development membership state is in memory; it cannot serve as payment or shared entitlement evidence.
- The static CSP is a baseline only; hosting must provide production security headers and a narrowed connect policy.
- 1024px, 200% zoom, named screen-reader, dark appearance, production deployment, SLO and recovery proofs remain required.
- The launch-readiness validator remains authoritative and is expected to remain not ready.

## Follow-up

- PC Web design PR #469 merged after all required checks, including iOS Release simulator and unsigned archive, passed.
- This implementation branch was rebased to the merged design authority and full local gates passed.
- Implementation PR #470 is open, ready for review and configured for squash auto-merge.
- Require the corrected exact-head Web quality run, existing required checks, agent review and formal approval before merge.
