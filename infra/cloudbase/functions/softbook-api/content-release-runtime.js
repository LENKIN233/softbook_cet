const FORMAL_RELEASE_SCHEMA = 'content-release.v1';
const PILOT_RELEASE_SCHEMA = 'pilot-content-release.v1';
const RELEASE_ID_PATTERN = /^[0-9A-Za-z][0-9A-Za-z._-]{0,127}$/;
const SEMANTIC_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const PILOT_RELEASE_FIELDS = Object.freeze([
  'activated_at',
  'card_count',
  'content_version',
  'expires_at',
  'free_card_count',
  'gate_eligible',
  'minimum_client_versions',
  'pilot_id',
  'profile_id',
  'release_class',
  'release_id',
  'runtime_mode',
  'schema_version',
  'track',
]);

function isContentReleaseValidForRuntime(cardSource, runtimeMode, now) {
  if (runtimeMode === 'development') return true;
  const release = cardSource?.release;
  if (!release || release.content_version !== cardSource.content_version) {
    return false;
  }
  if (runtimeMode === 'production') {
    return release.schema_version === FORMAL_RELEASE_SCHEMA;
  }
  if (runtimeMode !== 'controlled_pilot') return false;
  const checkedAt = now instanceof Date ? now : new Date(now);
  const activatedAt = canonicalTimestamp(release.activated_at);
  const expiresAt = canonicalTimestamp(release.expires_at);
  const minimumClientVersions = release.minimum_client_versions;
  const minimumClientPlatforms =
    minimumClientVersions && typeof minimumClientVersions === 'object'
      ? Object.keys(minimumClientVersions).sort()
      : [];
  const minimumClientVersionsAreValid =
    minimumClientPlatforms.length === 2 &&
    minimumClientPlatforms[0] === 'android' &&
    minimumClientPlatforms[1] === 'ios' &&
    minimumClientPlatforms.every(platform =>
      isNativeStringMatching(
        minimumClientVersions[platform],
        SEMANTIC_VERSION_PATTERN,
      ),
    );
  return (
    hasExactFields(release, PILOT_RELEASE_FIELDS) &&
    release.schema_version === PILOT_RELEASE_SCHEMA &&
    release.runtime_mode === 'controlled_pilot' &&
    release.release_class === 'controlled_pilot' &&
    isNativeStringMatching(release.release_id, RELEASE_ID_PATTERN) &&
    isNativeStringMatching(release.profile_id, RELEASE_ID_PATTERN) &&
    isNativeStringMatching(release.pilot_id, RELEASE_ID_PATTERN) &&
    release.track === 'cet4' &&
    cardSource.track === 'cet4' &&
    release.card_count === 120 &&
    release.free_card_count === 60 &&
    cardSource.card_records?.length === 120 &&
    release.gate_eligible === false &&
    minimumClientVersionsAreValid &&
    Number.isFinite(checkedAt.getTime()) &&
    activatedAt !== null &&
    expiresAt !== null &&
    activatedAt < expiresAt &&
    activatedAt <= checkedAt.getTime() &&
    checkedAt.getTime() < expiresAt
  );
}

function hasExactFields(value, fields) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const actualFields = Object.keys(value).sort();
  return (
    actualFields.length === fields.length &&
    actualFields.every((field, index) => field === fields[index])
  );
}

function isNativeStringMatching(value, pattern) {
  return typeof value === 'string' && pattern.test(value);
}

function canonicalTimestamp(value) {
  if (typeof value !== 'string') return null;
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString() === value
    ? parsed.getTime()
    : null;
}

module.exports = {
  FORMAL_RELEASE_SCHEMA,
  PILOT_RELEASE_SCHEMA,
  isContentReleaseValidForRuntime,
};
