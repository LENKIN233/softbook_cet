const FORMAL_RELEASE_SCHEMA = 'content-release.v1';
const PILOT_RELEASE_SCHEMA = 'pilot-content-release.v1';

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
  return (
    release.schema_version === PILOT_RELEASE_SCHEMA &&
    release.runtime_mode === 'controlled_pilot' &&
    release.release_class === 'controlled_pilot' &&
    release.track === 'cet4' &&
    cardSource.track === 'cet4' &&
    release.card_count === 120 &&
    release.free_card_count === 60 &&
    cardSource.card_records?.length === 120 &&
    release.gate_eligible === false &&
    Number.isFinite(checkedAt.getTime()) &&
    Date.parse(release.activated_at) <= checkedAt.getTime() &&
    checkedAt.getTime() < Date.parse(release.expires_at)
  );
}

module.exports = {
  FORMAL_RELEASE_SCHEMA,
  PILOT_RELEASE_SCHEMA,
  isContentReleaseValidForRuntime,
};
