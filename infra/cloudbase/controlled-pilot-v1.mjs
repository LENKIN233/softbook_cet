const SCHEMA = Object.freeze({
  bundle: 'controlled-pilot-bundle.v1',
  entitlementCommand: 'pilot-entitlement-command.v1',
  outcomeReport: 'pilot-outcome-report.v1',
  profile: 'controlled-pilot-profile.v1',
  release: 'pilot-content-release.v1',
});

export const CONTROLLED_PILOT_SCHEMAS = SCHEMA;
export const CONTROLLED_PILOT_CARD_COUNT = 120;
export const CONTROLLED_PILOT_FREE_CARD_COUNT = 60;
export const CONTROLLED_PILOT_DURATION_HOURS = 120;
export const CONTROLLED_PILOT_COHORT_MIN = 30;
export const CONTROLLED_PILOT_COHORT_MAX = 50;
export const PERSONAL_DEVELOPMENT_ENVIRONMENT = 'test-d2gzcyxr9f7e80972';
export const CONTROLLED_PILOT_LIBRARY_CARD_COUNTS = Object.freeze({
  careful_reading: 24,
  cloze: 16,
  grammar: 12,
  listening: 24,
  translation: 16,
  vocabulary: 12,
  writing: 16,
});
export const CONTROLLED_PILOT_CORE_INTERACTIONS = Object.freeze([
  'elimination',
  'flip',
  'lock',
  'multiple_choice',
  'swipe',
]);
export const CONTROLLED_PILOT_EXPLAINED_CONTENT_RISKS = Object.freeze([
  Object.freeze({
    rule_id: 'synthetic_source',
    severity: 'source_risk',
    card_count: CONTROLLED_PILOT_CARD_COUNT,
    disclosure: 'synthetic_training_content_not_true_exam',
  }),
]);

const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9._-]{2,127}$/;
const SHA256_PATTERN = /^sha256:[a-f0-9]{64}$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;
const PHONE_PATTERN = /^1\d{10}$/;
const SECRET_KEY_PATTERN =
  /(?:secret|private[_-]?key|password|credential|access[_-]?token|refresh[_-]?token|sms[_-]?code|api[_-]?key)/i;

export class ControlledPilotContractError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ControlledPilotContractError';
  }
}

export function validateControlledPilotProfile(value) {
  const profile = requireRecord(value, 'controlled pilot profile');
  assertExactKeys(
    profile,
    [
      'schema_version',
      'profile_id',
      'pilot_id',
      'environment_id',
      'region',
      'api_base_url',
      'runtime_mode',
      'enabled_tracks',
      'minimum_client_versions',
      'signing_key_id',
      'cohort_limit',
      'pilot_expires_at',
      'gate_eligible',
    ],
    'controlled pilot profile',
  );
  assertNoSecretFields(profile, 'controlled pilot profile');
  requireExact(profile.schema_version, SCHEMA.profile, 'schema_version');
  requireExact(profile.runtime_mode, 'controlled_pilot', 'runtime_mode');
  requireExact(profile.gate_eligible, false, 'gate_eligible');
  const enabledTracks = requireStringArray(profile.enabled_tracks, 'enabled_tracks');
  if (enabledTracks.length !== 1 || enabledTracks[0] !== 'cet4') {
    fail('enabled_tracks must be exactly ["cet4"].');
  }
  const environmentId = requireString(profile.environment_id, 'environment_id');
  if (environmentId === PERSONAL_DEVELOPMENT_ENVIRONMENT) {
    fail('environment_id must identify an independent receiver pilot environment.');
  }

  return {
    schema_version: SCHEMA.profile,
    profile_id: requirePattern(profile.profile_id, IDENTIFIER_PATTERN, 'profile_id'),
    pilot_id: requirePublicIdentifier(profile.pilot_id, 'pilot_id'),
    environment_id: environmentId,
    region: requirePattern(profile.region, /^[a-z]+-[a-z]+(?:-\d+)?$/, 'region'),
    api_base_url: requireHttpsApiBaseUrl(profile.api_base_url, 'api_base_url'),
    runtime_mode: 'controlled_pilot',
    enabled_tracks: ['cet4'],
    minimum_client_versions: validateMinimumClientVersions(
      profile.minimum_client_versions,
    ),
    signing_key_id: requirePattern(
      profile.signing_key_id,
      IDENTIFIER_PATTERN,
      'signing_key_id',
    ),
    cohort_limit: requireIntegerRange(
      profile.cohort_limit,
      CONTROLLED_PILOT_COHORT_MIN,
      CONTROLLED_PILOT_COHORT_MAX,
      'cohort_limit',
    ),
    pilot_expires_at: requireIsoTimestamp(
      profile.pilot_expires_at,
      'pilot_expires_at',
    ),
    gate_eligible: false,
  };
}

