# Softbook Release Bundle v1 Runtime Contract

Referenced active specs:

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/repo-delivery-contract.json`

## Authority boundary

`product_truth`:

- The closed beta release contains CET4 only and requires one final whole-track
  user approval.
- Audio remains a card resource and cannot enter a release without complete QC.
- Delivery does not include development users, learning records, credentials,
  signing private keys, or fixed SMS codes.

`implementation_hypothesis`:

- `delivery-profile.v1` describes a receiver-owned CloudBase target with only
  non-sensitive configuration.
- `release-bundle.v1` binds the exact card payload, whole-track approval, quality
  audit, audio asset manifest, audio QC index, and iOS/Android compatibility.
- The repository-local validator, receiver CloudBase adapter, dry-run-first
  unified delivery command, and publisher orchestration are implemented. A
  receiver environment, its secrets, actual uploads, activation, rollback
  drill, remote device smoke, and verification remain external execution
  evidence.

## Environment-independent content identity

Content versioning includes stable audio identity, duration, media type, hash,
and byte size. It excludes the CloudBase `storage_file_id`, because that locator
is created separately in every receiver environment. A release-bundle payload
uses a safe relative `asset_path`; the publisher uploads those bytes, obtains
private CloudBase file IDs, and then revalidates that the hydrated runtime
source still has the bundle content version.

## `delivery-profile.v1`

The profile contains `profile_id`, receiver `environment_id`, `region`, HTTPS
`api_base_url`, `runtime_mode=closed_beta`, `enabled_tracks=[cet4]`, minimum iOS
and Android client versions, and a public `signing_key_id`. Secret-shaped fields
are rejected. The personal development environment is rejected as a delivery
target. `region` accepts the real CloudBase environment form such as
`ap-shanghai` and an optional numeric zone suffix.

## `release-bundle.v1`

The bundle requires:

- exactly 1,180 CET4 cards and a deterministic content version;
- a card-workspace corpus fingerprint carried by the exported content payload
  and matched exactly by the bundle and final approval;
- a `full_track_final` approval whose exact card/box scope and corpus
  fingerprint match the payload;
- a hash-bound audit with zero unresolved blockers, zero unexplained risks, and
  100% quality metadata coverage;
- exactly 301 audio assets whose paths, sizes, durations, hashes, and QC records
  match the content payload;
- every QC record to state formal readiness and pass all required text,
  pronunciation, rhythm, noise, no-autoplay, subtitle, and provenance checks;
- explicit minimum iOS/Android versions, parent release, and release time.

Every referenced file must remain inside the bundle directory and match its
declared SHA-256. Missing evidence fails closed.

## Publish and rollback ordering

Publishing performs only this order:

1. upload and hash-bound all private audio assets;
2. hydrate and stage the new immutable content version;
3. verify the staged content and release evidence;
4. activate `content-release.v1` last.

An error before activation leaves the previous release active. Rollback first
verifies a retained release and then changes only the active release pointer;
it never deletes learning data. The publisher adapter is deliberately injected
so repository tests can prove ordering without writing CloudBase.

The concrete receiver adapter stores immutable staged versions in
`softbook_card_source_versions`. It re-downloads every uploaded private audio
object and verifies byte length and SHA-256 before staging, binds the staged
document to the approval, audit, audio-manifest, and audio-QC hashes, and marks
that stage verified before changing `softbook_card_sources.cet4`. Retention
metadata is written before the current-source pointer, so activation remains
the final write.

## Receiver delivery command

`infra/cloudbase/deliver-release.mjs` exposes `preflight`, `provision`,
`deploy`, `publish`, `verify`, and `rollback`. Mutating commands are dry-run by
default and require `--apply`, Node 22.13.0, a clean local `main` exactly equal
to `origin/main`, a receiver-owned profile, successful remote inspection, and
receiver secrets supplied through environment variables.

Provisioning creates only the existing CloudBase collection allowlist.
Deployment builds and tests an isolated lockfile-resolved function artifact,
uses a mode-0600 temporary CloudBase config, and removes it after use. The
production runtime excludes `SOFTBOOK_SMS_DEV_CODE` and requires a
receiver-owned HTTPS SMS webhook plus separate auth, SMS, and Ed25519 signing
secrets. `verify` is read-only and checks the active release, API route, bundle,
catalog, and zero imported user-data baseline. A real lifecycle-managed
production SMS/device smoke is still a separate acceptance gate.

## Closed-beta readiness aggregation

`docs/release/beta-release-readiness.v1.json` is the independent closed-beta
acceptance ledger. It requires five separately evidenced domains: content,
audio, iOS/Android clients, backend, and receiver delivery. Its validator is
`scripts/validate_beta_release_readiness.mjs` and is also invoked by the normal
launch-readiness command.

Every release evidence item is a distinct tracked, size- and SHA-256-bound
repository artifact. Human CET review, perceptual audio review, real-device
smoke, and final whole-track user approval require their corresponding named
human or product-owner verifier. External card-workspace reports may be recorded
as diagnostic observations, but cannot become release evidence merely because
their technical audit passes. The personal development database is excluded.
The current record remains `not_ready` until all five domains pass; a single
green test or build cannot substitute for whole-release readiness.
