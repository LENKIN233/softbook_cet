#!/usr/bin/env node

import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';

import {
  REGISTRY_PATH,
  validateBatch1Registry,
} from './validate_mobile_ux_batch1_registry.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function runGit(root, args) {
  const result = spawnSync('git', args, {cwd: root, encoding: 'utf8'});
  assert.equal(result.status, 0, result.stderr || result.stdout);
  return result.stdout.trim();
}

function copyFile(root, relativePath) {
  const destination = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(destination), {recursive: true});
  fs.copyFileSync(path.join(ROOT, relativePath), destination);
}

function readJson(root, relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
}

function writeJson(root, relativePath, value) {
  fs.writeFileSync(path.join(root, relativePath), `${JSON.stringify(value, null, 2)}\n`);
}

function fixturePaths() {
  const sourceBundle = readJson(ROOT, REGISTRY_PATH);
  return new Set([
    REGISTRY_PATH,
    ...sourceBundle.source_bindings.map(item => item.path),
    ...sourceBundle.checkpoint_registry_bindings.map(item => item.path),
    ...sourceBundle.target_requirements.map(item => item.document_path),
  ]);
}

function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-batch1-registry-'));
  for (const relativePath of fixturePaths()) copyFile(root, relativePath);
  return root;
}

function makeCommittedFixture({excludedPaths = []} = {}) {
  const container = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-batch1-committed-'));
  const root = path.join(container, 'repo');
  runGit(container, ['clone', '--quiet', '--shared', ROOT, root]);
  const excluded = new Set(excludedPaths);
  const paths = [...fixturePaths()];
  for (const relativePath of paths) copyFile(root, relativePath);
  for (const relativePath of paths.filter(item => !excluded.has(item))) {
    runGit(root, ['add', '--', relativePath]);
  }
  for (const relativePath of excluded) {
    const tracked = spawnSync('git', ['ls-files', '--error-unmatch', '--', relativePath], {
      cwd: root,
      encoding: 'utf8',
    });
    if (tracked.status === 0) runGit(root, ['rm', '--cached', '--quiet', '--', relativePath]);
  }
  runGit(root, ['config', 'user.name', 'Batch 1 Fixture']);
  runGit(root, ['config', 'user.email', 'batch1-fixture@example.invalid']);
  runGit(root, ['commit', '--quiet', '--allow-empty', '-m', 'fixture']);
  runGit(root, ['remote', 'set-url', 'origin', 'https://github.com/LENKIN233/softbook_cet.git']);
  return {container, root};
}

