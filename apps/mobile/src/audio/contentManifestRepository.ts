import type {
  LearningAudioResource,
  LearningCard,
  LearningTrack,
} from '../learning/model';
import { RemoteHttpError } from '../runtime/remoteHttpError';

export type ContentManifestAsset = {
  asset_id: string;
  duration_ms: number;
  media_type: 'audio/mpeg';
  sha256: string;
  size_bytes: number;
};

export type ProductionContentManifest = {
  schema_version: 'content-manifest.v1';
  release_id: string;
  track: LearningTrack;
  content_version: string;
  minimum_client_version: string;
  parent_release_id: string | null;
  assets: ContentManifestAsset[];
};

export type ControlledPilotContentManifest = {
  schema_version: 'content-manifest.v1';
  release_id: string;
  release_class: 'controlled_pilot';
  pilot_id: string;
  track: 'cet4';
  content_version: string;
  minimum_client_versions: {
    android: string;
    ios: string;
  };
  expires_at: string;
  gate_eligible: false;
  assets: ContentManifestAsset[];
};

export type ContentManifest =
  | ProductionContentManifest
  | ControlledPilotContentManifest;

export type ContentAssetDownload = {
  asset_id: string;
  expires_at: string;
  url: string;
};

export type ContentManifestSignature = {
  algorithm: 'ed25519';
  key_id: string;
  value: string;
};

export type ContentManifestAccess = {
  accessible_card_count: number;
  mode: 'free_subset' | 'full' | 'trial_not_started';
  total_card_count: number;
};

export type VerifiedContentManifest = {
  access: ContentManifestAccess;
  downloads: ContentAssetDownload[];
  manifest: ContentManifest;
  signature: ContentManifestSignature;
};

export type ContentManifestSignatureVerifier = (input: {
  canonicalPayload: string;
  keyId: string;
  signature: string;
}) => boolean | Promise<boolean>;

export type ContentManifestFetchResponse = {
  json: () => Promise<unknown>;
  ok: boolean;
  status: number;
};

export type ContentManifestFetch = (
  input: string,
  init: {
    headers: Record<string, string>;
    method: 'GET';
  },
) => Promise<ContentManifestFetchResponse>;

