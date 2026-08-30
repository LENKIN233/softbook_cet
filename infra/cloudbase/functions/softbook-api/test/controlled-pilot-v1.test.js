const assert = require('node:assert/strict');
const {resolve} = require('node:path');
const {pathToFileURL} = require('node:url');
const {before, test} = require('node:test');

let pilot;
let formalDelivery;

before(async () => {
  pilot = await import(
    pathToFileURL(resolve(__dirname, '../../../controlled-pilot-v1.mjs'))
  );
  formalDelivery = await import(
    pathToFileURL(resolve(__dirname, '../../../release-delivery-v1.mjs'))
  );
});

test('controlled pilot profile is CET4-only, receiver-owned in shape, and never gate eligible', () => {
  const profile = pilot.validateControlledPilotProfile(profileFixture());
  assert.equal(profile.runtime_mode, 'controlled_pilot');
  assert.deepEqual(profile.enabled_tracks, ['cet4']);
  assert.equal(profile.cohort_limit, 50);
  assert.equal(profile.gate_eligible, false);

  assert.throws(
    () =>
      pilot.validateControlledPilotProfile({
        ...profileFixture(),
        enabled_tracks: ['cet4', 'cet6'],
      }),
    /exactly \["cet4"\]/,
  );
  assert.throws(
    () =>
      pilot.validateControlledPilotProfile({
        ...profileFixture(),
        api_key: 'not-allowed',
      }),
    /unsupported or missing fields/,
  );
  assert.throws(
    () =>
      pilot.validateControlledPilotProfile({
        ...profileFixture(),
        environment_id: pilot.PERSONAL_DEVELOPMENT_ENVIRONMENT,
      }),
    /independent receiver pilot environment/,
  );
});

test('controlled pilot profile requires a credential-free HTTPS function path', () => {
  const missingPath = profileFixture();
  missingPath.api_base_url = 'https://pilot-api.softbook.example';
  assert.throws(
    () => pilot.validateControlledPilotProfile(missingPath),
    /with a path/,
  );

  const credentialed = profileFixture();
  credentialed.api_base_url =
    'https://user:secret@pilot-api.softbook.example/softbook-api';
  assert.throws(
    () => pilot.validateControlledPilotProfile(credentialed),
    /credential-free/,
  );
});

test('controlled pilot bundle locks 120 cards, 60 free cards, all libraries, approval, audit, and audio QC', () => {
  const bundle = pilot.validateControlledPilotBundle(bundleFixture());
  assert.equal(bundle.content.card_count, 120);
  assert.equal(bundle.content.free_card_count, 60);
  assert.equal(bundle.audio.referenced_asset_count, 24);
  assert.equal(bundle.audio.qc_asset_count, 24);
  assert.equal(bundle.audit.explained_risks[0].rule_id, 'synthetic_source');
  assert.equal(bundle.audit.explained_risks[0].card_count, 120);
  assert.equal(bundle.gate_eligible, false);

  assert.throws(
    () =>
      pilot.validateControlledPilotBundle({
        ...bundleFixture(),
        content: {...bundleFixture().content, card_count: 119},
      }),
    /content.card_count must be 120/,
  );
  assert.throws(
    () =>
      pilot.validateControlledPilotBundle({
        ...bundleFixture(),
        content: {...bundleFixture().content, card_count: 10},
      }),
    /content.card_count must be 120/,
  );
  assert.throws(
    () =>
      pilot.validateControlledPilotBundle({
        ...bundleFixture(),
        content: {
          ...bundleFixture().content,
          free_library_card_counts: {
            ...bundleFixture().content.free_library_card_counts,
            grammar: 0,
            listening: 17,
          },
        },
      }),
    /free_library_card_counts.grammar/,
  );
  assert.throws(
    () =>
      pilot.validateControlledPilotBundle({
        ...bundleFixture(),
        gate_eligible: true,
      }),
    /gate_eligible must be false/,
  );
  assert.throws(
    () =>
      pilot.validateControlledPilotBundle({
        ...bundleFixture(),
        audit: {
          ...bundleFixture().audit,
          explained_risks: [],
        },
      }),
    /synthetic-source disclosure/,
  );
  assert.throws(
    () =>
      pilot.validateControlledPilotBundle({
        ...bundleFixture(),
        audit: {
          ...bundleFixture().audit,
          explained_risks: [
            {
              ...bundleFixture().audit.explained_risks[0],
              card_count: 119,
            },
          ],
        },
      }),
    /card_count must be 120/,
  );
});

