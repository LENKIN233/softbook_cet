# Agent Run Record: backend token helper metadata leak scan

## Task summary

- Date: 2026-06-15
- Branch: `infra/backend-token-helper-metadata-leak-scan`
- PR: N/A
- Summary: Hardened the mobile and design metadata scanners so backend token/auth helper names cannot leak through visible mobile text, accessibility copy, rendered metadata props, or design visual artifacts.

## Referenced specs

- `spec/doc-manifest.json`
- `spec/authority-map.json`
- `spec/harness-architecture.json`
- `spec/runtime-boundaries.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`

## Product truth used

- `spec/authority-map.json` assigns runtime hypotheses and boundaries to `spec/runtime-boundaries.json`; repo delivery remains owned by `spec/repo-delivery-contract.json`.
- `spec/runtime-boundaries.json` keeps CloudBase runtime and backend wiring as implementation hypothesis, not product truth.
- `infra/cloudbase/functions/softbook-api/index.js` defines backend token/auth helpers: `resolveTokenTtlSeconds`, `isApiKeyAllowed`, `assertBodyPhoneMatchesSession`, `signTokenPayload`, `base64UrlEncode`, `base64UrlDecode`, and `safeEqual`.
- `spec/harness-architecture.json` places mobile/design scanner regression fixtures in the design governance layer with temporary local fixtures only.
- `spec/agent-run-record.json` and `spec/repo-delivery-contract.json` require topic branch delivery, validation, PR Agent review, and a committed run record for harness/governance changes.

## Implementation hypothesis changed

- The mobile scanner now treats `resolveTokenTtlSeconds`, `isApiKeyAllowed`, `assertBodyPhoneMatchesSession`, `signTokenPayload`, `base64UrlEncode`, `base64UrlDecode`, and `safeEqual` as exact raw backend token/auth helper names when they appear in visible surfaces.
- The design scanner now treats the same exact names as raw metadata in design visual artifacts.
- `signTokenPayload` was already caught in rendered design HTML by the process-word rule through `Payload`, but exact scanner and harness coverage now includes it directly.
- Broad words such as `token`, `auth`, `payload`, `base64`, `encode`, `decode`, and `safe` remain out of scope to avoid false positives.
- The design scanner failure report cap now uses `maxReportedFindings = 160` so growing negative fixture coverage remains visible to harness validation.

## Workspace boundary and read scope

- Active truth/source read: `AGENTS.md`, `spec/doc-manifest.json`, `spec/authority-map.json`, `spec/harness-architecture.json`, `spec/runtime-boundaries.json`, `spec/repo-delivery-contract.json`, `spec/agent-run-record.json`, `infra/cloudbase/functions/softbook-api/index.js`, `apps/mobile/scripts/check-metadata-leaks.mjs`, `scripts/check_design_metadata_leaks.mjs`, `scripts/harness_validator/sections/design_governance.py`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `apps/mobile/scripts/check-metadata-leaks.mjs`: added exact backend token/auth helper names to raw metadata detection.
- `scripts/check_design_metadata_leaks.mjs`: added exact backend token/auth helper names to design visual artifact raw metadata detection and raised the reported finding cap for stable harness fixture visibility.
- `scripts/harness_validator/sections/design_governance.py`: added scanner snippet assertions and temporary mobile/design negative fixtures for backend token/auth helper name leakage.
- `docs/agent-runs/2026-06-15-backend-token-helper-metadata-leak-scan.md`: recorded this harness/governance run.

## Commands run

- `git switch -c infra/backend-token-helper-metadata-leak-scan origin/main` -> success.
- Temporary mobile TSX fixture before the scanner patch -> scanner incorrectly passed.
- Temporary design HTML fixture before the scanner patch without `signTokenPayload` -> scanner incorrectly passed; with `signTokenPayload`, the existing process-word rule rejected `Payload`.
- Removed temporary fixtures.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` -> `PASS: No metadata leaks detected in visible text.`
- `node scripts/check_design_metadata_leaks.mjs` -> `PASS: No metadata leaks detected in design visual artifacts.`
- First `python3 scripts/validate_harness.py` run after exact-key patch -> failed because the design scanner only printed the first 80 findings and growing fixture coverage hid `visible-process-leak.html` and `visible-process-leak.svg`.
- Raised the design scanner reported finding cap to 160.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` -> `PASS: No metadata leaks detected in visible text.`
- `node scripts/check_design_metadata_leaks.mjs` -> `PASS: No metadata leaks detected in design visual artifacts.`
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`
- `git diff --check` -> pass.
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/softbook_backend_token_helper_pr_body.md --changed-file apps/mobile/scripts/check-metadata-leaks.mjs --changed-file scripts/check_design_metadata_leaks.mjs --changed-file scripts/harness_validator/sections/design_governance.py --changed-file docs/agent-runs/2026-06-15-backend-token-helper-metadata-leak-scan.md` -> `PR DESIGN GATE OK`
- `python3 scripts/validate_agent_review.py --body-file /tmp/softbook_backend_token_helper_pr_body.md` -> `AGENT REVIEW GATE OK`

## Validation results

- Local mobile metadata scanner validation: pass.
- Local design metadata scanner validation: pass.
- Local negative fixture validation: pass, expected scanner rejection is covered by harness fixtures.
- Full harness validation: pass.
- Whitespace validation: pass.
- PR body design gate validation: pass.
- Agent review body validation: pass.
- CI validation: pending PR.

## Agent review status

- Reviewer: Codex.
- Status: Passed locally; PR body validation passed.
- Blocking findings: none known.

## User-visible UI impact

- None. This changes scanner and harness fixtures only; no accepted design artifact, visual output, screen, copy, reference HTML, or runtime UI changed.

## Card make external workspace impact

- N/A. No sibling external workspace read or content approval action occurred.

## Risks and open questions

- No known blocking risk. The guard is limited to exact backend token/auth helper names and does not scan broad auth/token words.

## Follow-up

- Run final local gates, open a PR, run required checks, and merge after checks are green.
