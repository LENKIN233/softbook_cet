#!/usr/bin/env node

import assert from 'node:assert/strict';
import {
  collectAdvisories,
  isAuditReport,
  validateTargetReport,
} from './validate_dependency_security.mjs';
import {
  legacyMinimatchPackages,
  normalizeMinimatchSource,
} from './normalize_minimatch_brace_expansion.mjs';

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

const minimatchFixture = `before
var expand = require('brace-expansion')
after
`;
const normalizedMinimatch = normalizeMinimatchSource(minimatchFixture);
assert.equal(normalizedMinimatch.changed, true);
assert.match(normalizedMinimatch.content, /braceExpansion\.expand/);
assert.equal(
  normalizeMinimatchSource(normalizedMinimatch.content).changed,
  false,
);
assert.throws(
  () => normalizeMinimatchSource('upstream changed'),
  /import shape drifted/,
);
assert.throws(
  () => normalizeMinimatchSource(`${minimatchFixture}${minimatchFixture}`),
  /multiple brace-expansion imports/,
);
assert.throws(
  () =>
    normalizeMinimatchSource(
      `${normalizedMinimatch.content}\n${minimatchFixture}`,
    ),
  /ambiguous normalized import/,
);
assert.deepEqual(
  legacyMinimatchPackages({
    packages: {
      'node_modules/modern/minimatch': {version: '10.2.5'},
      'node_modules/old/minimatch': {version: '3.1.5'},
    },
  }),
  [{packagePath: 'node_modules/old/minimatch', version: '3.1.5'}],
);

console.log(
  'PASS: dependency policy and minimatch compatibility normalization fail closed.',
);