export function validateControlledPilotBundle(value) {
  const bundle = requireRecord(value, 'controlled pilot bundle');
  assertExactKeys(
    bundle,
    [
      'schema_version',
      'bundle_id',
      'profile_id',
      'pilot_id',
      'release_id',
      'track',
      'runtime_mode',
      'created_at',
      'release_at',
      'pilot_expires_at',
      'content',
      'approval',
      'audit',
      'audio',
      'minimum_client_versions',
      'gate_eligible',
    ],
    'controlled pilot bundle',
  );
  requireExact(bundle.schema_version, SCHEMA.bundle, 'schema_version');
  requireExact(bundle.track, 'cet4', 'track');
  requireExact(bundle.runtime_mode, 'controlled_pilot', 'runtime_mode');
  requireExact(bundle.gate_eligible, false, 'gate_eligible');

  const createdAt = requireIsoTimestamp(bundle.created_at, 'created_at');
  const releaseAt = requireIsoTimestamp(bundle.release_at, 'release_at');
  const pilotExpiresAt = requireIsoTimestamp(
    bundle.pilot_expires_at,
    'pilot_expires_at',
  );
  requireChronological(
    [createdAt, releaseAt, pilotExpiresAt],
    'created_at, release_at, and pilot_expires_at',
  );

  return {
    schema_version: SCHEMA.bundle,
    bundle_id: requirePattern(bundle.bundle_id, IDENTIFIER_PATTERN, 'bundle_id'),
    profile_id: requirePattern(bundle.profile_id, IDENTIFIER_PATTERN, 'profile_id'),
    pilot_id: requirePublicIdentifier(bundle.pilot_id, 'pilot_id'),
    release_id: requirePattern(bundle.release_id, IDENTIFIER_PATTERN, 'release_id'),
    track: 'cet4',
    runtime_mode: 'controlled_pilot',
    created_at: createdAt,
    release_at: releaseAt,
    pilot_expires_at: pilotExpiresAt,
    content: validatePilotContentEvidence(bundle.content),
    approval: validatePilotApproval(bundle.approval),
    audit: validatePilotAudit(bundle.audit),
    audio: validatePilotAudio(bundle.audio),
    minimum_client_versions: validateMinimumClientVersions(
      bundle.minimum_client_versions,
    ),
    gate_eligible: false,
  };
}

export function validatePilotContentRelease(value) {
  const release = requireRecord(value, 'pilot content release');
  assertExactKeys(
    release,
    [
      'schema_version',
      'pilot_id',
      'profile_id',
      'release_id',
      'release_class',
      'runtime_mode',
      'track',
      'content_version',
      'card_count',
      'free_card_count',
      'activated_at',
      'expires_at',
      'minimum_client_versions',
      'gate_eligible',
    ],
    'pilot content release',
  );
  requireExact(release.schema_version, SCHEMA.release, 'schema_version');
  requireExact(release.release_class, 'controlled_pilot', 'release_class');
  requireExact(release.runtime_mode, 'controlled_pilot', 'runtime_mode');
  requireExact(release.track, 'cet4', 'track');
  requireExact(release.card_count, CONTROLLED_PILOT_CARD_COUNT, 'card_count');
  requireExact(
    release.free_card_count,
    CONTROLLED_PILOT_FREE_CARD_COUNT,
    'free_card_count',
  );
  requireExact(release.gate_eligible, false, 'gate_eligible');

  const activatedAt = requireIsoTimestamp(release.activated_at, 'activated_at');
  const expiresAt = requireIsoTimestamp(release.expires_at, 'expires_at');
  requireChronological(
    [activatedAt, expiresAt],
    'activated_at and expires_at',
  );

  return {
    schema_version: SCHEMA.release,
    pilot_id: requirePublicIdentifier(release.pilot_id, 'pilot_id'),
    profile_id: requirePattern(release.profile_id, IDENTIFIER_PATTERN, 'profile_id'),
    release_id: requirePattern(release.release_id, IDENTIFIER_PATTERN, 'release_id'),
    release_class: 'controlled_pilot',
    runtime_mode: 'controlled_pilot',
    track: 'cet4',
    content_version: requirePattern(
      release.content_version,
      SHA256_PATTERN,
      'content_version',
    ),
    card_count: CONTROLLED_PILOT_CARD_COUNT,
    free_card_count: CONTROLLED_PILOT_FREE_CARD_COUNT,
    activated_at: activatedAt,
    expires_at: expiresAt,
    minimum_client_versions: validateMinimumClientVersions(
      release.minimum_client_versions,
    ),
    gate_eligible: false,
  };
}

