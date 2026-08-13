const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const {mkdtempSync, mkdirSync, rmSync, writeFileSync} = require('node:fs');
const {tmpdir} = require('node:os');
const {join, resolve} = require('node:path');
const {pathToFileURL} = require('node:url');

const {
  createSoftbookApi,
} = require('../index');

let smokeModule;

test.before(async () => {
  smokeModule = await import(
    pathToFileURL(resolve(__dirname, '../../../smoke-controlled-pilot-candidate-runtime.mjs'))
  );
});

test('candidate runtime smoke exercises an exact approved 120-card five-card round', async () => {
  const fixture = await createFixture();
  try {
    let mobileAcceptanceFixture = null;
    const report = await smokeModule.smokeControlledPilotCandidateRuntime({
      approvalPath: fixture.approvalPath,
      auditPath: fixture.auditPath,
      candidatePayloadPath: fixture.candidatePath,
      checkedAt: '2026-08-12T12:00:00.000Z',
      pilotReviewPath: fixture.reviewPath,
      captureMobileAcceptanceFixture: captured => {
        mobileAcceptanceFixture = captured;
      },
    });
    assert.equal(report.card_count, 120);
    assert.equal(report.audio_asset_count, 24);
    assert.equal(report.completed_card_ids.length, 5);
    assert.equal(report.round_completion_verified, true);
    assert.equal(report.round_continuation_verified, true);
    assert.equal(report.content_manifest_signature_verified, true);
    assert.equal(report.membership_v2_verified, true);
    assert.equal(report.human_audio_qc_verified, false);
    assert.equal(report.gate_eligible, false);
    assert.equal(
      mobileAcceptanceFixture.schema_version,
      'controlled-pilot-mobile-acceptance-fixture.v1',
    );
    assert.equal(mobileAcceptanceFixture.card_source.data.card_records.length, 120);
    assert.equal(
      mobileAcceptanceFixture.content_manifest.data.manifest.release_class,
      'controlled_pilot',
    );
    assert.equal(
      mobileAcceptanceFixture.bootstrap.data.content.release_class,
      'controlled_pilot',
    );
    assert.match(mobileAcceptanceFixture.public_key.value, /^[a-f0-9]{64}$/);
    assert.doesNotMatch(
      JSON.stringify(mobileAcceptanceFixture),
      /private_key|access_token|phone_number/i,
    );
  } finally {
    rmSync(fixture.root, {recursive: true, force: true});
  }
});

test('candidate runtime smoke rejects payload hash drift before starting the API', async () => {
  const fixture = await createFixture();
  try {
    const review = JSON.parse(fixture.reviewJson);
    review.source_records.runtime_payload_sha256 = `sha256:${'0'.repeat(64)}`;
    writeFileSync(fixture.reviewPath, JSON.stringify(review));

    await assert.rejects(
      smokeModule.smokeControlledPilotCandidateRuntime({
        approvalPath: fixture.approvalPath,
        auditPath: fixture.auditPath,
        candidatePayloadPath: fixture.candidatePath,
        checkedAt: '2026-08-12T12:00:00.000Z',
        pilotReviewPath: fixture.reviewPath,
      }),
      error =>
        error instanceof smokeModule.ControlledPilotCandidateRuntimeSmokeError &&
        /not bound/.test(error.message),
    );
  } finally {
    rmSync(fixture.root, {recursive: true, force: true});
  }
});

