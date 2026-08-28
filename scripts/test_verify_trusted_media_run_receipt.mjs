import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {verifyTrustedMediaRunReceipt} from './verify_trusted_media_run_receipt.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');

function validReceipt() {
  return {
    schema_version: 'trusted-media-run-receipt.v1',
    receipt_id: 'cet4-audio-20260826-run-001',
    created_at: '2026-08-26T13:00:00.000Z',
    source: {
      repository: 'LENKIN233/card-make',
      ref: 'refs/heads/main',
      commit_sha: hash('card-make-main').slice(0, 40),
      workflow_path: '.github/workflows/trusted-media-run.yml',
      workflow_sha256: hash('trusted workflow'),
    },
    execution: {
      workflow_run_id: '32939841276',
      workflow_run_attempt: 1,
      runner_class: 'self_hosted_macos_arm64',
      started_at: '2026-08-26T12:00:00.000Z',
      completed_at: '2026-08-26T12:59:00.000Z',
      model: {
        id: 'mlx-community/Qwen2-Audio-7B-Instruct-4bit',
        revision: hash('model revision').slice(0, 40),
        weights_manifest_sha256: hash('weights manifest'),
      },
      harness: {
        driver_bundle_sha256: hash('driver bundle'),
        dependency_lock_sha256: hash('dependency lock'),
      },
    },
    candidate: {
      track: 'cet4',
      card_count: 1180,
      box_count: 108,
      audio_asset_count: 301,
      content_version: `sha256:${hash('content version')}`,
      content_authorization_sha256: hash('authorization'),
      full_track_review_sha256: hash('full review'),
      quality_audit_sha256: hash('quality audit'),
    },
    artifacts: {
      audio_manifest: {sha256: hash('audio manifest'), size_bytes: 1001},
      review_worklist: {sha256: hash('worklist'), size_bytes: 1002},
      raw_run_manifest: {sha256: hash('raw runs'), size_bytes: 1003},
    },
    review_runs: [
      {
        run_id: 'qwen2-audio-run-a',
        purpose: 'full_perceptual',
        model_id: 'mlx-community/Qwen2-Audio-7B-Instruct-4bit',
        model_revision: hash('model revision').slice(0, 40),
        card_count: 301,
        complete_asset_count: 301,
        raw_output_sha256: hash('run a'),
      },
      {
        run_id: 'qwen2-audio-run-b',
        purpose: 'full_perceptual',
        model_id: 'mlx-community/Qwen2-Audio-7B-Instruct-4bit',
        model_revision: hash('model revision').slice(0, 40),
        card_count: 301,
        complete_asset_count: 301,
        raw_output_sha256: hash('run b'),
      },
      {
        run_id: 'qwen2-audio-run-f',
        purpose: 'blind_transcript',
        model_id: 'mlx-community/Qwen2-Audio-7B-Instruct-4bit',
        model_revision: hash('model revision').slice(0, 40),
        card_count: 301,
        complete_asset_count: 301,
        raw_output_sha256: hash('run f'),
      },
      {
        run_id: 'qwen2-audio-run-g',
        purpose: 'blind_transcript',
        model_id: 'mlx-community/Qwen2-Audio-7B-Instruct-4bit',
        model_revision: hash('model revision').slice(0, 40),
        card_count: 301,
        complete_asset_count: 301,
        raw_output_sha256: hash('run g'),
      },
    ],
    result: {
      reviewed_card_count: 301,
      passed_card_count: 301,
      failed_card_count: 0,
      every_card_has_two_independent_acceptances: true,
      all_assets_complete_consumed: true,
      all_required_checks_passed: true,
    },
  };
}

function writeArtifactJson(artifactDirectory, filename, value) {
  const bytes = Buffer.from(`${JSON.stringify(value)}\n`);
  fs.writeFileSync(path.join(artifactDirectory, filename), bytes);
  return {sha256: hash(bytes), size_bytes: bytes.length};
}