export function validatePilotEntitlementCommand(value) {
  const command = requireRecord(value, 'pilot entitlement command');
  assertExactKeys(
    command,
    [
      'schema_version',
      'event_id',
      'pilot_id',
      'phone_number',
      'action',
      'actor',
      'reason',
      'occurred_at',
      'previous_stage',
      'resulting_stage',
    ],
    'pilot entitlement command',
  );
  requireExact(
    command.schema_version,
    SCHEMA.entitlementCommand,
    'schema_version',
  );
  const action = requireString(command.action, 'action');
  if (action !== 'grant' && action !== 'revoke') {
    fail('action must be grant or revoke.');
  }
  const previousStage = requireMembershipStage(
    command.previous_stage,
    'previous_stage',
  );
  const resultingStage = requireMembershipStage(
    command.resulting_stage,
    'resulting_stage',
  );
  if (action === 'grant' && resultingStage !== 'pilot_premium') {
    fail('grant resulting_stage must be pilot_premium.');
  }
  if (action === 'revoke' && resultingStage === 'pilot_premium') {
    fail('revoke resulting_stage must restore the canonical base membership.');
  }

  return {
    schema_version: SCHEMA.entitlementCommand,
    event_id: requirePublicIdentifier(command.event_id, 'event_id'),
    pilot_id: requirePublicIdentifier(command.pilot_id, 'pilot_id'),
    phone_number: requirePattern(command.phone_number, PHONE_PATTERN, 'phone_number'),
    action,
    actor: requirePrivacySafePublicText(command.actor, 'actor'),
    reason: requireString(command.reason, 'reason'),
    occurred_at: requireIsoTimestamp(command.occurred_at, 'occurred_at'),
    previous_stage: previousStage,
    resulting_stage: resultingStage,
  };
}

export function validatePilotOutcomeReport(value) {
  const report = requireRecord(value, 'pilot outcome report');
  assertExactKeys(
    report,
    [
      'schema_version',
      'pilot_id',
      'generated_at',
      'days_observed',
      'cohort_size',
      'metrics',
      'decision',
      'contains_direct_identifiers',
      'gate_eligible',
    ],
    'pilot outcome report',
  );
  requireExact(report.schema_version, SCHEMA.outcomeReport, 'schema_version');
  requireExact(report.days_observed, 5, 'days_observed');
  requireExact(
    report.contains_direct_identifiers,
    false,
    'contains_direct_identifiers',
  );
  requireExact(report.gate_eligible, false, 'gate_eligible');
  const cohortSize = requireIntegerRange(
    report.cohort_size,
    CONTROLLED_PILOT_COHORT_MIN,
    CONTROLLED_PILOT_COHORT_MAX,
    'cohort_size',
  );
  const metrics = validateOutcomeMetrics(report.metrics, cohortSize);
  const decision = requireString(report.decision, 'decision');
  if (!['advance', 'iterate', 'stop'].includes(decision)) {
    fail('decision must be advance, iterate, or stop.');
  }
  if (decision === 'advance' && !metrics.meets_all_thresholds) {
    fail('decision cannot advance when one or more controlled pilot thresholds fail.');
  }

  return {
    schema_version: SCHEMA.outcomeReport,
    pilot_id: requirePublicIdentifier(report.pilot_id, 'pilot_id'),
    generated_at: requireIsoTimestamp(report.generated_at, 'generated_at'),
    days_observed: 5,
    cohort_size: cohortSize,
    metrics,
    decision,
    contains_direct_identifiers: false,
    gate_eligible: false,
  };
}

