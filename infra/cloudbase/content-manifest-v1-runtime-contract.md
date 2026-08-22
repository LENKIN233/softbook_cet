# Softbook Content Manifest v1 Runtime Contract

Referenced active specs:

- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/runtime-boundaries.json`

## Authority boundary

`product_truth`:

- Audio is a content medium available on every release target, not a separate
  interaction family.
- Audio never autoplays. Front-side subtitles are absent by default; useful
  text or transcript may appear on the back.
- A card carries a stable audio asset identity, hash, and duration. It does not
  carry a download URL.

`implementation_hypothesis`:

- `GET /v2/content/manifest` resolves assets for one exact published track and
  content version after active-session authentication.
- The stable manifest is signed with Ed25519. Expiring private-object URLs are
  returned separately because expiry is transport state, not signed content
  identity.
- The signed payload is an exact discriminated union: formal
  `content-release.v1` content uses the original formal field set, while
  `pilot-content-release.v1` content carries the literal
  `release_class=controlled_pilot`, pilot identity, exact iOS/Android minimum
  versions, pilot expiry, and `gate_eligible=false`. Mixed or unknown fields
  fail closed.
- The repository-local CloudBase endpoint, exact mobile parser, strict runtime
  keyring consumer, pinned-key Ed25519 verifier, native content-addressed cache
  with completed-byte hashing, Learning controller, attached control, and
  iOS/Android native playback adapters are implemented locally but not deployed
  or device smoked. The actual native iOS/Android client minimum gate is also
  implemented locally and runs only after signed-manifest verification.
  Production key values and native release injection, persistent receiver
  execution, real-device minimum-version proof, private-object
  download/playback proof, and cross-platform visual evidence remain pending,
  so the audio launch gate stays pending.

## Card source

An optional card `audio` object contains exactly the resource facts needed by
all clients:

```json
{
  "asset_id": "cet4.002001.prompt",
  "sha256": "sha256:<64 lowercase hex characters>",
  "duration_ms": 2100,
  "transcript": "optional back-side text"
}
```

The card source owns a private `assets` catalog. Each runtime descriptor contains
the same `asset_id`, hash, and duration plus `media_type`, `size_bytes`, and a
server-only CloudBase `storage_file_id`. Release-bundle payloads use a safe
relative `asset_path` until the receiver environment upload supplies that file
ID. Validation rejects duplicate assets,
missing references, hash or duration drift, unreferenced assets, public URLs,
and non-MP3 media. A source without assets retains its previous canonical
content-version calculation; once assets exist, their sorted stable descriptors
participate in the content hash. The environment-specific `storage_file_id` and
bundle-local `asset_path` do not, so one approved content version is portable to
a fresh receiver environment.

## Request

```http
GET /v2/content/manifest?track=cet4&content_version=sha256%3A...
Authorization: Bearer <access_token>
Accept: application/json
x-softbook-client: mobile
x-api-key: <optional>
```

Rules:

- Only `track` and `content_version` are accepted query fields.
- A request body and client-provided account or phone identity are rejected.
- The requested source must be the active source, have the release class allowed
  by the runtime (`content-release.v1` in production or a current
  `pilot-content-release.v1` in `controlled_pilot`), and match the exact
  canonical content version. Neither non-development runtime falls back to
  development content.
- Temporary downloads are filtered by canonical membership: trial and premium
  receive the full card prefix, free receives the stable first `ceil(50%)`
  prefix, and `trial_available` receives no download until the learning-session
  authority starts the trial.
- Missing signing or private-download configuration fails with 503. There is
  no unsigned or public-URL fallback.

## Response

`data.manifest` is one of two exact canonical signed variants. The formal
variant contains exactly the following top-level fields and deliberately has no
`release_class` field:

```json
{
  "schema_version": "content-manifest.v1",
  "release_id": "cet4-2026-07-28",
  "track": "cet4",
  "content_version": "sha256:<64 lowercase hex characters>",
  "minimum_client_version": "1.0.0",
  "parent_release_id": null,
  "assets": [
    {
      "asset_id": "cet4.002001.prompt",
      "duration_ms": 2100,
      "media_type": "audio/mpeg",
      "sha256": "sha256:<64 lowercase hex characters>",
      "size_bytes": 4096
    }
  ]
}
```

The `controlled_pilot` variant contains exactly the following top-level
fields:

```json
{
  "schema_version": "content-manifest.v1",
  "release_id": "cet4-controlled-pilot-2026",
  "release_class": "controlled_pilot",
  "pilot_id": "cet4-pilot-2026",
  "track": "cet4",
  "content_version": "sha256:<64 lowercase hex characters>",
  "minimum_client_versions": {
    "android": "1.0.0",
    "ios": "1.0.0"
  },
  "expires_at": "2026-09-10T00:00:00.000Z",
  "gate_eligible": false,
  "assets": [
    {
      "asset_id": "cet4.002001.prompt",
      "duration_ms": 2100,
      "media_type": "audio/mpeg",
      "sha256": "sha256:<64 lowercase hex characters>",
      "size_bytes": 4096
    }
  ]
}
```

For `controlled_pilot`, `track` is exactly `cet4`,
`minimum_client_versions` contains exactly `android` and `ios` semantic-version
strings, `expires_at` is a future canonical UTC timestamp, and
`gate_eligible` is the literal `false`. The pilot expiry and gate marker are
inside the signed payload. The formal-only `minimum_client_version` and
`parent_release_id` fields are forbidden in this variant; pilot-only fields are
forbidden in the formal variant.

`data.access` records `mode`, `accessible_card_count`, and `total_card_count`.
The client recomputes the expected audio IDs from the canonical card prefix and
rejects over-granted or missing downloads.

`data.signature` contains `algorithm=ed25519`, an allowlisted `key_id`, and a
64-byte lowercase-hex signature over recursively key-sorted compact JSON of
`{access, manifest}`. This binds membership scope without signing expiring URLs.
`data.downloads` contains exactly one item per distinct asset referenced by the
server-authorized card prefix, with `asset_id`, a future `expires_at`, and a
credential-free HTTPS URL. The signed manifest may describe additional assets
outside that membership scope. Storage file IDs never leave the server response
boundary. In `controlled_pilot`, each download expiry is
`min(issued_at + download TTL, manifest.expires_at)` and therefore never
outlives the signed pilot release; the mobile parser independently rejects any
pilot download whose expiry is later than that release expiry.

## Client acceptance

The client must:

1. require an authenticated request and exact track/content-version match;
2. select exactly one formal or `controlled_pilot` manifest variant and reject
   unknown, missing, or mixed fields, invalid pilot identity or gate state,
   non-semantic minimum versions, non-canonical or expired pilot release time,
   duplicate IDs, expired URLs, and any difference between the authorized
   card-prefix asset IDs and download IDs;
3. verify the Ed25519 signature using a pinned key ID and public key with
   strict RFC 8032 semantics;
4. compare the actual installed native platform client version with the
   applicable now-verified signed minimum before exposing content;
5. match every loaded card audio reference to its signed descriptor;
6. download to an account-independent content-addressed cache;
7. hash the completed bytes and delete any mismatch before playback;
8. start playback only after an explicit user action.

Exact variant parsing, expiry checks, steps 1 through 5, and the reusable strict
verifier are implemented in the repository-local mobile runtime. Formal
content applies its single signed `minimum_client_version` to either supported
native platform; controlled-pilot content selects the signed entry for the
actual platform. Installed identity comes from synchronous
`NativeModules.SoftbookAppInfo` constants containing `platform` (`android` or
`ios`) and `version`, and the native platform must match React Native
`Platform.OS`. Missing, malformed, mismatched, unsupported, or below-minimum
native identity fails closed.

Both the installed version and applicable minimum use strict semantic versions
with a required `x.y.z` core and only valid optional prerelease/build
identifiers. Numeric prerelease identifiers compare numerically, alphanumeric
identifiers compare lexically, a stable release sorts after its prerelease, and
build metadata does not change precedence. The client does not trim, fill
missing components, or normalize a native value such as `1.0` into `1.0.0`.
Most importantly, the minimum is not trusted or compared until strict Ed25519
verification succeeds; an invalid signature cannot use a forged low minimum to
reach later manifest handling.

When remote learning is enabled, the Learning repository loads the canonical
card source and server selection first, then loads this manifest for that exact
track/content version. It rejects any card catalog, membership access mode, or
access-count drift before returning a selected card. Remote runtime
configuration consumes a non-empty release-owned public-key map and fails
closed when it is absent or invalid, but production key values and
cross-platform release injection remain external pending work. A deliberately
local content-manifest feature is allowed only as an explicit development smoke
configuration; it returns no manifest.

Steps 6-7 are implemented through `react-native-blob-util@0.24.10`: downloads
write directly to a unique partial file under the app cache, then native stat
and SHA-256 must match the signed descriptor before same-directory promotion to
`softbook-content-v1/sha256/<prefix>/<digest>.mp3`. Corrupt hits, failed
downloads, and post-move mismatches are deleted. A verified cache hit is
account-independent and remains usable offline without reusing an expired URL;
cache misses require an unexpired credential-free HTTPS download, and every
native redirect target must also remain credential-free HTTPS. Concurrent
requests for the same digest share one in-process operation only after each
caller's asset/download identity and declared byte length are validated.

The verified manifest is attached to the in-memory Learning session. The
attached Learning audio chip now calls the verified cache through a bounded
TypeScript controller, then prepares and plays the local file through
`AVAudioPlayer` on iOS or Media3 ExoPlayer on Android only after an explicit
tap. Card changes, backgrounding, and system interruption stop or pause without
automatic resume; one internal preparation retry and bounded offline/error copy
prevent native details from reaching visible state. Cross-platform private-file
device smoke, release-key injection, cache eviction policy, screenshots, and
physical-device playback evidence remain follow-up work and cannot be inferred
from local compilation or this contract being green. The repository-local
minimum-version code likewise does not constitute receiver deployment or
real-device proof.
