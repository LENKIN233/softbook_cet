#!/usr/bin/env node

import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import {parseStrictJson} from './lib/strict_json.mjs';
import {
  LEARNING_RUNTIME_EVIDENCE_TYPES,
  RELEASE_OPERATIONAL_EVIDENCE_TYPES,
  CET4_FORMAL_CONTENT_EVIDENCE_TYPES,
  BETA_ENTITLEMENT_EVIDENCE_TYPES,
  SPACE_SYNC_EVIDENCE_TYPES,
  validateGateEvidenceArtifact,
  validateGateEvidenceCoherence,
} from './lib/launch_evidence_contract.mjs';
import {
  loadLaunchEvidenceSemanticContext,
  loadCet4FormalContentEvidence,
  loadBetaEntitlementDrillEvidence,
  loadSpaceSyncEvidence,
  loadProductionDeploymentEvidence,
  loadSmsProviderSmokeReport,
  verifyInnerRepositoryArtifact,
} from './validate_launch_readiness.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CONTRACT = path.join(
  ROOT,
  'docs',
  'release',
  'cet4-closed-beta-readiness.v1.json',
);
const DEFAULT_SPEC = path.join(ROOT, 'spec', 'cet4-closed-beta-readiness.json');
const DEFAULT_LAUNCH_CONTRACT = path.join(
  ROOT,
  'docs',
  'release',
  'launch-readiness.v1.json',
);
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const CONTENT_VERSION_PATTERN = /^sha256:[0-9a-f]{64}$/;
const COMMIT_PATTERN = /^[0-9a-f]{40}$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const ACTOR_PATTERN = /^(github|team|external):[A-Za-z0-9_.-]+$/;
const FORBIDDEN_ENVIRONMENT_PATTERN =
  /(^|[-_.:])(local|mock|simulation|simulator|personal|development|dev)([-_.:]|$)/i;
const STATUS_VALUES = new Set(['not_ready', 'ready']);
const GATE_STATUS_VALUES = new Set([
  'pending',
  'in_progress',
  'blocked',
  'passed',
]);
const DEPENDENCY_STATUS_VALUES = new Set(['unverified', 'blocked', 'ready']);
const MAX_REPOSITORY_EVIDENCE_BYTES = 1024 * 1024;

export const CET4_CLOSED_BETA_SUPPORTED_EVIDENCE_TYPES = Object.freeze([
  'production-deployment',
  'sms-provider-smoke',
  ...LEARNING_RUNTIME_EVIDENCE_TYPES,
  ...RELEASE_OPERATIONAL_EVIDENCE_TYPES,
  ...CET4_FORMAL_CONTENT_EVIDENCE_TYPES,
  ...BETA_ENTITLEMENT_EVIDENCE_TYPES,
  ...SPACE_SYNC_EVIDENCE_TYPES,
]);
const SUPPORTED_EVIDENCE_SET = new Set(
  CET4_CLOSED_BETA_SUPPORTED_EVIDENCE_TYPES,
);

export const CET4_CLOSED_BETA_DEPENDENCY_IDS = Object.freeze([
  'tencent-cloud-receiver',
  'sms-provider',
  'apple-private-distribution',
  'android-private-distribution',
  'human-content-review',
]);

export const CET4_CLOSED_BETA_GATE_DEFINITIONS = Object.freeze({
  'receiver-runtime': [
    'dev-environment-isolation',
    'production-deployment',
    'secret-access-audit',
    'release-permission-audit',
  ],
  'auth-and-account-deletion': [
    'sms-provider-smoke',
    'auth-abuse-test',
    'session-revocation-test',
    'account-deletion-drill',
  ],
  'canonical-learning-and-space': [
    'cross-device-bootstrap-test',
    'offline-replay-test',
    'canonical-state-test',
    'fsrs-version-lock',
    'scheduler-contract-test',
    'clock-boundary-test',
    'space-sync-test',
  ],
  'approved-cet4-content': [
    'cet4-approved-box-coverage-report',
    'cet4-approved-card-coverage-report',
    'cet4-audio-qc-coverage-report',
    'cet4-content-pack-integrity-report',
  ],
  'beta-entitlement': ['beta-entitlement-drill'],
  'private-distribution-and-device-acceptance': [
    'ios-private-beta-device-report',
    'android-private-beta-device-report',
    'pc-web-closed-beta-report',
    'cross-platform-private-audio-report',
    'closed-beta-device-matrix-report',
  ],
  'release-recovery': [
    'load-test-report',
    'availability-observation',
    'backup-restore-drill',
    'penetration-test-report',
    'rollback-drill',
  ],
});

const EXPECTED_BLOCKERS = Object.freeze({
  'receiver-runtime': ['tencent-cloud-receiver'],
  'auth-and-account-deletion': [
    'tencent-cloud-receiver',
    'sms-provider',
  ],
  'canonical-learning-and-space': ['tencent-cloud-receiver'],
  'approved-cet4-content': ['human-content-review'],
  'beta-entitlement': ['tencent-cloud-receiver'],
  'private-distribution-and-device-acceptance': [
    'tencent-cloud-receiver',
    'apple-private-distribution',
    'android-private-distribution',
  ],
  'release-recovery': ['tencent-cloud-receiver'],
});

