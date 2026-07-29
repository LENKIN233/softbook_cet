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
- The repository-local validator and publisher orchestration are implemented;
  a receiver environment, its secrets, actual uploads, activation, rollback
  drill, and remote verification remain external execution evidence.

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
target.

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
