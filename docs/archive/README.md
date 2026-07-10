# Historical Archive Indexes

Ordinary Git stores active source and text authority. Historical screenshots,
generated visual evidence, repository bundles, and recovery packages are
published as immutable assets on the `history-cutover-2026-07-10` release.

`pre-cutover-evidence-index.json` maps every removed visual evidence path to its
SHA-256, byte size, archive asset, and any surviving text records that cite it.
Use `node scripts/validate_agent_run_evidence.mjs --verify-remote` to verify the
published archive after the release exists.
