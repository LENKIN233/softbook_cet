# Agent Run Record: CET4 release bundle delivery

## Task summary

- Date: 2026-07-29
- Branch: `infra/release-bundle-delivery`
- Summary: Added environment-independent CET4 closed-beta release contracts, complete evidence verification, and fail-closed publisher/rollback orchestration. No CloudBase write or deployment was performed.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `infra/cloudbase/content-manifest-v1-runtime-contract.md`
- `infra/cloudbase/release-bundle-v1-runtime-contract.md`

## Product truth used

- This release scope is CET4 closed beta only: 1,180 cards, 108 boxes, and 301 audio references.
- Formal publication requires one final whole-track user approval after complete automated, Agent, and human CET review.
- Audio is a card resource and requires complete QC; it is not a standalone interaction family.
- Delivery must not contain development users, learning data, fixed verification codes, credentials, signing private keys, or a dependency on the personal CloudBase environment.

## Implementation hypothesis changed

- `delivery-profile.v1` is a strict non-sensitive description of a receiver-owned target; it rejects the personal development environment and secret-shaped fields.
- `release-bundle.v1` binds exact content, corpus fingerprint, final approval, audit bytes, all audio bytes, per-asset QC evidence, compatibility, parent release, and release time.
- Content versioning now excludes the environment-specific `storage_file_id` while retaining stable audio identity, hash, size, media type, and duration. Bundle-local `asset_path` is replaced by the receiver upload result without changing content identity.
- Publisher orchestration uploads assets, stages content, verifies the staged source, and activates `content-release.v1` last. Rollback switches only to a verified retained release and never deletes learning data.
- A concrete CloudBase receiver adapter, configurable production SMS adapter, unified provision/deploy/publish/verify command, and blank-environment drill remain pending.

## Workspace boundary and read scope

- Active repository scope: task-relevant specs, CloudBase content/import/deployment code, runtime contracts, release readiness contracts, tests, and delivery governance.
- External content workspace: `/Users/lenkin/programing/card make` was read only for its full-track approval and audio-QC schemas, then its governance PR was updated so a final approval must bind the quality-audit report SHA-256.
- No candidate card content or audio asset was produced, modified, approved, or imported.
- Generated and dependency trees were not used as product truth.

## Files changed

- `infra/cloudbase/release-delivery-v1.mjs`: profile/bundle validators, full evidence verifier, publisher ordering, and retained-release rollback.
- `infra/cloudbase/verify-release-bundle.mjs`: read-only local verification command.
- `infra/cloudbase/functions/softbook-api/index.js`: separate bundle-local and runtime asset locators; make content identity independent of receiver storage IDs.
- `infra/cloudbase/functions/softbook-api/test/release-delivery-v1.test.js`: 1,180-card/108-box/301-audio contract fixtures and fail-closed regressions.
- `infra/cloudbase/release-bundle-v1-runtime-contract.md`, `infra/cloudbase/content-manifest-v1-runtime-contract.md`, `infra/cloudbase/README.md`: runtime and operator boundary.
- `spec/runtime-boundaries.json`, `AGENTS.md`: register the new implementation status and read path.
- External `card make` PR #108: add `card_quality_audit.report_sha256` to full-track final approval governance.

## Commands run

- `tcb db nosql --help`, `tcb storage --help`, `tcb storage upload --help`, `tcb db nosql execute --help` -> inspected available delivery primitives; no remote operation.
- `cd infra/cloudbase/functions/softbook-api && node --test test/release-delivery-v1.test.js` -> 9 tests passed.
- `cd infra/cloudbase/functions/softbook-api && npm test` -> 150 tests passed.
- `python3 scripts/validate_harness.py --format text` -> passed.
- `node scripts/validate_dependency_security.mjs` -> mobile and CloudBase API reported zero known vulnerabilities.
- `git diff --check` -> passed.
- External `card make`: `node scripts/validate_harness.mjs` -> passed with only recorded upstream version/group-alignment warnings.

## Validation results

- A valid bundle cannot pass without 1,180 cards across exactly 108 boxes, 301 audio card references, 301 matching assets, 301 formal QC entries, exact local file hashes, exact user approval scope, audit hash, and complete quality exit metadata.
- One changed audio byte fails verification before publisher execution.
- Receiver storage file IDs do not change the approved deterministic content version.
- Activation is always the final publisher call; failed staged verification cannot activate a release.
- Rollback requires a verified retained release and records that no learning data was deleted.
- No real release bundle exists yet because content remediation, human review, audio QC, and final user approval are incomplete.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: Codex
- Status: passed
- Blocking findings: none in the repository-local contract and orchestration layer.
- Review summary: The review identified the environment-specific content-hash defect, corrected it, added exact approval/audit/audio binding, and verified fail-closed ordering. Remote adapter and empty-environment evidence remain explicit follow-up gates, not implied completion.

## User-visible UI impact

- N/A. No screen, copy, visual state, gesture, or player behavior changed.

## Card make external workspace impact

- Updated PR #108 governance so the final `full_track_final` approval must include and validate the exact card-quality audit report SHA-256.
- No card, transcript, audio file, QC verdict, or approval record was created or changed.

## Risks and open questions

- The CloudBase receiver adapter and unified delivery CLI are not yet implemented, so this PR alone cannot provision, deploy, publish, verify, or roll back a real environment.
- Backend production SMS delivery is not yet wired to a configurable receiver adapter.
- No approved CET4 payload, audio QC index, signing key, receiver profile, or blank receiver environment exists yet.
- GitHub billing currently prevents card-make PR #108 jobs from starting; local validation is green but remote required checks remain blocked.

## Follow-up

- Implement the receiver CloudBase adapter and unified delivery command without weakening the personal-development safety boundary.
- Add the configurable non-development SMS adapter.
- After final content/audio evidence exists, construct and verify a real bundle, then run provision → deploy → publish → verify and rollback in a new receiver environment.
