# Agent Run Record: Repository History Cutover

## Task summary

- Date: 2026-07-10
- Branch: `history-cutover-preview`
- PR: N/A; authorized administrative history replacement
- Summary: Replace the active repository history with one signed root while preserving the final old tree, excluding archived generated evidence, and retaining machine-verifiable recovery paths.

## Referenced specs

- `spec/workspace-boundary.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`

## Product truth used

- N/A. Product source, active specs, design authority text, and runtime assets remain byte-equivalent to the final old `main` unless listed by the cutover manifest.

## Implementation hypothesis changed

- Historical screenshots and generated visual evidence are external release assets addressed by per-file hashes instead of ordinary Git blobs.

## Workspace boundary and read scope

- Active truth/source read: final old `main` at `fa108d36d2b406c26737f77333edb191816482f5` and repository governance specs.
- Generated/dependency/cache/archive read: 391 tracked historical evidence files solely to generate the immutable archive index.
- External workspace read: `/Users/lenkin/programing/card make` for coordinated cutover status only.

## Files changed

- `docs/archive/pre-cutover-evidence-index.json`: path-to-archive and SHA-256 mapping for removed evidence.
- `scripts/validate_agent_run_evidence.mjs`: validate the historical index alongside new run evidence manifests.
- `scripts/build_pre_cutover_evidence_index.mjs`: deterministic migration index generator.
- `scripts/report_repo_health.mjs`: reject generated media while allowing explanatory text in evidence directories.
- Historical evidence binaries: removed from ordinary Git and retained in the release archive.

## Commands run

- `git bundle verify` and recovery clone `git fsck --full` -> passed for final old history.
- `node scripts/build_pre_cutover_evidence_index.mjs ... --expected-count 391` -> passed.
- `node scripts/validate_agent_run_evidence.mjs` -> passed with 391 indexed files.
- `python3 scripts/validate_harness.py --skip-remote-guard` and `python3 scripts/validate_maestro_selectors.py` -> passed.
- Fresh `npm ci`, lint, metadata scans, typecheck, 26 Jest suites / 164 tests, and 11 backend tests -> passed.
- Release simulator `xcodebuild` and unsigned device archive -> passed.

## Validation results

- Local validation: all repository, mobile, backend, Release simulator, and unsigned archive checks passed.
- CI validation: pending `history-cutover-preview` workflow.

## Binary evidence

- Evidence manifest: `docs/archive/pre-cutover-evidence-index.json`
- Archive: https://github.com/LENKIN233/softbook_cet/releases/download/history-cutover-2026-07-10/softbook-visual-evidence-2026-07-10.tar.gz

## Agent review status

- Reviewer: Codex
- Status: Passed for local tree and engineering validation; remote preview remains pending
- Blocking findings: none at index construction time

## User-visible UI impact

- N/A. No product UI, interaction, or runtime behavior changes.

## Card make external workspace impact

- Coordinated repository cutover only; no card content or approval state changes.

## Risks and open questions

- Remote archive verification remains pending until the release asset is uploaded.
- Current production dependency audit reports 15 mobile findings including one critical transitive `shell-quote` advisory, and 9 backend findings including six high findings in the CloudBase SDK dependency chain. These are preserved baseline debt and require separate dependency remediation rather than unreviewed lockfile churn during history replacement.

## Follow-up

- Validate the signed root in a fresh clone, switch protected `main`, publish the archive release, and rerun remote evidence verification.
