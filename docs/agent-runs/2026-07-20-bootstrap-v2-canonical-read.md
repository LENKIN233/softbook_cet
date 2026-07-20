# Agent Run Record: bootstrap v2 canonical read

## Task summary

- Date: 2026-07-20
- Branch: `module/bootstrap-v2-canonical-read`
- PR: https://github.com/LENKIN233/softbook_cet/pull/431
- Trigger: Continue the production launch path after mobile v2 authentication
  adoption merged in PR #430.
- Summary: Add an authenticated `/v2/bootstrap` read for server canonical
  membership, daily progress, learning, physical-space, and content-version
  state; fail closed on missing production content releases; and preserve the
  formal content-approval boundary.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/account-sync-contract.json`
- `spec/runtime-boundaries.json`
- `spec/workspace-boundary.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `infra/cloudbase/bootstrap-v2-runtime-contract.md`
- `infra/cloudbase/auth-v2-runtime-contract.md`
- `infra/cloudbase/mobile-runtime-contract.md`

## Product truth used

- Account, learning, physical-space, and membership state are shared and
  server-authoritative across release surfaces.
- Daily progress and useful learning state must survive device changes; exact
  same-card cross-device resume is not required.
- Production cannot fall back to bundled development cards when remote content
  is unavailable.
- Green validation, content hashes, and development imports cannot create
  formal card approval, a published content release, or launch readiness.

## Implementation hypothesis changed

- An active v2 session can read `/v2/bootstrap` for one explicit track and day;
  account identity is derived only from that session.
- The response carries `bootstrap.v2`, one generated time, canonical membership
  with freshness, daily progress, learning card states, a nullable cursor,
  physical-space state, and deterministic content metadata.
- Missing account documents return explicit empty server state without writing
  defaults or importing a device snapshot.
- Content identity is `sha256:` plus a stable serialization of normalized
  track/source/card content. Object-key order is canonical and array order is
  significant.
- Production bootstrap requires a matching `content-release.v1` descriptor and
  never seeds development cards. Development may expose a null release ID.
- The current card-source importer rejects non-null release descriptors. A
  future release pipeline must verify formal approval evidence before
  publishing one.
- The CloudBase implementation reads several collections and exposes freshness;
  it does not claim a serializable cross-collection snapshot.

## Workspace boundary and read scope

- Active source read: the referenced specs, CloudBase function/store/tests,
  card-source import/audit tools, mock/smoke scripts, and recent Agent run
  records.
- Generated/dependency/cache read: ignored local-gate output and installed
  dependencies were used only for validation, never as product truth.
- Remote read: none before local validation.
- External workspace read: none. `/Users/lenkin/programing/card make` remains
  the candidate-content and formal-approval workspace.

## Files changed

- `spec/account-sync-contract.json` and `spec/runtime-boundaries.json`: classify
  canonical bootstrap behavior and explicit non-claims.
- `infra/cloudbase/bootstrap-v2-runtime-contract.md`: request, response,
  freshness, content-release, and failure contract.
- `infra/cloudbase/functions/softbook-api/bootstrap-v2.js`: isolated canonical
  read service, state validation, stable content hash, and release validation.
- `infra/cloudbase/functions/softbook-api/index.js`: authenticated route,
  read-only store capabilities, empty states, content metadata, and membership
  freshness.
- Backend tests: auth/scope, account isolation, empty/corrupt state,
  cross-instance restore, stable hashes, release mismatch, production fail
  closed, and importer approval boundary.
- Import/audit policy and tools: persist and report content versions while the
  development importer rejects formal release publication.
- Mock/smoke and runtime docs: stateful bootstrap reads before and after writes,
  including membership freshness.
- `docs/agent-runs/2026-07-20-bootstrap-v2-canonical-read.md`: this record.

## Commands run

- `node --test infra/cloudbase/functions/softbook-api/test/*.test.js` -> 39/39
  passed.
