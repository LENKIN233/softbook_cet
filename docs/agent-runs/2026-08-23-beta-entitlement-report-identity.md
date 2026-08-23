# Agent Run Record: beta entitlement report identity

## Task summary

- Date: 2026-08-23
- Branch: `infra/beta-entitlement-report-identity-v2`
- PR: #520
- Summary: Bind closed-beta entitlement mutations to the exact campaign and
  emit a privacy-safe, commit/profile/operator/execution-bound raw report for a
  later formal grant/replay/revoke drill wrapper.

## Referenced specs

- `AGENTS.md`
- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/cet4-closed-beta-readiness.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `infra/cloudbase/beta-entitlement-v1-runtime-contract.md`

## Product truth used

- Closed-beta access is premium without payment, granted or revoked only by a
  receiver operator; clients cannot self-grant.
- Base membership remains shared server authority and must not be overwritten
  by the beta overlay.
- The release candidate owns one exact beta campaign identity.
- Repository tests and dry-run reports are not receiver execution or readiness
  evidence.

## Implementation hypothesis changed

- `spec/membership.json` now requires campaign binding for closed-beta access.
- `beta-entitlement-command.v1`, every stored audit event and active grant bind
  `campaign_id`; revoke requires the exact active campaign and grant.
- Applied mutation requires an identified `github:` / `team:` / `external:`
  actor plus a full repository commit in addition to existing Node 22.13,
  clean-main/origin parity and receiver preflight requirements.
- `beta-entitlement-report.v2` binds commit, raw profile SHA-256, environment,
  campaign, privacy-safe command hash/account fingerprint, operator and
  execution window, plus the exact observed Node version.
- The report records verified beta state digest/revision/audit/active identity
  and proves the base membership digest is unchanged before and after apply.
- Reports contain no phone or command bytes and remain `gate_eligible=false`
  until a registered formal drill wrapper revalidates the full sequence.

## Workspace boundary and read scope

- Active truth/source read: listed specs/contracts and beta entitlement runtime,
  manager, CloudBase store tests and closed-beta readiness harness.
- Generated/dependency/cache/archive read: installed backend dependencies only;
  not product truth and not retained as evidence.
- External card workspace and receiver control plane: none.

## Files changed

- Membership/runtime contracts, beta entitlement state machine and operator.
- Backend grant/revoke/report/privacy/concurrency tests.
- Formal approval classifier, HR-48 / GT-41 and harness mirrors.
- `docs/agent-runs/2026-08-23-beta-entitlement-report-identity.md`: this record.

## Commands run

- Focused beta runtime/manager tests -> 10/10 passed.
- Combined beta drill/content/builder/classifier/closed-beta/public-launch tests
  -> 74/74 passed after replay onto merged #519 `main`.
- `npm test` backend -> 298/298 passed.
- Formal approval classifier -> 10/10 passed.
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`.
- Learning contract -> 17/17 passed.
- Node 22.13.0 local gates -> 24/24 passed, zero exception; report
  `exports/local-gates/beta-entitlement-and-drill-v1-dev.json`.
- `git diff --check` -> passed.
- PR checks -> pending after publication.

## Validation results

- Grant stores campaign-bound active/audit state; exact replay stays idempotent.
- Revoke rejects campaign or grant drift and preserves later base premium.
- Apply rejects unqualified actor identity, non-full commit and topic/dirty/
  diverged write state before mutation.
- Report exposes stable hashes and public identifiers only; the phone is absent.
- A concurrent base-membership change causes verification failure.

## Binary evidence

- Evidence manifest: N/A. No binary evidence was generated.
- Archive: N/A.

## Agent review status

- Reviewer: Codex primary exact-diff and gate review.
- Status: passed final exact-main semantic and full-gate review.
- Blocking findings: none.

## User-visible UI impact

- None.

## Card make external workspace impact

- None.

## Risks and open questions

- No receiver-owned environment was changed and no real beta account was used.
- Raw report v2 alone cannot pass `beta-entitlement-drill`; the registered
  semantic wrapper still has to require grant, idempotent replay, revoke and
  idempotent replay on one campaign/account/cohort.
- Existing pre-deployment fixtures without `campaign_id` fail closed by design;
  no receiver beta entitlement has been formally deployed or issued.

## Follow-up

- Merge together with the exact four-phase `beta-entitlement-drill` evidence
  semantics in PR #520.
- Continue Space sync and real private-distribution/device evidence semantics.