const FORMAL_APPROVAL_POLICY = Object.freeze({
  provider: 'github_environment',
  environment: 'formal-product-owner-approval',
  required_reviewer: 'github:LENKIN233',
  administrators_can_bypass: false,
  workflow: '.github/workflows/formal-approval.yml',
  required_check: 'formal-approval',
});

export function validateCet4ClosedBetaReadiness(
  contract,
  spec,
  {
    launchContract = null,
    now = new Date(),
    repositoryEvidenceValidated = false,
  } = {},
) {
  const errors = [];
  validateReadinessSpec(spec, errors);
  if (!isRecord(contract)) {
    return {errors: [...errors, 'closed-beta contract must be an object.'], ok: false, ready: false};
  }
  assertExactKeys(
    contract,
    [
      'schema_version',
      'target_release',
      'status',
      'current_milestone',
      'quality_policy',
      'formal_evidence_ingestion',
      'formal_approval',
      'release_candidate',
      'scope',
      'external_dependencies',
      'gates',
      'launch_non_replacement',
    ],
    'closed-beta contract',
    errors,
  );
  assertEqual(
    contract.schema_version,
    'cet4-closed-beta-readiness.v1',
    'schema_version',
    errors,
  );
  assertEqual(contract.target_release, 'cet4-closed-beta', 'target_release', errors);
  assertEqual(
    contract.quality_policy,
    'move_closed_beta_date_before_reducing_gate',
    'quality_policy',
    errors,
  );
  assertEqual(
    contract.formal_evidence_ingestion,
    'registered_types_implemented_unregistered_fail_closed',
    'formal_evidence_ingestion',
    errors,
  );
  requireNonEmptyString(contract.current_milestone, 'current_milestone', errors);
  if (!STATUS_VALUES.has(contract.status)) errors.push('status must be not_ready or ready.');
  validateFormalApproval(contract.formal_approval, errors);
  validateScope(contract.scope, spec?.product_truth, errors);
  const dependencies = mapById(
    contract.external_dependencies,
    'external_dependencies',
    errors,
  );
  assertExactSet(
    [...dependencies.keys()],
    CET4_CLOSED_BETA_DEPENDENCY_IDS,
    'external dependency ids',
    errors,
  );
  for (const [id, dependency] of dependencies) {
    assertExactKeys(dependency, ['id', 'owner', 'status'], `dependency ${id}`, errors);
    assertEqual(dependency.owner, 'product_owner', `dependency ${id}.owner`, errors);
    if (!DEPENDENCY_STATUS_VALUES.has(dependency.status)) {
      errors.push(`dependency ${id}.status is invalid.`);
    }
  }
  const candidate = validateReleaseCandidate(contract.release_candidate, now, errors);
  const gates = mapById(contract.gates, 'gates', errors);
  assertExactSet(
    [...gates.keys()],
    Object.keys(CET4_CLOSED_BETA_GATE_DEFINITIONS),
    'gate ids',
    errors,
  );
  let evidenceCount = 0;
  for (const [gateId, evidenceTypes] of Object.entries(
    CET4_CLOSED_BETA_GATE_DEFINITIONS,
  )) {
    const gate = gates.get(gateId);
    if (!gate) continue;
    evidenceCount += validateGate(
      gate,
      gateId,
      evidenceTypes,
      dependencies,
      now,
      errors,
    );
  }
  if (evidenceCount > 0 && !candidate) {
    errors.push('formal gate evidence requires one exact release candidate first.');
  }
  if (evidenceCount > 0 && repositoryEvidenceValidated !== true) {
    errors.push(
      'formal gate evidence requires successful tracked repository semantic validation.',
    );
  }
  validateLaunchNonReplacement(
    contract.launch_non_replacement,
    launchContract,
    errors,
  );
  const stateReady =
    contract.formal_evidence_ingestion === 'all_required_types_implemented' &&
    candidate !== null &&
    dependencies.size === CET4_CLOSED_BETA_DEPENDENCY_IDS.length &&
    [...dependencies.values()].every(item => item.status === 'ready') &&
    gates.size === Object.keys(CET4_CLOSED_BETA_GATE_DEFINITIONS).length &&
    [...gates.values()].every(item => item.status === 'passed');
  const expectedStatus = stateReady ? 'ready' : 'not_ready';
  if (contract.status !== expectedStatus) {
    errors.push(`status must be ${expectedStatus} for the recorded closed-beta state.`);
  }
  return {
    errors,
    ok: errors.length === 0,
    ready: errors.length === 0 && stateReady,
    summary: {
      candidate_recorded: candidate !== null,
      dependencies_ready: [...dependencies.values()].filter(
        item => item.status === 'ready',
      ).length,
      evidence_count: evidenceCount,
      gates_passed: [...gates.values()].filter(item => item.status === 'passed').length,
      total_dependencies: CET4_CLOSED_BETA_DEPENDENCY_IDS.length,
      total_gates: Object.keys(CET4_CLOSED_BETA_GATE_DEFINITIONS).length,
    },
  };
}

