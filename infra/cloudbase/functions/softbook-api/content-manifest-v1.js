const crypto = require('node:crypto');
const {
  PILOT_RELEASE_SCHEMA,
  isContentReleaseValidForRuntime,
} = require('./content-release-runtime');

const CONTENT_MANIFEST_SCHEMA_VERSION = 'content-manifest.v1';
const CONTENT_MANIFEST_SIGNATURE_ALGORITHM = 'ed25519';
const DOWNLOAD_TTL_SECONDS = 15 * 60;

function createContentManifestV1Service(options) {
  validateServiceOptions(options);
  const runtimeMode = options.runtimeMode ?? 'development';

  return {
    read: async input => {
      const issuedAt = options.now();
      const track = requireTrack(input.track);
      const expectedContentVersion = requireContentVersion(
        input.contentVersion,
      );
      const cardSource = await options.store.getCardSource(track, {
        allowDevelopmentDefault: false,
      });

      if (
        cardSource.content_version !== expectedContentVersion ||
        cardSource.release === null ||
        !isContentReleaseValidForRuntime(cardSource, runtimeMode, issuedAt)
      ) {
        throw contentManifestError(
          409,
          'content_manifest_version_mismatch',
          'The requested content version is not the active published release.',
        );
      }

      const access = await resolveContentAccess(
        options.store,
        input.accountKey,
        input.phoneNumber,
        input.sessionAuthority,
        cardSource,
        issuedAt,
      );
      const manifest = createStableManifest(cardSource);
      const serializedAccess = {
        accessible_card_count: access.accessibleCardCount,
        mode: access.mode,
        total_card_count: cardSource.card_records.length,
      };
      const signature = signManifest(
        {access: serializedAccess, manifest},
        requireSigner(options.signer),
      );
      const resolveDownloadUrl = requireDownloadUrlResolver(
        options.resolveDownloadUrl,
      );
      const downloadTtlExpiresAt = new Date(
        issuedAt.getTime() +
          (options.downloadTtlSeconds ?? DOWNLOAD_TTL_SECONDS) * 1000,
      );
      const expiresAt =
        manifest.release_class === 'controlled_pilot'
          ? new Date(
              Math.min(
                downloadTtlExpiresAt.getTime(),
                Date.parse(manifest.expires_at),
              ),
            )
          : downloadTtlExpiresAt;
      const downloads = await Promise.all(
        access.assets.map(async asset => ({
          asset_id: asset.asset_id,
          expires_at: expiresAt.toISOString(),
          url: requireHttpsUrl(
            await resolveDownloadUrl({
              asset,
              expiresAt,
              issuedAt,
              release: cardSource.release,
              track,
            }),
          ),
        })),
      );

      return {
        access: serializedAccess,
        downloads,
        manifest,
        signature,
      };
    },
  };
}

async function resolveContentAccess(
  store,
  accountKey,
  phoneNumber,
  sessionAuthority,
  cardSource,
  issuedAt,
) {
  if (typeof phoneNumber !== 'string' || phoneNumber.length === 0) {
    throw contentManifestError(
      401,
      'invalid_auth_session',
      'Content manifest requires an account-bound session.',
    );
  }

  const membership = await store.getMembership(
    phoneNumber,
    issuedAt.toISOString(),
    {accountKey, sessionAuthority},
  );
  const totalCardCount = cardSource.card_records.length;
  let accessibleCardCount;
  let mode;

  switch (membership?.stage) {
    case 'trial':
    case 'premium':
      accessibleCardCount = totalCardCount;
      mode = 'full';
      break;
    case 'free':
      accessibleCardCount = Math.ceil(totalCardCount * 0.5);
      mode = 'free_subset';
      break;
    case 'trial_available':
      accessibleCardCount = 0;
      mode = 'trial_not_started';
      break;
    default:
      throw contentManifestError(
        500,
        'content_access_invalid',
        'Canonical membership stage is invalid.',
      );
  }

  const accessibleAssetIds = new Set(
    cardSource.card_records
      .slice(0, accessibleCardCount)
      .flatMap(card => (card.audio ? [card.audio.asset_id] : [])),
  );

  return {
    accessibleCardCount,
    assets: cardSource.assets.filter(asset =>
      accessibleAssetIds.has(asset.asset_id),
    ),
    mode,
  };
}

function createContentManifestSigner(keyId, privateKeyPem) {
  if (typeof keyId !== 'string' || keyId.trim().length === 0) {
    throw new Error('Content manifest signing key ID is required.');
  }

  if (typeof privateKeyPem !== 'string' || privateKeyPem.trim().length === 0) {
    throw new Error('Content manifest Ed25519 private key is required.');
  }

  const privateKey = crypto.createPrivateKey(privateKeyPem);

  if (privateKey.asymmetricKeyType !== 'ed25519') {
    throw new Error('Content manifest private key must use Ed25519.');
  }

  return {
    keyId: keyId.trim(),
    privateKey,
  };
}