async function createFixture() {
  const root = mkdtempSync(join(tmpdir(), 'candidate-runtime-smoke-test-'));
  mkdirSync(root, {recursive: true});
  const candidate = await candidatePayload();
  const candidateJson = JSON.stringify(candidate);
  const candidateHash = sha256(candidateJson);
  const cardIds = candidate.card_records.map(card => card.card_id);
  const approval = {
    schema_version: 'controlled-pilot-approval.v1',
    pilot_id: 'controlled-pilot-smoke-fixture',
    content_version: candidate.content_version,
    scope: 'controlled_pilot_120',
    status: 'approved',
    approved_by_user: true,
    card_ids: cardIds,
  };
  const audit = {
    audit_version: 'card-make-quality-audit-v1',
    report_type: 'scoped_card_quality_audit',
    scope: {card_ids: [...cardIds].reverse(), missing_card_ids: []},
    scope_summary: {
      card_count: 120,
      by_severity: {hard_blocker: 0, content_risk: 0, review_gap: 0, source_risk: 120},
      by_rule: {synthetic_source: 120, unverified_source: 0},
    },
  };
  const auditJson = JSON.stringify(audit);
  const review = {
    schema_version: 'controlled-pilot-review.v1',
    status: 'user_approved',
    pilot_id: approval.pilot_id,
    content_version: candidate.content_version,
    scope: {
      track: 'cet4',
      purpose: 'controlled_pilot',
      card_count: 120,
      card_ids: [...cardIds].reverse(),
    },
    approval: {approved_by_user: true},
    source_records: {
      runtime_payload_sha256: candidateHash,
      scoped_audit_sha256: sha256(auditJson),
    },
  };
  const paths = {
    approvalPath: join(root, 'approval.json'),
    auditPath: join(root, 'audit.json'),
    candidatePath: join(root, 'candidate.json'),
    reviewPath: join(root, 'review.json'),
  };
  writeFileSync(paths.approvalPath, JSON.stringify(approval));
  writeFileSync(paths.auditPath, auditJson);
  writeFileSync(paths.candidatePath, candidateJson);
  const reviewJson = JSON.stringify(review);
  writeFileSync(paths.reviewPath, reviewJson);
  return {root, reviewJson, ...paths};
}

async function candidatePayload() {
  const api = createSoftbookApi({
    smsCode: '2468',
    tokenSecret: 'candidate-smoke-fixture-secret',
  });
  const request = input => api.handleHttpRequest({headers: {}, query: {}, ...input});
  const challenge = await request({
    body: {phone_number: '13800138000'},
    clientIp: '127.0.0.1',
    method: 'POST',
    path: '/v2/auth/request-code',
  });
  const verified = await request({
    body: {
      challenge_id: challenge.body.data.challenge_id,
      phone_number: '13800138000',
      sms_code: '2468',
    },
    clientIp: '127.0.0.1',
    method: 'POST',
    path: '/v2/auth/verify-code',
  });
  const response = await request({
    headers: {authorization: `Bearer ${verified.body.data.access_token}`},
    method: 'GET',
    path: '/v1/learning/card-source',
    query: {track: 'cet4'},
  });
  const templates = response.body.data.card_records;
  const cards = Array.from({length: 120}, (_, index) => {
    const template = templates[index % templates.length];
    const suffix = String(Math.floor(index / templates.length) + 1).padStart(2, '0');
    return {...structuredClone(template), card_id: `${template.knowledge_ref}${suffix}`};
  });
  const assets = Array.from({length: 24}, (_, index) => {
    const assetId = `fixture-audio-${String(index + 1).padStart(2, '0')}`;
    const digest = crypto
      .createHash('sha256')
      .update(assetId)
      .digest('hex');
    const audio = {
      asset_id: assetId,
      duration_ms: 1000 + index,
      sha256: `sha256:${digest}`,
    };
    cards[index] = {...cards[index], audio};
    return {
      ...audio,
      asset_path: `audio/${assetId}.mp3`,
      media_type: 'audio/mpeg',
      size_bytes: 2000 + index,
    };
  });
  const {validateCardSourceForReleaseBundle} = require('../index');
  return validateCardSourceForReleaseBundle(
    {
      assets,
      card_records: cards,
      source: {id: 'fixture-source', label: 'Fixture source'},
      track: 'cet4',
    },
    'cet4',
  );
}

function sha256(value) {
  return `sha256:${crypto.createHash('sha256').update(value).digest('hex')}`;
}
