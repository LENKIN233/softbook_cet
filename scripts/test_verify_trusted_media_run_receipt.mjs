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

function fixture(t, receipt = validReceipt()) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trusted-media-receipt-'));
  t.after(() => fs.rmSync(root, {force: true, recursive: true}));
  const receiptPath = path.join(root, 'receipt.json');
  const bundlePath = path.join(root, 'bundle.jsonl');
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt)}\n`);
  fs.writeFileSync(bundlePath, '{"mediaType":"application/vnd.dev.sigstore.bundle+json;version=0.3"}\n');
  return {bundlePath, receiptPath};
}

test('valid structural receipt stays non-formal without cryptographic attestation', t => {
  const {receiptPath} = fixture(t);
  const result = verifyTrustedMediaRunReceipt({receiptPath});
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.attestation_verified, false);
  assert.equal(result.formal_ready, false);
});

test('verified exact workflow and receipt digest make the receipt formally ready', t => {
  const {bundlePath, receiptPath} = fixture(t);
  const receiptSha256 = hash(fs.readFileSync(receiptPath));
  let observedArgs = null;
  const result = verifyTrustedMediaRunReceipt({
    bundlePath,
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
  const {bundlePath, receiptPath} = fixture(t);
  const result = verifyTrustedMediaRunReceipt({
    bundlePath,
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
  const {bundlePath, receiptPath} = fixture(t);
  const receiptSha256 = hash(fs.readFileSync(receiptPath));
  const result = verifyTrustedMediaRunReceipt({
    bundlePath,
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
  receipt.review_runs[1].raw_output_sha256 =
    receipt.review_runs[0].raw_output_sha256;
  const {receiptPath} = fixture(t, receipt);
  const result = verifyTrustedMediaRunReceipt({receiptPath});
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /raw_output_sha256 is duplicated/);
});
