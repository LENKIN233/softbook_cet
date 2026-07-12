#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  collectAdvisories,
  isAuditReport,
  validateTargetReport,
} from './validate_dependency_security.mjs';

const report = {
  vulnerabilities: {
    dependency: {
      via: [
        {
          name: 'dependency',
          severity: 'high',
          source: 1,
          title: 'fixture advisory',
          url: 'https://github.com/advisories/GHSA-aaaa-bbbb-cccc',
        },
      ],
    },
  },
  metadata: {
    vulnerabilities: {high: 1, total: 1},
  },
};
const exception = {
  id: 'GHSA-AAAA-BBBB-CCCC',
  package: 'dependency',
  severity: 'high',
  expires_on: '2026-08-10',
  reason: 'fixture',
};

assert.equal(collectAdvisories(report).length, 1);
assert.equal(isAuditReport(report), true);
assert.equal(
  isAuditReport({error: {summary: 'registry unavailable'}}),
  false,
  'npm audit error payloads must not be accepted as empty reports',
);
assert.equal(
  validateTargetReport(
    {id: 'allowed', allowed_advisories: [exception]},
    report,
    new Date('2026-07-11T00:00:00Z'),
  ).ok,
  true,
);
assert.equal(
  validateTargetReport(
    {id: 'unknown', allowed_advisories: []},
    report,
    new Date('2026-07-11T00:00:00Z'),
  ).errors[0].code,
  'unapproved_advisory',
);
assert.ok(
  validateTargetReport(
    {id: 'expired', allowed_advisories: [exception]},
    report,
    new Date('2026-08-11T00:00:00Z'),
  ).errors.some(error => error.code === 'expired_exception'),
);
assert.equal(
  validateTargetReport(
    {id: 'stale', allowed_advisories: [exception]},
    {vulnerabilities: {}, metadata: {vulnerabilities: {total: 0}}},
    new Date('2026-07-11T00:00:00Z'),
  ).errors[0].code,
  'resolved_exception_still_listed',
);

console.log(
  'PASS: dependency security policy rejects invalid reports and unknown, expired, or stale exceptions.',
);