test('pilot release cannot impersonate a formal content release', () => {
  const release = pilot.validatePilotContentRelease({
    schema_version: 'pilot-content-release.v1',
    pilot_id: 'cet4-pilot-2026',
    profile_id: 'receiver-pilot-profile',
    release_id: 'cet4-pilot-release-001',
    release_class: 'controlled_pilot',
    runtime_mode: 'controlled_pilot',
    track: 'cet4',
    content_version: digest('1'),
    card_count: 120,
    free_card_count: 60,
    activated_at: '2026-08-10T00:00:00.000Z',
    expires_at: '2026-09-10T00:00:00.000Z',
    minimum_client_versions: {ios: '1.0.0', android: '1.0.0'},
    gate_eligible: false,
  });
  assert.equal(release.release_class, 'controlled_pilot');

  assert.throws(
    () =>
      pilot.validatePilotContentRelease({
        ...release,
        schema_version: 'content-release.v1',
      }),
    /schema_version/,
  );
});

test('formal delivery rejects controlled pilot profile and bundle artifacts', () => {
  assert.throws(
    () => formalDelivery.validateDeliveryProfile(profileFixture()),
    /unsupported or missing fields|schema_version/,
  );
  assert.throws(
    () => formalDelivery.validateReleaseBundle(bundleFixture()),
    /unsupported or missing fields|schema_version/,
  );
});

test('pilot entitlement command accepts only auditable grant and revoke inputs', () => {
  const command = pilot.validatePilotEntitlementCommand({
    schema_version: 'pilot-entitlement-command.v1',
    event_id: 'pilot-grant-001',
    pilot_id: 'cet4-pilot-2026',
    phone_number: '13800138000',
    action: 'grant',
    actor: 'receiver-operator',
    reason: 'continue controlled pilot after trial',
    occurred_at: '2026-08-15T00:00:00.000Z',
    previous_stage: 'free',
    resulting_stage: 'pilot_premium',
  });
  assert.equal(command.action, 'grant');

  assert.throws(
    () => pilot.validatePilotEntitlementCommand({...command, action: 'purchase'}),
    /grant or revoke/,
  );
});

test('controlled-pilot public identifiers reject phone-number material', () => {
  const phoneMaterial = 'scope-138-0013-8000';
  assert.throws(
    () =>
      pilot.validateControlledPilotProfile({
        ...profileFixture(),
        pilot_id: phoneMaterial,
      }),
    /phone-number material/,
  );
  assert.throws(
    () =>
      pilot.validateControlledPilotBundle({
        ...bundleFixture(),
        pilot_id: phoneMaterial,
      }),
    /phone-number material/,
  );
  const command = {
    schema_version: 'pilot-entitlement-command.v1',
    event_id: 'pilot-grant-001',
    pilot_id: 'cet4-pilot-2026',
    phone_number: '13800138000',
    action: 'grant',
    actor: 'receiver-operator',
    reason: 'continue controlled pilot after trial',
    occurred_at: '2026-08-15T00:00:00.000Z',
    previous_stage: 'free',
    resulting_stage: 'pilot_premium',
  };
  for (const field of ['actor', 'event_id', 'pilot_id']) {
    assert.throws(
      () =>
        pilot.validatePilotEntitlementCommand({
          ...command,
          [field]: phoneMaterial,
        }),
      /phone-number material/,
    );
  }
});

test('pilot outcome report derives thresholds and rejects an unsupported advance decision', () => {
  const passing = pilot.validatePilotOutcomeReport({
    schema_version: 'pilot-outcome-report.v1',
    pilot_id: 'cet4-pilot-2026',
    generated_at: '2026-08-20T00:00:00.000Z',
    days_observed: 5,
    cohort_size: 50,
    metrics: {
      first_round_completers: 35,
      d1_retained: 20,
      d5_retained: 10,
      survey_respondents: 40,
      exam_value_and_space_respondents: 24,
      p0_incident_count: 0,
    },
    decision: 'advance',
    contains_direct_identifiers: false,
    gate_eligible: false,
  });
  assert.equal(passing.metrics.meets_all_thresholds, true);

  assert.throws(
    () =>
      pilot.validatePilotOutcomeReport({
        ...passing,
        metrics: {...passing.metrics, d5_retained: 9},
      }),
    /unsupported or missing fields/,
  );

  const failingInput = {
    schema_version: 'pilot-outcome-report.v1',
    pilot_id: 'cet4-pilot-2026',
    generated_at: '2026-08-20T00:00:00.000Z',
    days_observed: 5,
    cohort_size: 50,
    metrics: {
      first_round_completers: 34,
      d1_retained: 20,
      d5_retained: 10,
      survey_respondents: 40,
      exam_value_and_space_respondents: 24,
      p0_incident_count: 0,
    },
    decision: 'advance',
    contains_direct_identifiers: false,
    gate_eligible: false,
  };
  assert.throws(
    () => pilot.validatePilotOutcomeReport(failingInput),
    /cannot advance/,
  );
});