function validatePilotContentEvidence(value) {
  const content = requireRecord(value, 'content');
  assertExactKeys(
    content,
    [
      'payload_path',
      'payload_sha256',
      'content_version',
      'corpus_fingerprint',
      'card_count',
      'free_card_count',
      'library_card_counts',
      'free_library_card_counts',
      'library_box_counts',
      'interaction_card_counts',
      'mapped_card_count',
      'unmapped_card_count',
      'duplicate_card_id_count',
    ],
    'content',
  );
  requireExact(content.card_count, CONTROLLED_PILOT_CARD_COUNT, 'content.card_count');
  requireExact(
    content.free_card_count,
    CONTROLLED_PILOT_FREE_CARD_COUNT,
    'content.free_card_count',
  );
  requireExact(
    content.mapped_card_count,
    CONTROLLED_PILOT_CARD_COUNT,
    'content.mapped_card_count',
  );
  requireExact(content.unmapped_card_count, 0, 'content.unmapped_card_count');
  requireExact(
    content.duplicate_card_id_count,
    0,
    'content.duplicate_card_id_count',
  );
  const libraryCardCounts = validateLibraryCounts(
    content.library_card_counts,
    CONTROLLED_PILOT_CARD_COUNT,
    CONTROLLED_PILOT_LIBRARY_CARD_COUNTS,
    'content.library_card_counts',
  );
  const freeLibraryCardCounts = validateLibraryCounts(
    content.free_library_card_counts,
    CONTROLLED_PILOT_FREE_CARD_COUNT,
    null,
    'content.free_library_card_counts',
  );
  const libraryBoxCounts = validateLibraryBoxCounts(content.library_box_counts);
  const interactionCardCounts = validateInteractionCounts(
    content.interaction_card_counts,
  );

  return {
    payload_path: requireSafeRelativePath(content.payload_path, 'content.payload_path'),
    payload_sha256: requirePattern(
      content.payload_sha256,
      SHA256_PATTERN,
      'content.payload_sha256',
    ),
    content_version: requirePattern(
      content.content_version,
      SHA256_PATTERN,
      'content.content_version',
    ),
    corpus_fingerprint: requirePattern(
      content.corpus_fingerprint,
      SHA256_PATTERN,
      'content.corpus_fingerprint',
    ),
    card_count: CONTROLLED_PILOT_CARD_COUNT,
    free_card_count: CONTROLLED_PILOT_FREE_CARD_COUNT,
    library_card_counts: libraryCardCounts,
    free_library_card_counts: freeLibraryCardCounts,
    library_box_counts: libraryBoxCounts,
    interaction_card_counts: interactionCardCounts,
    mapped_card_count: CONTROLLED_PILOT_CARD_COUNT,
    unmapped_card_count: 0,
    duplicate_card_id_count: 0,
  };
}

function validatePilotApproval(value) {
  const approval = requireRecord(value, 'approval');
  assertExactKeys(
    approval,
    [
      'record_path',
      'record_sha256',
      'review_path',
      'review_sha256',
      'scope',
      'status',
      'approved_at',
    ],
    'approval',
  );
  requireExact(approval.scope, 'controlled_pilot_120', 'approval.scope');
  requireExact(approval.status, 'approved', 'approval.status');
  return {
    record_path: requireSafeRelativePath(approval.record_path, 'approval.record_path'),
    record_sha256: requirePattern(
      approval.record_sha256,
      SHA256_PATTERN,
      'approval.record_sha256',
    ),
    review_path: requireSafeRelativePath(
      approval.review_path,
      'approval.review_path',
    ),
    review_sha256: requirePattern(
      approval.review_sha256,
      SHA256_PATTERN,
      'approval.review_sha256',
    ),
    scope: 'controlled_pilot_120',
    status: 'approved',
    approved_at: requireIsoTimestamp(approval.approved_at, 'approval.approved_at'),
  };
}