function withFixture(callback) {
  const root = makeFixture();
  try {
    return callback(root);
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
}

function withCommittedFixture(options, callback) {
  const {container, root} = makeCommittedFixture(options);
  try {
    return callback(root);
  } finally {
    fs.rmSync(container, {recursive: true, force: true});
  }
}

function mutateBundle(root, mutate) {
  const value = readJson(root, REGISTRY_PATH);
  mutate(value);
  writeJson(root, REGISTRY_PATH, value);
}

function childPath(root, checkpointId) {
  const bundle = readJson(root, REGISTRY_PATH);
  return bundle.checkpoint_registry_bindings.find(item => item.checkpoint_id === checkpointId).path;
}

function mutateChild(root, checkpointId, mutate, {refreshBinding = true} = {}) {
  const relativePath = childPath(root, checkpointId);
  const value = readJson(root, relativePath);
  mutate(value);
  writeJson(root, relativePath, value);
  if (refreshBinding) {
    const bytes = fs.readFileSync(path.join(root, relativePath));
    mutateBundle(root, bundle => {
      bundle.checkpoint_registry_bindings.find(item => item.checkpoint_id === checkpointId).sha256 =
        sha256(bytes);
    });
  }
}

test('valid v1 registry is structural preparation only and remains blocked', () => {
  const result = validateBatch1Registry({root: ROOT});
  assert.equal(result.artifact_valid, true);
  assert.equal(result.subject_class, 'registry_preparation');
  assert.equal(result.current_authority_state, 'requires_new_exact_head_protected_preparation_decision');
  assert.equal(result.next_stage_readiness, 'blocked_unresolved_inputs');
  assert.equal(result.freeze_readiness, 'ineligible_preparation_schema');
  assert.equal(result.manifest_freeze_eligible, false);
  assert.equal(result.schema_transition_required, true);
  assert.equal(result.gate_effect, 'none');
  for (const field of [
    'gate_eligible',
    'evidence_eligible',
    'provisioning_authorized',
    'execution_authorized',
    'collection_authorized',
    'aggregation_authorized',
    'promotion_authorized',
    'visual_exploration_authorized',
    'implementation_authorized',
    'native_acceptance_authorized',
    'release_authorized',
  ]) {
    assert.equal(result[field], false, field);
  }
  assert.equal(result.semantic_obligation_count, 173);
  assert.equal(result.pc_web_matrix_count, 12);
  assert.equal(result.cp_cs_scenario_count, 12);
  assert.ok(result.unresolved_input_count > 0);
});

test('the source universe binds direct product owners and every child names the complete owner set', () => {
  const expectedOwners = [
    'spec/product-core.json',
    'spec/platform-contract.json',
    'spec/account-sync-contract.json',
    'spec/action-surface.json',
    'spec/card-system.json',
    'spec/interactions.json',
    'spec/knowledge-map.json',
    'spec/space-operations.json',
    'spec/box-catalog.json',
    'spec/membership.json',
    'spec/visual-language.json',
  ];
  const bundle = readJson(ROOT, REGISTRY_PATH);
  const sources = bundle.source_bindings.map(item => item.path);
  assert.ok(sources.includes('spec/requirement-memory.json'));
  assert.ok(sources.includes('spec/product-core.json'));
  for (const checkpointId of ['CP-BA', 'CP-CS', 'CP-WEB']) {
    assert.deepEqual(readJson(ROOT, childPath(ROOT, checkpointId)).semantic_owner_anchors, expectedOwners);
  }
});

test('formal, managed, and private entitlement subjects remain profile-isolated', () => {
  const bundle = readJson(ROOT, REGISTRY_PATH);
  assert.deepEqual(
    bundle.content_subject_requirements.map(item => [item.content_requirement_id, item.profile]),
    [
      ['content-release-subject', 'shared_account_runtime'],
      ['private-audio-manifest-subject', 'private_content_audio'],
      ['formal-entitlement-configuration-subject', 'formal_account_access'],
      ['managed-entitlement-configuration-subject', 'receiver_managed'],
      ['private-content-entitlement-configuration-subject', 'private_content_audio'],
    ],
  );
});

test('v1 rejects the obsolete freeze-ready CLI instead of implying in-place promotion', () => {
  const result = spawnSync(
    process.execPath,
    [path.join(ROOT, 'scripts', 'validate_mobile_ux_batch1_registry.mjs'), '--require-freeze-ready'],
    {cwd: ROOT, encoding: 'utf8'},
  );
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /unknown argument: --require-freeze-ready/);
});

test('preparation validator rejects upward consumer labels', () => {
  for (const consumer of ['evidence-collector', 'cp-va', 'ui-design-gate', 'cp-nfa', 'cp-rlr']) {
    assert.throws(
      () => validateBatch1Registry({root: ROOT, consumer}),
      new RegExp(`cannot be consumed by ${consumer}`),
    );
  }
});

test('unknown and authority-bearing input fields fail closed', () =>
  withFixture(root => {
    mutateBundle(root, value => {
      value.collection_authorized = true;
      value.extra = 'structural_extension';
    });
    assert.throws(() => validateBatch1Registry({root}), /forbidden preparation-stage field/);
  }));

test('child evidence fields cannot be introduced even when the parent hash is rebound', () =>
  withFixture(root => {
    mutateChild(root, 'CP-CS', value => {
      value.scenario_registry[0].raw_evidence = [];
      value.scenario_registry[0].executed_at = '2026-08-09T00:00:00Z';
    });
    assert.throws(
      () => validateBatch1Registry({root}),
      /forbidden preparation-stage field raw_evidence/,
    );
  }));

test('real-device and launch-cohort labels cannot be smuggled into requirements', () =>
  withFixture(root => {
    mutateBundle(root, value => {
      value.target_requirements[0].candidate_system.real_device = true;
      value.launch_cohort = 'launch-release-candidate.v1';
    });
    assert.throws(() => validateBatch1Registry({root}), /forbidden preparation-stage field/);
  }));

test('placeholder assignments are rejected', () =>
  withFixture(root => {
    mutateBundle(root, value => {
      value.required_roles[0].assignment.reason_code = 'TBD';
    });
    assert.throws(() => validateBatch1Registry({root}), /forbidden preparation-stage value TBD/);
  }));

