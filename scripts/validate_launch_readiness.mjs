#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {validateSmsProviderSmokeReport} from '../infra/cloudbase/smoke-sms-provider.mjs';
import {
  validateGateEvidenceArtifact,
  validateGateEvidenceCoherence,
  validateReleaseOperationalPolicy,
} from './lib/launch_evidence_contract.mjs';
import {parseStrictJson} from './lib/strict_json.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_LAUNCH_CONTRACT = path.join(
  ROOT,
  'docs',
  'release',
  'launch-readiness.v1.json',
);
const DEFAULT_ACCOUNT_CONTRACT = path.join(
  ROOT,
  'docs',
  'release',
  'external-account-readiness.v1.json',
);

const LAUNCH_STATUSES = new Set(['not_ready', 'ready']);
const GATE_STATUSES = new Set(['pending', 'in_progress', 'blocked', 'passed']);
const ACCOUNT_STATUSES = new Set(['unverified', 'blocked', 'ready']);
const CAPABILITY_STATUSES = new Set(['unverified', 'blocked', 'ready']);
const EVIDENCE_TYPES = new Set(['capability-verification', 'blocking-record']);
const REPOSITORY_EVIDENCE_PREFIXES = [
  'docs/agent-runs/evidence/',
  'docs/release/evidence/',
  'security/reports/',
];
const PRODUCT_OWNER_VERIFIER = 'github:LENKIN233';
const EVIDENCE_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000;
const MAX_REPOSITORY_EVIDENCE_BYTES = 1024 * 1024;
const MAX_REPOSITORY_RAW_EVIDENCE_BYTES = 16 * 1024 * 1024;
const COMMIT_SHA_PATTERN = /^[0-9a-f]{40}$/;
const SUBJECT_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const CONTENT_VERSION_PATTERN = /^sha256:[0-9a-f]{64}$/;
const FORBIDDEN_ENVIRONMENT_PATTERN =
  /(^|[-_.:])(local|mock|simulation|simulator|personal|development|dev)([-_.:]|$)/i;
const FORMAL_APPROVAL_POLICY = Object.freeze({
  provider: 'github_environment',
  environment: 'formal-product-owner-approval',
  required_reviewer: 'github:LENKIN233',
  administrators_can_bypass: false,
  workflow: '.github/workflows/formal-approval.yml',
  required_check: 'formal-approval',
});

export const GATE_DEFINITIONS = Object.freeze({
  'production-environments': {
    phase: 'platform',
    evidenceTypes: [
      'dev-environment-isolation',
      'staging-deployment',
      'production-deployment',
      'secret-access-audit',
      'release-permission-audit',
    ],
  },
  'production-auth-and-account-deletion': {
    phase: 'platform',
    evidenceTypes: [
      'sms-provider-smoke',
      'auth-abuse-test',
      'session-revocation-test',
      'account-deletion-drill',
    ],
  },
  'canonical-bootstrap-and-idempotent-events': {
    phase: 'product',
    evidenceTypes: [
      'cross-device-bootstrap-test',
      'offline-replay-test',
      'canonical-state-test',
    ],
  },
  'server-scheduler': {
    phase: 'product',
    evidenceTypes: [
      'fsrs-version-lock',
      'scheduler-contract-test',
      'clock-boundary-test',
    ],
  },
  'audio-runtime': {
    phase: 'product',
    evidenceTypes: [
      'cross-platform-audio-test',
      'audio-cache-integrity-test',
      'audio-qc-coverage-report',
    ],
  },
  'three-surface-parity': {
    phase: 'product',
    evidenceTypes: [
      'ios-parity-report',
      'android-parity-report',
      'pc-web-parity-report',
      'device-matrix-report',
    ],
  },
  'store-and-web-payments': {
    phase: 'commerce',
    evidenceTypes: [
      'storekit-sandbox-report',
      'wechat-sandbox-report',
      'alipay-sandbox-report',
      'webhook-idempotency-report',
      'cross-channel-entitlement-report',
    ],
  },
  'approved-production-content': {
    phase: 'content',
    evidenceTypes: [
      'approved-box-coverage-report',
      'approved-card-coverage-report',
      'audio-qc-coverage-report',
      'content-pack-integrity-report',
    ],
  },
  'compliance-and-distribution': {
    phase: 'release',
    evidenceTypes: [
      'apple-review-approval',
      'app-filing-approval',
      'icp-filing-approval',
      'android-channel-approval-report',
      'privacy-legal-review',
    ],
  },
  'release-slo-and-recovery-drill': {
    phase: 'release',
    evidenceTypes: [
      'load-test-report',
      'availability-observation',
      'backup-restore-drill',
      'penetration-test-report',
      'rollback-drill',
    ],
  },
});

export const EXTERNAL_ACCOUNT_DEFINITIONS = Object.freeze({
  'apple-developer': [
    'app-store-connect',
    'storekit-subscriptions',
    'app-store-server-notifications',
    'distribution-signing',
  ],
  'android-distribution': [
    'huawei',
    'xiaomi',
    'oppo',
    'vivo',
    'tencent-myapp',
    'release-signing',
  ],
  'tencent-cloud-production': [
    'cloudbase-run',
    'tencentdb-postgresql',
    'cos-private-bucket',
    'sms',
    'cls',
    'rum',
  ],
  payments: ['wechat-pay', 'alipay', 'webhook-domain'],
  'china-compliance': [
    'domain-registration',
    'icp-filing',
    'app-filing',
    'privacy-policy-public-url',
    'customer-support-contact',
  ],
});

const REQUIRED_SUBSCRIPTION_PRODUCTS = [
  'com.softbook.cet.premium.monthly',
  'com.softbook.cet.premium.yearly',
];
const KNOWN_BLOCKERS = new Set([
  ...Object.keys(EXTERNAL_ACCOUNT_DEFINITIONS),
  '218-box-user-approval',
]);