function validatePilotAudit(value) {
  const audit = requireRecord(value, 'audit');
  assertExactKeys(
    audit,
    [
      'report_path',
      'report_sha256',
      'audit_version',
      'report_type',
      'scope_card_count',
      'scope_card_ids_sha256',
      'corpus_sha256',
      'unresolved_blockers',
      'unexplained_risks',
      'metadata_coverage',
      'explained_risks',
    ],
    'audit',
  );
  requireExact(
    audit.audit_version,
    'card-make-quality-audit-v1',
    'audit.audit_version',
  );
  requireExact(
    audit.report_type,
    'scoped_card_quality_audit',
    'audit.report_type',
  );
  requireExact(
    audit.scope_card_count,
    CONTROLLED_PILOT_CARD_COUNT,
    'audit.scope_card_count',
  );
  requireExact(audit.unresolved_blockers, 0, 'audit.unresolved_blockers');
  requireExact(audit.unexplained_risks, 0, 'audit.unexplained_risks');
  requireExact(audit.metadata_coverage, 1, 'audit.metadata_coverage');
  const explainedRisks = validateExplainedContentRisks(audit.explained_risks);
  return {
    report_path: requireSafeRelativePath(audit.report_path, 'audit.report_path'),
    report_sha256: requirePattern(
      audit.report_sha256,
      SHA256_PATTERN,
      'audit.report_sha256',
    ),
    audit_version: 'card-make-quality-audit-v1',
    report_type: 'scoped_card_quality_audit',
    scope_card_count: CONTROLLED_PILOT_CARD_COUNT,
    scope_card_ids_sha256: requirePattern(
      audit.scope_card_ids_sha256,
      SHA256_PATTERN,
      'audit.scope_card_ids_sha256',
    ),
    corpus_sha256: requirePattern(
      audit.corpus_sha256,
      SHA256_PATTERN,
      'audit.corpus_sha256',
    ),
    unresolved_blockers: 0,
    unexplained_risks: 0,
    metadata_coverage: 1,
    explained_risks: explainedRisks,
  };
}

function validateExplainedContentRisks(value) {
  if (!Array.isArray(value) || value.length !== 1) {
    fail('audit.explained_risks must contain exactly the synthetic-source disclosure.');
  }
  const risk = requireRecord(value[0], 'audit.explained_risks[0]');
  assertExactKeys(
    risk,
    ['rule_id', 'severity', 'card_count', 'disclosure'],
    'audit.explained_risks[0]',
  );
  const expected = CONTROLLED_PILOT_EXPLAINED_CONTENT_RISKS[0];
  requireExact(
    risk.rule_id,
    expected.rule_id,
    'audit.explained_risks[0].rule_id',
  );
  requireExact(
    risk.severity,
    expected.severity,
    'audit.explained_risks[0].severity',
  );
  requireExact(
    risk.card_count,
    expected.card_count,
    'audit.explained_risks[0].card_count',
  );
  requireExact(
    risk.disclosure,
    expected.disclosure,
    'audit.explained_risks[0].disclosure',
  );
  return [expected];
}

function validatePilotAudio(value) {
  const audio = requireRecord(value, 'audio');
  assertExactKeys(
    audio,
    [
      'manifest_path',
      'manifest_sha256',
      'qc_index_path',
      'qc_index_sha256',
      'referenced_asset_count',
      'qc_asset_count',
    ],
    'audio',
  );
  const referencedAssetCount = requireIntegerRange(
    audio.referenced_asset_count,
    24,
    CONTROLLED_PILOT_CARD_COUNT,
    'audio.referenced_asset_count',
  );
  requireExact(audio.qc_asset_count, referencedAssetCount, 'audio.qc_asset_count');
  return {
    manifest_path: requireSafeRelativePath(audio.manifest_path, 'audio.manifest_path'),
    manifest_sha256: requirePattern(
      audio.manifest_sha256,
      SHA256_PATTERN,
      'audio.manifest_sha256',
    ),
    qc_index_path: requireSafeRelativePath(audio.qc_index_path, 'audio.qc_index_path'),
    qc_index_sha256: requirePattern(
      audio.qc_index_sha256,
      SHA256_PATTERN,
      'audio.qc_index_sha256',
    ),
    referenced_asset_count: referencedAssetCount,
    qc_asset_count: referencedAssetCount,
  };
}

