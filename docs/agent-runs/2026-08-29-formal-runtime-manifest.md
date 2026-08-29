# Agent Run Record: authorization-bound runtime manifest

## Task summary

- Date: 2026-08-29
- Branch: `fix/formal-runtime-manifest`
- PR: https://github.com/LENKIN233/softbook_cet/pull/533
- Summary: Remove the impossible formal-bundle assumption that one input file
  must simultaneously be the authorization-bound sharded manifest and a
  monolithic 1,180-card payload.

## Referenced specs

- `AGENTS.md`
- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/runtime-boundaries.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `infra/cloudbase/release-bundle-v1-runtime-contract.md`

## Product truth used

- Formal CET4 scope remains exactly 1,180 cards, 108 boxes and 301 audio
  references.
- Model authorization binds the exact source runtime payload or manifest byte
  SHA-256 plus its canonical content version. A regenerated monolith cannot
  replace the bound manifest.
- The original manifest and every hash-bound shard must remain independently
  re-verifiable inside the release bundle.
- Bundle assembly does not create content authorization, audio QC, deployment,
  distribution, device or launch evidence.

## Implementation hypothesis changed

- One shared resolver now handles a direct payload or
  `card-make-runtime-payload-manifest.v1`.
- Manifest shards are safe-path, regular-file, strict-JSON, SHA-256, count,
  card-range and global-order checked before their canonical content version is
  recomputed.
- The builder writes normalized `content/cet4.json` for publication and copies
  the original manifest plus all exact shard bytes to their authorization paths.
- The trusted-media verifier and receiver bundle verifier reuse the same
  resolver, while direct monolithic payloads remain supported.

## Files changed

- `scripts/lib/card_make_runtime_payload.mjs`
- `scripts/build_formal_release_bundle.mjs`
- `scripts/test_build_formal_release_bundle.mjs`
- `scripts/verify_trusted_media_run_receipt.mjs`
- `infra/cloudbase/release-delivery-v1.mjs`
- `infra/cloudbase/release-bundle-v1-runtime-contract.md`
- `docs/agent-runs/2026-08-29-formal-runtime-manifest.md`

## Validation

- Current Card Make authorized manifest replay: 3 shards, 1,180 cards, 301
  assets and content version
  `sha256:f93665bae6f14f354756ea9d563b3666b226082d16223a8ef26481ea65f9c5ca`.
- `node --test scripts/test_build_formal_release_bundle.mjs` -> 9/9 passed.
- `node --test scripts/test_verify_trusted_media_run_receipt.mjs` -> 30/30
  passed.
- Release-delivery tests -> 21/21 passed.
- Full CloudBase backend suite -> 329/329 passed.
- Model-acceptance and PR-scope classifier tests -> 3/3 passed.
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`.
- `git diff --check` -> passed.

## Workspace and external facts

- `/Users/lenkin/programing/card make` was read only to replay its current
  tracked authorization manifest and shards; it was not modified by this run.
- No receiver profile, CloudBase receiver write, signing key, distribution or
  device result was created or inferred.
- No user-visible UI, interaction, motion or visual artifact changed.

## Agent review

- Review method: exact final diff, assumption inversion and failure projection
  in the same active model+harness task.
- External model API: not used.
- Final decision and exact diff identity are recorded in PR #533 after this
  run-record commit.

## Remaining boundary

- Formal bundle assembly still requires merged real audio QC and a real
  receiver-owned `closed_beta` profile.
- A verified bundle remains separate from receiver deployment, private
  distribution, device playback and closed-beta readiness.