- Exact Node 22.13.0 `npm test` in the CloudBase function -> 39/39 passed.
- `node infra/cloudbase/import-card-source.mjs --file /dev/stdin --track cet4`
  with the normalized development source -> dry-run passed, no write.
- Stateful local mock smoke with writes and membership mutations -> v2 auth,
  refresh, bootstrap before/after writes, membership mutations, bootstrap
  freshness, and logout passed.
- `python3 scripts/validate_harness.py --mode local --profile` -> all 15
  selected sections passed with expected partial completeness.
- `git diff --check` -> passed.
- Exact Node 22.13.0, Python 3.12.13, and Ruby 3.3.12
  `scripts/run_local_gates --profile dev` -> 17/17 passed; report remained in
  ignored `exports/local-gates/`.
- `python3 scripts/validate_harness.py` -> passed in full remote mode.
- Exact Node 22.13.0, Python 3.12.13, and Ruby 3.3.12
  `scripts/run_local_gates --profile pr --base origin/main --pr 431` -> first
  run collected 28/29 with only the intentionally Pending Agent review; after
  review completion, the strict profile passed 29/29.
- First-round GitHub `validate-harness`, `mobile-quality`,
  `backend-contract`, `dependency-security`, `repo-health`,
  `evidence-archive`, design-artifact, and formal-approval jobs -> passed.
  Final required checks remain an independent merge gate on the final commit.

## Validation results

- Bootstrap rejects missing/legacy/revoked credentials and account identity
  supplied by request input.
- Memory and CloudBase stores return account-isolated canonical state and
  restore writes across separate function instances.
- Empty reads are explicit and side-effect free; invalid persisted state fails
  closed as `invalid_canonical_state`.
- Production checks published content before reading account state and returns
  `content_release_unavailable` when no matching release exists.
- Content hashes are stable across object-key order and change with ordered card
  content; declared content/release hashes must match normalized content.
- Empty card arrays, duplicate card IDs, impossible calendar dates, and invalid
  persisted timestamps fail validation instead of receiving canonical output.
- The existing development importer cannot publish a formal release.
- Existing `/v1` card-source and membership response shapes remain compatible.

## Binary evidence

- Evidence manifest: N/A
- Archive: N/A. No screenshot, audio, generated report, or binary product
  artifact is created by this backend change.

## Agent review status

- Reviewer: Codex
- Status: Passed
- Blocking findings: None.
- Review summary: Review found and corrected missing membership freshness, a
  development importer path that could accept technically valid but unapproved
  release metadata, empty/duplicate card sources that could receive a content
  hash, and impossible date keys. Focused regressions cover each correction.
  The exact-toolchain dev and strict PR profiles, full remote Harness, backend
  suite, HTTP smoke, and first-round remote jobs show no remaining blocking
  finding. Final GitHub required checks still must pass on the final commit
  before merge and are not replaced by this review.

## User-visible UI impact

- None. No screen, component, copy, motion, or visual token changes.
- The mobile client does not consume `/v2/bootstrap` in this change.

## Card make external workspace impact

- No external card, review, approval, or audio files changed.
- Formal approval remains external and unchanged. This repository only adds a
  technical content hash/release read boundary and refuses to publish a release
  through its development importer.

## Risks and open questions

- Mobile bootstrap adoption is still pending, so product-data writes and card
  payload reads remain on the development-only `/v1` bridge.
- Idempotent `learning-events.v2`, server scheduling/FSRS, exact cursor writes,
  signed manifests/packs, and audio delivery are not implemented.
- The CommonJS CloudBase function and NoSQL collections are still a staging
  implementation, not the planned TypeScript CloudBase Run/PostgreSQL service.
- The approved content-release pipeline does not exist; production correctly
  remains unavailable without it.
- Real SMS, payment entitlement, deletion completion, complete approved content,
  and launch readiness remain outside this change.

## Follow-up

- Require every GitHub check to run and pass on the final review-record commit
  before changing the PR from draft or merging.
- Next serial product slice after merge: adopt `/v2/bootstrap` in the mobile
  runtime before replacing snapshot writes with idempotent learning events and
  server scheduling.