function validateOutcomeMetrics(value, cohortSize) {
  const metrics = requireRecord(value, 'metrics');
  assertExactKeys(
    metrics,
    [
      'first_round_completers',
      'd1_retained',
      'd5_retained',
      'survey_respondents',
      'exam_value_and_space_respondents',
      'p0_incident_count',
    ],
    'metrics',
  );
  const normalized = {};
  for (const key of [
    'first_round_completers',
    'd1_retained',
    'd5_retained',
    'survey_respondents',
  ]) {
    normalized[key] = requireIntegerRange(metrics[key], 0, cohortSize, `metrics.${key}`);
  }
  normalized.exam_value_and_space_respondents = requireIntegerRange(
    metrics.exam_value_and_space_respondents,
    0,
    normalized.survey_respondents,
    'metrics.exam_value_and_space_respondents',
  );
  normalized.p0_incident_count = requireIntegerRange(
    metrics.p0_incident_count,
    0,
    Number.MAX_SAFE_INTEGER,
    'metrics.p0_incident_count',
  );
  const rates = {
    first_round_completion_rate: normalized.first_round_completers / cohortSize,
    d1_retention_rate: normalized.d1_retained / cohortSize,
    d5_retention_rate: normalized.d5_retained / cohortSize,
    survey_response_rate: normalized.survey_respondents / cohortSize,
    exam_value_and_space_understanding_rate:
      normalized.survey_respondents === 0
        ? 0
        : normalized.exam_value_and_space_respondents /
          normalized.survey_respondents,
  };
  return {
    ...normalized,
    ...rates,
    meets_all_thresholds:
      rates.first_round_completion_rate >= 0.7 &&
      rates.d1_retention_rate >= 0.4 &&
      rates.d5_retention_rate >= 0.2 &&
      rates.survey_response_rate >= 0.8 &&
      rates.exam_value_and_space_understanding_rate >= 0.6 &&
      normalized.p0_incident_count === 0,
  };
}

function validateLibraryCounts(value, expectedTotal, exactCounts, label) {
  const counts = requireRecord(value, label);
  const libraries = Object.keys(CONTROLLED_PILOT_LIBRARY_CARD_COUNTS);
  assertExactKeys(counts, libraries, label);
  const normalized = {};
  for (const library of libraries) {
    const minimum = exactCounts === null ? 1 : exactCounts[library];
    const maximum = exactCounts === null ? expectedTotal : exactCounts[library];
    normalized[library] = requireIntegerRange(
      counts[library],
      minimum,
      maximum,
      `${label}.${library}`,
    );
  }
  const total = Object.values(normalized).reduce((sum, count) => sum + count, 0);
  if (total !== expectedTotal) {
    fail(`${label} must sum to ${expectedTotal}.`);
  }
  return normalized;
}

function validateLibraryBoxCounts(value) {
  const counts = requireRecord(value, 'content.library_box_counts');
  const libraries = Object.keys(CONTROLLED_PILOT_LIBRARY_CARD_COUNTS);
  assertExactKeys(counts, libraries, 'content.library_box_counts');
  const normalized = {};
  for (const library of libraries) {
    normalized[library] = requireIntegerRange(
      counts[library],
      2,
      CONTROLLED_PILOT_LIBRARY_CARD_COUNTS[library],
      `content.library_box_counts.${library}`,
    );
  }
  return normalized;
}

function validateInteractionCounts(value) {
  const counts = requireRecord(value, 'content.interaction_card_counts');
  assertExactKeys(
    counts,
    CONTROLLED_PILOT_CORE_INTERACTIONS,
    'content.interaction_card_counts',
  );
  const normalized = {};
  for (const interaction of CONTROLLED_PILOT_CORE_INTERACTIONS) {
    normalized[interaction] = requireIntegerRange(
      counts[interaction],
      1,
      CONTROLLED_PILOT_CARD_COUNT,
      `content.interaction_card_counts.${interaction}`,
    );
  }
  const total = Object.values(normalized).reduce((sum, count) => sum + count, 0);
  if (total !== CONTROLLED_PILOT_CARD_COUNT) {
    fail(`content.interaction_card_counts must sum to ${CONTROLLED_PILOT_CARD_COUNT}.`);
  }
  return normalized;
}

