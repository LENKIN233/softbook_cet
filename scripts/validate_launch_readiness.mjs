#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CONTRACT = path.join(
  ROOT,
  'docs',
  'release',
  'launch-readiness.v1.json',
);
const DEFAULT_EXTERNAL_ACCOUNTS = path.join(
  ROOT,
  'docs',
  'release',
  'external-account-readiness.v1.json',
);
const ALLOWED_GATE_STATUSES = new Set([
  'pending',
  'in_progress',
  'blocked',
  'passed',
]);
const ALLOWED_EXTERNAL_STATUSES = new Set([
  'unverified',
  'blocked',
  'ready',
]);
const REQUIRED_EXTERNAL_DEPENDENCIES = [
  'apple-developer',
  'android-distribution',
  'tencent-cloud-production',
  'payments',
  'china-compliance',
];
const REQUIRED_GATES = [
  'production-environments',
  'production-auth-and-account-deletion',
  'canonical-bootstrap-and-idempotent-events',
  'server-scheduler',
  'audio-runtime',
  'three-surface-parity',
  'store-and-web-payments',
  'approved-production-content',
  'compliance-and-distribution',
  'release-slo-and-recovery-drill',
];
const REQUIRED_SUBSCRIPTION_PRODUCTS = [
  'com.softbook.cet.premium.monthly',
  'com.softbook.cet.premium.yearly',
];

export function validateLaunchReadiness(contract) {
  const errors = [];

  if (contract?.schema_version !== 'launch-readiness.v1') {
    errors.push('schema_version must be launch-readiness.v1.');
  }

  if (contract?.target_release !== '2027-Q2') {
    errors.push('target_release must remain 2027-Q2 until explicitly revised.');
  }

  const scope = contract?.product_scope;
  assertExactSet(scope?.tracks, ['cet4', 'cet6'], 'product_scope.tracks', errors);
  assertExactSet(
    scope?.release_targets,
    ['ios', 'android', 'pc_web'],
    'product_scope.release_targets',
    errors,
  );

  if (scope?.expected_box_count !== 218) {
    errors.push('product_scope.expected_box_count must be 218.');
  }
  if (scope?.expected_card_count !== 2414) {
    errors.push('product_scope.expected_card_count must be 2414.');
  }
  if (scope?.trial_duration_days !== 5) {
    errors.push('product_scope.trial_duration_days must be 5.');
  }
  assertExactSet(
    scope?.subscription_products,
    REQUIRED_SUBSCRIPTION_PRODUCTS,
    'product_scope.subscription_products',
    errors,
  );

  const externalDependencies = Array.isArray(contract?.external_dependencies)
    ? contract.external_dependencies
    : [];
  const externalIds = uniqueIds(
    externalDependencies,
    'external_dependencies',
    errors,
  );
  assertExactSet(
    [...externalIds],
    REQUIRED_EXTERNAL_DEPENDENCIES,
    'external_dependencies ids',
    errors,
  );
  for (const dependency of externalDependencies) {
    if (!ALLOWED_EXTERNAL_STATUSES.has(dependency.status)) {
      errors.push(
        `external dependency ${dependency.id ?? '<missing>'} has invalid status.`,
      );
    }
  }

  const gates = Array.isArray(contract?.gates) ? contract.gates : [];
  const gateIds = uniqueIds(gates, 'gates', errors);
  assertExactSet([...gateIds], REQUIRED_GATES, 'gate ids', errors);
  if (gates.length === 0) {
    errors.push('gates must not be empty.');
  }

  for (const gate of gates) {
    if (!ALLOWED_GATE_STATUSES.has(gate.status)) {
      errors.push(`gate ${gate.id ?? '<missing>'} has invalid status.`);
    }
    if (!Array.isArray(gate.evidence)) {
      errors.push(`gate ${gate.id ?? '<missing>'} evidence must be an array.`);
    }
    if (gate.status === 'passed' && gate.evidence.length === 0) {
      errors.push(`passed gate ${gate.id} must include evidence.`);
    }
    if (gate.status === 'blocked') {
      if (!Array.isArray(gate.blocked_by) || gate.blocked_by.length === 0) {
        errors.push(`blocked gate ${gate.id} must include blocked_by.`);
      }
    }
    for (const dependencyId of gate.blocked_by ?? []) {
      if (
        !externalIds.has(dependencyId) &&
        dependencyId !== '218-box-user-approval'
      ) {
        errors.push(
          `gate ${gate.id} references unknown blocker ${dependencyId}.`,
        );
      }
    }
  }

  const ready =
    gates.length > 0 &&
    gates.every(gate => gate.status === 'passed') &&
    externalDependencies.length > 0 &&
    externalDependencies.every(dependency => dependency.status === 'ready');
  const expectedStatus = ready ? 'ready' : 'not_ready';
  if (contract?.status !== expectedStatus) {
    errors.push(`status must be ${expectedStatus} for the recorded gate states.`);
  }

  return {
    errors,
    ok: errors.length === 0,
    ready,
    summary: Object.fromEntries(
      [...ALLOWED_GATE_STATUSES].map(status => [
        status,
        gates.filter(gate => gate.status === status).length,
      ]),
    ),
  };
}