export function verifyCet4ClosedBetaRepositoryEvidence(
  contract,
  {
    now = new Date(),
    root = ROOT,
    semanticContext = null,
    trackedFiles = null,
    trustedCommits = null,
  } = {},
) {
  const errors = [];
  const evidenceRecords = Array.isArray(contract?.gates)
    ? contract.gates.flatMap(gate =>
        Array.isArray(gate?.evidence)
          ? gate.evidence.map(evidence => ({evidence, gateId: gate.id}))
          : [],
      )
    : [];
  if (
    isRecord(contract?.release_candidate) &&
    (!(trustedCommits instanceof Set) ||
      !trustedCommits.has(contract.release_candidate.commit_sha))
  ) {
    errors.push(
      'closed-beta release candidate commit must be reachable from validated HEAD.',
    );
  }
  if (evidenceRecords.length === 0) {
    return {errors, ok: errors.length === 0, reports: new Map()};
  }
  if (!(trackedFiles instanceof Set) || !(trustedCommits instanceof Set)) {
    return {
      errors: [
        'formal closed-beta evidence requires explicit tracked-file and reachable-commit sets.',
      ],
      ok: false,
      reports: new Map(),
    };
  }
  const loadedContext =
    semanticContext ?? loadLaunchEvidenceSemanticContext({root});
  errors.push(...(loadedContext?.errors ?? []));
  const specPath = path.join(root, 'spec', 'cet4-closed-beta-readiness.json');
  let readinessSpecSha256 = null;
  try {
    readinessSpecSha256 = createHash('sha256')
      .update(fs.readFileSync(specPath))
      .digest('hex');
  } catch (error) {
    errors.push(
      `closed-beta readiness policy could not be hashed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
  const parsedReports = new Map();
  const outerUris = new Set();
  const outerHashes = new Set();
  for (const {evidence, gateId} of evidenceRecords) {
    const label = `closed-beta gate ${String(gateId)} evidence ${String(
      evidence?.type,
    )}`;
    if (!isRecord(evidence)) continue;
    if (outerUris.has(evidence.artifact_uri)) {
      errors.push(`${label} reuses an outer artifact URI.`);
    }
    if (outerHashes.has(evidence.artifact_sha256)) {
      errors.push(`${label} reuses an outer artifact SHA-256.`);
    }
    outerUris.add(evidence.artifact_uri);
    outerHashes.add(evidence.artifact_sha256);
    const loadedOuter = loadTrackedEvidenceArtifact(evidence, {
      label,
      root,
      trackedFiles,
    });
    errors.push(...loadedOuter.errors);
    if (!loadedOuter.artifact) continue;
    const artifact = loadedOuter.artifact;
    for (const [index, rawArtifact] of (
      Array.isArray(artifact.raw_artifacts) ? artifact.raw_artifacts : []
    ).entries()) {
      if (!rawArtifact?.artifact_uri?.startsWith('repo://')) continue;
      verifyInnerRepositoryArtifact(
        rawArtifact,
        {
          label: `${label} raw_artifacts[${index}]`,
          root,
          trackedFiles,
        },
        errors,
      );
    }
    if (!trustedCommits.has(artifact?.subject?.commit_sha)) {
      errors.push(`${label} subject commit must be reachable from validated HEAD.`);
    }
    if (!SUPPORTED_EVIDENCE_SET.has(evidence.type)) {
      errors.push(
        `${label} has no registered CET4 closed-beta type-specific semantic contract.`,
      );
      continue;
    }
    const expectedPolicy = closedBetaEvidencePolicy(
      evidence.type,
      loadedContext,
      readinessSpecSha256,
    );
    if (!expectedPolicy?.id || !expectedPolicy?.sha256) {
      errors.push(`${label} has no trusted policy binding.`);
      continue;
    }
    const smsResult =
      evidence.type === 'sms-provider-smoke'
        ? loadSmsProviderSmokeReport(artifact, {
            label,
            root,
            trackedFiles,
          })
        : {errors: [], ok: true, report: null};
    errors.push(...smsResult.errors);
    const deploymentResult =
      evidence.type === 'production-deployment'
        ? loadProductionDeploymentEvidence(artifact, {
            label,
            root,
            trackedFiles,
          })
        : {errors: [], evidence: null, ok: true};
    errors.push(...deploymentResult.errors);
    const contentResult = CET4_FORMAL_CONTENT_EVIDENCE_TYPES.includes(
      evidence.type,
    )
      ? loadCet4FormalContentEvidence(artifact, {
          label,
          root,
          trackedFiles,
        })
      : {errors: [], evidence: null, ok: true};
    errors.push(...contentResult.errors);
    const entitlementResult = BETA_ENTITLEMENT_EVIDENCE_TYPES.includes(
      evidence.type,
    )
      ? loadBetaEntitlementDrillEvidence(artifact, {
          label,
          root,
          trackedFiles,
        })
      : {errors: [], evidence: null, ok: true};
    errors.push(...entitlementResult.errors);
    const spaceResult = SPACE_SYNC_EVIDENCE_TYPES.includes(evidence.type)
      ? loadSpaceSyncEvidence(artifact, {
          label,
          root,
          trackedFiles,
        })
      : {errors: [], evidence: null, ok: true};
    errors.push(...spaceResult.errors);
    const result = validateGateEvidenceArtifact(artifact, {
      evidenceType: evidence.type,
      expectedPolicy,
      expectedSubject: contract.release_candidate,
      gateId,
      now,
      outerEvidence: evidence,
      productionDeploymentEvidence: deploymentResult.evidence,
      cet4FormalContentEvidence: contentResult.evidence,
      betaEntitlementDrillEvidence: entitlementResult.evidence,
      spaceSyncEvidence: spaceResult.evidence,
      releaseOperationalPolicy: loadedContext.releaseOperationalPolicy,
      smsProviderSmokeReport: smsResult.report,
      targetRelease: 'cet4-closed-beta',
    });
    errors.push(...result.errors);
    if (
      result.ok &&
      smsResult.ok &&
      deploymentResult.ok &&
      contentResult.ok &&
      entitlementResult.ok &&
      spaceResult.ok
    ) {
      const gateReports = parsedReports.get(gateId) ?? [];
      gateReports.push(artifact);
      parsedReports.set(gateId, gateReports);
    }
  }
  for (const [gateId, reports] of parsedReports) {
    if (reports.length <= 1) continue;
    const coherence = validateGateEvidenceCoherence(reports, {
      gateId,
      requiredEvidenceTypes: reports.map(
        report => report.subject?.evidence_type,
      ),
    });
    errors.push(...coherence.errors);
  }
  return {errors, ok: errors.length === 0, reports: parsedReports};
}

function loadTrackedEvidenceArtifact(
  evidence,
  {label, root, trackedFiles},
) {
  const errors = [];
  if (
    typeof evidence.artifact_uri !== 'string' ||
    !evidence.artifact_uri.startsWith('repo://')
  ) {
    return {artifact: null, errors: [`${label} must use repo://.`]};
  }
  const relativePath = evidence.artifact_uri.slice('repo://'.length);
  if (
    !relativePath.startsWith('docs/release/evidence/') ||
    relativePath.includes('\\') ||
    relativePath.split('/').includes('..') ||
    !relativePath.endsWith('.json')
  ) {
    return {
      artifact: null,
      errors: [`${label} must use a safe docs/release/evidence JSON path.`],
    };
  }
  if (!trackedFiles.has(relativePath)) {
    return {artifact: null, errors: [`${label} must be tracked by Git.`]};
  }
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, relativePath);
  if (!resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)) {
    return {artifact: null, errors: [`${label} escapes the repository root.`]};
  }
  if (!fs.existsSync(resolvedPath)) {
    return {artifact: null, errors: [`${label} file does not exist.`]};
  }
  const stats = fs.lstatSync(resolvedPath);
  if (
    !stats.isFile() ||
    stats.size <= 0 ||
    stats.size > MAX_REPOSITORY_EVIDENCE_BYTES
  ) {
    return {
      artifact: null,
      errors: [`${label} must be a regular file no larger than 1 MiB.`],
    };
  }
  const bytes = fs.readFileSync(resolvedPath);
  if (stats.size !== evidence.artifact_size_bytes) {
    errors.push(`${label} byte size does not match.`);
  }
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== evidence.artifact_sha256) {
    errors.push(`${label} SHA-256 does not match.`);
  }
  try {
    return {artifact: parseStrictJson(bytes, label), errors};
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
    return {artifact: null, errors};
  }
}

