#!/usr/bin/env node

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildModelAcceptanceInputSha256,
  requireIndependentModelAcceptances,
} from './lib/model_acceptance_contract.mjs';

const INPUT = `sha256:${'a'.repeat(64)}`;
const acceptance = runId => ({
  schema_version: 'model-acceptance.v2',
  actor: {kind: 'model_harness', agent: 'agent:codex', model: 'gpt-5.6-sol', run_id: runId},
  evidence: {
    reviewed_at: '2026-08-23T17:00:00+08:00',
    input_sha256: INPUT,
    capabilities: ['content_authorization'],
    summary: 'Reviewed the exact content identity.',
    findings: [],
  },
  decision: 'accepted',
});

test('independent model evidence binds input, capability, and distinct runs', () => {
  assert.equal(requireIndependentModelAcceptances(
    [acceptance('review:first'), acceptance('review:second')],
    {expectedInputSha256: INPUT, requiredCapabilities: ['content_authorization']},
  ).length, 2);
  assert.throws(() => requireIndependentModelAcceptances(
    [acceptance('review:first'), acceptance('review:first')],
    {expectedInputSha256: INPUT, requiredCapabilities: ['content_authorization']},
  ), /distinct/);
  const drifted = acceptance('review:second');
  drifted.evidence.input_sha256 = `sha256:${'b'.repeat(64)}`;
  assert.throws(() => requireIndependentModelAcceptances(
    [acceptance('review:first'), drifted],
    {expectedInputSha256: INPUT, requiredCapabilities: ['content_authorization']},
  ), /exact expected input/);
});

test('canonical model input binds exact scope, audit, review, and additional inputs', () => {
  const base = {
    additionalBindings: {
      runtime_payload_sha256: `sha256:${'d'.repeat(64)}`,
      pilot_id: 'cet4-pilot-2026',
      content_version: `sha256:${'e'.repeat(64)}`,
    },
    auditSha256: `sha256:${'b'.repeat(64)}`,
    corpusFingerprint: `sha256:${'c'.repeat(64)}`,
    decisionType: 'controlled_pilot_authorization',
    linkedReviewIdentity: {
      path: 'reviews/controlled_pilot_reviews/pilot.json',
      sha256: `sha256:${'f'.repeat(64)}`,
    },
    scope: {
      track: 'cet4',
      purpose: 'controlled_pilot',
      box_prefixes: ['B02', 'B01'],
      card_ids: ['000002', '000001'],
    },
  };
  const canonical = buildModelAcceptanceInputSha256(base);
  assert.match(canonical, /^sha256:[a-f0-9]{64}$/);
  assert.equal(
    canonical,
    buildModelAcceptanceInputSha256({
      ...base,
      additionalBindings: {
        content_version: `sha256:${'e'.repeat(64)}`,
        pilot_id: 'cet4-pilot-2026',
        runtime_payload_sha256: `sha256:${'d'.repeat(64)}`,
      },
      scope: {...base.scope, box_prefixes: [...base.scope.box_prefixes].reverse()},
    }),
  );
  assert.notEqual(
    canonical,
    buildModelAcceptanceInputSha256({
      ...base,
      auditSha256: `sha256:${'0'.repeat(64)}`,
    }),
  );
});
