# Agent Run Record: controlled pilot publication on main

## Task summary

- Date: 2026-08-12
- Branch: `infra/controlled-pilot-publication-main`
- PR: `https://github.com/LENKIN233/softbook_cet/pull/497`
- Summary: Restore the fail-closed CET4 controlled-pilot publication contract on current `main`, and make shared content authority distinguish development, production, and controlled-pilot releases without weakening formal production.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/card-system.json`
- `spec/box-catalog.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/agent-harness.json`
- `spec/evals.json`
- `spec/agent-run-record.json`
- `infra/cloudbase/controlled-pilot-v1-runtime-contract.md`

## Product truth used

- Softbook remains a CET4/6 single-card learning product; the 120-card controlled pilot is a pre-beta proof and cannot replace the 1,180-card formal CET4 closed-beta release.
- Controlled-pilot publication requires exactly 120 approved CET4 cards, a stable 60-card free prefix, all seven libraries, all five core interactions, active box mapping, explicit synthetic-training disclosure, exact quality-audit binding, and formal QC for every referenced audio asset.
- Candidate conversion, repository simulations, green tests, sample confirmation, technical audio audit, or this PR do not create user content approval or launch evidence.

## Implementation hypothesis changed

- Added exact controlled-pilot profile, bundle, release, approval, audit, audio-QC, entitlement-command and outcome-report validators.
- Added a publisher that validates all bound bytes before private upload, stages and verifies content, activates last, and rereads the active pilot release through an injected receiver adapter.
- Added shared runtime content authority: production accepts only `content-release.v1`; `controlled_pilot` accepts only a current `pilot-content-release.v1` with 120 cards and 60 free cards; development remains non-formal.
- Applied the same authority to authenticated card-source reads, Bootstrap, Learning Events, Learning Session and Space actions. Non-development auth continues to require strong separate secrets, persistent storage, trusted client IP and a non-development SMS provider.
- Reused the concrete CloudBase receiver adapter under an explicit pilot profile boundary and added a separate dry-run-first `preflight|provision|deploy|publish|verify` command. Pilot deployment injects `controlled_pilot`, records distinct staged verification, rereads uploaded assets, activates last and refuses to replace a different active release.

## Workspace boundary and read scope

- Active truth/source read: the referenced product/runtime/governance specs and current backend implementation.
- Generated/dependency/cache/archive read: dependency `node_modules` only to execute the current backend tests; historical topic commit `ae28096f37ca08f1558143a1c0291b252ecfbb7b` was used as implementation source and then reconciled against current `main`.
- External workspace read: `/Users/lenkin/programing/card-make-worktrees/cet4-pilot-samples` and its generated technical-audit/worklist outputs only to verify the exact existing candidate scope; no content or approval record was created or changed.

## Files changed

- `AGENTS.md`: register the controlled-pilot contract, read order, and non-replacement guardrail.
- `spec/doc-manifest.json`: register the controlled-pilot runtime contract.
- `spec/runtime-boundaries.json`: record the current repository-local implementation and explicit remaining work.
- `infra/cloudbase/controlled-pilot-v1-runtime-contract.md`: define product and implementation boundaries without claiming deployment.
- `infra/cloudbase/controlled-pilot-v1.mjs`: validate pilot schemas and exact 120/60 constraints.
- `infra/cloudbase/controlled-pilot-publisher-v1.mjs`: verify bound content, approval, audit, audio bytes/QC and activate last through an adapter.
- `infra/cloudbase/deliver-controlled-pilot.mjs` and shared receiver delivery code: add exact-main-only pilot provisioning, deployment, publication and remote verification without relaxing production delivery.
- `infra/cloudbase/functions/softbook-api/content-release-runtime.js`: central runtime-mode release authority.
- Backend auth, Bootstrap, card-source, Learning Events, scheduler, SMS and Space modules: consume the central authority and accept the explicit controlled-pilot runtime mode without loosening production.
- Controlled-pilot and runtime-mode tests: positive and fail-closed coverage.

## Commands run

- `node --test infra/cloudbase/functions/softbook-api/test/controlled-pilot-v1.test.js infra/cloudbase/functions/softbook-api/test/controlled-pilot-publisher-v1.test.js` -> 10/10 passed after current-main reconciliation.
- `node --test infra/cloudbase/functions/softbook-api/test/content-release-runtime.test.js ...` -> 12/12 passed.
- `node --test infra/cloudbase/functions/softbook-api/test/*.test.js` -> 232/232 passed after runtime-mode and content-manifest coverage was added.
- `npm run lint -- --quiet && npm run typecheck && npm test -- --runInBand --watchAll=false --no-watchman` in `apps/mobile` with Node 22.13.0 -> lint and typecheck passed; 46 suites / 492 tests passed.
- `npm run lint && npm run typecheck && npm test -- --run && npm run build` in `apps/web` with Node 22.13.0 -> lint and typecheck passed; 12 tests passed; production bundle built and excluded development card content.
- `npm test` in `infra/cloudbase/functions/softbook-api` with Node 22.13.0 -> 232/232 passed.
- `python3 scripts/validate_harness.py` -> passed after spec and doc-manifest updates.
- Initial candidate release-mode smoke used content version `sha256:d2de9ebb3e4fcbb14acdd4ff5d76251a6d8d17e1c6445a0e42a264982f7594c9`. After card-make PR #154 removed author-facing `front.context` copy, restored three lock word-bank mirrors, and fixed two product-consumed analysis mirrors, the smoke was rerun against `/tmp/softbook-cet4-pilot-final.KqAEeq/card-make-candidate-handoff-cet4-card-source.json`: 120 cards, 24 audio assets, content version `sha256:dd2d397532556563a205351f04f98184afc09a4cd6a2580966556052ffc24f36`, payload SHA-256 `5f75b4ddd2e3462854d9c5dbdf9543178993356d150e23910966375fbb9feea3`, controlled-pilot accepted, production rejected, expiry rejected, free boundary `012106` / `000007`, internal production phrasing on learner-visible contexts 0.
- Real candidate publication preflight using the same payload -> bundle structure accepted with 120 cards, 60 free cards, exact seven-library and five-interaction distributions, and 24 audio assets; verification then failed closed exactly at the absent `controlled_pilot_120` user approval record. Report: `/tmp/cet4-controlled-pilot-real-preflight-report.json` (`gate_eligible=false`); next required gate after approval is human QC for all 24 referenced audio assets.
- `node --test test/deliver-controlled-pilot.test.js test/deliver-release.test.js test/cloudbase-receiver-adapter.test.js test/controlled-pilot-publisher-v1.test.js` -> 26/26 passed after pilot receiver/deployment wiring and exact active-reread binding; formal release behavior remains covered in the same run.
- `npm test` in `infra/cloudbase/functions/softbook-api` after rebasing onto merged candidate intake -> 240/240 passed.

## Validation results

- Exact production/pilot mode separation passes.
- The full existing backend contract suite passes with no production regression.
- The current 120-card candidate can be normalized into a pilot release while preserving its current `dd2d3975...` content identity; any later card edit must produce and revalidate a different identity.
- The real candidate cannot enter publication without an exact, byte-bound user approval artifact; no approval or audio-QC evidence was synthesized for the preflight.
- A live API smoke correctly refuses memory-backed non-development authentication, preserving the persistent-store boundary; no receiver deployment was attempted.
- `./scripts/run_local_gates --profile pr` initially reported 22/36 passed because the new worktree lacked installed dependencies, the shell used Node 25/Ruby 2.6, and no PR/upstream existed. After installing lockfile dependencies, every affected mobile, web and backend command passed under Node 22.13.0. The required Ruby 3.3 toolchain and PR-context gates remain for GitHub CI.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A

## Agent review status

- Reviewer: Codex independent review record in PR #497
- Status: previous head passed remotely; the new receiver-delivery commit requires a fresh remote run
- Blocking findings: none from the previous review record; protected product-owner environment approval and fresh required checks remain pending

## User-visible UI impact

- N/A. No UI or visual artifact changed.

## Card make external workspace impact

- Card content was not authored here. After this run, card-make PR #154 merged the final corrections and PR #155 recorded the user's explicit exact-version approval; audio-QC remains separate and incomplete.

## Risks and open questions

- The exact 120-card `dd2d3975...` batch is now user-approved through card-make PR #155; any later content change requires a new identity and approval.
- All 24 referenced audio assets still require human perceptual QC and the three product-semantics checks not covered by the current listening worklist.
- Receiver-owned profile/secrets and actual execution, pilot entitlement overlay, exact 120-hour trial timestamps, five-card round gate, deletion-worker extension and mobile pilot-specific wiring remain outside repository-local completion.
- All controlled-pilot artifacts remain `gate_eligible=false` and cannot satisfy formal closed-beta or launch gates.

## Follow-up

- With candidate intake, publication contract and exact content approval now landed, complete human audio QC, build the exact bound controlled-pilot bundle, then execute the receiver delivery command and real iOS/Android learning/private-audio smoke in an independent environment.
