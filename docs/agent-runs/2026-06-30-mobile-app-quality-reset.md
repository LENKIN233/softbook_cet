# Agent Run Record: Mobile App Quality Reset Design Search

## Task summary

- Date: 2026-06-30
- Branch: `codex/mobile-design-reset`
- PR: https://github.com/LENKIN233/softbook_cet/pull/267
- Summary: Created a design-only mobile app quality reset using the Design Evolution Engine. The run audits the current real app screenshots, compares eight candidate directions, promotes a one-screen current-object app grammar, and records implementation mapping for future RN work.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/action-surface.json`
- `spec/interactions.json`
- `spec/knowledge-map.json`
- `spec/space-operations.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `spec/perturbation-audit.json`
- `spec/agent-run-record.json`
- `spec/agent-harness.json`
- `spec/evals.json`
- `docs/design/canon.md`
- `docs/design/design-harness.md`
- `docs/design/single-card-ux-contract.md`

## Product truth used

- 软书四六级 is an exam-prep product centered on system-sequenced single-card flow, not a generic English learning dashboard.
- Physical Space is a core differentiator and must preserve library / group / box / card hierarchy.
- User-facing UI requires an accepted design artifact before implementation treats it as shippable.
- Existing RN screens are behavior prototypes and screenshot evidence, not visual authority.

## Implementation hypothesis changed

- Added a mobile core surface reset hypothesis: the app should be rebuilt around current object -> attached action/result layer -> compact Space address -> floating chrome.
- No RN implementation was changed in this run.

## Workspace boundary and read scope

- Active truth/source read: `spec/requirement-memory.json`, `spec/product-core.json`, `spec/visual-language.json`, `spec/perturbation-audit.json`, `docs/design/design-harness.md`, `docs/design/canon.md`, `docs/design/mapping/learning-space-implementation-map-v1.md`, `docs/design/search-runs/README.md`, `docs/design/app-screenshots/current-real-app/*`.
- Generated/dependency/cache/archive read: bundled Playwright package path from the Codex desktop runtime was used only to render screenshots.
- External workspace read: none.

## Files changed

- `docs/design/search-runs/2026-06-30-mobile-app-quality-reset/`: design search run with context pack, current real-app blind audit, eight candidates, hard filter, pairwise reviews, fragment harvest, mutation log, promotion record, rendered proof, and screenshots.
- `docs/design/decisions/mobile-core-surface-reset-v1.md`: accepted design-only direction for the mobile core surface reset.
- `docs/design/mocks/mobile-core-surface-reset-v1.html`: rendered phone proof for Learning, Detail, Space, Statistics, and Mine.
- `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`: future implementation mapping and required screenshot evidence.
- `docs/design/rejected/mobile-core-surface-reset-failures-v1.md`: failure sedimentation for timeline-first, dashboard-first, carousel-first, and report-first directions.
- `docs/agent-runs/2026-06-30-mobile-app-quality-reset.md`: this run record.

## Commands run

- `git switch -c codex/mobile-design-reset origin/main` -> created design reset branch.
- `python3 scripts/validate_design_search_run.py --run docs/design/search-runs/2026-06-30-mobile-app-quality-reset` -> passed after fixing template placeholder text.
- Bundled Node plus Playwright with `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` -> rendered `screenshots/promoted-proof.png` and `screenshots/candidate-proof.png`.
- Bundled Python Pillow pixel check -> confirmed nonblank PNG output with nonzero variance.
- `python3 scripts/validate_pr_design_gate.py --changed-file ...` -> initially failed because checklist PR body was not supplied and one self-assess reference lacked mint/amber evidence; self-assess evidence was corrected.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> initially failed in CI because the visual proof used raw library labels and semantic accent token names; fixed by replacing raw labels with current-library language and generic accent tokens, then passed locally.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed.

## Validation results

- `python3 scripts/validate_design_search_run.py --run docs/design/search-runs/2026-06-30-mobile-app-quality-reset` -> passed.
- Rendered screenshot evidence:
  - `docs/design/search-runs/2026-06-30-mobile-app-quality-reset/screenshots/promoted-proof.png`
  - `docs/design/search-runs/2026-06-30-mobile-app-quality-reset/screenshots/candidate-proof.png`
- `python3 scripts/validate_pr_design_gate.py --body-file /tmp/mobile-reset-pr-body.md --changed-file ...` -> passed.
- `python3 scripts/validate_harness.py` -> passed.
- `npm --prefix apps/mobile run design-metadata-leak-scan` -> passed.
- `npm --prefix apps/mobile run metadata-leak-scan` -> passed.
- `npm --prefix apps/mobile run lint -- --quiet` -> passed.
- `npm --prefix apps/mobile run typecheck` -> passed.
- `npm --prefix apps/mobile test -- --runInBand --watchAll=false` -> passed.

## Agent review status

- Reviewer: Codex self-review
- Status: Passed
- Blocking findings: none currently known

## User-visible UI impact

- Design-only. No app runtime or RN source changed.
- Future user-visible implementation must consume `docs/design/decisions/mobile-core-surface-reset-v1.md`, `docs/design/mocks/mobile-core-surface-reset-v1.html`, and `docs/design/mapping/mobile-core-surface-reset-implementation-map-v1.md`.

## Card make external workspace impact

- N/A. No card content was produced, approved, or imported.

## Risks and open questions

- The rendered proof is not a simulator screenshot. It is a design authority artifact for the next implementation PR.
- Future RN work must prove the design in the actual app with real simulator screenshots.

## Follow-up

- Future implementation PR should consume this design-only artifact and produce real simulator screenshots.