export function validateExternalAccountReadiness(accounts, contract) {
  const errors = [];
  if (accounts?.schema_version !== 'external-account-readiness.v1') {
    errors.push('external account schema_version is invalid.');
  }
  const accountRecords = Array.isArray(accounts?.accounts) ? accounts.accounts : [];
  const dependencyRecords = Array.isArray(contract?.external_dependencies)
    ? contract.external_dependencies
    : [];
  const accountIds = uniqueIds(accountRecords, 'accounts', errors);
  const dependencyIds = new Set(
    dependencyRecords.map(dependency => dependency.id).filter(Boolean),
  );
  if (
    [...accountIds].sort().join('\n') !==
    [...dependencyIds].sort().join('\n')
  ) {
    errors.push(
      'external account ids must match launch contract external dependencies.',
    );
  }
  for (const account of accountRecords) {
    if (!ALLOWED_EXTERNAL_STATUSES.has(account.status)) {
      errors.push(`external account ${account.id ?? '<missing>'} has invalid status.`);
    }
    if (!Array.isArray(account.required_capabilities) || account.required_capabilities.length === 0) {
      errors.push(`external account ${account.id ?? '<missing>'} requires capabilities.`);
    }
    if (!Array.isArray(account.evidence)) {
      errors.push(`external account ${account.id ?? '<missing>'} evidence must be an array.`);
    }
    if (account.status === 'ready' && account.evidence.length === 0) {
      errors.push(`ready external account ${account.id} must include evidence.`);
    }
    const dependency = dependencyRecords.find(candidate => candidate.id === account.id);
    if (dependency && dependency.status !== account.status) {
      errors.push(`external account ${account.id} status differs from launch contract.`);
    }
  }
  const ready =
    accountRecords.length > 0 &&
    accountRecords.every(account => account.status === 'ready');
  if (ready && !isIsoTimestamp(accounts?.last_verified_at)) {
    errors.push('ready external accounts require an ISO last_verified_at timestamp.');
  }
  const expectedStatus = ready ? 'ready' : 'unverified';
  if (accounts?.overall_status !== expectedStatus) {
    errors.push(`external account overall_status must be ${expectedStatus}.`);
  }
  return {errors, ok: errors.length === 0, ready};
}

function isIsoTimestamp(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString() === value;
}

function assertExactSet(actual, expected, label, errors) {
  if (!Array.isArray(actual)) {
    errors.push(`${label} must be an array.`);
    return;
  }

  if (
    actual.length !== expected.length ||
    [...actual].sort().join('\n') !== [...expected].sort().join('\n')
  ) {
    errors.push(`${label} must contain exactly: ${expected.join(', ')}.`);
  }
}

function uniqueIds(records, label, errors) {
  const ids = new Set();
  for (const record of records) {
    if (typeof record?.id !== 'string' || record.id.length === 0) {
      errors.push(`${label} entries must include a non-empty id.`);
      continue;
    }
    if (ids.has(record.id)) {
      errors.push(`${label} contains duplicate id ${record.id}.`);
    }
    ids.add(record.id);
  }
  return ids;
}

function main() {
  const args = process.argv.slice(2);
  const requireReady = args.includes('--require-launch-ready');
  const contractPath = args.find(argument => !argument.startsWith('--'));
  const resolvedPath = contractPath
    ? path.resolve(process.cwd(), contractPath)
    : DEFAULT_CONTRACT;
  const contract = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  const result = validateLaunchReadiness(contract);
  const accounts = JSON.parse(fs.readFileSync(DEFAULT_EXTERNAL_ACCOUNTS, 'utf8'));
  const accountResult = validateExternalAccountReadiness(accounts, contract);

  console.log(
    JSON.stringify(
      {
        schema_version: 'launch-readiness-report.v1',
        contract: path.relative(ROOT, resolvedPath),
        external_accounts: accountResult,
        ...result,
      },
      null,
      2,
    ),
  );

  if (
    !result.ok ||
    !accountResult.ok ||
    (requireReady && (!result.ready || !accountResult.ready))
  ) {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
