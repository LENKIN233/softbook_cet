# Agent Run Record: Learning manifest binding

## Task summary

- Date: 2026-07-29
- Branch: `module/learning-manifest-binding`
- PR: `#455` (`https://github.com/LENKIN233/softbook_cet/pull/455`)
- Summary: Bind authenticated, signed content manifests to remote Learning sessions so card source, scheduler selection, membership access, and audio descriptors must agree before a card is returned. This adds no player or user-visible audio control.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/runtime-boundaries.json`
- `spec/harness-architecture.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`

## Product truth used

- Audio remains a card resource, not a separate interaction family, and must not autoplay.
- Remote content failures must fail closed rather than substitute bundled development cards.
- Server-side session and membership authority define the accessible card prefix; a mobile manifest cannot expand it.

## Implementation hypothesis changed

- A remote Learning repository now requires an explicit content-manifest mode. `remote` loads and verifies the signed manifest; `disabled` is an explicit development-only staged-smoke state that returns no manifest.
- Remote loading verifies one exact track/content version across card source, server session, and manifest, then rejects catalog, signature, download, or access-mode/count drift before returning a selected card.
- The verified manifest is retained only in the in-memory `LearningSession`; expiring URLs are not persisted.
- Native cache-to-player wiring, playback state/UI, production key values, Android native release injection, deployment, and device smoke remain pending.

## Workspace boundary and read scope

- Active truth/source read: `AGENTS.md`, task-relevant specs and runtime contract, mobile Learning/audio runtime and tests, and delivery/run-record contracts.
- Generated/dependency/cache/archive read: ignored test output only; no archive or generated product output was treated as truth.
- External workspace read: none. `/Users/lenkin/programing/card make` was not accessed.

## Files changed

- `apps/mobile/src/learning/learningRepository.ts`, `model.ts`, `session.ts`: require explicit manifest mode, bind verified manifests to remote sessions, and expose only in-memory session state.
- `apps/mobile/App.tsx`: resolve the release keyring and pass an explicit remote or disabled manifest mode to the Learning repository.
- Mobile tests: cover binding, access drift, failed manifest fetches, runtime keyring wiring, and explicit staged local manifest profiles.
- `spec/runtime-boundaries.json`, `infra/cloudbase/content-manifest-v1-runtime-contract.md`: record the implemented binding and remaining playback/device/deployment gaps.

## Commands run

- `cd apps/mobile && npm test -- --runInBand --watchAll=false --no-watchman` -> 43 suites and 399 tests passed.
- `cd apps/mobile && npm run typecheck` -> passed.
- `cd apps/mobile && npm run lint -- --quiet` -> passed.
- `python3 scripts/validate_harness.py --format text` -> passed.
- `node scripts/validate_dependency_security.mjs` -> mobile and CloudBase API report zero known vulnerabilities.
- `git diff --check` -> passed.

## Validation results

- A signed manifest must match every loaded card audio descriptor and the exact session access mode/count before a remote session returns.
- A failed or unsigned manifest and an access mismatch reject the session; no bundled-card fallback occurs.
- Release keyring mode is passed from App to the Learning repository. Existing remote smoke fixtures explicitly declare the manifest feature local and receive no manifest.
- No user-visible audio state, playback, cache invocation, CloudBase deployment, real private download, or formal content approval was performed.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: Codex
- Status: passed
- Blocking findings: none.
- Review summary: The review verified that remote manifest retrieval is explicit, authenticated, exact-version-bound, and fail-closed. It found test fixtures that had implicitly treated every remote feature as configured; they now explicitly declare local content-manifest mode for staged smoke. Required GitHub checks remain mandatory before merge.

## User-visible UI impact

- N/A. No screen, control, transcript placement, playback state, or motion changes.

## Card make external workspace impact

- N/A. No candidate or approved content was read, produced, changed, or imported.

## Risks and open questions

- Production key values and Android native release injection are still external configuration work.
- The verified manifest is in memory only; it is not yet connected to the content cache or an explicit player.
- The minimum client version is parsed but not yet compared to a release-owned client version at runtime.
- Real private-object download and device verification remain required before audio can be considered usable.

## Follow-up

- Add release-version compatibility enforcement and connect the verified manifest/cache to a player only after an accepted inline audio control and playback-state design artifact exists.