function closedBetaEvidencePolicy(
  evidenceType,
  semanticContext,
  readinessSpecSha256,
) {
  if (
    ['cross-device-bootstrap-test', 'offline-replay-test', 'canonical-state-test'].includes(
      evidenceType,
    )
  ) {
    return semanticContext.expectedPolicies?.[
      'canonical-bootstrap-and-idempotent-events'
    ];
  }
  if (
    ['fsrs-version-lock', 'scheduler-contract-test', 'clock-boundary-test'].includes(
      evidenceType,
    )
  ) {
    return semanticContext.expectedPolicies?.['server-scheduler'];
  }
  if (RELEASE_OPERATIONAL_EVIDENCE_TYPES.includes(evidenceType)) {
    return {
      id: semanticContext.releaseOperationalPolicy?.policy_id,
      sha256: semanticContext.releasePolicySha256,
    };
  }
  return {
    id: 'cet4-closed-beta-readiness-v1',
    sha256: readinessSpecSha256,
  };
}

function repositoryProofSets(root) {
  const run = args =>
    execFileSync('git', args, {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
  return {
    trackedFiles: new Set(
      run(['ls-files', '-z'])
        .split('\0')
        .filter(Boolean),
    ),
    trustedCommits: new Set(
      run(['rev-list', 'HEAD'])
        .split('\n')
        .filter(Boolean),
    ),
  };
}

function validateReadinessSpec(spec, errors) {
  if (!isRecord(spec)) {
    errors.push('closed-beta readiness spec must be an object.');
    return;
  }
  assertExactKeys(
    spec,
    [
      'version',
      'status',
      'classification',
      'purpose',
      'product_truth',
      'authority_boundary',
      'release_candidate',
      'external_dependencies',
      'gates',
      'state_policy',
    ],
    'closed-beta readiness spec',
    errors,
  );
  assertEqual(spec.version, 'cet4-closed-beta-readiness-v1', 'spec.version', errors);
  assertEqual(spec.status, 'active', 'spec.status', errors);
  assertEqual(
    spec.classification,
    'product_truth_and_implementation_hypothesis',
    'spec.classification',
    errors,
  );
  assertEqual(
    spec.authority_boundary?.state_record,
    'docs/release/cet4-closed-beta-readiness.v1.json',
    'spec state_record',
    errors,
  );
  assertEqual(
    spec.authority_boundary?.validator,
    'scripts/validate_cet4_closed_beta_readiness.mjs',
    'spec validator',
    errors,
  );
  assertEqual(
    spec.state_policy?.formal_evidence_ingestion,
    'registered_types_implemented_unregistered_fail_closed',
    'spec formal_evidence_ingestion',
    errors,
  );
  assertExactArray(
    spec.state_policy?.registered_evidence_types,
    CET4_CLOSED_BETA_SUPPORTED_EVIDENCE_TYPES,
    'spec registered_evidence_types',
    errors,
  );
  assertExactSet(
    Object.keys(spec.external_dependencies ?? {}),
    CET4_CLOSED_BETA_DEPENDENCY_IDS,
    'spec external dependencies',
    errors,
  );
  assertExactSet(
    Object.keys(spec.gates ?? {}),
    Object.keys(CET4_CLOSED_BETA_GATE_DEFINITIONS),
    'spec gates',
    errors,
  );
  for (const [gateId, evidenceTypes] of Object.entries(
    CET4_CLOSED_BETA_GATE_DEFINITIONS,
  )) {
    assertExactArray(
      spec.gates?.[gateId],
      evidenceTypes,
      `spec gate ${gateId}`,
      errors,
    );
  }
}

function validateFormalApproval(value, errors) {
  if (!isRecord(value)) {
    errors.push('formal_approval must be an object.');
    return;
  }
  assertExactKeys(value, Object.keys(FORMAL_APPROVAL_POLICY), 'formal_approval', errors);
  for (const [field, expected] of Object.entries(FORMAL_APPROVAL_POLICY)) {
    assertEqual(value[field], expected, `formal_approval.${field}`, errors);
  }
}

function validateScope(value, truth, errors) {
  if (!isRecord(value)) {
    errors.push('scope must be an object.');
    return;
  }
  assertExactKeys(
    value,
    [
      'track',
      'card_count',
      'box_count',
      'audio_asset_count',
      'release_targets',
      'membership_access',
    ],
    'scope',
    errors,
  );
  assertEqual(value.track, 'cet4', 'scope.track', errors);
  assertEqual(value.card_count, 1180, 'scope.card_count', errors);
  assertEqual(value.box_count, 108, 'scope.box_count', errors);
  assertEqual(value.audio_asset_count, 301, 'scope.audio_asset_count', errors);
  assertExactArray(value.release_targets, ['ios', 'android', 'pc_web'], 'scope.release_targets', errors);
  assertEqual(value.membership_access, 'beta-entitlement.v1', 'scope.membership_access', errors);
  if (isRecord(truth)) {
    assertEqual(value.track, truth.track, 'scope product-truth track', errors);
    assertEqual(value.card_count, truth.card_count, 'scope product-truth card count', errors);
    assertEqual(value.box_count, truth.box_count, 'scope product-truth box count', errors);
    assertEqual(
      value.audio_asset_count,
      truth.audio_asset_count,
      'scope product-truth audio count',
      errors,
    );
    assertExactArray(
      value.release_targets,
      truth.release_targets,
      'scope product-truth release targets',
      errors,
    );
  }
}

function validateGate(
  gate,
  gateId,
  evidenceTypes,
  dependencies,
  now,
  errors,
) {
  if (!isRecord(gate)) return 0;
  assertExactKeys(gate, ['id', 'status', 'evidence', 'blocked_by'], `gate ${gateId}`, errors);
  if (!GATE_STATUS_VALUES.has(gate.status)) errors.push(`gate ${gateId}.status is invalid.`);
  if (!Array.isArray(gate.evidence)) {
    errors.push(`gate ${gateId}.evidence must be an array.`);
    return 0;
  }
  const seenTypes = new Set();
  for (const [index, evidence] of gate.evidence.entries()) {
    validateEvidenceRecord(
      evidence,
      gateId,
      evidenceTypes,
      index,
      now,
      errors,
    );
    if (typeof evidence?.type === 'string') {
      if (seenTypes.has(evidence.type)) {
        errors.push(`gate ${gateId} repeats evidence type ${evidence.type}.`);
      }
      seenTypes.add(evidence.type);
    }
  }
  if (!Array.isArray(gate.blocked_by)) {
    errors.push(`gate ${gateId}.blocked_by must be an array.`);
  } else {
    assertExactSet(
      gate.blocked_by,
      gate.status === 'blocked' ? EXPECTED_BLOCKERS[gateId] : [],
      `gate ${gateId}.blocked_by`,
      errors,
    );
    for (const dependencyId of gate.blocked_by) {
      if (dependencies.get(dependencyId)?.status === 'ready') {
        errors.push(`gate ${gateId} cannot be blocked by ready dependency ${dependencyId}.`);
      }
    }
  }
  if (gate.status === 'passed') {
    assertExactSet(
      [...seenTypes],
      evidenceTypes,
      `gate ${gateId} passed evidence types`,
      errors,
    );
  }
  return gate.evidence.length;
}

function validateEvidenceRecord(
  value,
  gateId,
  evidenceTypes,
  index,
  now,
  errors,
) {
  const label = `gate ${gateId}.evidence[${index}]`;
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  assertExactKeys(
    value,
    [
      'type',
      'artifact_uri',
      'artifact_sha256',
      'artifact_size_bytes',
      'verified_at',
      'verified_by',
      'subject_commit_sha',
    ],
    label,
    errors,
  );
  if (!evidenceTypes.includes(value.type)) errors.push(`${label}.type is not required for ${gateId}.`);
  if (
    typeof value.artifact_uri !== 'string' ||
    !value.artifact_uri.startsWith('repo://docs/release/evidence/') ||
    value.artifact_uri.includes('..') ||
    !value.artifact_uri.endsWith('.json')
  ) {
    errors.push(`${label}.artifact_uri must be a safe repository JSON evidence path.`);
  }
  requireSha256(value.artifact_sha256, `${label}.artifact_sha256`, errors);
  if (
    !Number.isSafeInteger(value.artifact_size_bytes) ||
    value.artifact_size_bytes <= 0 ||
    value.artifact_size_bytes > 1024 * 1024
  ) {
    errors.push(`${label}.artifact_size_bytes must be 1..1048576.`);
  }
  parseTimestamp(value.verified_at, `${label}.verified_at`, now, errors);
  if (!ACTOR_PATTERN.test(value.verified_by ?? '')) {
    errors.push(`${label}.verified_by must identify a github, team, or external verifier.`);
  }
  if (!COMMIT_PATTERN.test(value.subject_commit_sha ?? '')) {
    errors.push(`${label}.subject_commit_sha must be a full lowercase commit SHA.`);
  }
}

function validateReleaseCandidate(value, now, errors) {
  if (value === null) return null;
  if (!isRecord(value)) {
    errors.push('release_candidate must be null or an object.');
    return null;
  }
  assertExactKeys(
    value,
    [
      'schema_version',
      'repository',
      'commit_sha',
      'target_release',
      'recorded_at',
      'recorded_by',
      'environment',
      'release',
      'content',
      'client_builds',
      'entitlement',
    ],
    'release_candidate',
    errors,
  );
  assertEqual(
    value.schema_version,
    'cet4-closed-beta-release-candidate.v1',
    'release_candidate.schema_version',
    errors,
  );
  assertEqual(value.repository, 'LENKIN233/softbook_cet', 'release_candidate.repository', errors);
  if (!COMMIT_PATTERN.test(value.commit_sha ?? '')) errors.push('release_candidate.commit_sha is invalid.');
  assertEqual(value.target_release, 'cet4-closed-beta', 'release_candidate.target_release', errors);
  parseTimestamp(value.recorded_at, 'release_candidate.recorded_at', now, errors);
  assertEqual(value.recorded_by, 'github:LENKIN233', 'release_candidate.recorded_by', errors);
  validateCandidateEnvironment(value.environment, errors);
  validateCandidateRelease(value.release, errors);
  validateCandidateContent(value.content, errors);
  validateCandidateBuilds(value.client_builds, errors);
  validateCandidateEntitlement(value.entitlement, errors);
  return value;
}

function validateCandidateEnvironment(value, errors) {
  if (!isRecord(value)) {
    errors.push('release_candidate.environment must be an object.');
    return;
  }
  assertExactKeys(
    value,
    ['profile_id', 'profile_sha256', 'environment_id', 'class', 'receiver_owned'],
    'release_candidate.environment',
    errors,
  );
  requireId(value.profile_id, 'release_candidate.environment.profile_id', errors);
  requireSha256(value.profile_sha256, 'release_candidate.environment.profile_sha256', errors);
  requireId(value.environment_id, 'release_candidate.environment.environment_id', errors);
  if (FORBIDDEN_ENVIRONMENT_PATTERN.test(value.environment_id ?? '')) {
    errors.push('release_candidate.environment.environment_id must not be local or development.');
  }
  assertEqual(value.class, 'production_like_staging', 'release_candidate.environment.class', errors);
  assertEqual(value.receiver_owned, true, 'release_candidate.environment.receiver_owned', errors);
}

function validateCandidateRelease(value, errors) {
  if (!isRecord(value)) {
    errors.push('release_candidate.release must be an object.');
    return;
  }
  assertExactKeys(
    value,
    [
      'release_id',
      'parent_release_id',
      'content_version',
      'bundle_sha256',
      'backend_deployment_id',
    ],
    'release_candidate.release',
    errors,
  );
  requireId(value.release_id, 'release_candidate.release.release_id', errors);
  requireId(value.parent_release_id, 'release_candidate.release.parent_release_id', errors);
  if (value.release_id === value.parent_release_id) {
    errors.push('release_candidate.release parent must differ from release_id.');
  }
  if (!CONTENT_VERSION_PATTERN.test(value.content_version ?? '')) {
    errors.push('release_candidate.release.content_version is invalid.');
  }
  requireSha256(value.bundle_sha256, 'release_candidate.release.bundle_sha256', errors);
  if (
    typeof value.backend_deployment_id !== 'string' ||
    !/^backend-deployment:sha256:[0-9a-f]{64}$/.test(
      value.backend_deployment_id,
    )
  ) {
    errors.push('release_candidate.release.backend_deployment_id is invalid.');
  }
}

function validateCandidateContent(value, errors) {
  if (!isRecord(value)) {
    errors.push('release_candidate.content must be an object.');
    return;
  }
  assertExactKeys(
    value,
    [
      'track',
      'card_count',
      'box_count',
      'audio_asset_count',
      'full_track_approval_sha256',
      'audio_qc_index_sha256',
    ],
    'release_candidate.content',
    errors,
  );
  assertEqual(value.track, 'cet4', 'release_candidate.content.track', errors);
  assertEqual(value.card_count, 1180, 'release_candidate.content.card_count', errors);
  assertEqual(value.box_count, 108, 'release_candidate.content.box_count', errors);
  assertEqual(value.audio_asset_count, 301, 'release_candidate.content.audio_asset_count', errors);
  requireSha256(
    value.full_track_approval_sha256,
    'release_candidate.content.full_track_approval_sha256',
    errors,
  );
  requireSha256(
    value.audio_qc_index_sha256,
    'release_candidate.content.audio_qc_index_sha256',
    errors,
  );
}

function validateCandidateBuilds(value, errors) {
  if (!isRecord(value)) {
    errors.push('release_candidate.client_builds must be an object.');
    return;
  }
  assertExactKeys(value, ['ios', 'android', 'pc_web'], 'release_candidate.client_builds', errors);
  for (const platform of ['ios', 'android', 'pc_web']) {
    requireId(value[platform], `release_candidate.client_builds.${platform}`, errors);
  }
}

function validateCandidateEntitlement(value, errors) {
  if (!isRecord(value)) {
    errors.push('release_candidate.entitlement must be an object.');
    return;
  }
  assertExactKeys(value, ['mode', 'campaign_id'], 'release_candidate.entitlement', errors);
  assertEqual(value.mode, 'beta-entitlement.v1', 'release_candidate.entitlement.mode', errors);
  requireId(value.campaign_id, 'release_candidate.entitlement.campaign_id', errors);
}

function validateLaunchNonReplacement(value, launchContract, errors) {
  if (!isRecord(value)) {
    errors.push('launch_non_replacement must be an object.');
    return;
  }
  assertExactKeys(
    value,
    [
      'launch_readiness_path',
      'launch_status_unchanged',
      'closed_beta_ready_does_not_imply_public_launch_ready',
    ],
    'launch_non_replacement',
    errors,
  );
  assertEqual(
    value.launch_readiness_path,
    'docs/release/launch-readiness.v1.json',
    'launch_non_replacement.launch_readiness_path',
    errors,
  );
  assertEqual(
    value.launch_status_unchanged,
    'not_ready',
    'launch_non_replacement.launch_status_unchanged',
    errors,
  );
  assertEqual(
    value.closed_beta_ready_does_not_imply_public_launch_ready,
    true,
    'launch_non_replacement.closed_beta_ready_does_not_imply_public_launch_ready',
    errors,
  );
  if (launchContract !== null) {
    if (!isRecord(launchContract)) {
      errors.push('public launch contract must be an object.');
    } else {
      assertEqual(
        launchContract.schema_version,
        'launch-readiness.v1',
        'public launch schema_version',
        errors,
      );
      assertEqual(
        launchContract.status,
        value.launch_status_unchanged,
        'public launch status non-replacement binding',
        errors,
      );
    }
  }
}

function mapById(value, label, errors) {
  const map = new Map();
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array.`);
    return map;
  }
  for (const [index, item] of value.entries()) {
    if (!isRecord(item) || typeof item.id !== 'string') {
      errors.push(`${label}[${index}] must be an object with an id.`);
      continue;
    }
    if (map.has(item.id)) errors.push(`${label} contains duplicate id ${item.id}.`);
    map.set(item.id, item);
  }
  return map;
}

function assertExactKeys(value, expected, label, errors) {
  if (!isRecord(value)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  ) {
    errors.push(`${label} keys must be exactly: ${wanted.join(', ')}.`);
  }
}

function assertExactSet(value, expected, label, errors) {
  if (!Array.isArray(value)) {
    errors.push(`${label} must be an array.`);
    return;
  }
  const actual = [...value].sort();
  const wanted = [...expected].sort();
  if (
    new Set(value).size !== value.length ||
    actual.length !== wanted.length ||
    actual.some((item, index) => item !== wanted[index])
  ) {
    errors.push(`${label} must contain exactly: ${wanted.join(', ')}.`);
  }
}

function assertExactArray(value, expected, label, errors) {
  if (
    !Array.isArray(value) ||
    value.length !== expected.length ||
    value.some((item, index) => item !== expected[index])
  ) {
    errors.push(`${label} must equal ${JSON.stringify(expected)}.`);
  }
}

function assertEqual(actual, expected, label, errors) {
  if (actual !== expected) errors.push(`${label} must be ${JSON.stringify(expected)}.`);
}

function requireId(value, label, errors) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    errors.push(`${label} has an invalid value.`);
  }
}

function requireSha256(value, label, errors) {
  if (
    typeof value !== 'string' ||
    !SHA256_PATTERN.test(value) ||
    /^([0-9a-f])\1{63}$/.test(value)
  ) {
    errors.push(`${label} must be a non-placeholder SHA-256.`);
  }
}

function requireNonEmptyString(value, label, errors) {
  if (typeof value !== 'string' || value.trim() !== value || value.length === 0) {
    errors.push(`${label} must be a non-empty trimmed string.`);
  }
}

function parseTimestamp(value, label, now, errors) {
  if (typeof value !== 'string') {
    errors.push(`${label} must be a canonical ISO timestamp.`);
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    errors.push(`${label} must be a canonical ISO timestamp.`);
    return null;
  }
  if (now instanceof Date && parsed > now) errors.push(`${label} must not be in the future.`);
  return parsed;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function parseArguments(argv) {
  const options = {
    contractPath: DEFAULT_CONTRACT,
    format: 'text',
    launchContractPath: DEFAULT_LAUNCH_CONTRACT,
    requireReady: false,
    specPath: DEFAULT_SPEC,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--contract') options.contractPath = argv[++index];
    else if (argument === '--spec') options.specPath = argv[++index];
    else if (argument === '--launch-contract') {
      options.launchContractPath = argv[++index];
    } else if (argument === '--format') options.format = argv[++index];
    else if (argument === '--require-ready') options.requireReady = true;
    else if (argument === '--help' || argument === '-h') return {help: true};
    else throw new Error(`unknown argument ${argument}`);
  }
  if (!['text', 'json'].includes(options.format)) {
    throw new Error('--format must be text or json');
  }
  return options;
}

function readStrictJson(file, label) {
  return parseStrictJson(fs.readFileSync(path.resolve(file)), label);
}

function printUsage() {
  console.log(`Usage:
  node scripts/validate_cet4_closed_beta_readiness.mjs [--contract <path>] [--spec <path>] [--launch-contract <path>] [--format text|json] [--require-ready]

The tracked baseline is expected to validate but remain not_ready. --require-ready fails until formal evidence ingestion, one exact candidate, every dependency and every gate are complete.`);
}

function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      printUsage();
      return;
    }
    const contract = readStrictJson(
      options.contractPath,
      'CET4 closed-beta readiness contract',
    );
    const spec = readStrictJson(
      options.specPath,
      'CET4 closed-beta readiness spec',
    );
    const proofSets = repositoryProofSets(ROOT);
    const repositoryResult = verifyCet4ClosedBetaRepositoryEvidence(
      contract,
      {
        ...proofSets,
        root: ROOT,
      },
    );
    const result = validateCet4ClosedBetaReadiness(contract, spec, {
      launchContract: readStrictJson(
        options.launchContractPath,
        'public launch readiness contract',
      ),
      repositoryEvidenceValidated: repositoryResult.ok,
    });
    result.errors.push(...repositoryResult.errors);
    result.ok = result.errors.length === 0;
    result.ready = result.ready && result.ok;
    if (options.format === 'json') console.log(JSON.stringify(result, null, 2));
    else {
      console.log(
        `[cet4-closed-beta-readiness] ${result.ok ? 'valid' : 'invalid'}; ready=${result.ready}; gates=${result.summary?.gates_passed ?? 0}/${result.summary?.total_gates ?? 0}; dependencies=${result.summary?.dependencies_ready ?? 0}/${result.summary?.total_dependencies ?? 0}`,
      );
      for (const error of result.errors) console.error(`- ${error}`);
    }
    if (!result.ok || (options.requireReady && !result.ready)) process.exitCode = 1;
  } catch (error) {
    console.error(
      `[cet4-closed-beta-readiness] ${error instanceof Error ? error.message : 'unknown failure'}`,
    );
    process.exitCode = 1;
  }
}

const isDirectExecution =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) main();
