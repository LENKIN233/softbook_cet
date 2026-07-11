#!/usr/bin/env node

import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const POLICY_PATH = path.join(ROOT, 'security', 'dependency-audit-policy.json');

export function collectAdvisories(report) {
  const advisories = new Map();

  for (const vulnerability of Object.values(report.vulnerabilities ?? {})) {
    for (const via of vulnerability.via ?? []) {
      if (typeof via !== 'object' || !via) {
        continue;
      }

      const id = advisoryId(via);
      advisories.set(id, {
        id,
        package: via.name,
        severity: via.severity,
        title: via.title,
        url: via.url,
      });
    }
  }

  return [...advisories.values()].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
}

export function validateTargetReport(target, report, now = new Date()) {
  const errors = [];
  const advisories = collectAdvisories(report);
  const discovered = new Map(advisories.map(advisory => [advisory.id, advisory]));
  const allowed = new Map();

  for (const exception of target.allowed_advisories ?? []) {
    const exceptionId = exception.id.toUpperCase();
    if (allowed.has(exceptionId)) {
      errors.push({code: 'duplicate_exception', advisory: exception.id});
      continue;
    }

    allowed.set(exceptionId, {...exception, id: exceptionId});
    const expiresAt = new Date(`${exception.expires_on}T23:59:59.999Z`);
    if (Number.isNaN(expiresAt.getTime()) || now > expiresAt) {
      errors.push({
        code: 'expired_exception',
        advisory: exceptionId,
        expires_on: exception.expires_on,
      });
    }
  }

  for (const advisory of advisories) {
    const exception = allowed.get(advisory.id);
    if (!exception) {
      errors.push({code: 'unapproved_advisory', ...advisory});
      continue;
    }
    if (exception.package !== advisory.package) {
      errors.push({
        code: 'exception_package_mismatch',
        advisory: advisory.id,
        expected: exception.package,
        actual: advisory.package,
      });
    }
    if (exception.severity !== advisory.severity) {
      errors.push({
        code: 'exception_severity_changed',
        advisory: advisory.id,
        expected: exception.severity,
        actual: advisory.severity,
      });
    }
    if (advisory.severity === 'critical') {
      errors.push({code: 'critical_advisory_cannot_be_excepted', advisory: advisory.id});
    }
  }

  for (const exception of allowed.values()) {
    if (!discovered.has(exception.id)) {
      errors.push({code: 'resolved_exception_still_listed', advisory: exception.id});
    }
  }

  return {
    id: target.id,
    ok: errors.length === 0,
    vulnerabilities: report.metadata?.vulnerabilities ?? null,
    advisories,
    errors,
  };
}

function advisoryId(advisory) {
  const githubId = advisory.url?.match(/GHSA-[a-z0-9-]+/i)?.[0];
  return githubId?.toUpperCase() ?? `npm-${advisory.source}`;
}

function auditTarget(target) {
  const cwd = path.join(ROOT, target.path);
  const result = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });

  if (result.error) {
    return {
      id: target.id,
      ok: false,
      vulnerabilities: null,
      advisories: [],
      errors: [{code: 'audit_command_failed', message: result.error.message}],
    };
  }

  let report;
  try {
    report = JSON.parse(result.stdout);
  } catch {
    return {
      id: target.id,
      ok: false,
      vulnerabilities: null,
      advisories: [],
      errors: [
        {
          code: 'audit_output_invalid',
          status: result.status,
          stderr: result.stderr.trim(),
        },
      ],
    };
  }

  return validateTargetReport(target, report);
}

function main() {
  const policy = JSON.parse(fs.readFileSync(POLICY_PATH, 'utf8'));
  const targets = policy.targets.map(auditTarget);
  const output = {
    schema_version: 'dependency-security-report.v1',
    ok: targets.every(target => target.ok),
    targets,
  };

  console.log(JSON.stringify(output, null, 2));
  if (!output.ok) {
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