export function validateLaunchReadiness(contract, { now = new Date() } = {}) {
  const errors = [];
  if (!isRecord(contract)) {
    return invalidResult('launch contract must be an object.');
  }

  assertAllowedKeys(
    contract,
    [
      'schema_version',
      'target_release',
      'status',
      'current_milestone',
      'quality_policy',
      'formal_approval',
      'release_candidate',
      'product_scope',
      'external_dependencies',
      'gates',
    ],
    'launch contract',
    errors,
  );
  assertEqual(
    contract.schema_version,
    'launch-readiness.v1',
    'schema_version',
    errors,
  );
  assertEqual(contract.target_release, '2027-Q2', 'target_release', errors);
  assertEqual(
    contract.quality_policy,
    'move_release_date_before_reducing_gate',
    'quality_policy',
    errors,
  );
  if (!isNonEmptyString(contract.current_milestone)) {
    errors.push('current_milestone must be a non-empty string.');
  }
  if (!LAUNCH_STATUSES.has(contract.status)) {
    errors.push('status must be not_ready or ready.');
  }

  validateFormalApprovalPolicy(contract.formal_approval, errors);
  validateLaunchReleaseCandidate(contract.release_candidate, now, errors);

  validateProductScope(contract.product_scope, errors);

  const dependencies = mapRecordsById(
    contract.external_dependencies,
    'external_dependencies',
    errors,
  );
  assertExactSet(
    [...dependencies.keys()],
    Object.keys(EXTERNAL_ACCOUNT_DEFINITIONS),
    'external dependency ids',
    errors,
  );
  for (const [id, dependency] of dependencies) {
    assertAllowedKeys(
      dependency,
      ['id', 'owner', 'status'],
      `external dependency ${id}`,
      errors,
    );
    assertEqual(
      dependency.owner,
      'product_owner',
      `external dependency ${id} owner`,
      errors,
    );
    if (!ACCOUNT_STATUSES.has(dependency.status)) {
      errors.push(`external dependency ${id} has an invalid status.`);
    }
  }

  const gates = mapRecordsById(contract.gates, 'gates', errors);
  assertExactSet(
    [...gates.keys()],
    Object.keys(GATE_DEFINITIONS),
    'gate ids',
    errors,
  );
  for (const [id, definition] of Object.entries(GATE_DEFINITIONS)) {
    const gate = gates.get(id);
    if (!gate) {
      continue;
    }
    validateGate(gate, definition, now, errors);
  }
  const hasGateEvidence = [...gates.values()].some(
    gate => Array.isArray(gate.evidence) && gate.evidence.length > 0,
  );
  if (hasGateEvidence && !isRecord(contract.release_candidate)) {
    errors.push(
      'release_candidate is required before recording formal gate evidence.',
    );
  }
  validateDistinctEvidenceArtifacts(collectEvidence(contract, null), errors);

  const stateReady =
    isRecord(contract.release_candidate) &&
    gates.size === Object.keys(GATE_DEFINITIONS).length &&
    [...gates.values()].every(gate => gate.status === 'passed') &&
    dependencies.size === Object.keys(EXTERNAL_ACCOUNT_DEFINITIONS).length &&
    [...dependencies.values()].every(
      dependency => dependency.status === 'ready',
    );
  const expectedStatus = stateReady ? 'ready' : 'not_ready';
  if (contract.status !== expectedStatus) {
    errors.push(
      `status must be ${expectedStatus} for the recorded gate states.`,
    );
  }

  const ok = errors.length === 0;
  return {
    errors,
    ok,
    ready: ok && stateReady,
    summary: Object.fromEntries(
      [...GATE_STATUSES].map(status => [
        status,
        [...gates.values()].filter(gate => gate.status === status).length,
      ]),
    ),
  };
}

export function validateExternalAccountReadiness(
  accountsContract,
  launchContract,
  { now = new Date() } = {},
) {
  const errors = [];
  if (!isRecord(accountsContract)) {
    return invalidResult('external account contract must be an object.');
  }

  assertAllowedKeys(
    accountsContract,
    [
      'schema_version',
      'product_owner',
      'last_verified_at',
      'overall_status',
      'accounts',
    ],
    'external account contract',
    errors,
  );
  assertEqual(
    accountsContract.schema_version,
    'external-account-readiness.v1',
    'external account schema_version',
    errors,
  );
  assertEqual(
    accountsContract.product_owner,
    PRODUCT_OWNER_VERIFIER,
    'external account product_owner',
    errors,
  );

  const launchDependencies = mapRecordsById(
    launchContract?.external_dependencies,
    'launch external_dependencies',
    errors,
  );
  const accounts = mapRecordsById(
    accountsContract.accounts,
    'accounts',
    errors,
  );
  assertExactSet(
    [...accounts.keys()],
    Object.keys(EXTERNAL_ACCOUNT_DEFINITIONS),
    'external account ids',
    errors,
  );

  for (const [id, expectedCapabilities] of Object.entries(
    EXTERNAL_ACCOUNT_DEFINITIONS,
  )) {
    const account = accounts.get(id);
    if (!account) {
      continue;
    }
    validateExternalAccount(
      account,
      expectedCapabilities,
      accountsContract.product_owner,
      now,
      errors,
    );
    const launchDependency = launchDependencies.get(id);
    if (!launchDependency) {
      errors.push(`launch contract is missing external dependency ${id}.`);
    } else if (launchDependency.status !== account.status) {
      errors.push(
        `external account ${id} status must match the launch contract dependency.`,
      );
    }
  }
  validateDistinctEvidenceArtifacts(
    collectEvidence(null, accountsContract),
    errors,
  );

  const stateReady =
    accounts.size === Object.keys(EXTERNAL_ACCOUNT_DEFINITIONS).length &&
    [...accounts.values()].every(account => account.status === 'ready');
  const blocked = [...accounts.values()].some(
    account => account.status === 'blocked',
  );
  const expectedOverallStatus = stateReady
    ? 'ready'
    : blocked
    ? 'blocked'
    : 'unverified';
  if (accountsContract.overall_status !== expectedOverallStatus) {
    errors.push(`overall_status must be ${expectedOverallStatus}.`);
  }

  if (stateReady) {
    const verifiedAt = parseIsoTimestamp(
      accountsContract.last_verified_at,
      'last_verified_at',
      now,
      errors,
    );
    const latestEvidenceTime = latestEvidenceTimestamp(
      accountsContract.accounts,
    );
    if (
      verifiedAt &&
      latestEvidenceTime &&
      verifiedAt.getTime() < latestEvidenceTime.getTime()
    ) {
      errors.push('last_verified_at must not predate capability evidence.');
    }
  } else if (accountsContract.last_verified_at !== null) {
    errors.push('last_verified_at must be null until every account is ready.');
  }

  const ok = errors.length === 0;
  return { errors, ok, ready: ok && stateReady };
}

