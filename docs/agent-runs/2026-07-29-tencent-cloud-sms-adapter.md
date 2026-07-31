# Agent Run Record: Tencent Cloud SMS adapter

## Task summary

- Date: 2026-07-29
- Branch: `infra/tencent-sms-provider`
- PR: [#467](https://github.com/LENKIN233/softbook_cet/pull/467)
- Summary: Added a receiver-selectable direct Tencent Cloud SMS production adapter while retaining the existing HTTPS webhook path, plus a two-phase human-confirmed raw smoke and a typed launch-evidence wrapper contract. No real SMS, CloudBase write, deployment, or receiver-secret access was performed.
- Final integration base before PR creation: `origin/main` `f0410d777f0a539d935537cc74e38f1d6943e41b`; the branch was replayed after the Android release and typed launch-evidence governance PRs merged.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/account-sync-contract.json`
- `spec/runtime-boundaries.json`
- `spec/workspace-boundary.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `infra/cloudbase/auth-v2-runtime-contract.md`
- `infra/cloudbase/release-bundle-v1-runtime-contract.md`

## Product truth used

- Login requires a mainland China phone number and SMS verification code before learning.
- Production must use a receiver-configured non-development SMS adapter with credentials injected outside tracked files; fixed verification codes are development-only.
- A local or CI test cannot prove that a production provider delivered a real SMS or that the receiver environment is launch-ready.

## Implementation hypothesis changed

- Production runtime now supports two explicit provider values: `webhook` and `tencentcloud`; every other value fails closed.
- Tencent Cloud mode uses the official SMS v20210111 SDK endpoint and binds one E.164 recipient to the receiver's SdkAppId, approved sign, approved template, and explicit `code` or `code,expiry_minutes` placeholder order.
- Only one matching Tencent Cloud `SendStatusSet` entry with `Code=Ok` is accepted. Provider response details and credentials are not returned through the public auth error envelope.
- Receiver preflight validates provider-specific configuration and the 1–15000ms timeout before deployment. The deployed environment excludes unused provider credentials and `SOFTBOOK_SMS_DEV_CODE`.
- `infra/cloudbase/smoke-sms-provider.mjs` adds a database-free two-phase real-provider smoke: explicit apply sends from clean exact `main`, and a separate human confirmation reads the received code from stdin. Phone/code state is ignored and mode 0600; random UUID temporary names, exclusive creation, atomic rename, and failure cleanup protect local state, and a successful match removes it before a strict public report is published.
- `sms-provider-smoke.v1` contains only run-bound fingerprints and sanitized provider acceptance metadata and can be written only below `docs/release/evidence/raw/`. It is deliberately ineligible by itself.
- Formal launch readiness requires a `launch-gate-evidence.v1` wrapper whose `measurements.report_role` resolves to the tracked raw report. The validator re-hashes both files and binds campaign/run ID, reachable candidate commit, receiver environment, send/confirmation window, human verifier, release candidate, independent attestation, size, and SHA-256; a direct raw report or generic summary fails closed.

## Workspace boundary and read scope

- Active truth/source read: task-relevant authentication, runtime, delivery, governance specs; CloudBase auth/delivery implementation and tests.
- Generated/dependency/cache/archive read: the installed official Tencent Cloud SMS package was inspected only to confirm the v20210111 request shape and CommonJS export. It was not used as product truth.
- External workspace read: none. `/Users/lenkin/programing/card make` was not read or modified.
- External technical references: official Tencent Cloud SMS SendSms and Node SDK documentation were consulted for the current endpoint, fields, SDK generation, E.164 format, and `Code=Ok` result contract. Rechecked on 2026-08-01: the official page last updated 2026-04-16 still identifies `2021-01-11` as the current version, requires approved domestic `SignName`/`TemplateId`, exact template parameter count, E.164 recipients, and exposes `SendStatusSet` plus `RequestId`; npm still reports `tencentcloud-sdk-nodejs-sms@4.1.240` as `latest`.

## Files changed

- `infra/cloudbase/functions/softbook-api/sms-provider.js`: direct Tencent Cloud provider, strict configuration, E.164 conversion, template binding, response validation, timeout bound, and generic failure surface.
- `infra/cloudbase/deliver-release.mjs`: receiver-selected provider preflight and provider-specific runtime environment.
- `infra/cloudbase/functions/softbook-api/package.json` and `package-lock.json`: exact official SMS SDK dependency and compatible secure `uuid` override.
- `infra/cloudbase/functions/softbook-api/test/sms-provider.test.js` and `deliver-release.test.js`: provider contract, fail-closed configuration, response mismatch, timeout, secret isolation, and fixed-code exclusion coverage.
- `infra/cloudbase/smoke-sms-provider.mjs` and `infra/cloudbase/functions/softbook-api/test/sms-provider-smoke.test.js`: private prepare state, apply-only send, bounded human confirmation, PII-free report, expiry/attempt cleanup, safe path, and interrupted-state discard behavior.
- `scripts/validate_launch_readiness.mjs` and `scripts/test_validate_launch_readiness.mjs`: strict semantic validation for evidence declared as `sms-provider-smoke`, beyond its repository hash and size.
- `scripts/lib/launch_evidence_contract.mjs` and `docs/release/README.md`: register the SMS-specific typed measurement contract and document the raw-report/formal-wrapper boundary without weakening the existing typed evidence policy.
- `spec/runtime-boundaries.json`, `infra/cloudbase/auth-v2-runtime-contract.md`, `infra/cloudbase/release-bundle-v1-runtime-contract.md`, and `infra/cloudbase/README.md`: implementation status and receiver setup contract.

## Commands run

- `cd infra/cloudbase/functions/softbook-api && npm test` -> 197/197 tests passed on the rebased branch after the 2026-08-01 provider-shape and typed-wrapper tightening.
- `cd infra/cloudbase/functions/softbook-api && node --test test/sms-provider.test.js test/deliver-release.test.js` -> 23 tests passed at an earlier targeted checkpoint; all later provider and smoke regressions are included in the final 197-test run.
- `cd infra/cloudbase/functions/softbook-api && npm audit --omit=dev --audit-level=moderate` -> zero known vulnerabilities after overriding the SDK's compatible `uuid` dependency to 11.1.1.
- `node scripts/validate_dependency_security.mjs` -> mobile and CloudBase API both reported zero known vulnerabilities.
- `python3 -m json.tool spec/runtime-boundaries.json` and `git diff --check` -> passed.
- `scripts/run_local_gates --profile dev` -> `PASSED_WITH_EXCEPTION`, 19/20 passed, no failed gate; only the declared development Node 25.9.0 versus pinned Node 22.13.0 exception remained.
- `python3 scripts/validate_harness.py --format text` -> `HARNESS VALIDATION OK` after replay onto the post-#460/#463 main.
- `node --test test/sms-provider.test.js test/sms-provider-smoke.test.js` -> 24 targeted provider/smoke tests passed before the final request-ID and symlink regressions; both are included in the final full run.
- `node --test scripts/test_validate_launch_readiness.mjs && node scripts/validate_launch_readiness.mjs` -> 19 tests passed; tracked readiness remained structurally valid and honestly `ready=false`.
- Final typed-evidence regression: `node --test scripts/test_validate_launch_readiness.mjs` -> 37/37 passed, including direct-raw rejection, mandatory raw-report injection at the shared validator boundary, and campaign/commit/environment/time/verifier/hash wrapper binding.
- `scripts/run_local_gates --profile dev` -> `PASSED_WITH_EXCEPTION`, 19/20 passed and zero failed gates after `npm ci`; the sole declared exception is local Node 25.9.0 versus pinned Node 22.13.0.
- Mobile regression within the final local-gate run -> 44 suites / 423 tests passed.

## Validation results

- The adapter emits one request for one verified mainland-China number, converts it to `+86` E.164, and maps only the configured approved template placeholders.
- The Tencent adapter rejects every non-six-digit verification code before calling the provider, matching the repository generator and the current provider template constraint rather than relying on remote rejection.
- Missing credentials, unknown provider values, unsafe regions/IDs/template fields, invalid timeout values, non-`Ok` delivery results, and mismatched returned numbers fail closed.
- Tests assert that receiver reports expose configured variable names but never secret values, and that one provider's deployed environment does not contain the other provider's credentials.
- No provider account, approved sign/template, lifecycle-managed phone, or receiver CloudBase environment was available; real delivery smoke remains pending.
- No SMS smoke command was run with `--apply`; no phone, generated code, provider request, private state, or public smoke report was created during this implementation.
- Local dev gates passed with the repository-declared Node-version exception; full remote-aware Harness validation now also passes on the rebased branch.
- A CLI dry-run instantiated the official Tencent Cloud adapter with synthetic configuration, returned only provider/target/path readiness metadata, created no state file, and exposed neither the synthetic phone nor code.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: Codex
- Status: Passed for the Tencent SMS implementation scope
- Blocking findings: none in the changed adapter, delivery preflight, tests, dependency lock, or runtime documentation
- Review summary: Verified provider selection fails closed, template order is exact, the recipient is E.164 and result-bound, only six-digit codes reach Tencent Cloud, timeout is bounded, unused-provider variables are not deployed, provider errors are generic, fixed codes remain excluded, and the official latest SDK dependency has zero known audit findings. The smoke path requires explicit apply on clean exact main, never accepts the received code through argv/environment, bounds confirmation attempts, removes expired/private state, rejects symlink escapes, and publishes no raw report without a human code match. Typed evidence cannot pass with the raw report alone: the launch candidate, environment, campaign, execution, independent verifier, tracked raw bytes, wrapper bytes, and semantic report must all match.

## User-visible UI impact

- N/A. No screen, copy, visual state, interaction, accessibility behavior, or mobile error mapping changed.

## Card make external workspace impact

- N/A. No card, audio asset, QC record, content audit, or approval state changed.

## Risks and open questions

- Tencent Cloud account enablement, approved sign/template, least-privilege CAM credentials, and a lifecycle-managed real-message smoke are still external acceptance requirements.
- The current adapter proves request construction and strict result handling locally; it does not prove provider availability, carrier delivery, or message rendering on a physical device.
- The beta readiness backend blocker remains `production_SMS_adapter_smoke_missing` until immutable receiver-owned smoke evidence exists.
- The smoke report records an exact human-entered received-code match and provider acceptance, but it cannot prove carrier delivery latency or handset notification behavior beyond that confirmation.

## Follow-up

- Receiver selects `tencentcloud` or `webhook`, injects credentials through CI/runtime secrets, and runs preflight before any apply command.
- After Tencent Cloud sign/template approval, execute a lifecycle-managed SMS smoke and archive hash-bound evidence without committing phone numbers, codes, or credentials.
- Run smoke dry-run first, then `prepare --apply`; pipe the human-received code to `confirm --apply` through stdin. Commit only the resulting PII-free raw report, then create the formal `launch-gate-evidence.v1` wrapper and bind both exact hashes/sizes plus the candidate, environment, campaign, time, verifier, and attestation in launch and beta readiness evidence.
- Complete the blank receiver CloudBase provision/deploy/publish/verify/rollback drill separately.