test('personal and credential-like strings are rejected from every allowed value position', async t => {
  const values = [
    'learner@example.com',
    '13812345678',
    '550e8400-e29b-41d4-a716-446655440000',
    '/Users/person/private-device',
    'api_key=private-value',
    'Bearer private-value',
  ];
  for (const sensitiveValue of values) {
    await t.test(sensitiveValue, () =>
      withFixture(root => {
        mutateBundle(root, value => {
          value.current_authority_requirement.reason_code = sensitiveValue;
        });
        assert.throws(
          () => validateBatch1Registry({root}),
          /forbidden personal or credential-like value/,
        );
      }),
    );
  }
});

test('strict JSON rejects duplicate keys, BOM, and trailing content', () => {
  withFixture(root => {
    const file = path.join(root, REGISTRY_PATH);
    const text = fs.readFileSync(file, 'utf8').replace(
      '{\n  "schema_version"',
      '{\n  "schema_version": "duplicate",\n  "schema_version"',
    );
    fs.writeFileSync(file, text);
    assert.throws(() => validateBatch1Registry({root}), /duplicate object key/);
  });
  withFixture(root => {
    const file = path.join(root, REGISTRY_PATH);
    fs.writeFileSync(file, Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), fs.readFileSync(file)]));
    assert.throws(() => validateBatch1Registry({root}), /must not contain a UTF-8 BOM/);
  });
  withFixture(root => {
    const file = path.join(root, REGISTRY_PATH);
    fs.appendFileSync(file, 'false\n');
    assert.throws(() => validateBatch1Registry({root}), /trailing content/);
  });
});

test('source byte drift and source-hash rebinding both fail', () => {
  withFixture(root => {
    const bundle = readJson(root, REGISTRY_PATH);
    const source = bundle.target_requirements[0].document_path;
    fs.appendFileSync(path.join(root, source), '\nDRIFT\n');
    assert.throws(() => validateBatch1Registry({root}), /SHA-256 drift/);
  });
  withFixture(root => {
    const bundle = readJson(root, REGISTRY_PATH);
    const source = bundle.target_requirements[0].document_path;
    fs.appendFileSync(path.join(root, source), '\nDRIFT\n');
    mutateBundle(root, value => {
      value.source_bindings.find(item => item.path === source).sha256 =
        sha256(fs.readFileSync(path.join(root, source)));
    });
    assert.throws(() => validateBatch1Registry({root}), /source_bindings exact digest/);
  });
});

test('direct product-owner byte drift fails closed', async t => {
  for (const source of ['spec/requirement-memory.json', 'spec/product-core.json']) {
    await t.test(source, () =>
      withFixture(root => {
        fs.appendFileSync(path.join(root, source), '\n');
        assert.throws(() => validateBatch1Registry({root}), /SHA-256 drift/);
      }),
    );
  }
});

test('source traversal and arbitrary semantic digests fail', () => {
  withFixture(root => {
    mutateBundle(root, value => {
      value.source_bindings[0].path = '../outside.md';
    });
    assert.throws(() => validateBatch1Registry({root}), /order\/content mismatch|traversal/);
  });
  withFixture(root => {
    mutateBundle(root, value => {
      value.semantic_scope.ledger_semantic_digest = '0'.repeat(64);
    });
    assert.throws(() => validateBatch1Registry({root}), /ledger_semantic_digest must equal/);
  });
});

test('child drift and deliberate parent rebinding both fail exact child hashes', () => {
  withFixture(root => {
    mutateChild(root, 'CP-BA', value => {
      value.registry_id = 'drifted';
    }, {refreshBinding: false});
    assert.throws(() => validateBatch1Registry({root}), /SHA-256 drift/);
  });
  withFixture(root => {
    mutateChild(root, 'CP-BA', value => {
      value.semantic_owner_anchors[0] = 'attacker/owner.json';
    });
    assert.throws(() => validateBatch1Registry({root}), /semantic_owner_anchors must equal/);
  });
  withFixture(root => {
    const relativePath = childPath(root, 'CP-BA');
    fs.appendFileSync(path.join(root, relativePath), '\n');
    mutateBundle(root, value => {
      value.checkpoint_registry_bindings.find(item => item.checkpoint_id === 'CP-BA').sha256 =
        sha256(fs.readFileSync(path.join(root, relativePath)));
    });
    assert.throws(() => validateBatch1Registry({root}), /exact reviewed SHA-256/);
  });
});

