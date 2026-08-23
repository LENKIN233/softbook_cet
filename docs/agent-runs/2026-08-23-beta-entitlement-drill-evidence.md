# Agent Run Record: beta entitlement drill evidence

## Task summary

- Date: 2026-08-23
- Branch: `infra/beta-entitlement-drill-evidence-v1`
- PR: #520
- Summary: Register strict formal closed-beta evidence semantics for one exact
  beta entitlement grant, idempotent grant replay, revoke and idempotent revoke
  replay sequence without ingesting phone-bearing command files.

## Referenced specs

- `AGENTS.md`
- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/cet4-closed-beta-readiness.json`
- `spec/release-operational-policy.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `infra/cloudbase/beta-entitlement-v1-runtime-contract.md`

## Product truth used

- Receiver-only beta access is campaign-bound premium without payment and must
  never mutate base membership.
- Formal readiness needs real receiver execution, not dry-run, labels or one
  isolated operator report.
- Personal command bytes and phone numbers are never formal repository evidence.

## Implementation hypothesis changed

- `beta-entitlement-drill` is registered with five exact checks.
- Every wrapper resolves five distinct tracked strict-JSON roles: delivery
  profile plus applied grant, grant replay, revoke and revoke replay report v2.
- All phases bind the same candidate commit/profile/environment/campaign,
  account fingerprint, grant, actor and base-membership digest.
- Grant must move a non-premium base stage to premium and produce active state;
  revoke must restore the original base stage and produce inactive state.
- Each mutation advances revision/audit count exactly once; each replay uses the
  identical command/state digest and performs no write.
- Every report independently revalidates receiver preflight, Node 22.13, clean
  exact main/origin, applied/passed state, ordered execution and raw-report
  `gate_eligible=false`.
- Outer and nested bytes retain tracked/root/size/SHA-256 and reachable-commit
  validation; only the semantic wrapper may be formal evidence.

## Workspace boundary and read scope

- Active truth/source read: listed specs/contracts, launch evidence contract,
  closed-beta loader and beta operator report v2 shape.
- Generated/dependency/cache/archive read: temporary strict JSON fixtures only;
  not product truth and deleted after tests.
- External card workspace and receiver control plane: none.

## Files changed

- Launch evidence registry, validator and five-role raw loader.
- Closed-beta supported evidence registry and runtime mirror.
- End-to-end/negative/tamper tests and PR workflow registration.
- HR-49 / GT-42, classifier, harness mirrors and beta runtime documentation.
- `docs/agent-runs/2026-08-23-beta-entitlement-drill-evidence.md`: this record.

## Commands run

- Focused beta drill evidence tests -> 3/3 passed.
- Combined beta drill/content/builder/classifier/closed-beta/public-launch tests
  -> 74/74 passed after replay onto merged #519 `main`.
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`.
- `npm test` backend -> 298/298 passed.
- Learning contract -> 17/17 passed.
- Node 22.13.0 local gates -> 24/24 passed, zero exception; report
  `exports/local-gates/beta-entitlement-and-drill-v1-dev.json`.
- `git diff --check` -> passed.
- PR checks -> pending after publication.

## Validation results

- A complete four-phase drill validates against one exact candidate while
  overall readiness remains false because other gates are incomplete.
- Planned grant, campaign drift, replay write, base digest drift, revision gap
  and wrong Node version fail closed.
- Tracked raw report mutation fails size/SHA-256 verification.

## Binary evidence

- Evidence manifest: N/A. Tests use temporary JSON only.
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

- No receiver command was executed and no real account or phone data was read.
- A syntactically valid wrapper cannot exist until four real report v2 files
  are generated on clean exact `main` in the receiver environment.
- This gate does not replace Space, distribution/device or release-recovery
  evidence.

## Follow-up

- Merge with beta report identity in PR #520.
- Continue Space sync and real private-distribution/device evidence semantics.