function profileFixture() {
  return {
    schema_version: 'controlled-pilot-profile.v1',
    profile_id: 'receiver-pilot-profile',
    pilot_id: 'cet4-pilot-2026',
    environment_id: 'receiver-pilot-environment',
    region: 'ap-shanghai',
    api_base_url: 'https://pilot-api.softbook.example/softbook-api',
    runtime_mode: 'controlled_pilot',
    enabled_tracks: ['cet4'],
    minimum_client_versions: {ios: '1.0.0', android: '1.0.0'},
    signing_key_id: 'pilot-signing-key-1',
    cohort_limit: 50,
    pilot_expires_at: '2026-09-10T00:00:00.000Z',
    gate_eligible: false,
  };
}

function bundleFixture() {
  return {
    schema_version: 'controlled-pilot-bundle.v1',
    bundle_id: 'cet4-pilot-bundle-001',
    profile_id: 'receiver-pilot-profile',
    pilot_id: 'cet4-pilot-2026',
    release_id: 'cet4-pilot-release-001',
    track: 'cet4',
    runtime_mode: 'controlled_pilot',
    created_at: '2026-08-09T00:00:00.000Z',
    release_at: '2026-08-10T00:00:00.000Z',
    pilot_expires_at: '2026-09-10T00:00:00.000Z',
    content: {
      payload_path: 'content/cet4-pilot.json',
      payload_sha256: digest('1'),
      content_version: digest('2'),
      corpus_fingerprint: digest('3'),
      card_count: 120,
      free_card_count: 60,
      library_card_counts: {
        listening: 24,
        careful_reading: 24,
        cloze: 16,
        writing: 16,
        translation: 16,
        vocabulary: 12,
        grammar: 12,
      },
      free_library_card_counts: {
        listening: 16,
        careful_reading: 12,
        cloze: 8,
        writing: 8,
        translation: 6,
        vocabulary: 5,
        grammar: 5,
      },
      library_box_counts: {
        listening: 4,
        careful_reading: 4,
        cloze: 3,
        writing: 3,
        translation: 3,
        vocabulary: 2,
        grammar: 2,
      },
      interaction_card_counts: {
        flip: 40,
        multiple_choice: 30,
        lock: 20,
        elimination: 15,
        swipe: 15,
      },
      mapped_card_count: 120,
      unmapped_card_count: 0,
      duplicate_card_id_count: 0,
    },
    approval: {
      record_path: 'approval/pilot-authorization.json',
      record_sha256: digest('4'),
      review_path: 'approval/pilot-review.json',
      review_sha256: digest('6'),
      scope: 'controlled_pilot_120',
      status: 'approved',
      approved_at: '2026-08-09T00:00:00.000Z',
    },
    audit: {
      report_path: 'audit/pilot-audit.json',
      report_sha256: digest('5'),
      audit_version: 'card-make-quality-audit-v1',
      report_type: 'scoped_card_quality_audit',
      scope_card_count: 120,
      scope_card_ids_sha256: digest('8'),
      corpus_sha256: digest('9'),
      unresolved_blockers: 0,
      unexplained_risks: 0,
      metadata_coverage: 1,
      explained_risks: [
        {
          rule_id: 'synthetic_source',
          severity: 'source_risk',
          card_count: 120,
          disclosure: 'synthetic_training_content_not_true_exam',
        },
      ],
    },
    audio: {
      manifest_path: 'audio/manifest.json',
      manifest_sha256: digest('6'),
      qc_index_path: 'audio/qc-index.json',
      qc_index_sha256: digest('7'),
      referenced_asset_count: 24,
      qc_asset_count: 24,
    },
    minimum_client_versions: {ios: '1.0.0', android: '1.0.0'},
    gate_eligible: false,
  };
}

function digest(character) {
  return `sha256:${character.repeat(64)}`;
}
