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
  requires its own final whole-track user approval.
- Audio remains a card resource and cannot enter a release without complete QC.
- Delivery does not include development users, learning records, credentials,
  signing private keys, or fixed SMS codes.
- CET4 closed-beta readiness is recorded separately in
  `docs/release/cet4-closed-beta-readiness.v1.json` with exact 1,180-card,
  108-box and 301-audio scope. Its future `ready` state never changes or lowers
  `docs/release/launch-readiness.v1.json`, CET6, public distribution, payment or
  compliance gates.
- The closed-beta repository loader reuses only registered type-specific
  receiver-deployment, SMS, Learning/scheduler and release-recovery semantics
  with `target_release=cet4-closed-beta`, the exact closed-beta candidate
  cohort, tracked/rehashed raw artifacts and reachable commits. Every
  unregistered closed-beta evidence type remains ineligible.

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
  and matched exactly by the bundle and final approval;
- a `full_track_final` approval whose exact card/box scope and corpus
  fingerprint match the payload;
- a hash-bound audit with zero unresolved blockers, zero unexplained risks, and
  100% quality metadata coverage;
- the exact track audio count whose paths, sizes, durations, hashes, and QC
  records match the content payload;
- every QC record to state formal readiness and pass all required text,
  pronunciation, rhythm, noise, no-autoplay, subtitle, and provenance checks;
- explicit minimum iOS/Android versions, parent release, and release time.

Every referenced file must remain inside the bundle directory and match its
declared SHA-256. Missing evidence fails closed.

## Formal bundle builder

`scripts/build_formal_release_bundle.mjs` is the only repository assembler for
a formal CET4 bundle. It consumes an already exported exact 1,180-card / 108-box
/ 301-audio payload, one `full_track_final` user approval, the exact audit bytes
named and hashed by that approval, complete identified-human formal audio QC,
private audio bytes and a `closed_beta` receiver profile. It never produces or
approves content or QC.

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
`main` exactly equal to `origin/main`, and an identified `github:`, `team:` or
`external:` operator. `formal-release-bundle-build-report.v2` binds that exact
repository commit, profile ID/hash, bundle/content/release/parent, approval and
audit hashes, audio manifest/QC-index hashes, canonical execution window and
write-safety observation. It exposes only the output directory basename, never
the machine-local path. Dry-run may execute on a topic branch for preparation,
but its failed write-safety observation and null operator cannot be promoted as
an applied formal raw report.

The closed-beta evidence loader registers four CET4 content types: exact box
coverage, exact card coverage, formal audio-QC coverage and content-pack
integrity. Each semantic report resolves eight distinct tracked strict-JSON
roles: applied build report v2, profile, bundle, content, full-track approval,
quality audit, audio manifest and audio-QC index. The validator rehashes every
file, binds the exact candidate cohort, recomputes 1,180-card/108-box/301-audio
membership, checks full-track approval/card/box/corpus/audit relationships,
requires zero hard/content/review blockers and no missing cards, and matches all
301 formally ready QC entries to manifest assets and audio-bearing cards. The
builder/report never substitutes for the human evidence carried by those raw
artifacts.

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
verify invocation requires `--operator` with a `github:`, `team:` or
`external:` identity so later formal evidence can bind the raw execution
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
document to the approval, audit, audio-manifest, and audio-QC hashes, and marks
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
`sms-provider-smoke.v1` raw report only after a non-agent human submits the
received code through stdin. Formal launch evidence wraps that raw report in a
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
