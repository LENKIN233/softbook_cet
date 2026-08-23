#!/usr/bin/env node

import assert from 'node:assert/strict';
import test from 'node:test';

import {historicalRunRecordChanges} from './guard_agent_run_archive.mjs';

test('historical run records are frozen while archive policy files may change', () => {
  assert.deepEqual(
    historicalRunRecordChanges([
      'README.md',
      'docs/agent-runs/README.md',
      'docs/agent-runs/TEMPLATE.md',
      'docs/agent-runs/2026-08-23-release.md',
      'docs/agent-runs/2026-08-23-release.md',
      'docs/agent-runs/evidence/README.md',
    ]),
    ['docs/agent-runs/2026-08-23-release.md'],
  );
});