test('CP-BA exact child rejects scenario shrink, missing phone landscape, and shared-to-platform copying', async t => {
  const mutations = [
    [value => value.scenario_registry.pop(), /scenario_registry scenario_id order\/content mismatch/],
    [
      value => {
        value.scenario_registry[0].stress_matrix_ids =
          value.scenario_registry[0].stress_matrix_ids.filter(item => item !== 'phone-landscape');
      },
      /stress_matrix_ids must equal/,
    ],
    [
      value => {
        value.scenario_registry[1].target_ids = [
          'ba-ios-phone-browser',
          'ba-android-phone-browser',
          'ba-ipados-browser',
          'ba-android-tablet-browser',
        ];
      },
      /target_ids must equal/,
    ],
  ];
  for (const [index, [mutation, expectedError]] of mutations.entries()) {
    await t.test(`mutation-${index + 1}`, () =>
      withFixture(root => {
        mutateChild(root, 'CP-BA', mutation);
        assert.throws(() => validateBatch1Registry({root}), expectedError);
      }),
    );
  }
});

test('planned manifest role, scenario, validator, and path collisions reach semantic checks', async t => {
  const mutations = [
    [
      value => {
        value.planned_manifest_registry[0].manifest_role = 'unknown_role';
      },
      /manifest_role is invalid/,
    ],
    [
      value => {
        value.planned_manifest_registry[0].scenario_id = 'wrong-scenario';
      },
      /scenario_id is not registered/,
    ],
    [
      value => {
        value.planned_manifest_registry[0].semantic_validator_id = 'future-noop';
      },
      /exact semantic digest/,
    ],
    [
      value => {
        value.planned_manifest_registry[1].planned_path =
          value.planned_manifest_registry[0].planned_path;
      },
      /planned_path must be unique/,
    ],
  ];
  for (const [index, [mutation, expectedError]] of mutations.entries()) {
    await t.test(`mutation-${index + 1}`, () =>
      withFixture(root => {
        mutateChild(root, 'CP-WEB', mutation);
        assert.throws(() => validateBatch1Registry({root}), expectedError);
      }),
    );
  }
});

test('CP-CS exact child rejects scenario omission, profile blending, selector gaps, and resolved roles', async t => {
  const mutations = [
    [value => value.scenario_registry.splice(6, 1), /scenario_registry scenario_id order\/content mismatch/],
    [
      value => {
        value.scenario_registry.find(item => item.scenario_id === 'cs-receiver-managed-access').access_profile =
          'formal_commerce_web';
      },
      /access_profile must equal/,
    ],
    [
      value => {
        const space = value.scenario_registry.find(item => item.scenario_id === 'cs-space-actions');
        space.state_selectors = space.state_selectors.filter(item => item !== 'TOOL-11');
      },
      /state_selectors must equal/,
    ],
    [
      value => {
        value.scenario_registry[0].operator_assignment = {
          kind: 'resolved',
          principal_id: 'github:unconfirmed',
        };
      },
      /operator_assignment keys must be exactly|operator_assignment.kind must equal/,
    ],
    [
      value => {
        value.scenario_registry.find(
          item => item.scenario_id === 'cs-receiver-managed-access',
        ).content_requirement_ids = ['formal-entitlement-configuration-subject'];
      },
      /content_requirement_ids must equal/,
    ],
  ];
  for (const [index, [mutation, expectedError]] of mutations.entries()) {
    await t.test(`mutation-${index + 1}`, () =>
      withFixture(root => {
        mutateChild(root, 'CP-CS', mutation);
        assert.throws(() => validateBatch1Registry({root}), expectedError);
      }),
    );
  }
});

test('CP-CS cohort dimensions cannot be swapped across target, build, content, or window', async t => {
  const fields = [
    ['target_requirement_ids', ['web-desktop-primary']],
    ['build_requirement_ids', ['build-cp-web-production-like']],
    ['content_requirement_ids', ['private-audio-manifest-subject']],
    ['execution_window_requirement_id', 'window-cp-web'],
  ];
  for (const [field, replacement] of fields) {
    await t.test(field, () =>
      withFixture(root => {
        mutateChild(root, 'CP-CS', value => {
          value.scenario_registry[0][field] = replacement;
        });
        assert.throws(
          () => validateBatch1Registry({root}),
          new RegExp(`${field} must equal`),
        );
      }),
    );
  }
});