export function verifyRepositoryEvidenceFiles(
  launchContract,
  accountsContract,
  {
    root = ROOT,
    semanticContext = null,
    trackedFiles = null,
    trustedCommits = null,
    now = new Date(),
  } = {},
) {
  const errors = [];
  if (!(trackedFiles instanceof Set) || !(trustedCommits instanceof Set)) {
    const trustErrors = [];
    if (!(trackedFiles instanceof Set)) {
      trustErrors.push(
        'repository evidence verification requires an explicit trusted tracked-file set.',
      );
    }
    if (!(trustedCommits instanceof Set)) {
      trustErrors.push(
        'repository evidence verification requires an explicit trusted reachable-commit set.',
      );
    }
    return {
      errors: trustErrors,
      ok: false,
    };
  }
  const loadedContext =
    semanticContext ?? loadLaunchEvidenceSemanticContext({root});
  if (!loadedContext?.ok) {
    errors.push(
      ...(loadedContext?.errors ?? [
        'launch evidence semantic context is unavailable.',
      ]),
    );
  }
  const evidenceRecords = collectEvidence(launchContract, accountsContract);
  validateDistinctEvidenceArtifacts(evidenceRecords, errors);
  const gateEvidenceRecords = evidenceRecords.filter(
    record => record.scope === 'gate',
  );
  const expectedReleaseCandidate = isRecord(launchContract?.release_candidate)
    ? launchContract.release_candidate
    : null;
  if (gateEvidenceRecords.length > 0 && !expectedReleaseCandidate) {
    errors.push(
      'formal gate evidence requires one launch-level release_candidate cohort.',
    );
  }
  if (
    expectedReleaseCandidate &&
    !trustedCommits.has(expectedReleaseCandidate.commit_sha)
  ) {
    errors.push(
      'release_candidate commit must be reachable from the validated repository HEAD.',
    );
  }
  const parsedGateEvidence = new Map();
  for (const record of evidenceRecords) {
    const {evidence, label} = record;
    if (!isRecord(evidence) || !evidence.artifact_uri?.startsWith('repo://')) {
      continue;
    }
    const relativePath = evidence.artifact_uri.slice('repo://'.length);
    if (!trackedFiles.has(relativePath)) {
      errors.push(`${label} repository evidence must be tracked by Git.`);
      continue;
    }
    const resolvedPath = path.resolve(root, relativePath);
    const rootPrefix = `${path.resolve(root)}${path.sep}`;
    if (!resolvedPath.startsWith(rootPrefix)) {
      errors.push(`${label} repository evidence escapes the repository root.`);
      continue;
    }
    if (!fs.existsSync(resolvedPath)) {
      errors.push(`${label} repository evidence file does not exist.`);
      continue;
    }
    const stats = fs.lstatSync(resolvedPath);
    if (!stats.isFile()) {
      errors.push(`${label} repository evidence must be a regular file.`);
      continue;
    }
    if (stats.size > MAX_REPOSITORY_EVIDENCE_BYTES) {
      errors.push(`${label} repository evidence exceeds the 1 MiB limit.`);
      continue;
    }
    if (stats.size !== evidence.artifact_size_bytes) {
      errors.push(`${label} repository evidence byte size does not match.`);
    }
    const artifactBytes = fs.readFileSync(resolvedPath);
    const actualSha256 = createHash('sha256').update(artifactBytes).digest('hex');
    if (actualSha256 !== evidence.artifact_sha256) {
      errors.push(`${label} repository evidence SHA-256 does not match.`);
    }
    const requiresSemanticJson =
      record.scope === 'gate' ||
      (record.scope === 'external_capability' &&
        evidence.type === 'capability-verification');
    if (!requiresSemanticJson) {
      continue;
    }
    if (!relativePath.endsWith('.json')) {
      errors.push(`${label} semantic evidence must be a JSON file.`);
      continue;
    }
    let artifact;
    try {
      artifact = parseStrictJson(artifactBytes, label);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
      continue;
    }
    for (const [index, rawArtifact] of asArray(
      artifact?.raw_artifacts,
    ).entries()) {
      if (!rawArtifact?.artifact_uri?.startsWith('repo://')) {
        continue;
      }
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
    if (record.scope === 'external_capability') {
      const subjectCommit = artifact?.subject?.commit_sha;
      if (
        typeof subjectCommit !== 'string' ||
        !trustedCommits.has(subjectCommit)
      ) {
        errors.push(
          `${label} subject commit must be reachable from the validated repository HEAD.`,
        );
      }
      const result = validateExternalCapabilityEvidenceArtifact(artifact, {
        accountId: record.accountId,
        capabilityId: record.capabilityId,
        expectedPolicy: {
          ...loadedContext?.releaseOperationalPolicy?.external_capability,
          policy_id: loadedContext?.releaseOperationalPolicy?.policy_id,
          policy_sha256: loadedContext?.releasePolicySha256,
          evidence_validity_days:
            loadedContext?.releaseOperationalPolicy?.evidence_validity_days,
        },
        now,
        outerEvidence: evidence,
        targetRelease: launchContract?.target_release,
      });
      errors.push(...result.errors);
      continue;
    }
    const subjectCommit = artifact?.subject?.commit_sha;
    if (
      typeof subjectCommit !== 'string' ||
      !trustedCommits.has(subjectCommit)
    ) {
      errors.push(
        `${label} subject commit must be reachable from the validated repository HEAD.`,
      );
    }
    const expectedPolicy = loadedContext?.expectedPolicies?.[record.gateId];
    const result = validateGateEvidenceArtifact(artifact, {
      evidenceType: record.evidenceType,
      expectedPolicy,
      expectedSubject: expectedReleaseCandidate,
      gateId: record.gateId,
      outerEvidence: evidence,
      releaseOperationalPolicy: loadedContext?.releaseOperationalPolicy,
    });
    errors.push(...result.errors);
    if (result.ok) {
      const reports = parsedGateEvidence.get(record.gateId) ?? [];
      reports.push(artifact);
      parsedGateEvidence.set(record.gateId, reports);
    }
  }
  for (const gate of asArray(launchContract?.gates)) {
    const reports = parsedGateEvidence.get(gate?.id) ?? [];
    if (reports.length <= 1) continue;
    const coherence = validateGateEvidenceCoherence(reports, {
      gateId: gate.id,
      requiredEvidenceTypes:
        gate.status === 'passed'
          ? GATE_DEFINITIONS[gate.id]?.evidenceTypes ?? []
          : reports.map(report => report.subject?.evidence_type),
    });
    errors.push(...coherence.errors);
  }
  return { errors, ok: errors.length === 0 };
}

function verifyInnerRepositoryArtifact(
  artifact,
  {label, root, trackedFiles},
  errors,
) {
  const relativePath = artifact.artifact_uri.slice('repo://'.length);
  if (!trackedFiles.has(relativePath)) {
    errors.push(`${label} repository artifact must be tracked by Git.`);
    return;
  }
  const resolvedPath = path.resolve(root, relativePath);
  const rootPrefix = `${path.resolve(root)}${path.sep}`;
  if (!resolvedPath.startsWith(rootPrefix)) {
    errors.push(`${label} repository artifact escapes the repository root.`);
    return;
  }
  if (!fs.existsSync(resolvedPath)) {
    errors.push(`${label} repository artifact file does not exist.`);
    return;
  }
  const stats = fs.lstatSync(resolvedPath);
  if (!stats.isFile()) {
    errors.push(`${label} repository artifact must be a regular file.`);
    return;
  }
  if (stats.size > MAX_REPOSITORY_RAW_EVIDENCE_BYTES) {
    errors.push(`${label} repository artifact exceeds the 16 MiB limit.`);
    return;
  }
  if (stats.size !== artifact.size_bytes) {
    errors.push(`${label} repository artifact byte size does not match.`);
  }
  const actualSha256 = createHash('sha256')
    .update(fs.readFileSync(resolvedPath))
    .digest('hex');
  if (actualSha256 !== artifact.sha256) {
    errors.push(`${label} repository artifact SHA-256 does not match.`);
  }
}

export function validateExternalCapabilityEvidenceArtifact(
  artifact,
  {
    accountId,
    capabilityId,
    expectedPolicy,
    now = new Date(),
    outerEvidence,
    targetRelease,
  } = {},
) {
  const errors = [];
  const label = `external capability ${String(accountId)}/${String(
    capabilityId,
  )}`;
  if (!isRecord(artifact)) {
    return {errors: [`${label} artifact must be a JSON object.`], ok: false};
  }
  assertAllowedKeys(
    artifact,
    [
      'schema_version',
      'capability_eligible',
      'gate_eligible',
      'result',
      'subject',
      'observation',
      'verification',
      'checks',
      'raw_artifacts',
    ],
    `${label} artifact`,
    errors,
  );
  assertEqual(
    artifact.schema_version,
    'external-capability-evidence.v1',
    `${label} schema_version`,
    errors,
  );
  assertEqual(
    artifact.capability_eligible,
    true,
    `${label} capability_eligible`,
    errors,
  );
  assertEqual(
    artifact.gate_eligible,
    false,
    `${label} gate_eligible`,
    errors,
  );
  assertEqual(artifact.result, 'verified', `${label} result`, errors);

  const subject = artifact.subject;
  if (!isRecord(subject)) {
    errors.push(`${label} subject must be an object.`);
  } else {
    assertAllowedKeys(
      subject,
      [
        'repository',
        'commit_sha',
        'target_release',
        'account_id',
        'capability_id',
        'policy',
      ],
      `${label} subject`,
      errors,
    );
    assertEqual(
      subject.repository,
      'LENKIN233/softbook_cet',
      `${label} subject.repository`,
      errors,
    );
    assertEqual(
      subject.commit_sha,
      outerEvidence?.subject_commit_sha,
      `${label} subject.commit_sha`,
      errors,
    );
    assertEqual(
      subject.target_release,
      targetRelease,
      `${label} subject.target_release`,
      errors,
    );
    assertEqual(
      subject.account_id,
      accountId,
      `${label} subject.account_id`,
      errors,
    );
    assertEqual(
      subject.capability_id,
      capabilityId,
      `${label} subject.capability_id`,
      errors,
    );
    if (!isRecord(subject.policy)) {
      errors.push(`${label} subject.policy must be an object.`);
    } else {
      assertAllowedKeys(
        subject.policy,
        ['id', 'sha256'],
        `${label} subject.policy`,
        errors,
      );
      assertEqual(
        subject.policy.id,
        expectedPolicy?.policy_id,
        `${label} subject.policy.id`,
        errors,
      );
      assertEqual(
        subject.policy.sha256,
        expectedPolicy?.policy_sha256,
        `${label} subject.policy.sha256`,
        errors,
      );
    }
  }

  const observation = artifact.observation;
  if (!isRecord(observation)) {
    errors.push(`${label} observation must be an object.`);
  } else {
    assertAllowedKeys(
      observation,
      [
        'provider_id',
        'provider_subject_sha256',
        'mode',
        'observed_at',
        'valid_until',
      ],
      `${label} observation`,
      errors,
    );
    assertEqual(
      observation.provider_id,
      accountId,
      `${label} observation.provider_id`,
      errors,
    );
    validateSha256(
      observation.provider_subject_sha256,
      `${label} observation.provider_subject_sha256`,
      errors,
    );
    if (
      !Array.isArray(expectedPolicy?.allowed_observation_modes) ||
      !expectedPolicy.allowed_observation_modes.includes(observation.mode)
    ) {
      errors.push(`${label} observation.mode is not allowed by policy.`);
    }
    const observedAt = parseIsoTimestamp(
      observation.observed_at,
      `${label} observation.observed_at`,
      now,
      errors,
    );
    const verifiedAt =
      typeof outerEvidence?.verified_at === 'string'
        ? new Date(outerEvidence.verified_at)
        : null;
    if (
      observedAt &&
      verifiedAt &&
      !Number.isNaN(verifiedAt.getTime()) &&
      observedAt.getTime() > verifiedAt.getTime()
    ) {
      errors.push(
        `${label} observation.observed_at must not be later than verification.`,
      );
    }
    if (
      observedAt &&
      Number.isInteger(expectedPolicy?.evidence_validity_days) &&
      observedAt.getTime() <
        now.getTime() -
          expectedPolicy.evidence_validity_days * 24 * 60 * 60 * 1000
    ) {
      errors.push(
        `${label} observation exceeds the active evidence validity window.`,
      );
    }
    if (observation.valid_until !== null) {
      const validUntil = parseIsoTimestamp(
        observation.valid_until,
        `${label} observation.valid_until`,
        new Date(
          now.getTime() +
            (expectedPolicy?.evidence_validity_days ?? 180) *
              24 *
              60 *
              60 *
              1000,
        ),
        errors,
      );
      if (validUntil && validUntil.getTime() <= now.getTime()) {
        errors.push(`${label} observation.valid_until must be in the future.`);
      }
      if (
        validUntil &&
        verifiedAt &&
        !Number.isNaN(verifiedAt.getTime()) &&
        validUntil.getTime() < verifiedAt.getTime()
      ) {
        errors.push(
          `${label} observation.valid_until must not predate verification.`,
        );
      }
    }
  }

  const verification = artifact.verification;
  if (!isRecord(verification)) {
    errors.push(`${label} verification must be an object.`);
  } else {
    assertAllowedKeys(
      verification,
      ['verified_at', 'verified_by'],
      `${label} verification`,
      errors,
    );
    assertEqual(
      verification.verified_at,
      outerEvidence?.verified_at,
      `${label} verification.verified_at`,
      errors,
    );
    assertEqual(
      verification.verified_by,
      outerEvidence?.verified_by,
      `${label} verification.verified_by`,
      errors,
    );
    assertEqual(
      verification.verified_by,
      expectedPolicy?.product_owner,
      `${label} verification product_owner`,
      errors,
    );
  }

  const capabilityChecks =
    expectedPolicy?.required_checks?.[accountId]?.[capabilityId];
  const commonChecks = expectedPolicy?.common_required_checks;
  const requiredChecks =
    Array.isArray(commonChecks) && Array.isArray(capabilityChecks)
      ? [...commonChecks, ...capabilityChecks]
      : null;
  if (!Array.isArray(requiredChecks) || requiredChecks.length === 0) {
    errors.push(`${label} has no trusted required-check policy.`);
  }
  const checks = mapRecordsById(
    artifact.checks,
    `${label} checks`,
    errors,
  );
  if (Array.isArray(requiredChecks)) {
    assertExactSet(
      [...checks.keys()],
      requiredChecks,
      `${label} check ids`,
      errors,
    );
  }
  for (const [checkId, check] of checks) {
    assertAllowedKeys(
      check,
      ['id', 'result', 'artifact_roles'],
      `${label} check ${checkId}`,
      errors,
    );
    assertEqual(
      check.result,
      'passed',
      `${label} check ${checkId} result`,
      errors,
    );
    if (
      !Array.isArray(check.artifact_roles) ||
      check.artifact_roles.length === 0 ||
      check.artifact_roles.some(role => !isNonEmptyString(role)) ||
      new Set(check.artifact_roles).size !== check.artifact_roles.length
    ) {
      errors.push(
        `${label} check ${checkId} artifact_roles must be a non-empty unique string array.`,
      );
    }
  }

  const rawArtifacts = new Map();
  const rawUris = new Set();
  const rawHashes = new Set();
  if (!Array.isArray(artifact.raw_artifacts)) {
    errors.push(`${label} raw_artifacts must be an array.`);
  } else {
    for (const [index, rawArtifact] of artifact.raw_artifacts.entries()) {
      const rawLabel = `${label} raw_artifacts[${index}]`;
      if (!isRecord(rawArtifact)) {
        errors.push(`${rawLabel} must be an object.`);
        continue;
      }
      assertAllowedKeys(
        rawArtifact,
        ['role', 'artifact_uri', 'sha256', 'size_bytes'],
        rawLabel,
        errors,
      );
      if (
        typeof rawArtifact.role !== 'string' ||
        !SUBJECT_ID_PATTERN.test(rawArtifact.role)
      ) {
        errors.push(`${rawLabel}.role has an invalid value.`);
      } else if (rawArtifacts.has(rawArtifact.role)) {
        errors.push(`${label} repeats raw artifact role ${rawArtifact.role}.`);
      } else {
        rawArtifacts.set(rawArtifact.role, rawArtifact);
      }
      validateArtifactUri(rawArtifact.artifact_uri, rawLabel, errors);
      if (rawArtifact.artifact_uri === outerEvidence?.artifact_uri) {
        errors.push(`${rawLabel} must not reference its own semantic report.`);
      }
      if (rawUris.has(rawArtifact.artifact_uri)) {
        errors.push(
          `${label} reuses raw artifact_uri ${String(
            rawArtifact.artifact_uri,
          )}.`,
        );
      }
      rawUris.add(rawArtifact.artifact_uri);
      validateSha256(rawArtifact.sha256, `${rawLabel}.sha256`, errors);
      if (rawHashes.has(rawArtifact.sha256)) {
        errors.push(
          `${label} reuses raw artifact SHA-256 ${String(
            rawArtifact.sha256,
          )}.`,
        );
      }
      rawHashes.add(rawArtifact.sha256);
      if (
        !Number.isInteger(rawArtifact.size_bytes) ||
        rawArtifact.size_bytes <= 0 ||
        rawArtifact.size_bytes > MAX_REPOSITORY_RAW_EVIDENCE_BYTES
      ) {
        errors.push(
          `${rawLabel}.size_bytes must be a positive integer no larger than 16 MiB.`,
        );
      }
    }
  }
  const referencedRoles = new Set(
    [...checks.values()].flatMap(check =>
      Array.isArray(check.artifact_roles) ? check.artifact_roles : [],
    ),
  );
  for (const role of referencedRoles) {
    if (!rawArtifacts.has(role)) {
      errors.push(`${label} check references unknown raw artifact role ${role}.`);
    }
  }
  assertExactSet(
    [...rawArtifacts.keys()],
    [...referencedRoles],
    `${label} referenced raw artifact roles`,
    errors,
  );

  return {errors, ok: errors.length === 0};
}

export function loadLaunchEvidenceSemanticContext({root = ROOT} = {}) {
  const errors = [];
  const policyPath = path.join(root, 'spec', 'release-operational-policy.json');
  const eventsContractPath = path.join(
    root,
    'infra',
    'cloudbase',
    'learning-events-v2-runtime-contract.md',
  );
  const sessionContractPath = path.join(
    root,
    'infra',
    'cloudbase',
    'learning-session-v1-runtime-contract.md',
  );
  const validatorPath = path.join(root, 'scripts', 'validate_launch_readiness.mjs');
  const schedulerLockfilePath = path.join(
    root,
    'infra',
    'cloudbase',
    'functions',
    'softbook-api',
    'package-lock.json',
  );
  let releaseOperationalPolicy = null;
  let releasePolicySha256 = null;
  try {
    const policyBytes = fs.readFileSync(policyPath);
    releaseOperationalPolicy = parseStrictJson(
      policyBytes,
      'release operational policy',
    );
    releasePolicySha256 = createHash('sha256').update(policyBytes).digest('hex');
    const policyResult = validateReleaseOperationalPolicy(
      releaseOperationalPolicy,
    );
    errors.push(...policyResult.errors);
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error));
  }

  const fileHash = (filePath, label) => {
    try {
      return createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
    } catch (error) {
      errors.push(
        `${label} could not be read: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  };
  const eventsContractSha256 = fileHash(
    eventsContractPath,
    'learning events runtime contract',
  );
  const sessionContractSha256 = fileHash(
    sessionContractPath,
    'learning session runtime contract',
  );
  const validatorSha256 = fileHash(
    validatorPath,
    'launch readiness validator',
  );
  const schedulerLockfileSha256 = fileHash(
    schedulerLockfilePath,
    'scheduler dependency lockfile',
  );
  const expectedPolicies = Object.fromEntries(
    Object.keys(GATE_DEFINITIONS).map(gateId => [
      gateId,
      {
        id: 'launch-readiness-validator.v1',
        sha256: validatorSha256,
      },
    ]),
  );
  expectedPolicies['canonical-bootstrap-and-idempotent-events'] = {
    id: 'learning-events-v2-runtime-contract',
    sha256: eventsContractSha256,
  };
  expectedPolicies['server-scheduler'] = {
    id: 'learning-session-v1-runtime-contract',
    lockfile_sha256: schedulerLockfileSha256,
    sha256: sessionContractSha256,
  };
  expectedPolicies['release-slo-and-recovery-drill'] = {
    id: releaseOperationalPolicy?.policy_id,
    sha256: releasePolicySha256,
  };
  return {
    errors,
    expectedPolicies,
    ok:
      errors.length === 0 &&
      Object.values(expectedPolicies).every(
        policy =>
          isNonEmptyString(policy.id) &&
          isNonEmptyString(policy.sha256) &&
          (!Object.hasOwn(policy, 'lockfile_sha256') ||
            isNonEmptyString(policy.lockfile_sha256)),
      ),
    releaseOperationalPolicy,
    releasePolicySha256,
  };
}

function validateSmsProviderSmokeEvidence(bytes, evidence, label, errors) {
  let report;
  try {
    report = JSON.parse(bytes.toString('utf8'));
  } catch {
    errors.push(`${label} SMS provider smoke evidence must be valid JSON.`);
    return;
  }
  for (const message of validateSmsProviderSmokeReport(report)) {
    errors.push(`${label} SMS provider smoke evidence: ${message}.`);
  }
  if (report?.verifier?.id !== evidence.verified_by) {
    errors.push(`${label} SMS provider smoke verifier does not match verified_by.`);
  }
  if (report?.confirmed_at !== evidence.verified_at) {
    errors.push(`${label} SMS provider smoke confirmed_at does not match verified_at.`);
  }
}

function validateProductScope(scope, errors) {
  if (!isRecord(scope)) {
    errors.push('product_scope must be an object.');
    return;
  }
  assertAllowedKeys(
    scope,
    [
      'tracks',
      'release_targets',
      'expected_box_count',
      'expected_card_count',
      'trial_duration_days',
      'subscription_products',
    ],
    'product_scope',
    errors,
  );
  assertExactSet(
    scope.tracks,
    ['cet4', 'cet6'],
    'product_scope.tracks',
    errors,
  );
  assertExactSet(
    scope.release_targets,
    ['ios', 'android', 'pc_web'],
    'product_scope.release_targets',
    errors,
  );
  assertEqual(
    scope.expected_box_count,
    218,
    'product_scope.expected_box_count',
    errors,
  );
  assertEqual(
    scope.expected_card_count,
    2414,
    'product_scope.expected_card_count',
    errors,
  );
  assertEqual(
    scope.trial_duration_days,
    5,
    'product_scope.trial_duration_days',
    errors,
  );
  assertExactSet(
    scope.subscription_products,
    REQUIRED_SUBSCRIPTION_PRODUCTS,
    'product_scope.subscription_products',
    errors,
  );
}

function validateFormalApprovalPolicy(policy, errors) {
  if (!isRecord(policy)) {
    errors.push('formal_approval must be an object.');
    return;
  }
  assertAllowedKeys(
    policy,
    [
      'provider',
      'environment',
      'required_reviewer',
      'administrators_can_bypass',
      'workflow',
      'required_check',
    ],
    'formal_approval',
    errors,
  );
  for (const [field, expected] of Object.entries(FORMAL_APPROVAL_POLICY)) {
    assertEqual(policy[field], expected, `formal_approval.${field}`, errors);
  }
}

function validateLaunchReleaseCandidate(candidate, now, errors) {
  if (candidate === null) {
    return;
  }
  const label = 'release_candidate';
  if (!isRecord(candidate)) {
    errors.push(`${label} must be null or an object.`);
    return;
  }
  assertAllowedKeys(
    candidate,
    [
      'schema_version',
      'repository',
      'commit_sha',
      'target_release',
      'environment',
      'release',
      'client_builds',
      'recorded_at',
      'recorded_by',
    ],
    label,
    errors,
  );
  assertEqual(
    candidate.schema_version,
    'launch-release-candidate.v1',
    `${label}.schema_version`,
    errors,
  );
  assertEqual(
    candidate.repository,
    'LENKIN233/softbook_cet',
    `${label}.repository`,
    errors,
  );
  if (
    typeof candidate.commit_sha !== 'string' ||
    !COMMIT_SHA_PATTERN.test(candidate.commit_sha)
  ) {
    errors.push(`${label}.commit_sha must be a full Git commit SHA.`);
  }
  assertEqual(
    candidate.target_release,
    '2027-Q2',
    `${label}.target_release`,
    errors,
  );

  const environment = candidate.environment;
  if (!isRecord(environment)) {
    errors.push(`${label}.environment must be an object.`);
  } else {
    assertAllowedKeys(
      environment,
      [
        'profile_id',
        'profile_sha256',
        'environment_id',
        'class',
        'receiver_owned',
      ],
      `${label}.environment`,
      errors,
    );
    validateSubjectId(
      environment.profile_id,
      `${label}.environment.profile_id`,
      errors,
    );
    validateSha256(
      environment.profile_sha256,
      `${label}.environment.profile_sha256`,
      errors,
    );
    validateSubjectId(
      environment.environment_id,
      `${label}.environment.environment_id`,
      errors,
    );
    if (
      typeof environment.environment_id === 'string' &&
      FORBIDDEN_ENVIRONMENT_PATTERN.test(environment.environment_id)
    ) {
      errors.push(
        `${label}.environment.environment_id must not name a local or development target.`,
      );
    }
    if (
      !['production_like_staging', 'production'].includes(environment.class)
    ) {
      errors.push(
        `${label}.environment.class must be production_like_staging or production.`,
      );
    }
    assertEqual(
      environment.receiver_owned,
      true,
      `${label}.environment.receiver_owned`,
      errors,
    );
  }

  const release = candidate.release;
  if (!isRecord(release)) {
    errors.push(`${label}.release must be an object.`);
  } else {
    assertAllowedKeys(
      release,
      [
        'release_id',
        'parent_release_id',
        'content_version',
        'bundle_sha256',
        'backend_deployment_id',
      ],
      `${label}.release`,
      errors,
    );
    validateSubjectId(
      release.release_id,
      `${label}.release.release_id`,
      errors,
    );
    validateSubjectId(
      release.parent_release_id,
      `${label}.release.parent_release_id`,
      errors,
    );
    if (release.release_id === release.parent_release_id) {
      errors.push(
        `${label}.release.parent_release_id must differ from release_id.`,
      );
    }
    if (
      typeof release.content_version !== 'string' ||
      !CONTENT_VERSION_PATTERN.test(release.content_version)
    ) {
      errors.push(`${label}.release.content_version has an invalid value.`);
    }
    validateSha256(
      release.bundle_sha256,
      `${label}.release.bundle_sha256`,
      errors,
    );
    validateSubjectId(
      release.backend_deployment_id,
      `${label}.release.backend_deployment_id`,
      errors,
    );
  }

  const clientBuilds = candidate.client_builds;
  if (!isRecord(clientBuilds)) {
    errors.push(`${label}.client_builds must be an object.`);
  } else {
    assertAllowedKeys(
      clientBuilds,
      ['ios', 'android', 'pc_web'],
      `${label}.client_builds`,
      errors,
    );
    for (const platform of ['ios', 'android', 'pc_web']) {
      validateSubjectId(
        clientBuilds[platform],
        `${label}.client_builds.${platform}`,
        errors,
      );
    }
  }
  parseIsoTimestamp(
    candidate.recorded_at,
    `${label}.recorded_at`,
    now,
    errors,
  );
  assertEqual(
    candidate.recorded_by,
    PRODUCT_OWNER_VERIFIER,
    `${label}.recorded_by`,
    errors,
  );
}

function validateSubjectId(value, label, errors) {
  if (typeof value !== 'string' || !SUBJECT_ID_PATTERN.test(value)) {
    errors.push(`${label} has an invalid value.`);
  }
}

function validateSha256(value, label, errors) {
  if (
    typeof value !== 'string' ||
    !SHA256_PATTERN.test(value) ||
    /^([0-9a-f])\1{63}$/.test(value)
  ) {
    errors.push(`${label} must be a non-placeholder SHA-256.`);
  }
}

function validateGate(gate, definition, now, errors) {
  const label = `gate ${gate.id}`;
  assertAllowedKeys(
    gate,
    ['id', 'phase', 'status', 'evidence', 'blocked_by'],
    label,
    errors,
  );
  assertEqual(gate.phase, definition.phase, `${label} phase`, errors);
  if (!GATE_STATUSES.has(gate.status)) {
    errors.push(`${label} has an invalid status.`);
  }

  const evidenceTypes = validateEvidenceList(
    gate.evidence,
    new Set(definition.evidenceTypes),
    `${label} evidence`,
    now,
    errors,
    {requireSubjectCommit: true},
  );
  if (gate.status === 'passed') {
    for (const requiredType of definition.evidenceTypes) {
      if (!evidenceTypes.has(requiredType)) {
        errors.push(
          `${label} passed without required evidence ${requiredType}.`,
        );
      }
    }
    if (
      gate.id === 'approved-production-content' &&
      Array.isArray(gate.evidence)
    ) {
      for (const type of [
        'approved-box-coverage-report',
        'approved-card-coverage-report',
      ]) {
        const approvalEvidence = gate.evidence.find(
          evidence => evidence?.type === type,
        );
        if (approvalEvidence?.verified_by !== PRODUCT_OWNER_VERIFIER) {
          errors.push(
            `${label} ${type} must be verified by ${PRODUCT_OWNER_VERIFIER}.`,
          );
        }
      }
    }
  }

  if (gate.status === 'blocked') {
    if (!Array.isArray(gate.blocked_by) || gate.blocked_by.length === 0) {
      errors.push(`${label} blocked_by must be a non-empty array.`);
    } else {
      const blockers = new Set();
      for (const blocker of gate.blocked_by) {
        if (!KNOWN_BLOCKERS.has(blocker)) {
          errors.push(
            `${label} references unknown blocker ${String(blocker)}.`,
          );
        }
        if (blockers.has(blocker)) {
          errors.push(
            `${label} contains duplicate blocker ${String(blocker)}.`,
          );
        }
        blockers.add(blocker);
      }
    }
  } else if ('blocked_by' in gate) {
    errors.push(`${label} must omit blocked_by unless status is blocked.`);
  }
}

function validateExternalAccount(
  account,
  expectedCapabilities,
  productOwner,
  now,
  errors,
) {
  const label = `external account ${account.id}`;
  assertAllowedKeys(
    account,
    ['id', 'owner', 'status', 'capabilities'],
    label,
    errors,
  );
  assertEqual(account.owner, 'product_owner', `${label} owner`, errors);
  if (!ACCOUNT_STATUSES.has(account.status)) {
    errors.push(`${label} has an invalid status.`);
  }

  const capabilities = mapRecordsById(
    account.capabilities,
    `${label} capabilities`,
    errors,
  );
  assertExactSet(
    [...capabilities.keys()],
    expectedCapabilities,
    `${label} capability ids`,
    errors,
  );
  for (const capability of capabilities.values()) {
    validateCapability(capability, productOwner, now, errors);
  }

  const blocked = [...capabilities.values()].some(
    capability => capability.status === 'blocked',
  );
  const ready =
    capabilities.size === expectedCapabilities.length &&
    [...capabilities.values()].every(
      capability => capability.status === 'ready',
    );
  const expectedStatus = ready ? 'ready' : blocked ? 'blocked' : 'unverified';
  if (account.status !== expectedStatus) {
    errors.push(`${label} status must be ${expectedStatus}.`);
  }
}

function validateCapability(capability, productOwner, now, errors) {
  const label = `capability ${capability.id}`;
  assertAllowedKeys(
    capability,
    ['id', 'status', 'evidence', 'blocked_by'],
    label,
    errors,
  );
  if (!CAPABILITY_STATUSES.has(capability.status)) {
    errors.push(`${label} has an invalid status.`);
  }
  const evidenceTypes = validateEvidenceList(
    capability.evidence,
    EVIDENCE_TYPES,
    `${label} evidence`,
    now,
    errors,
    {requireSubjectCommit: true},
  );

  if (
    capability.status === 'ready' &&
    !evidenceTypes.has('capability-verification')
  ) {
    errors.push(
      `${label} ready status requires capability-verification evidence.`,
    );
  }
  if (capability.status === 'ready' && Array.isArray(capability.evidence)) {
    const verification = capability.evidence.find(
      evidence => evidence?.type === 'capability-verification',
    );
    if (verification?.verified_by !== productOwner) {
      errors.push(`${label} must be verified by tracked product_owner.`);
    }
  }
  if (capability.status === 'blocked') {
    if (!isNonEmptyString(capability.blocked_by)) {
      errors.push(`${label} blocked status requires blocked_by.`);
    }
    if (!evidenceTypes.has('blocking-record')) {
      errors.push(`${label} blocked status requires blocking-record evidence.`);
    }
  } else if ('blocked_by' in capability) {
    errors.push(`${label} must omit blocked_by unless status is blocked.`);
  }
}

function validateEvidenceList(
  evidence,
  allowedTypes,
  label,
  now,
  errors,
  options = {},
) {
  const discoveredTypes = new Set();
  const discoveredArtifactUris = new Set();
  const discoveredArtifactHashes = new Set();
  if (!Array.isArray(evidence)) {
    errors.push(`${label} must be an array.`);
    return discoveredTypes;
  }
  for (const [index, record] of evidence.entries()) {
    const recordLabel = `${label}[${index}]`;
    if (!isRecord(record)) {
      errors.push(`${recordLabel} must be an object.`);
      continue;
    }
    assertAllowedKeys(
      record,
      [
        'type',
        'artifact_uri',
        'artifact_sha256',
        'artifact_size_bytes',
        'subject_commit_sha',
        'verified_at',
        'verified_by',
      ],
      recordLabel,
      errors,
    );
    if (!allowedTypes.has(record.type)) {
      errors.push(`${recordLabel} has unexpected type ${String(record.type)}.`);
    } else if (discoveredTypes.has(record.type)) {
      errors.push(`${label} contains duplicate evidence type ${record.type}.`);
    } else {
      discoveredTypes.add(record.type);
    }
    if (options.requireSubjectCommit) {
      if (
        typeof record.subject_commit_sha !== 'string' ||
        !COMMIT_SHA_PATTERN.test(record.subject_commit_sha)
      ) {
        errors.push(`${recordLabel} subject_commit_sha must be a full Git commit SHA.`);
      }
    }
    validateArtifactUri(record.artifact_uri, recordLabel, errors);
    if (typeof record.artifact_uri === 'string') {
      if (discoveredArtifactUris.has(record.artifact_uri)) {
        errors.push(`${label} reuses artifact_uri ${record.artifact_uri}.`);
      }
      discoveredArtifactUris.add(record.artifact_uri);
    }
    if (
      typeof record.artifact_sha256 !== 'string' ||
      !/^[0-9a-f]{64}$/.test(record.artifact_sha256) ||
      /^([0-9a-f])\1{63}$/.test(record.artifact_sha256)
    ) {
      errors.push(
        `${recordLabel} artifact_sha256 must be a non-placeholder SHA-256.`,
      );
    } else {
      if (discoveredArtifactHashes.has(record.artifact_sha256)) {
        errors.push(
          `${label} reuses artifact_sha256 ${record.artifact_sha256}.`,
        );
      }
      discoveredArtifactHashes.add(record.artifact_sha256);
    }
    if (
      !Number.isInteger(record.artifact_size_bytes) ||
      record.artifact_size_bytes <= 0
    ) {
      errors.push(
        `${recordLabel} artifact_size_bytes must be a positive integer.`,
      );
    } else if (record.artifact_size_bytes > MAX_REPOSITORY_EVIDENCE_BYTES) {
      errors.push(
        `${recordLabel} artifact_size_bytes must not exceed 1 MiB; archive larger evidence.`,
      );
    }
    parseIsoTimestamp(
      record.verified_at,
      `${recordLabel} verified_at`,
      now,
      errors,
    );
    if (
      typeof record.verified_by !== 'string' ||
      !/^(github|team|external):[A-Za-z0-9_.-]+$/.test(record.verified_by)
    ) {
      errors.push(
        `${recordLabel} verified_by must identify a github, team, or external verifier.`,
      );
    }
  }
  return discoveredTypes;
}

function validateArtifactUri(value, label, errors) {
  if (typeof value !== 'string' || !value.startsWith('repo://')) {
    errors.push(`${label} artifact_uri must use repo://.`);
    return;
  }
  const relativePath = value.slice('repo://'.length);
  const segments = relativePath.split('/');
  if (
    relativePath.length === 0 ||
    relativePath.includes('\\') ||
    relativePath.startsWith('/') ||
    segments.includes('..') ||
    !REPOSITORY_EVIDENCE_PREFIXES.some(prefix =>
      relativePath.startsWith(prefix),
    )
  ) {
    errors.push(
      `${label} artifact_uri is not an allowed repository evidence path.`,
    );
  }
}

function validateDistinctEvidenceArtifacts(records, errors) {
  const artifactUris = new Map();
  const artifactHashes = new Map();
  for (const { evidence, label } of records) {
    if (!isRecord(evidence)) continue;
    for (const [field, seen] of [
      ['artifact_uri', artifactUris],
      ['artifact_sha256', artifactHashes],
    ]) {
      const value = evidence[field];
      if (!isNonEmptyString(value)) continue;
      const firstLabel = seen.get(value);
      if (firstLabel) {
        errors.push(`${label} reuses ${field} already used by ${firstLabel}.`);
      } else {
        seen.set(value, label);
      }
    }
  }
}

function collectEvidence(launchContract, accountsContract) {
  const records = [];
  for (const gate of asArray(launchContract?.gates)) {
    for (const evidence of asArray(gate?.evidence)) {
      records.push({
        evidence,
        evidenceType: evidence?.type,
        gateId: gate?.id,
        label: `gate ${gate.id} evidence ${evidence?.type}`,
        scope: 'gate',
      });
    }
  }
  for (const account of asArray(accountsContract?.accounts)) {
    for (const capability of asArray(account?.capabilities)) {
      for (const evidence of asArray(capability?.evidence)) {
        records.push({
          accountId: account?.id,
          capabilityId: capability?.id,
          evidence,
          label: `account ${account.id} capability ${capability.id} evidence ${evidence?.type}`,
          scope: 'external_capability',
        });
      }
    }
  }
  return records;
}

function latestEvidenceTimestamp(accounts) {
  let latest = null;
  for (const account of asArray(accounts)) {
    for (const capability of asArray(account?.capabilities)) {
      for (const evidence of asArray(capability?.evidence)) {
        const value = new Date(evidence?.verified_at ?? '');
        if (!Number.isNaN(value.getTime()) && (!latest || value > latest)) {
          latest = value;
        }
      }
    }
  }
  return latest;
}

function parseIsoTimestamp(value, label, now, errors) {
  if (typeof value !== 'string') {
    errors.push(`${label} must be an ISO timestamp.`);
    return null;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== value) {
    errors.push(`${label} must be a canonical ISO timestamp.`);
    return null;
  }
  if (parsed.getTime() > now.getTime() + 5 * 60 * 1000) {
    errors.push(`${label} must not be in the future.`);
  }
  if (parsed.getTime() < now.getTime() - EVIDENCE_MAX_AGE_MS) {
    errors.push(`${label} must be verified within the last 180 days.`);
  }
  return parsed;
}

function mapRecordsById(records, label, errors) {
  const byId = new Map();
  if (!Array.isArray(records)) {
    errors.push(`${label} must be an array.`);
    return byId;
  }
  for (const [index, record] of records.entries()) {
    if (!isRecord(record) || !isNonEmptyString(record.id)) {
      errors.push(`${label}[${index}] must be an object with a non-empty id.`);
      continue;
    }
    if (byId.has(record.id)) {
      errors.push(`${label} contains duplicate id ${record.id}.`);
      continue;
    }
    byId.set(record.id, record);
  }
  return byId;
}

function assertAllowedKeys(record, allowedKeys, label, errors) {
  if (!isRecord(record)) {
    errors.push(`${label} must be an object.`);
    return;
  }
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(record)) {
    if (!allowed.has(key)) {
      errors.push(`${label} contains unexpected field ${key}.`);
    }
  }
}

