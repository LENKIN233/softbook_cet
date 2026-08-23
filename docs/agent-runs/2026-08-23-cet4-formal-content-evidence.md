# Agent Run Record: CET4 formal content evidence

## Task summary

- Date: 2026-08-23
- Branch: `infra/cet4-formal-content-evidence-v1`
- PR: #519
- Summary: Register strict closed-beta evidence semantics for exact CET4 box,
  card, audio-QC and content-pack coverage over an applied formal bundle report
  and the tracked human approval/QC artifacts it verified.

## Referenced specs

- `AGENTS.md`
- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/card-system.json`
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
- `infra/cloudbase/release-bundle-v1-runtime-contract.md`

## Product truth used

- Formal CET4 content scope is exactly 1,180 cards, 108 boxes and 301 audio
  assets.
- One exact `full_track_final` user approval must cover every card and box and
  bind the same corpus and audit bytes.
- Every referenced audio asset must have a formally ready identified-human QC
  entry covering the bound audio-bearing cards.
- A bundle builder/report cannot manufacture human approval or QC and remains
  gate-ineligible outside a semantic evidence wrapper.

## Implementation hypothesis changed

- Four evidence types are registered: CET4 box coverage, card coverage,
  audio-QC coverage and content-pack integrity, each with an exact required
  check registry.
- Every wrapper resolves eight distinct tracked strict-JSON roles: applied
  formal build report v2, delivery profile, release bundle, content payload,
  full-track approval, quality audit, audio manifest and audio-QC index.
- The validator rebinds build-report clean-main/commit/operator/execution and
  profile/bundle/evidence hashes to the exact closed-beta candidate.
- It recomputes unique 1,180-card, 108-box, 301-audio-card and 301-asset scope;
  matches bundle hashes to every raw artifact; matches approval card/box/corpus
  and audit path/hash; and requires zero hard/content/review blockers plus no
  missing cards.
- Audio manifest entries must equal content asset identities. The QC index must
  contain 301 unique formally ready entries, exact manifest asset coverage,
  identified reviewer/timestamp/hash, exact per-asset card bindings, complete
  audio-card coverage and the build report's exact unique-record count.
- Full-track approval revalidation includes its timestamp, exact card/box scope
  and nested 1,180-card zero-blocker audit summary.
- Outer and nested raw files retain tracked/root/size/SHA-256 and reachable
  commit validation from the closed-beta repository loader.

## Workspace boundary and read scope

- Active truth/source read: listed specs/contracts, formal builder/report v2,
  closed-beta and public launch evidence loaders.
- Generated/dependency/cache/archive read: generated strict JSON fixtures only;
  no product truth or retained artifacts.
- External card workspace and control plane: none.

## Files changed

- Launch evidence contract and raw loader for CET4 formal content.
- Closed-beta supported evidence registry and runtime mirror.
- End-to-end/negative content evidence tests and PR workflow registration.
- HR-47 / GT-40, classifier, harness mirrors and release documentation.
- `docs/agent-runs/2026-08-23-cet4-formal-content-evidence.md`: this record.

## Commands run

- Focused CET4 formal content tests -> 4/4 passed.
- Combined content/builder/classifier/closed-beta/public-launch tests -> 71/71
  passed.
- `npm test` backend -> 296/296 passed.
- Learning contract -> 17/17 passed.
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`.
- Node 22.13.0 local gates -> 24/24 passed, zero exception; report
  `exports/local-gates/cet4-formal-content-evidence-v1-dev.json`.
- `git diff --check` -> passed.
- PR checks -> pending after publication.

## Validation results

- All four evidence types validate with their exact check sets.
- Dry-run build report, false user approval, approval summary drift, non-ready
  QC entry, per-asset QC card swap and bundle content-hash drift fail semantic
  validation.
- A complete tracked wrapper validates end to end against the closed-beta
  candidate while readiness remains false because other gates are incomplete.
- Mutating tracked audit bytes fails raw size/SHA-256 verification.

## Binary evidence

- Evidence manifest: N/A. Tests use temporary JSON only.
- Archive: N/A.

## Agent review status

- Reviewer: Codex primary exact-diff and gate review.
- Status: passed local exact-diff and full-gate review.
- Blocking findings: none.

## User-visible UI impact

- None.

## Card make external workspace impact

- None. No real content, approval, audit, audio or QC record was read or changed.

## Risks and open questions

- No real full-track approval or 301-asset human QC exists, so no real wrapper
  can yet be recorded.
- QC record bytes are already core-verified by applied report v2; this semantic
  layer revalidates the QC index identities/hashes rather than inventing review.
- Receiver, device and remaining gate evidence stay incomplete.

## Follow-up

- Rebase after the formal report identity PR merges, finish validation, publish
  and auto-merge.
- Continue beta-entitlement, Space sync and device/distribution semantics.
