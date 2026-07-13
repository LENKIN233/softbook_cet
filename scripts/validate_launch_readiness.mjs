#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

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

  const stateReady =
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
  { root = ROOT, trackedFiles = null } = {},
) {
  const errors = [];
  for (const { evidence, label } of collectEvidence(
    launchContract,
    accountsContract,
  )) {
    if (!isRecord(evidence) || !evidence.artifact_uri?.startsWith('repo://')) {
      continue;
    }
    const relativePath = evidence.artifact_uri.slice('repo://'.length);
    if (trackedFiles && !trackedFiles.has(relativePath)) {
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
    const actualSha256 = createHash('sha256')
      .update(fs.readFileSync(resolvedPath))
      .digest('hex');
    if (actualSha256 !== evidence.artifact_sha256) {
      errors.push(`${label} repository evidence SHA-256 does not match.`);
    }
  }
  return { errors, ok: errors.length === 0 };
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

function validateEvidenceList(evidence, allowedTypes, label, now, errors) {
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

function collectEvidence(launchContract, accountsContract) {
  const records = [];
  for (const gate of asArray(launchContract?.gates)) {
    for (const evidence of asArray(gate?.evidence)) {
      records.push({
        evidence,
        label: `gate ${gate.id} evidence ${evidence?.type}`,
      });
    }
  }
  for (const account of asArray(accountsContract?.accounts)) {
    for (const capability of asArray(account?.capabilities)) {
      for (const evidence of asArray(capability?.evidence)) {
        records.push({
          evidence,
          label: `account ${account.id} capability ${capability.id} evidence ${evidence?.type}`,
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
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readTrackedFiles(root) {
  const output = execFileSync('git', ['-C', root, 'ls-files', '-z'], {
    encoding: 'utf8',
  });
  return new Set(output.split('\0').filter(Boolean));
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
    { trackedFiles: readTrackedFiles(ROOT) },
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