function requireMembershipStage(value, label) {
  const stage = requireString(value, label);
  if (!['trial_available', 'trial', 'free', 'premium', 'pilot_premium'].includes(stage)) {
    fail(`${label} must be a recognized canonical membership stage.`);
  }
  return stage;
}

function requireChronological(timestamps, label) {
  for (let index = 1; index < timestamps.length; index += 1) {
    if (Date.parse(timestamps[index - 1]) >= Date.parse(timestamps[index])) {
      fail(`${label} must be strictly chronological.`);
    }
  }
}

function validateMinimumClientVersions(value) {
  const versions = requireRecord(value, 'minimum_client_versions');
  assertExactKeys(versions, ['ios', 'android'], 'minimum_client_versions');
  return {
    ios: requirePattern(versions.ios, SEMVER_PATTERN, 'minimum_client_versions.ios'),
    android: requirePattern(
      versions.android,
      SEMVER_PATTERN,
      'minimum_client_versions.android',
    ),
  };
}

function assertNoSecretFields(value, label) {
  for (const key of Object.keys(value)) {
    if (SECRET_KEY_PATTERN.test(key)) {
      fail(`${label} must not contain secret-shaped field ${key}.`);
    }
  }
}

function requireSafeRelativePath(value, label) {
  const path = requireString(value, label);
  const segments = path.split('/');
  if (
    path.startsWith('/') ||
    segments.some(segment => segment === '' || segment === '.' || segment === '..') ||
    path.includes('\\')
  ) {
    fail(`${label} must be a safe relative path.`);
  }
  return path;
}

function requireHttpsApiBaseUrl(value, label) {
  const candidate = requireString(value, label);
  let url;
  try {
    url = new URL(candidate);
  } catch {
    fail(`${label} must be a valid HTTPS API base URL.`);
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname === '/' ||
    url.search ||
    url.hash
  ) {
    fail(`${label} must be a credential-free HTTPS API base URL with a path.`);
  }
  return url.toString().replace(/\/$/, '');
}

function requireStringArray(value, label) {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string')) {
    fail(`${label} must be an array of strings.`);
  }
  return [...value];
}

function requireIsoTimestamp(value, label) {
  const timestamp = requireString(value, label);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(timestamp)) {
    fail(`${label} must be an ISO-8601 UTC timestamp.`);
  }
  if (!Number.isFinite(Date.parse(timestamp))) {
    fail(`${label} must be a valid timestamp.`);
  }
  return timestamp;
}

function requireIntegerRange(value, minimum, maximum, label) {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    fail(`${label} must be an integer from ${minimum} through ${maximum}.`);
  }
  return value;
}

function requirePattern(value, pattern, label) {
  const candidate = requireString(value, label);
  if (!pattern.test(candidate)) {
    fail(`${label} is invalid.`);
  }
  return candidate;
}

function requirePublicIdentifier(value, label) {
  const candidate = requirePattern(value, IDENTIFIER_PATTERN, label);
  if (containsPhoneMaterial(candidate)) {
    fail(`${label} must not contain phone-number material.`);
  }
  return candidate;
}

function requirePrivacySafePublicText(value, label) {
  const candidate = requireString(value, label);
  if (containsPhoneMaterial(candidate)) {
    fail(`${label} must not contain phone-number material.`);
  }
  return candidate;
}

function containsPhoneMaterial(value) {
  return /1\d{10}/.test(value.replace(/\D/g, ''));
}

function requireString(value, label) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) {
    fail(`${label} must be a non-empty trimmed string.`);
  }
  return value;
}

function requireRecord(value, label) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    fail(`${label} must be an object.`);
  }
  return value;
}

function requireExact(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label} must be ${JSON.stringify(expected)}.`);
  }
  return actual;
}

function assertExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (actual.length !== required.length || actual.some((key, index) => key !== required[index])) {
    fail(`${label} has unsupported or missing fields.`);
  }
}

function fail(message) {
  throw new ControlledPilotContractError(message);
}