test('CP-WEB exact child rejects row omission, local-service substitution, and cohort swaps', async t => {
  const mutations = [
    [value => value.matrix_registry.pop(), /matrix_registry matrix_id order\/content mismatch/],
    [
      value => {
        value.matrix_registry.find(item => item.matrix_id === 'PW-SERVICE-01').environment_requirement_id =
          'env-local-browser-readonly';
      },
      /environment_requirement_id must equal/,
    ],
    [
      value => {
        value.matrix_registry.find(item => item.matrix_id === 'PW-COMMERCE-01').account_requirement_ids =
          ['account-runtime-primary'];
      },
      /account_requirement_ids must equal/,
    ],
    [
      value => {
        value.matrix_registry[0].build_requirement_id = 'build-cp-cs-service-harness';
      },
      /build_requirement_id must equal/,
    ],
    [
      value => {
        value.matrix_registry.find(item => item.matrix_id === 'PW-AUDIO-01').content_requirement_ids =
          ['content-release-subject'];
      },
      /content_requirement_ids must equal/,
    ],
    [
      value => {
        value.matrix_registry[0].execution_window_requirement_id = 'window-cp-cs';
      },
      /execution_window_requirement_id must equal/,
    ],
    [
      value => {
        value.matrix_registry.find(item => item.matrix_id === 'PW-BETA-01').content_requirement_ids =
          ['formal-entitlement-configuration-subject'];
      },
      /content_requirement_ids must equal/,
    ],
  ];
  for (const [index, [mutation, expectedError]] of mutations.entries()) {
    await t.test(`mutation-${index + 1}`, () =>
      withFixture(root => {
        mutateChild(root, 'CP-WEB', mutation);
        assert.throws(() => validateBatch1Registry({root}), expectedError);
      }),
    );
  }
});

test('bundle cannot promote local browser or browser-framed targets', () => {
  withFixture(root => {
    mutateBundle(root, value => {
      const environment = value.environment_requirements.find(
        item => item.environment_id === 'env-local-browser-readonly',
      );
      environment.environment_class = 'receiver_owned_staging';
      environment.profile = 'shared_account_runtime';
    });
    assert.throws(() => validateBatch1Registry({root}), /environment_class must equal/);
  });
  withFixture(root => {
    mutateBundle(root, value => {
      value.target_requirements[0].target_class = 'real_client_system';
    });
    assert.throws(() => validateBatch1Registry({root}), /target_class must equal/);
  });
});

test('planned path traversal, premature creation, and ancestor symlinks fail', () => {
  withFixture(root => {
    mutateChild(root, 'CP-WEB', value => {
      value.planned_manifest_registry[0].planned_path =
        'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/execution-manifests/cp-web/../escape.json';
    });
    assert.throws(() => validateBatch1Registry({root}), /traversal or normalization aliases/);
  });
  withFixture(root => {
    const child = readJson(root, childPath(root, 'CP-CS'));
    const planned = path.join(root, child.planned_manifest_registry[0].planned_path);
    fs.mkdirSync(path.dirname(planned), {recursive: true});
    fs.writeFileSync(planned, '{}\n');
    assert.throws(() => validateBatch1Registry({root}), /must not exist before a protected manifest decision/);
  });
  withFixture(root => {
    const unregistered = path.join(
      root,
      'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/execution-manifests/cp-ba/unregistered.json',
    );
    fs.mkdirSync(path.dirname(unregistered), {recursive: true});
    fs.writeFileSync(unregistered, '{}\n');
    assert.throws(
      () => validateBatch1Registry({root}),
      /planned manifest subtree must contain no files or directories/,
    );
  });
  withFixture(root => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'softbook-batch1-outside-'));
    try {
      const symlink = path.join(
        root,
        'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/execution-manifests',
      );
      fs.symlinkSync(outside, symlink, 'dir');
      assert.throws(() => validateBatch1Registry({root}), /must not traverse a symlink/);
    } finally {
      fs.rmSync(outside, {recursive: true, force: true});
    }
  });
  withFixture(root => {
    const symlink = path.join(
      root,
      'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/execution-manifests',
    );
    fs.symlinkSync(path.join(root, 'missing-external-target'), symlink, 'dir');
    assert.throws(() => validateBatch1Registry({root}), /must not traverse a symlink/);
  });
});

