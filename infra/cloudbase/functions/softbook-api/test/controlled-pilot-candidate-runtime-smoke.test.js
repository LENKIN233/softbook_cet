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
let modelContract;
let catalog;

test.before(async () => {
  smokeModule = await import(
    pathToFileURL(resolve(__dirname, '../../../smoke-controlled-pilot-candidate-runtime.mjs'))
  );
  modelContract = await import(
    pathToFileURL(resolve(__dirname, '../../../../../scripts/lib/model_acceptance_contract.mjs'))
  );
  catalog = await import(
    pathToFileURL(resolve(__dirname, '../../../card-source-catalog.mjs'))
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
    assert.equal(report.model_audio_qc_verified, false);
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

test('candidate runtime smoke rejects duplicated model authorization runs', async () => {
  const fixture = await createFixture();
  try {
    const approval = JSON.parse(require('node:fs').readFileSync(fixture.approvalPath, 'utf8'));
    approval.model_acceptances[1] = structuredClone(approval.model_acceptances[0]);
    writeFileSync(fixture.approvalPath, JSON.stringify(approval));
    await assert.rejects(
      smokeModule.smokeControlledPilotCandidateRuntime({
        approvalPath: fixture.approvalPath,
        auditPath: fixture.auditPath,
        candidatePayloadPath: fixture.candidatePath,
        checkedAt: '2026-08-12T12:00:00.000Z',
        pilotReviewPath: fixture.reviewPath,
      }),
      /run IDs must be distinct/,
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
  const boxPrefixes = [...new Set(candidate.card_records.map(card => card.knowledge_ref))];
  const auditCorpusFingerprint = sha256('controlled-pilot-smoke-corpus');
  const audit = {
    audit_version: 'card-make-quality-audit-v1',
    corpus_fingerprint: {digest: auditCorpusFingerprint.slice('sha256:'.length)},
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
    schema_version: 'controlled-pilot-review.v2',
    review_id: 'controlled-pilot-smoke-review',
    created_at: '2026-08-12T10:00:00+08:00',
    status: 'ready_for_model_authorization',
    pilot_id: 'controlled-pilot-smoke-fixture',
    content_version: candidate.content_version,
    scope: {
      track: 'cet4',
      purpose: 'controlled_pilot',
      card_count: 120,
      box_prefixes: [...boxPrefixes].reverse(),
      card_ids: [...cardIds].reverse(),
    },
    source_records: {
      runtime_payload: 'exports/candidate.json',
      runtime_payload_sha256: candidateHash,
      model_reviews: ['reviews/agent_self_review/pilot-model-review.json'],
      scoped_audit: 'reviews/audit_scopes/pilot-audit.json',
      scoped_audit_sha256: sha256(auditJson),
    },
    coverage: {
      reviewed_cards: 120,
      boxes: boxPrefixes.map(boxPrefix => ({
        box_prefix: boxPrefix,
        card_ids: cardIds.filter(cardId =>
          candidate.card_records.find(card => card.card_id === cardId).knowledge_ref === boxPrefix),
        status: 'passed',
      })),
    },
    quality: {
      corpus_fingerprint: auditCorpusFingerprint,
      hard_blockers: 0,
      content_risks: 0,
      review_gaps: 0,
      source_risks: 120,
      synthetic_source_cards: 120,
      source_disclosure: 'synthetic_training_content_not_true_exam',
    },
    authorization: {
      model_acceptance: null,
      authorized_at: null,
      artifact_path: null,
    },
    authorization_boundary: {
      audio_qc_required_separately: true,
      pilot_publication_required_separately: true,
      external_facts_must_not_be_inferred: true,
      gate_eligible: false,
    },
  };
  const paths = {
    approvalPath: join(root, 'approval.json'),
    auditPath: join(root, 'audit.json'),
    candidatePath: join(root, 'candidate.json'),
    reviewPath: join(root, 'review.json'),
  };
  writeFileSync(paths.auditPath, auditJson);
  writeFileSync(paths.candidatePath, candidateJson);
  const reviewJson = JSON.stringify(review);
  writeFileSync(paths.reviewPath, reviewJson);
  const reviewHash = sha256(reviewJson);
  const acceptanceInput = modelContract.buildModelAcceptanceInputSha256({
    decisionType: 'controlled_pilot_authorization',
    scope: review.scope,
    corpusFingerprint: auditCorpusFingerprint,
    auditSha256: sha256(auditJson),
    linkedReviewIdentity: {
      path: 'reviews/controlled_pilot_reviews/pilot-review.json',
      sha256: reviewHash,
    },
    additionalBindings: {
      pilot_id: review.pilot_id,
      content_version: candidate.content_version,
      runtime_payload_sha256: candidateHash,
    },
  });
  const modelAcceptance = runId => ({
    schema_version: 'model-acceptance.v2',
    actor: {
      kind: 'model_harness',
      agent: `agent:${runId}`,
      model: 'gpt-5.6-sol',
      run_id: runId,
    },
    evidence: {
      reviewed_at: '2026-08-12T10:30:00+08:00',
      input_sha256: acceptanceInput,
      capabilities: ['content_authorization'],
      summary: 'Independent exact-scope pilot authorization.',
      findings: [],
    },
    decision: 'accepted',
  });
  const approval = {
    schema_version: 'controlled-pilot-authorization.v2',
    pilot_id: review.pilot_id,
    content_version: candidate.content_version,
    scope: 'controlled_pilot_120',
    status: 'authorized',
    authorized_at: '2026-08-12T10:30:00+08:00',
    model_acceptances: [modelAcceptance('pilot-review-a'), modelAcceptance('pilot-review-b')],
    review: 'reviews/controlled_pilot_reviews/pilot-review.json',
    review_sha256: reviewHash,
    runtime_payload_sha256: candidateHash,
    scoped_audit_sha256: sha256(auditJson),
    card_ids: cardIds,
  };
  writeFileSync(paths.approvalPath, JSON.stringify(approval));
  return {root, reviewJson, ...paths};
}

async function candidatePayload() {
  const api = createSoftbookApi({
    runtimeMode: 'development',
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
  const purchased = await request({
    body: {phone_number: '13800138000'},
    headers: {authorization: `Bearer ${verified.body.data.access_token}`},
    method: 'POST',
    path: '/v1/membership/purchase',
  });
  assert.equal(purchased.statusCode, 200);
  const response = await request({
    headers: {authorization: `Bearer ${verified.body.data.access_token}`},
    method: 'GET',
    path: '/v1/learning/card-source',
    query: {track: 'cet4'},
  });
  const templates = response.body.data.card_records;
  const catalogEntries = [...catalog.catalogEntriesByRef(catalog.loadBoxCatalog(), 'cet4')]
    .slice(0, 14);
  assert.equal(catalogEntries.length, 14);
  const cards = Array.from({length: 120}, (_, index) => {
    const template = templates[index % templates.length];
    const [knowledgeRef, metadata] = catalogEntries[index % catalogEntries.length];
    const suffix = String(Math.floor(index / catalogEntries.length) + 1).padStart(2, '0');
    return {
      ...structuredClone(template),
      card_id: `${knowledgeRef}${suffix}`,
      knowledge_ref: knowledgeRef,
      space_metadata: {
        library: metadata.library,
        group: metadata.group,
        box: metadata.box,
        box_ref: knowledgeRef,
      },
    };
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
