# Softbook Release Bundle v1 Runtime Contract

Referenced active specs:

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/cet4-closed-beta-readiness.json`
- `spec/repo-delivery-contract.json`

## Authority boundary

`product_truth`:

- The initial closed beta release contains CET4 only. The formal product scope
  contains CET4 and CET6 as separate track-bound releases, and each track
  requires its own final whole-track model-harness acceptance bound to
  `spec/machine-acceptance.json`.
- Audio remains a card resource and cannot enter a release without complete QC.
- Delivery does not include development users, learning records, credentials,
  signing private keys, or fixed SMS codes.
- CET4 closed-beta readiness is recorded separately in
  `docs/release/cet4-closed-beta-readiness.v1.json` with exact 1,180-card,
  108-box and 301-audio scope. Its future `ready` state never changes or lowers
  `docs/release/launch-readiness.v1.json`, CET6, public distribution, payment or
  compliance gates.
- The closed-beta repository loader reuses only registered type-specific
  receiver-deployment, Learning/scheduler and release-recovery semantics
  with `target_release=cet4-closed-beta`, the exact closed-beta candidate
  cohort, tracked/rehashed raw artifacts and reachable commits. Every
  unregistered closed-beta evidence type remains ineligible. SMS raw evidence
  is structurally validated but remains unregistered until a pre-existing
  receiver key registry and deployed IAM attestation are implemented.

`implementation_hypothesis`:

- `delivery-profile.v1` describes a receiver-owned CloudBase target with only
  non-sensitive configuration.
- `release-bundle.v1` binds the exact card payload, whole-track model
  authorization, linked model review, quality
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

The repository source path recorded by model-owned QC may differ from the
bundle delivery path. QC remains bound to its original source path and exact
bytes; the assembler joins QC to the release asset by card ID, asset ID and
SHA-256, copies from the QC source path, and writes to the manifest's delivery
path. The formal QC index never exposes the repository source path.

## `delivery-profile.v1`

The profile contains `profile_id`, receiver `environment_id`, `region`, HTTPS
`api_base_url`, `runtime_mode`, `enabled_tracks`, minimum iOS and Android client
versions, and a public `signing_key_id`. `closed_beta` remains exactly
`enabled_tracks=[cet4]`; the formal `production` profile is exactly
`enabled_tracks=[cet4,cet6]`. Partial, duplicate, or reordered production track
sets fail closed. Secret-shaped fields are rejected. The personal development
environment is rejected as a delivery target. `region` accepts the real
CloudBase environment form such as `ap-shanghai` and an optional numeric zone
suffix.

## `release-bundle.v1`

The bundle is track-scoped and requires:

- exactly 1,180 cards / 108 boxes / 301 audio assets for CET4, or exactly
  1,234 cards / 110 boxes / 328 audio assets for CET6, plus a deterministic
  content version;
- a card-workspace corpus fingerprint carried by the exported content payload
  and matched exactly by the bundle and final model authorization;
- a `model-owned-content-authorization.v2` full-track record with two distinct
  accepted runs whose exact input binds card/box scope, corpus fingerprint,
  audit, linked model review, and the recomputed canonical runtime
  `content_version` plus the source runtime payload/manifest byte SHA-256;
- the exact authorized source runtime payload retained at the authorization's
  safe `validation.runtime_payload` path, rehashed by the receiver and required
  to normalize to the same publish content; a missing path, content-version-only
  legacy acceptance, or byte drift fails closed;
- a hash-bound audit with zero unresolved blockers, zero unexplained risks, and
  100% quality metadata coverage;
- the exact track audio count whose paths, sizes, durations, hashes, and QC
  records match the content payload;
- every `model-owned-audio-qc.v2` record to bind actual bytes and transcript,
  contain two distinct audio-capable model runs, prove complete per-card asset
  consumption, and pass all required text, pronunciation, rhythm, noise,
  no-autoplay, subtitle, and provenance checks;
- every QC index card set to equal the content cards that reference that exact
  asset ID, even when different assets happen to contain identical bytes;
- explicit minimum iOS/Android versions, parent release, and release time.

Every referenced file must remain inside the bundle directory and match its
declared SHA-256. The bundle approval envelope carries both the authorization
record path/hash and the linked full-track model-review path/hash; the receiver
recomputes both review and authorization canonical inputs. Missing evidence
fails closed.

`model-acceptance.v2` records bind inputs and decisions but are not standalone
cryptographic proof that a model execution or media consumption occurred.
Repository authority additionally depends on the trusted Codex Action PR gate.
Formal audio launch evidence remains ineligible until one real
`trusted-media-run-receipt.v1` is produced by the fixed `card-make` main-branch
workflow, its exact bytes pass GitHub Artifact Attestation verification, and
the four CET4 content/media evidence types are registered. The repository now
contains the receipt schema and structural/attestation verifier. Formal-ready
verification additionally requires the exact downloaded artifact directory;
the consumer rehashes all 301 exact audio files, the audio manifest, reviewed worklist, raw-run manifest
and every referenced JSONL run, recomputes exact 301-card media identity, two
full perceptual plus two blind-transcript runs, per-card dual acceptances and
measured untruncated sample coverage. Attestation without those bytes remains
non-formal. Current
model-owned QC structures alone still cannot satisfy launch or closed-beta
readiness.

## Formal bundle builder

`scripts/build_formal_release_bundle.mjs` is the only repository assembler for
a formal CET4 bundle. It consumes an already exported exact 1,180-card / 108-box
/ 301-audio payload, one `model-owned-content-authorization.v2` with two
independent exact-input runs, its linked `model-owned-full-track-review.v2`,
the exact audit bytes named and hashed by both records, complete
`model-owned-audio-qc.v2`, private audio bytes and a `closed_beta` receiver
profile. It never produces or authorizes content or QC.

The command is dry-run by default. It assembles in a temporary directory,
copies every hash-bound artifact, builds one audio manifest and one QC index
entry per asset, then calls the full `verifyReleaseBundleDirectory` core
validator. A missing/false verification result fails; `--apply` may retain the
directory only after verification, and refuses to overwrite an existing
output. The build report is always `gate_eligible=false` and records no
CloudBase write. An optional distinct parent release supports initial A and
retained-parent B assembly without claiming that the parent is remotely
retained; receiver verify remains the authority for that fact.

Retained `--apply` output additionally requires Node 22.13.0, clean local
`main` exactly equal to `origin/main`, and an identified `model:`, `agent:`,
`service:` or `oidc:` machine principal. `formal-release-bundle-build-report.v2`
binds that exact repository commit, profile ID/hash,
bundle/content/release/parent, authorization, linked model-review and audit
hashes, audio manifest/QC-index hashes, canonical execution window and
write-safety observation. It exposes only the output directory basename, never
the machine-local path. Dry-run may execute on a topic branch for preparation,
but its failed write-safety observation and null operator cannot be promoted as
an applied formal raw report.

The four required CET4 content/media evidence types remain deliberately
unregistered. `spec/trusted-media-run-receipt.json` and
`scripts/verify_trusted_media_run_receipt.mjs` now define and test the exact
candidate, authorization, linked review, audit, 1,180-card/108-box/301-audio
membership, two full perceptual runs, consumed media bytes, fixed trusted
workflow, source commit and GitHub Sigstore binding. Registration still waits
for the producer workflow and one real attested receipt; the builder report and
structural `model-acceptance.v2` records remain useful inputs but cannot
manufacture a model execution, playback, device or provider fact.

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

Every receiver command emits `receiver-delivery-report.v2` with a deterministic
backend deployment ID derived from the exact repository commit, receiver
profile/environment and fixed function topology. Deployment injects that
non-secret ID into `softbook-api`; after deploy and again during formal verify,
the command rereads the remote function configuration and requires the exact
ID, handler, runtime, timeout, signing key ID, runtime/store modes and SMS
provider while publishing only non-secret values plus variable names, never
secret values. A dry-run or local report cannot satisfy this remote reread.
Each report also carries canonical start/completion timestamps. Every apply or
verify invocation requires `--operator` with a `model:`, `agent:`, `service:`
or `oidc:` machine principal so later formal evidence can bind the raw execution
window and distinguish its independent verifier.

`production-deployment` now has registered `launch-gate-evidence.v1`
semantics. The semantic report must reference four distinct tracked strict-JSON
raw artifacts: the applied `receiver-delivery-report.v2` deploy report, the
read-only passed v2 verify report, the exact `delivery-profile.v1`, and the
exact `release-bundle.v1`. The validator rehashes every file and binds clean
exact `main`, receiver environment/profile, backend deployment ID, API and
account-deletion-worker shapes, active CET4 release, 1,180 cards, 301 QC-covered
audio assets, zero imported user data and one verified retained parent release.
The verify report carries the SHA-256 of the exact bundle bytes that the core
bundle validator accepted, and that hash must equal both the tracked raw bundle
and the launch-candidate subject.
The raw deploy/verify operator must match the evidence execution operator; the
formal verifier must remain independent. Dry-runs, controlled-pilot reports,
simulations, an initial release without a retained parent, or self-declared
checks remain ineligible.

The concrete receiver adapter stores immutable staged versions in
`softbook_card_source_versions`. It re-downloads every uploaded private audio
object and verifies byte length and SHA-256 before staging, binds the staged
document to the authorization, audit, audio-manifest, and audio-QC hashes, and marks
that stage verified before changing the matching
`softbook_card_sources.<track>` pointer. Retention
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
deploys both the HTTP `softbook-api` handler and the non-HTTP
`softbook-account-deletion-worker` handler, configures its one-minute timer,
rereads and validates the worker handler/runtime/timeout/timer (reusing an exact
existing trigger without duplicate creation), requires its custom environment
variable set to remain empty so API auth/SMS/signing secrets are not injected,
uses a mode-0600 temporary
CloudBase config, and removes it after use. The
remote `softbook-api` configuration must also contain the exact deterministic
backend deployment ID for that clean `main` commit and receiver profile.
`verify` fails closed when the remote ID or function shape drifts. The
production runtime excludes `SOFTBOOK_SMS_DEV_CODE` and requires the receiver
to select either the credentialed HTTPS webhook or direct Tencent Cloud SMS
adapter, plus separate auth, SMS, and Ed25519 signing secrets. Tencent Cloud
mode additionally requires the receiver's region, SdkAppId, approved sign,
approved template ID, and explicit template parameter order. `verify` is
read-only and checks the active release, API route, bundle, catalog, and zero
imported user-data baseline. When the bundle names a parent, it also rereads
that release through the receiver adapter and records it only if it is both
verified and retained; this raw observation is required by formal
`production-deployment` evidence. A real lifecycle-managed production SMS/device
smoke is still a separate acceptance gate.

Provider smoke does not use the CloudBase database. The two-phase
`smoke-sms-provider.mjs` command sends only with explicit apply on clean exact
`main`, keeps phone/code state private and ignored, and publishes a
`sms-provider-smoke.v2` raw report only after an independent receiver adapter
creates an Ed25519-signed private artifact that binds the received code, run,
target, source, timestamp, receipt and configured key ID. The verifier never
receives the adapter private key; prepare pins the adapter, key ID, and public
key fingerprint before sending, and confirmation rejects later substitution
before deleting the receiver artifact on consumption.
Formal launch evidence wraps that raw report in a
typed `launch-gate-evidence.v1` record so the candidate, environment, execution,
independent verification, tracked hash, and semantic report bindings all fail
closed together; repository-local tests alone never create that evidence.

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
machine-harness-recorded `launch-release-candidate.v1` cohort, and nested
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
five reports must also carry hashed raw artifacts and an independent machine
verifier whose principal and run ID differ from the execution principal and run.
Machine acceptance is the internal authority; report identity strings remain
metadata unless bound to their attestation.

External account readiness uses `external-capability-evidence.v1`. Each report
binds the exact reachable repository commit, target release, policy hash,
account, capability, provider observation, required control-plane checks, and
tracked repository raw artifacts whose size and SHA-256 are rechecked. It is
always `gate_eligible=false`: external capability evidence cannot replace
runtime, payment, distribution, compliance, or security launch gates. Portal
records and identity fields remain metadata; provider and registry state still
fails closed when it cannot be observed.

The required-check catalog is not an evidence-semantics registry. At present,
only `android-distribution/release-signing` is registered: it must include one
`android-signed-release.v1` raw report and pass its APK-signature, authenticated
archive-digest, receiver-target, commit, verifier, run, and observation-time
bindings. Every other account/capability pair remains capability-ineligible,
even if a generic report contains valid hashes and self-declared `passed`
checks. Registering another pair requires a type-specific validator and a
negative bypass eval in the same change; absent either, readiness fails closed.

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