function createStableManifest(cardSource) {
  if (cardSource.release.schema_version === PILOT_RELEASE_SCHEMA) {
    return {
      schema_version: CONTENT_MANIFEST_SCHEMA_VERSION,
      release_id: cardSource.release.release_id,
      release_class: 'controlled_pilot',
      pilot_id: cardSource.release.pilot_id,
      track: cardSource.track,
      content_version: cardSource.content_version,
      minimum_client_versions: cardSource.release.minimum_client_versions,
      expires_at: cardSource.release.expires_at,
      gate_eligible: false,
      assets: cardSource.assets.map(asset => ({
        asset_id: asset.asset_id,
        duration_ms: asset.duration_ms,
        media_type: asset.media_type,
        sha256: asset.sha256,
        size_bytes: asset.size_bytes,
      })),
    };
  }

  return {
    schema_version: CONTENT_MANIFEST_SCHEMA_VERSION,
    release_id: cardSource.release.release_id,
    track: cardSource.track,
    content_version: cardSource.content_version,
    minimum_client_version: cardSource.release.minimum_client_version,
    parent_release_id: cardSource.release.parent_release_id,
    assets: cardSource.assets.map(asset => ({
      asset_id: asset.asset_id,
      duration_ms: asset.duration_ms,
      media_type: asset.media_type,
      sha256: asset.sha256,
      size_bytes: asset.size_bytes,
    })),
  };
}

function signManifest(signedPayload, signer) {
  let signature;

  try {
    signature = crypto.sign(
      null,
      Buffer.from(stableJsonStringify(signedPayload)),
      signer.privateKey,
    );
  } catch (error) {
    throw contentManifestError(
      503,
      'content_manifest_signing_unavailable',
      `Content manifest signing failed: ${safeErrorMessage(error)}`,
    );
  }

  return {
    algorithm: CONTENT_MANIFEST_SIGNATURE_ALGORITHM,
    key_id: signer.keyId,
    value: signature.toString('hex'),
  };
}

function stableJsonStringify(value) {
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

function validateServiceOptions(options) {
  if (!options || typeof options !== 'object') {
    throw new Error('Content manifest service options are required.');
  }

  if (
    typeof options.store?.getCardSource !== 'function' ||
    typeof options.store?.getMembership !== 'function'
  ) {
    throw new Error(
      'Content manifest service requires card-source and membership reads.',
    );
  }

  if (typeof options.now !== 'function') {
    throw new Error('Content manifest service requires a clock.');
  }
  if (
    !['development', 'production', 'controlled_pilot'].includes(
      options.runtimeMode ?? 'development',
    )
  ) {
    throw new Error('Content manifest service runtime mode is invalid.');
  }

  if (
    !Number.isInteger(options.downloadTtlSeconds ?? DOWNLOAD_TTL_SECONDS) ||
    (options.downloadTtlSeconds ?? DOWNLOAD_TTL_SECONDS) <= 0
  ) {
    throw new Error('Content manifest download TTL must be a positive integer.');
  }

}

function requireSigner(signer) {
  if (
    !signer ||
    typeof signer.keyId !== 'string' ||
    signer.keyId.trim().length === 0 ||
    signer.privateKey?.asymmetricKeyType !== 'ed25519'
  ) {
    throw contentManifestError(
      503,
      'content_manifest_signing_unavailable',
      'Content manifest signing is not configured.',
    );
  }

  return signer;
}

function requireDownloadUrlResolver(resolveDownloadUrl) {
  if (typeof resolveDownloadUrl !== 'function') {
    throw contentManifestError(
      503,
      'content_asset_delivery_unavailable',
      'Content asset delivery is not configured.',
    );
  }

  return resolveDownloadUrl;
}

function requireTrack(value) {
  if (value !== 'cet4' && value !== 'cet6') {
    throw contentManifestError(
      400,
      'invalid_track',
      'track must be cet4 or cet6.',
    );
  }

  return value;
}

function requireContentVersion(value) {
  if (typeof value !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(value)) {
    throw contentManifestError(
      400,
      'invalid_content_version',
      'content_version must be a normalized SHA-256 version.',
    );
  }

  return value;
}

function requireHttpsUrl(value) {
  if (typeof value !== 'string') {
    throw contentManifestError(
      503,
      'content_asset_delivery_unavailable',
      'Content asset delivery did not return a URL.',
    );
  }

  let url;

  try {
    url = new URL(value);
  } catch {
    throw contentManifestError(
      503,
      'content_asset_delivery_unavailable',
      'Content asset delivery returned an invalid URL.',
    );
  }

  if (url.protocol !== 'https:' || url.username || url.password) {
    throw contentManifestError(
      503,
      'content_asset_delivery_unavailable',
      'Content asset delivery must return a credential-free HTTPS URL.',
    );
  }

  return url.toString();
}

function contentManifestError(statusCode, code, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = code;
  return error;
}

function safeErrorMessage(error) {
  return error instanceof Error ? error.message : 'unknown signing error';
}

function isObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

module.exports = {
  CONTENT_MANIFEST_SCHEMA_VERSION,
  createContentManifestSigner,
  createContentManifestV1Service,
  createStableManifest,
  stableJsonStringify,
};