function createArtifactFixture(root, receipt) {
  const artifactDirectory = path.join(root, 'artifacts');
  fs.mkdirSync(artifactDirectory);
  const modelFiles = [{
    path: 'weights.safetensors',
    sha256: hash('model-weights-bytes'),
    size_bytes: 1234,
  }];
  receipt.execution.model.weights_manifest_sha256 = hash(JSON.stringify(modelFiles));
  const assets = Array.from({length: 301}, (_, index) => {
    const cardId = String(index + 1).padStart(6, '0');
    const transcript = `Trusted media transcript ${cardId}.`;
    return {
      card_id: cardId,
      asset_path: `ai_tts/cet4/0000/${cardId}.mp3`,
      file_sha256: hash(`audio-${cardId}`),
      size_bytes: 1000 + index,
      transcript_sha256: hash(transcript),
      transcript,
      entry_identity_sha256: hash(`entry-${cardId}`),
    };
  });
  receipt.artifacts.audio_manifest = writeArtifactJson(
    artifactDirectory,
    'audio-manifest.json',
    {
      schema_version: 'trusted-media-audio-manifest.v1',
      track: 'cet4',
      asset_count: 301,
      assets: assets.map(({transcript, entry_identity_sha256, ...asset}) => asset),
    },
  );
  receipt.artifacts.review_worklist = writeArtifactJson(
    artifactDirectory,
    'reviewed-worklist.json',
    {
      schema_version: 'audio-perceptual-worklist.v3',
      track: 'cet4',
      progress: {pending: 0, passed: 301, failed: 0},
      entries: assets.map(asset => ({
        card_id: asset.card_id,
        entry_identity_sha256: asset.entry_identity_sha256,
        audio: {
          asset_path: asset.asset_path,
          file_sha256: asset.file_sha256,
          size_bytes: asset.size_bytes,
          transcript: asset.transcript,
          transcript_sha256: asset.transcript_sha256,
        },
        checks: Object.fromEntries([
          'audio_matches_text',
          'target_signal_audible',
          'accurate_pronunciation',
          'suitable_speed',
          'natural_rhythm',
          'stress_and_pauses_do_not_mislead',
          'no_unwanted_noise_or_clipping',
        ].map(check => [check, 'pass'])),
        review: {
          status: 'passed',
          complete_asset_consumed: true,
          model_acceptances: [
            modelAcceptance(receipt, asset.card_id, 'af'),
            modelAcceptance(receipt, asset.card_id, 'bg'),
          ],
        },
      })),
    },
  );
  const rawRuns = [
    ['a', 'qwen2-audio-run-a', 'full_perceptual'],
    ['b', 'qwen2-audio-run-b', 'full_perceptual'],
    ['f', 'qwen2-audio-run-f', 'blind_transcript'],
    ['g', 'qwen2-audio-run-g', 'blind_transcript'],
  ].map(([name, runId, purpose]) => {
    const records = assets.map(asset => ({
      schema_version: 'trusted-media-model-run-record.v1',
      run_id: runId,
      run_name: name,
      purpose,
      temperature: ['a', 'f'].includes(name) ? 0 : 0.1,
      card_id: asset.card_id,
      entry_identity_sha256: asset.entry_identity_sha256,
      asset_path: asset.asset_path,
      asset_sha256: asset.file_sha256,
      audio_coverage: {
        decoder: 'mlx_audio.stt.utils.load_audio',
        decoded_sample_count: 16000,
        model_input_sample_count: 16000,
        model_max_sample_count: 480000,
        model_feature_frame_count: 3001,
        model_audio_token_count: 750,
        sample_rate_hz: 16000,
        truncated: false,
      },
      complete_asset_consumed: true,
      status: 'ok',
      result: purpose === 'blind_transcript'
        ? {transcript_heard: asset.transcript}
        : {
            transcript_heard: asset.transcript,
            matches_text: true,
            target_signal_audible: true,
            accurate_pronunciation: true,
            suitable_speed: true,
            natural_rhythm: true,
            stress_pauses_do_not_mislead: true,
            no_unwanted_noise_or_clipping: true,
            notes: '',
          },
      raw_outputs: ['model-output'],
      transcript_similarity: 1,
    }));
    const bytes = Buffer.from(`${records.map(record => JSON.stringify(record)).join('\n')}\n`);
    const filename = `run-${name}.jsonl`;
    fs.writeFileSync(path.join(artifactDirectory, filename), bytes);
    const sha256 = hash(bytes);
    const receiptRun = receipt.review_runs.find(run => run.run_id === runId);
    receiptRun.raw_output_sha256 = sha256;
    return {
      name,
      run_id: runId,
      purpose,
      temperature: ['a', 'f'].includes(name) ? 0 : 0.1,
      path: filename,
      sha256,
      size_bytes: bytes.length,
      card_count: 301,
      complete_asset_count: 301,
    };
  });
  receipt.artifacts.raw_run_manifest = writeArtifactJson(
    artifactDirectory,
    'raw-run-manifest.json',
    {
      schema_version: 'trusted-media-raw-run-manifest.v1',
      model: receipt.execution.model,
      runs: rawRuns,
    },
  );
  receipt.artifacts.run_package = writeArtifactJson(
    artifactDirectory,
    'run-package.json',
    {
      schema_version: 'trusted-media-model-run-package.v1',
      model: receipt.execution.model,
      execution: {
        workflow_run_id: receipt.execution.workflow_run_id,
        workflow_run_attempt: receipt.execution.workflow_run_attempt,
        runner_class: receipt.execution.runner_class,
        started_at: receipt.execution.started_at,
        completed_at: receipt.execution.completed_at,
      },
      runs: rawRuns,
      decisions: assets.map(asset => ({
        card_id: asset.card_id,
        checks: Object.fromEntries([
          'audio_matches_text',
          'target_signal_audible',
          'accurate_pronunciation',
          'suitable_speed',
          'natural_rhythm',
          'stress_and_pauses_do_not_mislead',
          'no_unwanted_noise_or_clipping',
        ].map(check => [check, true])),
        acceptance_sources: [['a', 'f'], ['b', 'g']],
      })),
      result: {reviewed_card_count: 301, passed_card_count: 301, failed_card_count: 0},
    },
  );
  receipt.artifacts.model_weights_manifest = writeArtifactJson(
    artifactDirectory,
    'model-weights-manifest.json',
    {files: modelFiles, sha256: receipt.execution.model.weights_manifest_sha256},
  );
  receipt.artifacts.mlx_audio_package_manifest = writeArtifactJson(
    artifactDirectory,
    'mlx-audio-package-manifest.json',
    {files: [{path: '__init__.py', sha256: hash('mlx-audio'), size_bytes: 10}], sha256: hash('mlx-manifest')},
  );
  receipt.artifacts.python_environment_manifest = writeArtifactJson(
    artifactDirectory,
    'python-environment-manifest.json',
    {files: [{path: 'mlx_audio/__init__.py', sha256: hash('python-env'), size_bytes: 10}], sha256: hash('python-environment-manifest')},
  );
  return artifactDirectory;
}

