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

The receiver adapter accepts a rollback target only when its stored release
verification is true and its `retention_status` is exactly `retained`.
Verification alone is not enough to make an arbitrary staged version a
rollback target.

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

## Operational evidence policy

`spec/release-operational-policy.json` owns the minimum non-regressing launch
thresholds and the formal evidence schema. The
`release-slo-and-recovery-drill` gate requires one coherent campaign containing
all five `release-operational-evidence.v1` reports:

- load test;
- availability observation;
- backup and isolated restore;
- penetration test;
- release rollback.

All reports share the exact commit, policy hash, receiver-owned profile and
environment, release and parent release, bundle, content version, backend
deployment, and iOS, Android, and PC Web builds. The validator recomputes pass
from raw counts and measurements against the policy; it requires the outer and
inner subject commit to match and that commit to be reachable from the
validated repository HEAD. Every report must match the single
product-owner-recorded `launch-release-candidate.v1` cohort, and nested
repository raw artifacts are rechecked for tracked regular-file identity,
size, and SHA-256. Formal reports may reference only `repo://` raw artifacts;
large or restricted remote evidence must first be represented by an
`evidence-archive`-verified repository manifest. Measured duration and
timestamps must fit the execution window. Availability records exact
expected/success/failed/missing counts, ratio, latency, and outage for every
required route and binds their sums to the aggregate. Backup requires every
source dataset to be nonempty before exact restored count/hash comparison, and
RPO is recomputed from the snapshot and recovery reference. Rollback uses
distinct A/B releases with explicit verified/retained state plus a nonempty
learning-data count and hash. It does not trust a self-declared result. The
five reports must also carry hashed raw artifacts and an independent verifier
different from the execution operator. The protected product-owner
environment remains the merge authority; report identity strings are
metadata, not authentication by themselves.

External account readiness uses `external-capability-evidence.v1`. Each report
binds the exact reachable repository commit, target release, policy hash,
account, capability, provider observation, required control-plane checks, and
tracked repository raw artifacts whose size and SHA-256 are rechecked. It is
always `gate_eligible=false`: external capability evidence cannot replace
runtime, payment, distribution, compliance, or security launch gates. Portal
records and identity fields remain metadata; the protected product-owner
Environment authenticates approval for the exact pull request head.

Other launch-gate evidence remains fail-closed when no type-specific
measurement contract is registered. A generic scope and summary cannot make a
gate eligible.

## Repository blank-environment simulation

`infra/cloudbase/release-blank-environment-simulation.mjs` runs the real
publisher, receiver adapter, and rollback functions against an injected
credential-free in-memory CloudBase runner. It starts from an empty receiver,
publishes and verifies release A, inserts a synthetic learning-data sentinel,
publishes and verifies release B, rolls back and reverifies A, and proves the
sentinel count and canonical hash are unchanged with zero delete operations.

Its output is fixed to:

- `schema_version=release-blank-environment-simulation.v1`;
- `execution_mode=repository_in_memory`;
- `simulation=true`;
- `gate_eligible=false`.

The simulation is a regression framework, not receiver execution evidence.
Only a receiver-owned deployment running the formal policy can satisfy the
launch gate.
