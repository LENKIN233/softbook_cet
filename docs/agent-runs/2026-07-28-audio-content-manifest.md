# Agent Run Record: Audio content manifest foundation

## Task summary

- Date: 2026-07-28
- Branch: `module/audio-content-manifest`
- PR: pending
- Summary: Added the repository-local, fail-closed audio metadata and content-manifest foundation without claiming native playback or launch readiness.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`

## Product truth used

- Audio is a required content medium on every release target, not a separate interaction family.
- Audio never autoplays. Front-side subtitles remain absent by default; useful transcript text may appear only on the back.
- Membership authority remains server-side, including the stable free card prefix.

## Implementation hypothesis changed

- Added URL-free card audio metadata: `asset_id`, SHA-256, duration, and optional back-side transcript.
- Added authenticated `GET /v2/content/manifest` for an exact active published track and content version.
- The server signs `{access, manifest}` with Ed25519, keeps CloudBase file IDs private, and emits expiring HTTPS URLs only for the canonical membership-accessible card prefix.
- The mobile pure-TypeScript boundary strictly parses the response, verifies signatures through an allowlisted-key verifier backed by `@noble/ed25519`, and recomputes the expected download set from the loaded card catalog.

## Workspace boundary and read scope

- Active truth/source read: `AGENTS.md`, task-relevant specs, accepted Learning design anchors, mobile learning/runtime sources and tests, CloudBase API/runtime/import sources and tests, and delivery/run-record contracts.
- Generated/dependency/cache/archive read: package manifests and targeted installed type declarations/readme metadata for the selected Ed25519 implementation; no generated product output or archive was used as truth.
- External workspace read: none. `/Users/lenkin/programing/card make` was not accessed.

## Files changed

- `spec/interactions.json`, `spec/card-system.json`, `spec/runtime-boundaries.json`, `AGENTS.md`: own and register the audio resource and runtime boundaries.
- `infra/cloudbase/content-manifest-v1-runtime-contract.md`: document request, signed response, membership filtering, client acceptance, and pending work.
- `infra/cloudbase/functions/softbook-api/content-manifest-v1.js`, `index.js`: implement signed manifest delivery, private CloudBase URL resolution, and authorization filtering.
- `infra/cloudbase/card-source-import-commands.mjs`: preserve normalized asset catalogs during current/versioned imports.
- `apps/mobile/src/audio/*`, learning model/source contract: implement strict schema parsing, catalog matching, and real pinned-key Ed25519 verification without UI or playback.
- Mobile/backend tests and package manifests: cover cryptographic interoperability, access over-grant, invalid assets, version drift, expiry, storage leakage, and dependency integration.

## Commands run

- `cd infra/cloudbase/functions/softbook-api && npm test` -> 141/141 passed.
- `cd apps/mobile && npm run typecheck` -> passed.
- `cd apps/mobile && npm run lint -- --quiet` -> passed.
- `cd apps/mobile && npm test -- --runInBand --watchAll=false` -> 40 suites, 376 tests passed.
- `node scripts/validate_dependency_security.mjs` -> mobile and CloudBase API report zero known vulnerabilities.
- `python3 scripts/validate_harness.py --mode local --format text` -> passed with expected local completeness.
- `python3 scripts/validate_harness.py --format text` -> full Harness passed.
- `git diff --check`, JSON parsing, and Node syntax checks -> passed.

## Validation results

- Existing no-asset card sources retain their previous canonical content-version calculation.
- A real Node Ed25519 signature verifies through the React Native pure-JavaScript verifier with strict RFC 8032 semantics; message or key-ID drift fails.
- Free membership receives only the stable first-half card prefix's audio URLs; trial-not-started receives no URL; signed access or download drift fails on mobile.
- No CloudBase deployment or real object download was performed.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: pending PR Agent review
- Status: pending
- Blocking findings: pending

## User-visible UI impact

- N/A. This change adds no visible control, transcript presentation, autoplay behavior, or playback state.

## Card make external workspace impact

- N/A. No candidate or approved content was read, produced, changed, or imported.

## Risks and open questions

- The repository-local endpoint is not deployed. Tencent Cloud authentication remains unavailable in the current process.
- A release-owned mobile public-key keyring and server signing-key configuration are still required; missing configuration fails closed.
- Native download caching, downloaded-byte SHA-256 verification, playback, progress/failure state, and accepted inline audio UI remain pending.
- No formal audio QC or approved production audio is implied by these checks.

## Follow-up

- Add the release key configuration and native content-addressed cache with byte-hash verification, then add explicit playback and the accepted inline audio chip in a separate reviewed PR.
