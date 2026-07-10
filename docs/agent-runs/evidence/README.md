# Agent Run Evidence Manifests

Binary run evidence is stored outside ordinary Git. A committed JSON manifest in
this directory uses `agent-run-evidence.v1` and records the immutable archive
URL, archive SHA-256, byte size, and per-file metadata.

The local capture directory remains `docs/agent-runs/artifacts/`, but it is
ignored and must not be committed. Validate manifests with:

```bash
node scripts/validate_agent_run_evidence.mjs
```

Historical evidence removed during `history-cutover-2026-07-10` is indexed at
`docs/archive/pre-cutover-evidence-index.json`. That index preserves original
paths, file hashes, archive identity, and links to surviving text records. It is
validated by the same command but is not an `agent-run-evidence.v1` manifest.