function assertExactSet(actual, expected, label, errors) {
  if (!Array.isArray(actual)) {
    errors.push(`${label} must be an array.`);
    return;
  }
  const actualValues = [...actual].sort();
  const expectedValues = [...expected].sort();
  if (
    actualValues.length !== expectedValues.length ||
    actualValues.some((value, index) => value !== expectedValues[index])
  ) {
    errors.push(`${label} must contain exactly: ${expected.join(', ')}.`);
  }
}

function assertEqual(actual, expected, label, errors) {
  if (actual !== expected) {
    errors.push(`${label} must be ${String(expected)}.`);
  }
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function invalidResult(error) {
  return { errors: [error], ok: false, ready: false, summary: {} };
}

function readJson(filePath) {
  return parseStrictJson(fs.readFileSync(filePath), path.relative(ROOT, filePath));
}

function readTrackedFiles(root) {
  const output = execFileSync('git', ['-C', root, 'ls-files', '-z'], {
    encoding: 'utf8',
  });
  return new Set(output.split('\0').filter(Boolean));
}

function readReachableCommits(root) {
  const output = execFileSync('git', ['-C', root, 'rev-list', 'HEAD'], {
    encoding: 'utf8',
  });
  return new Set(output.split('\n').filter(Boolean));
}

function parseArgs(args) {
  const result = {
    accountsPath: DEFAULT_ACCOUNT_CONTRACT,
    launchPath: DEFAULT_LAUNCH_CONTRACT,
    requireReady: false,
  };
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--launch') {
      result.launchPath = path.resolve(
        requireArgument(args, ++index, '--launch'),
      );
    } else if (argument === '--accounts') {
      result.accountsPath = path.resolve(
        requireArgument(args, ++index, '--accounts'),
      );
    } else if (argument === '--require-launch-ready') {
      result.requireReady = true;
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return result;
}

function requireArgument(args, index, option) {
  const value = args[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} requires a file path.`);
  }
  return value;
}

function main() {
  let args;
  let launchContract;
  let accountsContract;
  try {
    args = parseArgs(process.argv.slice(2));
    launchContract = readJson(args.launchPath);
    accountsContract = readJson(args.accountsPath);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
    return;
  }

  const launch = validateLaunchReadiness(launchContract);
  const accounts = validateExternalAccountReadiness(
    accountsContract,
    launchContract,
  );
  const repositoryEvidence = verifyRepositoryEvidenceFiles(
    launchContract,
    accountsContract,
    {
      trackedFiles: readTrackedFiles(ROOT),
      trustedCommits: readReachableCommits(ROOT),
    },
  );
  const ok = launch.ok && accounts.ok && repositoryEvidence.ok;
  const ready = ok && launch.ready && accounts.ready;
  const report = {
    schema_version: 'launch-readiness-report.v1',
    ok,
    ready,
    launch,
    external_accounts: accounts,
    repository_evidence: repositoryEvidence,
  };
  console.log(JSON.stringify(report, null, 2));
  if (!ok || (args.requireReady && !ready)) {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
