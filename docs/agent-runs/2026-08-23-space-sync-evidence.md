# Agent Run Record: formal Space sync evidence

## Task summary

- Date: 2026-08-23
- Branch: `infra/space-sync-evidence-v1`
- PR: #524
- Summary: Register strict `space-sync-test` evidence semantics over one tracked
  receiver profile and one tracked applied Space sync drill report v1.

## Referenced specs

- `AGENTS.md`
- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json#physical_space_actions_v2`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/box-catalog.json`
- `spec/runtime-boundaries.json`
- `spec/cet4-closed-beta-readiness.json`
- `spec/release-operational-policy.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `infra/cloudbase/space-actions-v2-runtime-contract.md`

## Product truth used

- Space is canonical cross-client account state with independent favorite and
  sleep dimensions.
- Formal closed-beta evidence must bind one exact candidate cohort and tracked
  raw bytes; dry-run plans, mocks and self-declared assertions are ineligible.
- Space evidence cannot replace the separately required production-deployment
  gate or turn an expected backend identity into remote inspection.

## Implementation hypothesis changed

- `space-sync-test` is registered with five exact checks.
- Every wrapper resolves two distinct tracked strict-JSON roles: exact receiver
  delivery profile and one applied `space-sync-drill-report.v1`.
- Report commit/profile/environment, expected backend deployment ID and content
  version bind the exact closed-beta candidate.
- Node 22.13, clean exact main/origin, operator and report execution window are
  revalidated; raw report remains `gate_eligible=false` while the wrapper is
  formal evidence.
- Two distinct sessions and secret non-reporting are required.
- The validator recomputes the full revision sequence: initial, favorite +1,
  duplicate +0, conflict +0, sleep +1, favorite restore +1, final restore +1.
- All four action hashes must be unique; statuses, independent toggles and exact
  final-state restoration are recomputed.
- Outer and nested bytes retain tracked/root/size/SHA-256 and reachable-commit
  validation.

## Workspace boundary and read scope

- Active truth/source read: listed specs/contracts, launch evidence contract,
  closed-beta loader and Space drill report v1 shape.
- Generated/dependency/cache/archive read: temporary strict JSON fixtures only;
  not product truth and deleted after tests.
- External card workspace and receiver control plane: none.

## Files changed

- Launch evidence registry, semantic validator and two-role raw loader.
- Closed-beta supported evidence registry and runtime mirror.
- End-to-end/negative/tamper tests and PR workflow registration.
- HR-51 / GT-44, classifier, harness mirrors and Space documentation.
- `docs/agent-runs/2026-08-23-space-sync-evidence.md`: this record.

## Commands run

- Focused Space evidence tests -> 3/3 passed.
- Combined Space/beta/content/builder/classifier/closed-beta/public-launch tests
  -> 77/77 passed.
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`.
- `npm test` backend -> 302/302 passed.
- Learning contract -> 17/17 passed.
- Node 22.13.0 local gates -> 24/24 passed, zero exception; report
  `exports/local-gates/space-sync-evidence-v1-dev.json`.
- `git diff --check` -> passed.
- PR checks -> pending after publication.

## Validation results

- A complete tracked wrapper validates end to end against one exact candidate
  while overall readiness stays false because other gates are incomplete.
- Plan state, expected backend drift, content drift, duplicate revision advance
  and cleanup drift fail closed.
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

- No receiver report exists; the new evidence type cannot pass the gate yet.
- Overall readiness separately requires production-deployment evidence for the
  same candidate; this wrapper validates only expected backend identity.
- Auth abuse, session revocation, account deletion, devices/distribution and
  remaining recovery evidence are still incomplete.

## Follow-up

- Publish and auto-merge this formal Space evidence PR.
- Continue private distribution/device acceptance report semantics.
