#!/usr/bin/env node

import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, rmSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {
  buildSwipeStates,
  deriveConfirmedPilotScope,
  roundRobin,
} from './build_card_make_runtime_payload.mjs';

const BOXES = [
  ['0000', 12],
  ['0010', 12],
  ['0113', 12],
  ['0121', 12],
  ['0202', 8],
  ['0220', 8],
  ['0300', 8],
  ['0311', 8],
  ['0401', 8],
  ['0410', 8],
  ['0500', 6],
  ['0521', 6],
  ['0611', 6],
  ['0630', 6],
];

function cardIds(prefix, count) {
  return Array.from({length: count}, (_, index) =>
    `${prefix}${String(index + 1).padStart(2, '0')}`,
  );
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function testConfirmedPilotOrder() {
  const root = mkdtempSync(join(tmpdir(), 'softbook-pilot-scope-'));

  try {
    const reviewDir = join(root, 'reviews', 'agent_self_review');
    const confirmationDir = join(root, 'reviews', 'sample_confirmations');
    mkdirSync(reviewDir, {recursive: true});
    mkdirSync(confirmationDir, {recursive: true});
    const confirmationPath = join(confirmationDir, 'pilot.json');
    const confirmationId = 'confirmed-pilot-fixture';

    writeJson(confirmationPath, {
      schema_version: 'sample-confirmation.v1',
      confirmation_id: confirmationId,
      confirmed_by_user: true,
      scope: {
        track: 'cet4',
        purpose: 'controlled_pilot',
        target_card_count: 120,
        box_targets: BOXES.map(([boxPrefix, target]) => ({
          box_prefix: boxPrefix,
          target_card_count: target,
          sample_card_ids: cardIds(boxPrefix, 3),
        })),
      },
      authorizes: {confirmed_box_expansion: true},
      gate_eligible: false,
    });

    for (const [boxPrefix, target] of BOXES) {
      writeJson(join(reviewDir, `${boxPrefix}-expansion.json`), {
        sample_policy: {
          sample_confirmation_id: confirmationId,
          confirmed_box_expansion: true,
        },
        cards: cardIds(boxPrefix, target).slice(3).map(cardId => ({
          card_id: cardId,
          status: 'pass',
        })),
      });
    }

    const result = deriveConfirmedPilotScope({
      cardMakeRoot: root,
      confirmationPath,
    });
    assert.equal(result.cardIds.length, 120);
    assert.equal(result.manifest.free_card_ids.length, 60);
    assert.equal(result.manifest.continuation_card_ids.length, 60);
    assert.equal(new Set(result.manifest.free_card_ids.map(id => id[1])).size, 7);
    assert.deepEqual(
      result.cardIds.slice(0, BOXES.length),
      BOXES.map(([prefix]) => `${prefix}01`),
    );
    assert.equal(result.manifest.status, 'candidate_not_formally_approved');
    assert.equal(result.manifest.gate_eligible, false);
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
}

function testBooleanSwipeIdentifiers() {
  assert.deepEqual(
    buildSwipeStates({
      card_id: '040105',
      swipe_states: [
        {id: false, label: 'False'},
        {id: true, label: 'True'},
      ],
    }),
    [
      {id: 'false', label: 'False', description: 'False'},
      {id: 'true', label: 'True', description: 'True'},
    ],
  );
}

assert.deepEqual(roundRobin([['a', 'b'], ['c']]), ['a', 'c', 'b']);
testBooleanSwipeIdentifiers();
testConfirmedPilotOrder();
console.log('build_card_make_runtime_payload tests passed');
