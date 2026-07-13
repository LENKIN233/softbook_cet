# Agent Run Record: Production Platform Foundation

## Task summary

- Date: 2026-07-12
- Branch: `infra/production-platform-foundation`
- PR: https://github.com/LENKIN233/softbook_cet/pull/412
- Summary: Implement the first executable slice of the 2027 Q2 launch plan: machine-checked launch readiness, a fail-closed mobile Release boundary, a TypeScript/PostgreSQL `/v2` API foundation, Tencent Cloud infrastructure definitions, and CI coverage. This run does not claim that the product is launch-ready.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/box-catalog.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`

## Product truth used

- iOS, Android, and PC Web remain required release targets; this change does not reduce platform parity.
- Phone SMS authentication precedes learning, canonical account state is server authoritative, and membership entitlement is shared across release targets.
- Learning remains a single-card flow with the five existing interaction families. Audio is a resource, not a separate interaction family.
- Production content remains external to this repository and requires explicit formal approval. A green validator or active development payload is not production approval.
- The default trial remains five days and the fixed products remain `com.softbook.cet.premium.monthly` and `com.softbook.cet.premium.yearly`.

## Implementation hypotheses changed

- The production API is a Node.js/TypeScript Fastify service backed by TencentDB PostgreSQL; the existing CloudBase NoSQL `/v1` function remains development/staging compatibility only.
- Production SMS uses Tencent Cloud's TC3-HMAC-SHA256 request signing. Phone lookup values are HMAC protected, phone values are AES-256-GCM encrypted, and access/refresh tokens are stored only as hashes.
- Access tokens expire after 15 minutes, refresh sessions rotate after use, logout revokes a session, and account deletion revokes all sessions before queuing deletion work.
- `learning-events.v2` uses event IDs plus device IDs/cursors. Exact replay is idempotent; reused IDs or cursors with different payloads fail with HTTP 409.
- Canonical day boundaries use `Asia/Shanghai`. Production proxy trust is limited to the closest platform proxy rather than arbitrary forwarded headers.
- Active `content-release.v1` records require a manifest hash, signature key, signature, formal approval record hash, activation time, per-pack hashes, and an approved active database state.
- Mobile Release builds require HTTPS remote configuration, production signing on Android, no local runtime feature, and no fallback to tracked development cards. Distributable Release builds remain blocked while the tracked launch and external-account contracts are not ready.
- Terraform owns private PostgreSQL, its security group and backup plan, and a private encrypted/versioned COS content bucket. CloudBase Run deployment remains explicit and refuses to proceed without preconfigured secrets.

## Workspace boundary and read scope

- Active truth/source read: the task-relevant specs above, mobile runtime configuration and persistence boundaries, both API implementations, CI, dependency policy, repository health scripts, and existing run-record conventions.
- Generated/dependency read: installed React Native, CocoaPods, Gradle plugin, Terraform provider schema, npm audit output, and temporary Xcode products only for verification.
- Archive scope: no legacy archive or generated evidence was used as active product truth.
- External workspace: `/Users/lenkin/programing/card make` was not edited. Production content approval remains an external blocked gate.

## Files changed

- `docs/release/launch-readiness.v1.json` and `external-account-readiness.v1.json`: explicit not-ready launch and external-account state.
- `scripts/validate_launch_readiness.mjs` and tests: exact product, dependency, gate, evidence, and ready-state enforcement.
- `services/api/`: TypeScript production API, PostgreSQL migration/repository, SMS signing, auth/session/deletion/bootstrap/content/event contracts, tests, container, and operations documentation.
- `infra/production/`: Tencent Cloud Terraform, environment examples, guarded CloudBase Run deployment, and provisioning guidance.
- `apps/mobile/`: native runtime profile injection, Release configuration guard, production fallback prohibition, Android release signing boundary, and tests.
- `scripts/normalize_react_native_gradle_plugin.mjs` and test: deterministic React Native Gradle 9 Foojay compatibility normalization with upstream-drift failure.
- `.github/workflows/pr-gates.yml`, Dependabot, dependency policy, ignore rules, mobile bootstrap docs, PR template, and `spec/runtime-boundaries.json`: CI and governance integration.

## Commands run

- Mobile: `npm run lint -- --quiet`, both metadata scans, `npm run typecheck`, `npm run release-config-test`, and `npm test -- --runInBand --watchAll=false`.
- Development `/v1` API: `npm test` in `infra/cloudbase/functions/softbook-api`.
- Production `/v2` API: `npm run typecheck`, `npm test`, `npm run build`, and `npm audit --omit=dev --audit-level=high`.
- Platform: launch readiness tests/report, Terraform `fmt -check` and `validate`, plist/project lint, and YAML parsing.
- Governance: Maestro selectors, harness validation, dependency policy/normalizer tests, repository health regressions, evidence index, LFS fsck, and whitespace checks.
- Native iOS: clean source-Hermes CocoaPods install, Release simulator build with the CI-only incomplete-artifact marker, and an expected failing Release build without readiness/configuration.

## Validation results

- Mobile: lint/typecheck/scans passed; 29 Jest suites and 189 tests passed; 4 Release-guard tests passed.
- Development API: 14 tests passed.
- Production API: 16 local tests passed, one PostgreSQL integration test is correctly skipped without a local PostgreSQL server, build passed, and production dependencies have zero advisories.
- Production API contract coverage includes SMS cooldown/one-time use, rate-limit error preservation, session rotation/revocation, deletion lockout, canonical bootstrap, signed/approved manifest fields, event replay/conflicts, fail-closed bootstrap/content, malformed dates, encrypted phones, and China day rollover.
- Terraform: provider initialization and validation passed with Tencent Cloud provider 1.83.10.
- iOS: Release simulator build succeeded with `CI=true SOFTBOOK_ALLOW_INCOMPLETE_RELEASE=1`; a normal Release build failed before compilation as required because launch readiness is not ready and the production URL is absent.
- Harness/governance: selectors, harness, dependency security, repository health regressions, evidence index, LFS, JSON/YAML/plist, and whitespace checks passed.
- Remote-only checks did not execute: PostgreSQL 16 integration and Android Kotlin compilation both failed at job startup with zero steps because of the GitHub account billing/spending-limit state.

## Binary evidence

- Evidence manifest: N/A.
- Archive: N/A.
- Xcode, Pods, Terraform providers, compiled JavaScript, and API build output remain ignored or under `/tmp`; no generated binary or report is committed.

## Agent review status

- Reviewer: Codex
- Status: Blocked
- Prior conclusion: the earlier `Passed` result is retracted because it was recorded before mandatory remote evidence had actually executed.
- Blocking findings: PostgreSQL integration and Android Kotlin compilation have not run; all GitHub Actions jobs failed before their first step because of the account billing/spending-limit state; mobile still uses development `/v1` contracts; and the 57-file/6237-line change is too broad for a single production approval.
- Review requirement: decompose this draft into independently auditable slices, run every required local and remote check, and resolve each slice's findings before recording `Passed`.

## User-visible UI impact

- None. Screens, copy, controls, interactions, navigation, and visual assets are unchanged.
- Design authority and design review checklist: not applicable to runtime, backend, infrastructure, and governance work.

## Card make external workspace impact

- None. No card JSON, MP3, candidate PR, review evidence, or `reviews/approved_batches/` record changed.
- The approved-production-content gate remains blocked; this run does not reinterpret candidate validation as formal approval.

## Risks and open questions

- External Apple, Android-channel, Tencent Cloud, payment, domain, ICP/APP filing, privacy URL, and support accounts remain unverified.
- The production service is not deployed. PostgreSQL integration and Android native compilation still require CI; real Tencent SMS delivery requires account credentials and an approved signature/template.
- Mobile repositories still implement development `/v1` payloads. The tracked not-ready contract deliberately prevents distributable Release builds until `/v2` authentication, refresh persistence, bootstrap/session, content packs, sync, membership, and payment adapters are complete.
- Scheduling, signed COS download URLs, deletion workers, audio runtime/QC, StoreKit/WeChat/Alipay verification, PC Web, observability, SLO/load tests, backup restoration, security testing, content approval, and store/compliance review remain open launch gates.
- CloudBase Run does not currently provide direct WAF attachment in the verified topology; edge protection remains an explicit release decision.

## Follow-up

- Use the launch readiness contract as the ordered backlog. Complete and evidence gates rather than changing `not_ready` manually.
- Next platform slice: run the PostgreSQL integration in CI, then implement mobile `/v2` auth with challenge IDs, refresh-token Keychain persistence, canonical bootstrap, and server session delivery before starting the scheduler.
- Provision staging only after external account evidence is recorded; do not deploy production or enable distributable Release while any tracked gate is open.