export async function loadRemoteContentManifest(options: {
  apiKey?: string;
  authToken: string;
  baseUrl: string;
  contentVersion: string;
  fetchImpl?: ContentManifestFetch;
  now?: () => Date;
  track: LearningTrack;
  verifySignature: ContentManifestSignatureVerifier;
}): Promise<VerifiedContentManifest> {
  if (!options.authToken) {
    throw new RemoteHttpError(
      'Remote content manifest requires authToken.',
      401,
    );
  }

  requireContentVersion(options.contentVersion, 'Requested content version');
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(
    buildContentManifestUrl(
      options.baseUrl,
      options.track,
      options.contentVersion,
    ),
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${options.authToken}`,
        'x-softbook-client': 'mobile',
        ...(options.apiKey ? { 'x-api-key': options.apiKey } : {}),
      },
    },
  );

  if (!response.ok) {
    throw new RemoteHttpError(
      `Remote content manifest request failed with status ${response.status}.`,
      response.status,
    );
  }

  const result = parseContentManifestPayload(await response.json(), {
    contentVersion: options.contentVersion,
    now: options.now?.() ?? new Date(),
    track: options.track,
  });
  const verified = await options.verifySignature({
    canonicalPayload: stableJsonStringify({
      access: result.access,
      manifest: result.manifest,
    }),
    keyId: result.signature.key_id,
    signature: result.signature.value,
  });

  if (!verified) {
    throw new Error('Content manifest signature verification failed.');
  }

  return result;
}

export function parseContentManifestPayload(
  payload: unknown,
  expected: {
    contentVersion: string;
    now: Date;
    track: LearningTrack;
  },
): VerifiedContentManifest {
  const envelope = requireObject(payload, 'Content manifest response');
  assertExactKeys(envelope, ['data'], 'Content manifest response');
  const data = requireObject(envelope.data, 'Content manifest response.data');
  assertExactKeys(
    data,
    ['access', 'downloads', 'manifest', 'signature'],
    'Content manifest response.data',
  );
  const access = parseAccess(data.access);
  const manifest = parseManifest(data.manifest, expected.now, expected);
  const signature = parseSignature(data.signature);
  const downloads = parseDownloads(
    data.downloads,
    manifest.assets,
    expected.now,
  );
  if (
    'release_class' in manifest &&
    downloads.some(
      download =>
        Date.parse(download.expires_at) > Date.parse(manifest.expires_at),
    )
  ) {
    throw new Error(
      'Content manifest download cannot outlive the controlled-pilot release.',
    );
  }

  return { access, downloads, manifest, signature };
}

export function assertContentManifestMatchesCards(
  result: VerifiedContentManifest,
  cards: readonly LearningCard[],
) {
  const manifestAssets = new Map(
    result.manifest.assets.map(asset => [asset.asset_id, asset]),
  );
  const referenced = new Set<string>();

  for (const card of cards) {
    if (!card.audio) {
      continue;
    }

    const asset = manifestAssets.get(card.audio.asset_id);
    assertAudioMatchesAsset(card.audio, asset, card.card_id);
    referenced.add(card.audio.asset_id);
  }

  for (const asset of result.manifest.assets) {
    if (!referenced.has(asset.asset_id)) {
      throw new Error(
        `Content manifest asset ${asset.asset_id} is not referenced by the loaded cards.`,
      );
    }
  }

  if (result.access.total_card_count !== cards.length) {
    throw new Error(
      'Content manifest access does not match the loaded catalog.',
    );
  }

  const expectedAccessibleCardCount =
    result.access.mode === 'full'
      ? cards.length
      : result.access.mode === 'free_subset'
      ? Math.ceil(cards.length * 0.5)
      : 0;

  if (result.access.accessible_card_count !== expectedAccessibleCardCount) {
    throw new Error('Content manifest accessible card count is invalid.');
  }

  const expectedDownloadIds = [
    ...new Set(
      cards
        .slice(0, expectedAccessibleCardCount)
        .flatMap(card => (card.audio ? [card.audio.asset_id] : [])),
    ),
  ].sort();
  const actualDownloadIds = result.downloads
    .map(download => download.asset_id)
    .sort();

  if (
    JSON.stringify(actualDownloadIds) !== JSON.stringify(expectedDownloadIds)
  ) {
    throw new Error(
      'Content manifest downloads do not match the server-authorized card prefix.',
    );
  }
}

export function resolveCardAudioDownload(
  result: VerifiedContentManifest,
  card: LearningCard,
) {
  if (!card.audio) {
    return null;
  }

  const asset = result.manifest.assets.find(
    candidate => candidate.asset_id === card.audio?.asset_id,
  );
  assertAudioMatchesAsset(card.audio, asset, card.card_id);
  const download = result.downloads.find(
    candidate => candidate.asset_id === card.audio?.asset_id,
  );

  if (!download) {
    throw new Error(
      `Content manifest has no download for ${card.audio.asset_id}.`,
    );
  }

  return { asset, download };
}

export function stableJsonStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(item => stableJsonStringify(item)).join(',')}]`;
  }

  if (isObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableJsonStringify(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function parseManifest(
  value: unknown,
  now: Date,
  expected: { contentVersion: string; track: LearningTrack },
): ContentManifest {
  const manifest = requireObject(value, 'Content manifest');
  if (manifest.release_class === 'controlled_pilot') {
    return parseControlledPilotManifest(manifest, now, expected);
  }
  assertExactKeys(
    manifest,
    [
      'assets',
      'content_version',
      'minimum_client_version',
      'parent_release_id',
      'release_id',
      'schema_version',
      'track',
    ],
    'Content manifest',
  );

  if (manifest.schema_version !== 'content-manifest.v1') {
    throw new Error(
      'Content manifest schema_version must be content-manifest.v1.',
    );
  }
  if (manifest.track !== expected.track) {
    throw new Error('Content manifest track does not match the request.');
  }
  if (manifest.content_version !== expected.contentVersion) {
    throw new Error('Content manifest version does not match the card source.');
  }

  const releaseId = requireReleaseId(manifest.release_id, 'release_id');
  const parentReleaseId =
    manifest.parent_release_id === null
      ? null
      : requireReleaseId(manifest.parent_release_id, 'parent_release_id');
  if (parentReleaseId === releaseId) {
    throw new Error(
      'Content manifest parent release must differ from release_id.',
    );
  }
  const minimumClientVersion = requireString(
    manifest.minimum_client_version,
    'Content manifest minimum_client_version',
  );
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(minimumClientVersion)) {
    throw new Error('Content manifest minimum_client_version is invalid.');
  }

  const rawAssets = expectArray(manifest.assets, 'Content manifest assets');
  const assets = rawAssets.map((asset, index) =>
    parseAsset(asset, `Content manifest assets[${index}]`),
  );
  assertUniqueIds(assets, 'Content manifest assets');

  return {
    assets,
    content_version: requireContentVersion(
      manifest.content_version,
      'Content manifest content_version',
    ),
    minimum_client_version: minimumClientVersion,
    parent_release_id: parentReleaseId,
    release_id: releaseId,
    schema_version: 'content-manifest.v1',
    track: expected.track,
  };
}

function parseControlledPilotManifest(
  manifest: Record<string, unknown>,
  now: Date,
  expected: { contentVersion: string; track: LearningTrack },
): ControlledPilotContentManifest {
  assertExactKeys(
    manifest,
    [
      'assets',
      'content_version',
      'expires_at',
      'gate_eligible',
      'minimum_client_versions',
      'pilot_id',
      'release_class',
      'release_id',
      'schema_version',
      'track',
    ],
    'Controlled-pilot content manifest',
  );
  if (
    manifest.schema_version !== 'content-manifest.v1' ||
    manifest.release_class !== 'controlled_pilot' ||
    manifest.track !== 'cet4' ||
    expected.track !== 'cet4' ||
    manifest.content_version !== expected.contentVersion ||
    manifest.gate_eligible !== false
  ) {
    throw new Error('Controlled-pilot content manifest scope is invalid.');
  }

  const expiresAt = requireCanonicalFutureTimestamp(
    manifest.expires_at,
    now,
    'Controlled-pilot content manifest expires_at',
  );
  const minimumClientVersions = requireExactObject(
    manifest.minimum_client_versions,
    ['android', 'ios'],
    'Controlled-pilot content manifest minimum_client_versions',
  );
  const android = requireSemanticVersion(
    minimumClientVersions.android,
    'Controlled-pilot Android minimum client version',
  );
  const ios = requireSemanticVersion(
    minimumClientVersions.ios,
    'Controlled-pilot iOS minimum client version',
  );
  const rawAssets = expectArray(manifest.assets, 'Content manifest assets');
  const assets = rawAssets.map((asset, index) =>
    parseAsset(asset, `Content manifest assets[${index}]`),
  );
  assertUniqueIds(assets, 'Content manifest assets');

  return {
    assets,
    content_version: requireContentVersion(
      manifest.content_version,
      'Content manifest content_version',
    ),
    expires_at: expiresAt,
    gate_eligible: false,
    minimum_client_versions: { android, ios },
    pilot_id: requireReleaseId(manifest.pilot_id, 'pilot_id'),
    release_class: 'controlled_pilot',
    release_id: requireReleaseId(manifest.release_id, 'release_id'),
    schema_version: 'content-manifest.v1',
    track: 'cet4',
  };
}

function parseAccess(value: unknown): ContentManifestAccess {
  const access = requireObject(value, 'Content manifest access');
  assertExactKeys(
    access,
    ['accessible_card_count', 'mode', 'total_card_count'],
    'Content manifest access',
  );
  if (
    access.mode !== 'free_subset' &&
    access.mode !== 'full' &&
    access.mode !== 'trial_not_started'
  ) {
    throw new Error('Content manifest access mode is invalid.');
  }
  const accessibleCardCount = requireNonNegativeSafeInteger(
    access.accessible_card_count,
    'Content manifest accessible_card_count',
  );
  const totalCardCount = requirePositiveSafeInteger(
    access.total_card_count,
    'Content manifest total_card_count',
  );
  if (accessibleCardCount > totalCardCount) {
    throw new Error(
      'Content manifest accessible card count exceeds total cards.',
    );
  }

  return {
    accessible_card_count: accessibleCardCount,
    mode: access.mode,
    total_card_count: totalCardCount,
  };
}

function parseAsset(value: unknown, label: string): ContentManifestAsset {
  const asset = requireObject(value, label);
  assertExactKeys(
    asset,
    ['asset_id', 'duration_ms', 'media_type', 'sha256', 'size_bytes'],
    label,
  );
  if (asset.media_type !== 'audio/mpeg') {
    throw new Error(`${label}.media_type must be audio/mpeg.`);
  }

  return {
    asset_id: requireAssetId(asset.asset_id, `${label}.asset_id`),
    duration_ms: requirePositiveSafeInteger(
      asset.duration_ms,
      `${label}.duration_ms`,
    ),
    media_type: 'audio/mpeg',
    sha256: requireContentVersion(asset.sha256, `${label}.sha256`),
    size_bytes: requirePositiveSafeInteger(
      asset.size_bytes,
      `${label}.size_bytes`,
    ),
  };
}

function parseSignature(value: unknown): ContentManifestSignature {
  const signature = requireObject(value, 'Content manifest signature');
  assertExactKeys(
    signature,
    ['algorithm', 'key_id', 'value'],
    'Content manifest signature',
  );
  if (signature.algorithm !== 'ed25519') {
    throw new Error('Content manifest signature algorithm must be ed25519.');
  }
  const encoded = requireString(
    signature.value,
    'Content manifest signature value',
  );
  if (!/^[a-f0-9]{128}$/.test(encoded)) {
    throw new Error('Content manifest signature value must be 64-byte hex.');
  }

  return {
    algorithm: 'ed25519',
    key_id: requireReleaseId(signature.key_id, 'signature key_id'),
    value: encoded,
  };
}

function parseDownloads(
  value: unknown,
  assets: readonly ContentManifestAsset[],
  now: Date,
): ContentAssetDownload[] {
  const downloads = expectArray(value, 'Content manifest downloads').map(
    (download, index) => {
      const label = `Content manifest downloads[${index}]`;
      const record = requireObject(download, label);
      assertExactKeys(record, ['asset_id', 'expires_at', 'url'], label);
      const expiresAt = requireString(record.expires_at, `${label}.expires_at`);
      const expiry = Date.parse(expiresAt);

      if (Number.isNaN(expiry) || expiry <= now.getTime()) {
        throw new Error(`${label}.expires_at must be a future ISO timestamp.`);
      }

      return {
        asset_id: requireAssetId(record.asset_id, `${label}.asset_id`),
        expires_at: new Date(expiry).toISOString(),
        url: requireHttpsUrl(record.url, `${label}.url`),
      };
    },
  );
  assertUniqueIds(downloads, 'Content manifest downloads');
  const signedAssetIds = new Set(assets.map(asset => asset.asset_id));

  if (downloads.some(download => !signedAssetIds.has(download.asset_id))) {
    throw new Error(
      'Content manifest download is not present in signed assets.',
    );
  }

  return downloads;
}

function assertAudioMatchesAsset(
  audio: LearningAudioResource,
  asset: ContentManifestAsset | undefined,
  cardId: string,
): asserts asset is ContentManifestAsset {
  if (!asset) {
    throw new Error(
      `Card ${cardId} audio references missing manifest asset ${audio.asset_id}.`,
    );
  }
  if (
    asset.sha256 !== audio.sha256 ||
    asset.duration_ms !== audio.duration_ms
  ) {
    throw new Error(
      `Card ${cardId} audio does not match its signed manifest asset.`,
    );
  }
}

function buildContentManifestUrl(
  baseUrl: string,
  track: LearningTrack,
  contentVersion: string,
) {
  const normalized = baseUrl.trim().replace(/\/+$/, '');
  if (!normalized) {
    throw new Error('Remote content manifest requires baseUrl.');
  }

  return `${normalized}/v2/content/manifest?track=${track}&content_version=${encodeURIComponent(
    contentVersion,
  )}`;
}

function requireObject(
  value: unknown,
  label: string,
): Record<string, unknown> {
  if (!isObject(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function requireExactObject(
  value: unknown,
  keys: readonly string[],
  label: string,
) {
  const parsed = requireObject(value, label);
  assertExactKeys(parsed, keys, label);
  return parsed;
}

function expectArray(input: unknown, fieldName: string): unknown[] {
  if (!Array.isArray(input)) {
    throw new Error(`${fieldName} must be an array.`);
  }
  return input;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be a non-empty string.`);
  }
  return value.trim();
}

function requireSemanticVersion(value: unknown, label: string) {
  const version = requireExactString(value, label);
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`${label} is invalid.`);
  }
  return version;
}

function requireCanonicalFutureTimestamp(
  value: unknown,
  now: Date,
  label: string,
) {
  const timestamp = requireExactString(value, label);
  const parsed = new Date(timestamp);
  if (
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString() !== timestamp ||
    parsed.getTime() <= now.getTime()
  ) {
    throw new Error(`${label} must be a future canonical ISO timestamp.`);
  }
  return timestamp;
}

function requireAssetId(value: unknown, label: string) {
  const id = requireString(value, label);
  if (!/^[a-z0-9][a-z0-9._-]{2,127}$/.test(id)) {
    throw new Error(`${label} is invalid.`);
  }
  return id;
}

function requireReleaseId(value: unknown, label: string) {
  const id = requireExactString(value, `Content manifest ${label}`);
  if (!/^[0-9A-Za-z][0-9A-Za-z._-]{0,127}$/.test(id)) {
    throw new Error(`Content manifest ${label} is invalid.`);
  }
  return id;
}

function requireExactString(value: unknown, label: string) {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.trim() !== value
  ) {
    throw new Error(`${label} must be a non-empty exact string.`);
  }
  return value;
}

function requireContentVersion(value: unknown, label: string) {
  const version = requireString(value, label);
  if (!/^sha256:[a-f0-9]{64}$/.test(version)) {
    throw new Error(`${label} must be a SHA-256 identifier.`);
  }
  return version;
}

function requirePositiveSafeInteger(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value as number;
}

function requireNonNegativeSafeInteger(value: unknown, label: string) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new Error(`${label} must be a non-negative integer.`);
  }
  return value as number;
}

function requireHttpsUrl(value: unknown, label: string) {
  const text = requireString(value, label);
  let url: URL;
  try {
    url = new URL(text);
  } catch {
    throw new Error(`${label} must be a valid URL.`);
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error(`${label} must be a credential-free HTTPS URL.`);
  }
  return url.toString();
}

function assertUniqueIds(
  records: readonly { asset_id: string }[],
  label: string,
) {
  const ids = new Set<string>();
  for (const record of records) {
    if (ids.has(record.asset_id)) {
      throw new Error(
        `${label} contains duplicate asset_id ${record.asset_id}.`,
      );
    }
    ids.add(record.asset_id);
  }
}

function assertExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
  label: string,
) {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} has unsupported or missing fields.`);
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