test('resolved resource assignment and reason-code substitution fail', () => {
  withFixture(root => {
    mutateBundle(root, value => {
      value.required_roles[0].assignment = {kind: 'resolved', principal_id: 'github:someone'};
    });
    assert.throws(() => validateBatch1Registry({root}), /keys must be exactly|kind must equal/);
  });
  withFixture(root => {
    mutateBundle(root, value => {
      value.target_requirements[0].candidate_system.reason_code = 'provider_sandbox_missing';
    });
    assert.throws(() => validateBatch1Registry({root}), /reason_code must equal/);
  });
});

test('tracked mode rejects no repository, index-only state, and foreign origin', () => {
  withFixture(root => {
    assert.throws(() => validateBatch1Registry({root, requireTracked: true}), /requires a Git working tree/);
  });
  withFixture(root => {
    runGit(root, ['init', '--quiet']);
    runGit(root, ['add', '--', ...fixturePaths()]);
    assert.throws(() => validateBatch1Registry({root, requireTracked: true}), /requires a committed HEAD/);
  });
  withCommittedFixture({}, root => {
    runGit(root, ['remote', 'set-url', 'origin', 'https://github.com/attacker/other.git']);
    assert.throws(
      () => validateBatch1Registry({root, requireTracked: true}),
      /requires the LENKIN233\/softbook_cet origin/,
    );
  });
});

test('tracked mode accepts only a committed exact-head descendant', () =>
  withCommittedFixture({}, root => {
    const result = validateBatch1Registry({root, requireTracked: true});
    assert.equal(result.artifact_valid, true);
    assert.equal(result.freeze_readiness, 'ineligible_preparation_schema');
  }));

test('tracked mode binds the registry set and working bytes to HEAD', () => {
  withCommittedFixture({excludedPaths: [REGISTRY_PATH]}, root => {
    assert.throws(
      () => validateBatch1Registry({root, requireTracked: true}),
      /Batch 1 registry set must be tracked by Git|must be committed at HEAD/,
    );
  });
  withCommittedFixture({}, root => {
    fs.appendFileSync(path.join(root, REGISTRY_PATH), '\n');
    assert.throws(
      () => validateBatch1Registry({root, requireTracked: true}),
      /working bytes must match HEAD/,
    );
  });
});

test('tracked mode binds every target document to a regular HEAD blob', () =>
  withCommittedFixture(
    {
      excludedPaths: [
        'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/grayscale-proofs/ios-phone.html',
      ],
    },
    root => {
      assert.throws(
        () => validateBatch1Registry({root, requireTracked: true}),
        /must be tracked by Git|must be committed at HEAD/,
      );
    },
  ));

test('tracked mode rejects planned manifests committed at HEAD even when hidden from the working tree', async t => {
  await t.test('registered path', () =>
    withCommittedFixture({}, root => {
      const child = readJson(root, childPath(root, 'CP-BA'));
      const relativePath = child.planned_manifest_registry[0].planned_path;
      const absolutePath = path.join(root, relativePath);
      fs.mkdirSync(path.dirname(absolutePath), {recursive: true});
      fs.writeFileSync(absolutePath, '{}\n');
      runGit(root, ['add', '--', relativePath]);
      runGit(root, ['commit', '--quiet', '-m', 'commit forbidden registered manifest']);
      fs.rmSync(path.dirname(path.dirname(absolutePath)), {recursive: true, force: true});
      assert.throws(
        () => validateBatch1Registry({root, requireTracked: true}),
        /must not be committed at HEAD/,
      );
    }));
  await t.test('unregistered path', () =>
    withCommittedFixture({}, root => {
      const relativePath =
        'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/execution-manifests/cp-ba/unregistered.json';
      const absolutePath = path.join(root, relativePath);
      fs.mkdirSync(path.dirname(absolutePath), {recursive: true});
      fs.writeFileSync(absolutePath, '{}\n');
      runGit(root, ['add', '--', relativePath]);
      runGit(root, ['commit', '--quiet', '-m', 'commit forbidden unregistered manifest']);
      fs.rmSync(path.dirname(path.dirname(absolutePath)), {recursive: true, force: true});
      assert.throws(
        () => validateBatch1Registry({root, requireTracked: true}),
        /planned manifest subtree must contain no committed HEAD entries/,
      );
    }));
});