function modelAcceptance(receipt, cardId, sources) {
  return {
    schema_version: 'model-acceptance.v2',
    actor: {
      kind: 'model_harness',
      agent: `agent:trusted-media-${sources}`,
      model: receipt.execution.model.id,
      run_id: `${receipt.execution.workflow_run_id}:${cardId}:${sources}`,
    },
    evidence: {
      reviewed_at: receipt.execution.completed_at,
      input_sha256: `sha256:${hash(`input-${cardId}`)}`,
      capabilities: ['audio_perceptual_review'],
      summary: 'Exact test-only media acceptance.',
      findings: [],
    },
    decision: 'accepted',
  };
}

function fixture(t, receipt = validReceipt()) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trusted-media-receipt-'));
  t.after(() => fs.rmSync(root, {force: true, recursive: true}));
  const receiptPath = path.join(root, 'receipt.json');
  const bundlePath = path.join(root, 'bundle.jsonl');
  const artifactDirectory = createArtifactFixture(root, receipt);
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt)}\n`);
  fs.writeFileSync(bundlePath, '{"mediaType":"application/vnd.dev.sigstore.bundle+json;version=0.3"}\n');
  return {artifactDirectory, bundlePath, receiptPath};
}

test('valid structural receipt stays non-formal without cryptographic attestation', t => {
  const {receiptPath} = fixture(t);
  const result = verifyTrustedMediaRunReceipt({receiptPath});
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.attestation_verified, false);
  assert.equal(result.formal_ready, false);
});

test('verified exact workflow and receipt digest make the receipt formally ready', t => {
  const {artifactDirectory, bundlePath, receiptPath} = fixture(t);
  const receiptSha256 = hash(fs.readFileSync(receiptPath));
  let observedArgs = null;
  const result = verifyTrustedMediaRunReceipt({
    bundlePath,
    artifactDirectory,
    receiptPath,
    verifyAttestation: true,
    execFile(command, args) {
      assert.equal(command, 'gh');
      observedArgs = args;
      return JSON.stringify([{
        verificationResult: {
          verifiedTimestamps: [{type: 'transparency_log'}],
          statement: {subject: [{digest: {sha256: receiptSha256}}]},
        },
      }]);
    },
  });
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.attestation_verified, true);
  assert.equal(result.formal_ready, true);
  assert.ok(observedArgs.includes('--signer-workflow'));
  assert.ok(observedArgs.includes('LENKIN233/card-make/.github/workflows/trusted-media-run.yml'));
  assert.ok(observedArgs.includes('--signer-digest'));
  assert.ok(observedArgs.includes('--source-digest'));
  assert.equal(
    observedArgs.filter(value => value === validReceipt().source.commit_sha).length,
    2,
  );
  assert.ok(observedArgs.includes('--source-ref'));
  assert.ok(observedArgs.includes('refs/heads/main'));
  assert.ok(observedArgs.includes('--cert-oidc-issuer'));
  assert.ok(observedArgs.includes('https://token.actions.githubusercontent.com'));
});

test('attestation for different receipt bytes fails closed', t => {
  const {artifactDirectory, bundlePath, receiptPath} = fixture(t);
  const result = verifyTrustedMediaRunReceipt({
    bundlePath,
    artifactDirectory,
    receiptPath,
    verifyAttestation: true,
    execFile: () => JSON.stringify([{
      verificationResult: {
        verifiedTimestamps: [{type: 'transparency_log'}],
        statement: {subject: [{digest: {sha256: hash('different receipt')}}]},
      },
    }]),
  });
  assert.equal(result.ok, false);
  assert.equal(result.formal_ready, false);
  assert.match(result.errors.join('\n'), /does not bind the local receipt SHA-256/);
});

test('matching subject without a verified timestamp fails closed', t => {
  const {artifactDirectory, bundlePath, receiptPath} = fixture(t);
  const receiptSha256 = hash(fs.readFileSync(receiptPath));
  const result = verifyTrustedMediaRunReceipt({
    bundlePath,
    artifactDirectory,
    receiptPath,
    verifyAttestation: true,
    execFile: () => JSON.stringify([{
      verificationResult: {
        verifiedTimestamps: [],
        statement: {subject: [{digest: {sha256: receiptSha256}}]},
      },
    }]),
  });
  assert.equal(result.ok, false);
  assert.equal(result.formal_ready, false);
  assert.match(result.errors.join('\n'), /trusted timestamp/);
});

test('attestation cannot make a receipt formal without exact artifact recomputation', t => {
  const {bundlePath, receiptPath} = fixture(t);
  const receiptSha256 = hash(fs.readFileSync(receiptPath));
  const result = verifyTrustedMediaRunReceipt({
    bundlePath,
    receiptPath,
    verifyAttestation: true,
    execFile: () => JSON.stringify([{
      verificationResult: {
        verifiedTimestamps: [{type: 'transparency_log'}],
        statement: {subject: [{digest: {sha256: receiptSha256}}]},
      },
    }]),
  });
  assert.equal(result.formal_ready, false);
  assert.match(result.errors.join('\n'), /requires --artifact-dir/);
});

test('tampered per-asset model coverage fails before attestation can authorize media', t => {
  const {artifactDirectory, bundlePath, receiptPath} = fixture(t);
  const runPath = path.join(artifactDirectory, 'run-a.jsonl');
  const records = fs.readFileSync(runPath, 'utf8').trim().split('\n').map(JSON.parse);
  records[0].audio_coverage.model_input_sample_count -= 1;
  fs.writeFileSync(runPath, `${records.map(record => JSON.stringify(record)).join('\n')}\n`);
  const receiptSha256 = hash(fs.readFileSync(receiptPath));
  const result = verifyTrustedMediaRunReceipt({
    artifactDirectory,
    bundlePath,
    receiptPath,
    verifyAttestation: true,
    execFile: () => JSON.stringify([{
      verificationResult: {
        verifiedTimestamps: [{type: 'transparency_log'}],
        statement: {subject: [{digest: {sha256: receiptSha256}}]},
      },
    }]),
  });
  assert.equal(result.formal_ready, false);
  assert.match(result.errors.join('\n'), /bytes do not match the attested receipt identity/);
});

test('self-declared extra provider fields are rejected', t => {
  const receipt = validReceipt();
  receipt.execution.provider_verified = true;
  const {receiptPath} = fixture(t, receipt);
  const result = verifyTrustedMediaRunReceipt({receiptPath});
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /receipt.execution keys must be exactly/);
});

test('partial full runs cannot satisfy complete media consumption', t => {
  const receipt = validReceipt();
  receipt.review_runs[1].card_count = 300;
  receipt.review_runs[1].complete_asset_count = 300;
  const {receiptPath} = fixture(t, receipt);
  const result = verifyTrustedMediaRunReceipt({receiptPath});
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /full_perceptual run must cover all 301 assets/);
  assert.match(result.errors.join('\n'), /consumption count is below policy/);
});

test('a passing worklist cannot replace exact two-run acceptance', t => {
  const receipt = validReceipt();
  receipt.result.every_card_has_two_independent_acceptances = false;
  const {receiptPath} = fixture(t, receipt);
  const result = verifyTrustedMediaRunReceipt({receiptPath});
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /every_card_has_two_independent_acceptances/);
});

test('two run ids cannot reuse one raw model-output artifact', t => {
  const receipt = validReceipt();
  const {receiptPath} = fixture(t, receipt);
  receipt.review_runs[1].raw_output_sha256 =
    receipt.review_runs[0].raw_output_sha256;
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt)}\n`);
  const result = verifyTrustedMediaRunReceipt({receiptPath});
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /raw_output_sha256 is duplicated/);
});
