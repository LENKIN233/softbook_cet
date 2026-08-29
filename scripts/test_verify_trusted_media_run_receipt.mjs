import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
  sequenceMatcherRatio,
  validateAudioCoverage,
  verifyTrustedMediaRunReceipt,
} from './verify_trusted_media_run_receipt.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');

test('product verifier preserves phonetic spelling without accepting omitted clauses', () => {
  assert.ok(
    sequenceMatcherRatio(
      'Listen to turn off the light, where n links into off and sounds closer to tur noff in natural speed.',
      "Listen to turn off the light. We're in links into off and sounds closer to turn off in natural speed.",
    ) >= 0.85,
  );
  assert.ok(
    sequenceMatcherRatio(
      'In put it on, the final t of put links forward, so the phrase is heard as pu ti ton in connected speech.',
      'In put it on, the final T of put links forward so the phrase is heard as P U T I-T O N in connected speech.',
    ) >= 0.85,
  );
  assert.ok(
    sequenceMatcherRatio(
      'The initial feedback seemed positive; however, several users reported serious security concerns.',
      'The initial feedback seemed positive.',
    ) < 0.85,
  );
});

function cet4RuntimeCatalog() {
  const document = JSON.parse(fs.readFileSync(
    path.resolve(import.meta.dirname, '../spec/box-catalog.json'),
  ));
  return new Map(document.libraries.flatMap(library =>
    library.groups.flatMap(group => group.boxes.flatMap(box => {
      const prefix = box.resolved_box_prefixes?.cet4;
      return prefix ? [[prefix, {
        library: library.name,
        group: group.name,
        box: box.name,
      }]] : [];
    }))));
}

function validReceipt() {
  return {
    schema_version: 'trusted-media-run-receipt.v2',
    receipt_id: 'cet4-audio-20260826-run-001',
    created_at: '2026-08-26T13:00:00.000Z',
    source: {
      repository: 'LENKIN233/card-make',
      ref: 'refs/heads/main',
      commit_sha: hash('card-make-main').slice(0, 40),
      workflow_path: '.github/workflows/trusted-media-run.yml',
      workflow_sha256: hash('trusted workflow'),
    },
    finalization: {
      repository: 'LENKIN233/card-make',
      ref: 'refs/heads/main',
      commit_sha: hash('card-make-finalizer').slice(0, 40),
      workflow_path: '.github/workflows/trusted-media-run.yml',
      workflow_sha256: hash('trusted finalizer workflow'),
      retained_raw_artifact: {
        workflow_run_id: '32939841276',
        workflow_run_attempt: 1,
        artifact_name: 'trusted-media-raw-32939841276-1',
      },
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
        mlx_audio_package_manifest_sha256: hash('mlx manifest'),
        python_environment_manifest_sha256: hash('python environment manifest'),
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
  const catalog = cet4RuntimeCatalog();
  const prefixes = [...catalog.keys()];
  const assets = Array.from({length: 301}, (_, index) => {
    const boxPrefix = prefixes[index % prefixes.length];
    const suffix = String(Math.floor(index / prefixes.length) + 1).padStart(2, '0');
    const cardId = `${boxPrefix}${suffix}`;
    const transcript = `Trusted media transcript ${cardId}.`;
    const assetPath = `ai_tts/cet4/${boxPrefix}/${cardId}.mp3`;
    const audioBytes = Buffer.from(`audio-${cardId}`);
    const absoluteAssetPath = path.join(artifactDirectory, assetPath);
    fs.mkdirSync(path.dirname(absoluteAssetPath), {recursive: true});
    fs.writeFileSync(absoluteAssetPath, audioBytes);
    const identity = {
      card_id: cardId,
      card_source_file: 'card_boxes_json/cet4-listening.json',
      knowledge_ref: {
        library_id: '0',
        library_name: '听力',
        group_id: '0',
        group_name: '测试',
        box_id: '0',
        box_name: '测试盒',
        box_prefix: boxPrefix,
      },
      training_context: {
        main_training_goal: '完整听取音频',
        box_progression_role: 'recognition',
      },
      audio: {
        asset_path: assetPath,
        file_sha256: hash(audioBytes),
        size_bytes: audioBytes.length,
        declared_duration_ms: 1000,
        probed_duration_ms: 1000,
        transcript,
        transcript_sha256: hash(transcript),
      },
    };
    return {
      ...identity.audio,
      card_id: cardId,
      card_source_file: identity.card_source_file,
      knowledge_ref: identity.knowledge_ref,
      training_context: identity.training_context,
      entry_identity_sha256: hash(canonicalStringify(identity)),
    };
  });
  receipt.artifacts.audio_manifest = writeArtifactJson(
    artifactDirectory,
    'audio-manifest.json',
    {
      schema_version: 'trusted-media-audio-manifest.v1',
      track: 'cet4',
      asset_count: 301,
      assets: assets.map(({
        card_source_file,
        declared_duration_ms,
        entry_identity_sha256,
        knowledge_ref,
        probed_duration_ms,
        training_context,
        transcript,
        ...asset
      }) => asset),
    },
  );
  receipt.artifacts.review_worklist = writeArtifactJson(
    artifactDirectory,
    'reviewed-worklist.json',
    {
      schema_version: 'audio-perceptual-worklist.v3',
      track: 'cet4',
      progress: {pending: 0, passed: 301, failed: 0},
      entries: assets.map((asset, index) => ({
        sequence: index + 1,
        card_id: asset.card_id,
        card_source_file: asset.card_source_file,
        entry_identity_sha256: asset.entry_identity_sha256,
        knowledge_ref: asset.knowledge_ref,
        training_context: asset.training_context,
        audio: {
          asset_path: asset.asset_path,
          file_sha256: asset.file_sha256,
          size_bytes: asset.size_bytes,
          declared_duration_ms: asset.declared_duration_ms,
          probed_duration_ms: asset.probed_duration_ms,
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
            modelAcceptance(receipt, asset, 'af'),
            modelAcceptance(receipt, asset, 'bg'),
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
      raw_outputs: [],
      transcript_similarity: 1,
    }));
    for (const record of records) {
      const rawResult = structuredClone(record.result);
      if (['full_perceptual', 'adjudication'].includes(purpose)) {
        delete rawResult.notes;
      }
      record.raw_outputs = [JSON.stringify(rawResult)];
    }
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
  const mlxFiles = [{path: '__init__.py', sha256: hash('mlx-audio'), size_bytes: 10}];
  receipt.execution.harness.mlx_audio_package_manifest_sha256 =
    hash(canonicalStringify(mlxFiles));
  receipt.artifacts.mlx_audio_package_manifest = writeArtifactJson(
    artifactDirectory,
    'mlx-audio-package-manifest.json',
    {files: mlxFiles, sha256: receipt.execution.harness.mlx_audio_package_manifest_sha256},
  );
  const pythonFiles = [{
    path: 'mlx_audio/__init__.py',
    sha256: hash('python-env'),
    size_bytes: 10,
  }];
  receipt.execution.harness.python_environment_manifest_sha256 =
    hash(canonicalStringify(pythonFiles));
  receipt.artifacts.python_environment_manifest = writeArtifactJson(
    artifactDirectory,
    'python-environment-manifest.json',
    {
      schema_version: 'trusted-media-tree-manifest.v2',
      files: pythonFiles.map(entry => [entry.path, entry.size_bytes, entry.sha256]),
      sha256: receipt.execution.harness.python_environment_manifest_sha256,
    },
  );
  const authorizationPath = writeCandidateEvidence(root, receipt, assets);
  return {artifactDirectory, authorizationPath};
}

function writeCandidateEvidence(root, receipt, assets) {
  const catalog = cet4RuntimeCatalog();
  const fillerPrefixes = [...catalog.keys()].filter(prefix => prefix !== '0000');
  const reviewedCards = assets.map(asset => ({
    card_id: asset.card_id,
    knowledge_ref: asset.knowledge_ref,
    quality_metadata: {
      main_training_goal: asset.training_context.main_training_goal,
      box_progression_role: asset.training_context.box_progression_role,
    },
    audio: {path: asset.asset_path, transcript: asset.transcript},
  }));
  const fillerCards = Array.from({length: 879}, (_, index) => {
    const boxPrefix = fillerPrefixes[index % fillerPrefixes.length];
    const catalogEntry = catalog.get(boxPrefix);
    const suffix = String(Math.floor(index / fillerPrefixes.length) + 10).padStart(2, '0');
    const cardId = `${boxPrefix}${suffix}`;
    return {
      card_id: cardId,
      knowledge_ref: {
        library_id: '1',
        library_name: catalogEntry.library,
        group_id: '1',
        group_name: catalogEntry.group,
        box_id: boxPrefix,
        box_name: catalogEntry.box,
        box_prefix: boxPrefix,
      },
      quality_metadata: {
        main_training_goal: '测试正式内容绑定',
        box_progression_role: 'recognition',
      },
      prompt: `Candidate card ${cardId}`,
    };
  });
  const cards = [...reviewedCards, ...fillerCards];
  const sourcePath = path.join(root, 'card_boxes_json/cet4-listening.json');
  fs.mkdirSync(path.dirname(sourcePath), {recursive: true});
  fs.writeFileSync(sourcePath, `${JSON.stringify({track: 'cet4', cards})}\n`);
  const assetByCard = new Map(assets.map(asset => [asset.card_id, asset]));
  const runtimeAssets = assets.map(asset => ({
    asset_id: `cet4-${asset.card_id}-audio`,
    asset_path: `audio/cet4/${asset.card_id.slice(0, 4)}/${asset.card_id}.mp3`,
    duration_ms: asset.declared_duration_ms,
    media_type: 'audio/mpeg',
    sha256: `sha256:${asset.file_sha256}`,
    size_bytes: asset.size_bytes,
  }));
  const runtimeCards = cards.map(card => {
    const asset = assetByCard.get(card.card_id);
    const catalogEntry = catalog.get(card.knowledge_ref.box_prefix);
    return {
      card_id: card.card_id,
      track: 'cet4',
      knowledge_ref: card.knowledge_ref.box_prefix,
      interaction_id: 'flip',
      front: {eyebrow: '测试', prompt: '测试', support: '测试', context: '测试'},
      analysis: {title: '测试', summary: '测试', exam_tip: '测试'},
      space_metadata: {
        box_ref: card.knowledge_ref.box_prefix,
        library: catalogEntry.library,
        group: catalogEntry.group,
        box: catalogEntry.box,
      },
      back_text: '测试',
      ...(asset ? {
        audio: {
          asset_id: `cet4-${card.card_id}-audio`,
          duration_ms: asset.declared_duration_ms,
          sha256: `sha256:${asset.file_sha256}`,
          transcript: asset.transcript,
        },
      } : {}),
    };
  });
  const runtime = {
    source: {id: 'trusted-media-test', label: 'Trusted media test'},
    track: 'cet4',
    card_records: runtimeCards,
    assets: runtimeAssets,
    release: null,
  };
  runtime.content_version = runtimeContentVersion(runtime);
  const runtimePath = path.join(root, 'reviews/runtime_payloads/candidate.json');
  fs.mkdirSync(path.dirname(runtimePath), {recursive: true});
  const runtimeBytes = Buffer.from(`${JSON.stringify(runtime)}\n`);
  fs.writeFileSync(runtimePath, runtimeBytes);
  const reviewPath = path.join(root, 'reviews/agent_self_review/candidate.json');
  const auditPath = path.join(root, 'reviews/audit_scopes/candidate.json');
  fs.mkdirSync(path.dirname(reviewPath), {recursive: true});
  fs.mkdirSync(path.dirname(auditPath), {recursive: true});
  const reviewBytes = Buffer.from('{"schema_version":"model-owned-full-track-review.v2"}\n');
  const auditBytes = Buffer.from('{"ok":true}\n');
  fs.writeFileSync(reviewPath, reviewBytes);
  fs.writeFileSync(auditPath, auditBytes);
  const authorization = {
    schema_version: 'model-owned-content-authorization.v2',
    authorization_mode: 'full_track',
    content_version: runtime.content_version,
    scope: {
      track: 'cet4',
      purpose: 'formal_content',
      card_ids: cards.map(card => card.card_id),
      box_prefixes: [...new Set(cards.map(card => card.knowledge_ref.box_prefix))].sort(),
    },
    card_quality_audit: {
      report: 'reviews/audit_scopes/candidate.json',
      report_sha256: `sha256:${hash(auditBytes)}`,
    },
    validation: {
      model_review: 'reviews/agent_self_review/candidate.json',
      model_review_sha256: `sha256:${hash(reviewBytes)}`,
      runtime_payload: 'reviews/runtime_payloads/candidate.json',
      runtime_payload_sha256: `sha256:${hash(runtimeBytes)}`,
    },
  };
  const authorizationPath = path.join(root, 'reviews/approved_batches/candidate.json');
  fs.mkdirSync(path.dirname(authorizationPath), {recursive: true});
  const authorizationBytes = Buffer.from(`${JSON.stringify(authorization)}\n`);
  fs.writeFileSync(authorizationPath, authorizationBytes);
  receipt.candidate.content_version = runtime.content_version;
  receipt.candidate.content_authorization_sha256 = hash(authorizationBytes);
  receipt.candidate.full_track_review_sha256 = hash(reviewBytes);
  receipt.candidate.quality_audit_sha256 = hash(auditBytes);
  return authorizationPath;
}

function runtimeContentVersion(runtime) {
  return `sha256:${hash(canonicalStringify({
    assets: runtime.assets.map(asset => ({
      asset_id: asset.asset_id,
      duration_ms: asset.duration_ms,
      media_type: asset.media_type,
      sha256: asset.sha256,
      size_bytes: asset.size_bytes,
    })).sort((left, right) => left.asset_id.localeCompare(right.asset_id)),
    card_records: runtime.card_records,
    source: runtime.source,
    track: runtime.track,
  }))}`;
}

function rebindCandidateRuntime(fixtureValue, receipt, mutate) {
  const runtimePath = path.join(
    fixtureValue.candidateRoot,
    'reviews/runtime_payloads/candidate.json',
  );
  const authorizationPath = fixtureValue.authorizationPath;
  const runtime = JSON.parse(fs.readFileSync(runtimePath));
  mutate(runtime);
  runtime.content_version = runtimeContentVersion(runtime);
  const runtimeBytes = Buffer.from(`${JSON.stringify(runtime)}\n`);
  fs.writeFileSync(runtimePath, runtimeBytes);
  const authorization = JSON.parse(fs.readFileSync(authorizationPath));
  authorization.content_version = runtime.content_version;
  authorization.validation.runtime_payload_sha256 = `sha256:${hash(runtimeBytes)}`;
  const authorizationBytes = Buffer.from(`${JSON.stringify(authorization)}\n`);
  fs.writeFileSync(authorizationPath, authorizationBytes);
  receipt.candidate.content_version = runtime.content_version;
  receipt.candidate.content_authorization_sha256 = hash(authorizationBytes);
}

function modelAcceptance(receipt, asset, sources) {
  const checks = Object.fromEntries([
    'audio_matches_text',
    'target_signal_audible',
    'accurate_pronunciation',
    'suitable_speed',
    'natural_rhythm',
    'stress_and_pauses_do_not_mislead',
    'no_unwanted_noise_or_clipping',
  ].map(check => [check, 'pass']));
  const inputSha256 = `sha256:${hash(canonicalStringify({
    schema_version: 'audio-perceptual-decision-input.v1',
    entry_identity_sha256: asset.entry_identity_sha256,
    complete_asset_consumed: true,
    checks,
  }))}`;
  return {
    schema_version: 'model-acceptance.v2',
    actor: {
      kind: 'model_harness',
      agent: `agent:trusted-media-${sources}`,
      model: receipt.execution.model.id,
      run_id: `${receipt.execution.workflow_run_id}:${asset.card_id}:${sources}`,
    },
    evidence: {
      reviewed_at: receipt.execution.completed_at,
      input_sha256: inputSha256,
      capabilities: ['audio_perceptual_review'],
      summary: 'Exact test-only media acceptance.',
      findings: [],
    },
    decision: 'accepted',
  };
}

function canonicalStringify(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key =>
      `${JSON.stringify(key)}:${canonicalStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function fixture(t, receipt = validReceipt()) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'trusted-media-receipt-'));
  t.after(() => fs.rmSync(root, {force: true, recursive: true}));
  const receiptPath = path.join(root, 'receipt.json');
  const bundlePath = path.join(root, 'bundle.jsonl');
  const candidate = createArtifactFixture(root, receipt);
  const artifactDirectory = candidate.artifactDirectory;
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt)}\n`);
  fs.writeFileSync(bundlePath, '{"mediaType":"application/vnd.dev.sigstore.bundle+json;version=0.3"}\n');
  return {
    artifactDirectory,
    authorizationPath: candidate.authorizationPath,
    bundlePath,
    candidateRoot: root,
    receiptPath,
  };
}

test('valid structural receipt stays non-formal without cryptographic attestation', t => {
  const {receiptPath} = fixture(t);
  const result = verifyTrustedMediaRunReceipt({receiptPath});
  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.attestation_verified, false);
  assert.equal(result.formal_ready, false);
});

test('decoded samples must cover the bound probed media duration', () => {
  const policy = JSON.parse(fs.readFileSync(
    path.resolve(import.meta.dirname, '../spec/trusted-media-run-receipt.json'),
  ));
  const errors = [];
  validateAudioCoverage({
    decoder: 'mlx_audio.stt.utils.load_audio',
    decoded_sample_count: 16000,
    model_input_sample_count: 16000,
    model_max_sample_count: 480000,
    model_feature_frame_count: 3001,
    model_audio_token_count: 750,
    sample_rate_hz: 16000,
    truncated: false,
  }, policy, 'fixture coverage', errors, 10000);
  assert.match(errors.join('\n'), /complete untruncated model input/);
});

test('retained raw-output replay uses the same no-autojunk transcript similarity', () => {
  const output = execFileSync(
    'python3',
    [
      '-c',
      [
        'from scripts.replay_trusted_media_raw_outputs import similarity',
        "left = ' '.join(['the','cat','sat','on','mat'] * 40)",
        "right = ' '.join((['the','cat','sat','on','mat'] * 20) + ['different'] * 5 + (['the','cat','sat','on','mat'] * 19))",
        'print(similarity(left, right))',
      ].join('; '),
    ],
    {cwd: path.resolve(import.meta.dirname, '..'), encoding: 'utf8'},
  );
  assert.ok(Number(output.trim()) > 0.9);
});

test('verified exact workflow and receipt digest make the receipt formally ready', t => {
  const {artifactDirectory, authorizationPath, bundlePath, candidateRoot, receiptPath} = fixture(t);
  const receiptSha256 = hash(fs.readFileSync(receiptPath));
  let observedArgs = null;
  const result = verifyTrustedMediaRunReceipt({
    bundlePath,
    artifactDirectory,
    authorizationPath,
    receiptPath,
    candidateRoot,
    probeMediaDuration: () => 1000,
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
    observedArgs.filter(value => value === validReceipt().finalization.commit_sha).length,
    2,
  );
  assert.ok(observedArgs.includes('--source-ref'));
  assert.ok(observedArgs.includes('refs/heads/main'));
  assert.ok(observedArgs.includes('--cert-oidc-issuer'));
  assert.ok(observedArgs.includes('https://token.actions.githubusercontent.com'));
});

test('verified receipt identity can be reused by a separate type-specific evidence validator', t => {
  const {bundlePath, receiptPath} = fixture(t);
  const receiptSha256 = hash(fs.readFileSync(receiptPath));
  const result = verifyTrustedMediaRunReceipt({
    bundlePath,
    execFile: () => JSON.stringify([
      {
        verificationResult: {
          statement: {subject: [{digest: {sha256: receiptSha256}}]},
          verifiedTimestamps: [{timestamp: '2026-08-29T18:11:00.000Z'}],
        },
      },
    ]),
    receiptPath,
    requireArtifactEvidence: false,
    verifyAttestation: true,
  });

  assert.equal(result.ok, true, result.errors.join('\n'));
  assert.equal(result.identity_ready, true);
  assert.equal(result.attestation_verified, true);
  assert.equal(result.artifacts_verified, false);
  assert.equal(result.formal_ready, false);
});

test('attestation for different receipt bytes fails closed', t => {
  const {artifactDirectory, authorizationPath, bundlePath, candidateRoot, receiptPath} = fixture(t);
  const result = verifyTrustedMediaRunReceipt({
    bundlePath,
    artifactDirectory,
    authorizationPath,
    receiptPath,
    candidateRoot,
    probeMediaDuration: () => 1000,
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
  const {artifactDirectory, authorizationPath, bundlePath, candidateRoot, receiptPath} = fixture(t);
  const receiptSha256 = hash(fs.readFileSync(receiptPath));
  const result = verifyTrustedMediaRunReceipt({
    bundlePath,
    artifactDirectory,
    authorizationPath,
    receiptPath,
    candidateRoot,
    probeMediaDuration: () => 1000,
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

test('non-decodable media bytes cannot become formal through matching hashes', t => {
  const receipt = validReceipt();
  const fixtureValue = fixture(t, receipt);
  fs.writeFileSync(fixtureValue.receiptPath, `${JSON.stringify(receipt)}\n`);
  const receiptSha256 = hash(fs.readFileSync(fixtureValue.receiptPath));
  const result = verifyTrustedMediaRunReceipt({
    artifactDirectory: fixtureValue.artifactDirectory,
    authorizationPath: fixtureValue.authorizationPath,
    bundlePath: fixtureValue.bundlePath,
    candidateRoot: fixtureValue.candidateRoot,
    receiptPath: fixtureValue.receiptPath,
    verifyAttestation: true,
    probeMediaDuration: () => {
      throw new Error('non-decodable MP3');
    },
    execFile: () => JSON.stringify([{
      verificationResult: {
        verifiedTimestamps: [{type: 'transparency_log'}],
        statement: {subject: [{digest: {sha256: receiptSha256}}]},
      },
    }]),
  });
  assert.equal(result.formal_ready, false);
  assert.match(result.errors.join('\n'), /cannot be decoded and duration-probed/);
});

test('attested arbitrary candidate hashes cannot replace exact authorization bytes', t => {
  const receipt = validReceipt();
  const fixtureValue = fixture(t, receipt);
  receipt.candidate.content_authorization_sha256 = hash('unrelated authorization');
  const result = verifyAttested(fixtureValue, receipt);
  assert.equal(result.formal_ready, false);
  assert.match(result.errors.join('\n'), /authorization does not match the receipt candidate/);
});

test('runtime audio cards must own the exact asset catalog one to one', t => {
  const receipt = validReceipt();
  const fixtureValue = fixture(t, receipt);
  rebindCandidateRuntime(fixtureValue, receipt, runtime => {
    runtime.card_records[1].audio.asset_id = runtime.card_records[0].audio.asset_id;
  });
  const result = verifyAttested(fixtureValue, receipt);
  assert.equal(result.formal_ready, false);
  assert.match(result.errors.join('\n'), /own the exact 301-asset catalog/);
});

test('transformed audio runtime space metadata must match the canonical catalog', t => {
  const receipt = validReceipt();
  const fixtureValue = fixture(t, receipt);
  rebindCandidateRuntime(fixtureValue, receipt, runtime => {
    runtime.card_records[0].space_metadata.group = '错误分组';
  });
  const result = verifyAttested(fixtureValue, receipt);
  assert.equal(result.formal_ready, false);
  assert.match(result.errors.join('\n'), /does not match the CET4 box catalog/);
});

test('all transformed runtime cards must match the canonical box catalog', t => {
  const receipt = validReceipt();
  const fixtureValue = fixture(t, receipt);
  rebindCandidateRuntime(fixtureValue, receipt, runtime => {
    runtime.card_records.find(card => !card.audio).space_metadata.group = '错误分组';
  });
  const result = verifyAttested(fixtureValue, receipt);
  assert.equal(result.formal_ready, false);
  assert.match(result.errors.join('\n'), /does not match the CET4 box catalog/);
});

test('runtime asset IDs must retain the canonical nonempty card binding', t => {
  const receipt = validReceipt();
  const fixtureValue = fixture(t, receipt);
  rebindCandidateRuntime(fixtureValue, receipt, runtime => {
    const prior = runtime.card_records[0].audio.asset_id;
    runtime.card_records[0].audio.asset_id = '';
    runtime.assets.find(asset => asset.asset_id === prior).asset_id = '';
  });
  const result = verifyAttested(fixtureValue, receipt);
  assert.equal(result.formal_ready, false);
  assert.match(result.errors.join('\n'), /1180-card\/108-box candidate/);
});

test('runtime card IDs must retain their four-digit catalog prefix', t => {
  const receipt = validReceipt();
  const fixtureValue = fixture(t, receipt);
  rebindCandidateRuntime(fixtureValue, receipt, runtime => {
    const catalog = cet4RuntimeCatalog();
    const card = runtime.card_records.find(candidate => !candidate.audio);
    const replacement = [...catalog.entries()].find(([prefix]) =>
      prefix !== card.card_id.slice(0, 4));
    card.knowledge_ref = replacement[0];
    card.space_metadata = {box_ref: replacement[0], ...replacement[1]};
  });
  const result = verifyAttested(fixtureValue, receipt);
  assert.equal(result.formal_ready, false);
  assert.match(result.errors.join('\n'), /does not match the CET4 box catalog/);
});

test('runtime asset delivery path must derive from its owning card', t => {
  const receipt = validReceipt();
  const fixtureValue = fixture(t, receipt);
  rebindCandidateRuntime(fixtureValue, receipt, runtime => {
    runtime.assets[0].asset_path = 'audio/cet4/9999/000001.mp3';
  });
  const result = verifyAttested(fixtureValue, receipt);
  assert.equal(result.formal_ready, false);
  assert.match(result.errors.join('\n'), /does not bind the authorized candidate card/);
});

test('audio manifest rejects one media path reused by different cards', t => {
  const receipt = validReceipt();
  const fixtureValue = fixture(t, receipt);
  const manifest = JSON.parse(fs.readFileSync(
    path.join(fixtureValue.artifactDirectory, 'audio-manifest.json'),
  ));
  manifest.assets[1].asset_path = manifest.assets[0].asset_path;
  manifest.assets[1].file_sha256 = manifest.assets[0].file_sha256;
  manifest.assets[1].size_bytes = manifest.assets[0].size_bytes;
  updateArtifact(
    receipt,
    fixtureValue.artifactDirectory,
    'audio_manifest',
    'audio-manifest.json',
    manifest,
  );
  const result = verifyAttested(fixtureValue, receipt);
  assert.equal(result.formal_ready, false);
  assert.match(result.errors.join('\n'), /duplicate media identity/);
});

test('reviewed worklist requires complete card context and duration identity fields', t => {
  const receipt = validReceipt();
  const fixtureValue = fixture(t, receipt);
  const worklist = JSON.parse(fs.readFileSync(
    path.join(fixtureValue.artifactDirectory, 'reviewed-worklist.json'),
  ));
  delete worklist.entries[0].card_source_file;
  updateArtifact(
    receipt,
    fixtureValue.artifactDirectory,
    'review_worklist',
    'reviewed-worklist.json',
    worklist,
  );
  const result = verifyAttested(fixtureValue, receipt);
  assert.equal(result.formal_ready, false);
  assert.match(result.errors.join('\n'), /card_source_file|incomplete or invalid bound identity/);
});

test('structural receipt requires two complete blind transcript runs', t => {
  const receipt = validReceipt();
  for (const run of receipt.review_runs.filter(item => item.purpose === 'blind_transcript')) {
    run.purpose = 'pronunciation';
  }
  const {receiptPath} = fixture(t, receipt);
  fs.writeFileSync(receiptPath, `${JSON.stringify(receipt)}\n`);
  const result = verifyTrustedMediaRunReceipt({receiptPath});
  assert.equal(result.ok, false);
  assert.match(result.errors.join('\n'), /two complete blind_transcript runs/);
});

test('tampered per-asset model coverage fails before attestation can authorize media', t => {
  const {artifactDirectory, authorizationPath, bundlePath, candidateRoot, receiptPath} = fixture(t);
  const runPath = path.join(artifactDirectory, 'run-a.jsonl');
  const records = fs.readFileSync(runPath, 'utf8').trim().split('\n').map(JSON.parse);
  records[0].audio_coverage.model_input_sample_count -= 1;
  fs.writeFileSync(runPath, `${records.map(record => JSON.stringify(record)).join('\n')}\n`);
  const receiptSha256 = hash(fs.readFileSync(receiptPath));
  const result = verifyTrustedMediaRunReceipt({
    artifactDirectory,
    authorizationPath,
    bundlePath,
    candidateRoot,
    receiptPath,
    probeMediaDuration: () => 1000,
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

test('duplicate raw run cannot replace an independent run', t => {
  const receipt = validReceipt();
  const fixtureValue = fixture(t, receipt);
  const raw = JSON.parse(fs.readFileSync(
    path.join(fixtureValue.artifactDirectory, 'raw-run-manifest.json'),
  ));
  raw.runs[1] = structuredClone(raw.runs[0]);
  updateArtifact(receipt, fixtureValue.artifactDirectory, 'raw_run_manifest',
    'raw-run-manifest.json', raw);
  const runPackage = JSON.parse(fs.readFileSync(
    path.join(fixtureValue.artifactDirectory, 'run-package.json'),
  ));
  runPackage.runs[1] = structuredClone(runPackage.runs[0]);
  updateArtifact(receipt, fixtureValue.artifactDirectory, 'run_package',
    'run-package.json', runPackage);
  const result = verifyAttested(fixtureValue, receipt);
  assert.equal(result.formal_ready, false);
  assert.match(result.errors.join('\n'), /duplicates a run ID, name, path, or SHA-256/);
});

test('failed raw perceptual result cannot remain formal-ready', t => {
  const receipt = validReceipt();
  const fixtureValue = fixture(t, receipt);
  const runPath = path.join(fixtureValue.artifactDirectory, 'run-a.jsonl');
  const records = fs.readFileSync(runPath, 'utf8').trim().split('\n').map(JSON.parse);
  records[0].result.target_signal_audible = false;
  const bytes = Buffer.from(`${records.map(record => JSON.stringify(record)).join('\n')}\n`);
  fs.writeFileSync(runPath, bytes);
  const runSha = hash(bytes);
  receipt.review_runs[0].raw_output_sha256 = runSha;
  for (const [field, filename] of [
    ['raw_run_manifest', 'raw-run-manifest.json'],
    ['run_package', 'run-package.json'],
  ]) {
    const value = JSON.parse(fs.readFileSync(
      path.join(fixtureValue.artifactDirectory, filename),
    ));
    value.runs[0].sha256 = runSha;
    value.runs[0].size_bytes = bytes.length;
    updateArtifact(receipt, fixtureValue.artifactDirectory, field, filename, value);
  }
  const result = verifyAttested(fixtureValue, receipt);
  assert.equal(result.formal_ready, false);
  assert.match(
    result.errors.join('\n'),
    /retained raw model outputs do not replay packaged results|decision checks do not replay raw model results/,
  );
});

test('reviewed transcript text must match its bound digest', t => {
  const receipt = validReceipt();
  const fixtureValue = fixture(t, receipt);
  const worklist = JSON.parse(fs.readFileSync(
    path.join(fixtureValue.artifactDirectory, 'reviewed-worklist.json'),
  ));
  worklist.entries[0].audio.transcript = 'different transcript bytes';
  updateArtifact(receipt, fixtureValue.artifactDirectory, 'review_worklist',
    'reviewed-worklist.json', worklist);
  const result = verifyAttested(fixtureValue, receipt);
  assert.equal(result.formal_ready, false);
  assert.match(
    result.errors.join('\n'),
    /does not bind an exact passed media decision|retained raw model outputs do not replay packaged results/,
  );
});

test('worklist model acceptances must bind the recomputed media input', t => {
  const receipt = validReceipt();
  const fixtureValue = fixture(t, receipt);
  const worklist = JSON.parse(fs.readFileSync(
    path.join(fixtureValue.artifactDirectory, 'reviewed-worklist.json'),
  ));
  worklist.entries[0].review.model_acceptances[0].evidence.input_sha256 =
    `sha256:${hash('unrelated input')}`;
  updateArtifact(receipt, fixtureValue.artifactDirectory, 'review_worklist',
    'reviewed-worklist.json', worklist);
  const result = verifyAttested(fixtureValue, receipt);
  assert.equal(result.formal_ready, false);
  assert.match(result.errors.join('\n'), /model acceptance is not bound/);
});

test('formal verification requires every exact audio byte', t => {
  const receipt = validReceipt();
  const fixtureValue = fixture(t, receipt);
  fs.rmSync(path.join(
    fixtureValue.artifactDirectory,
    'ai_tts/cet4/0000/000001.mp3',
  ));
  const result = verifyAttested(fixtureValue, receipt);
  assert.equal(result.formal_ready, false);
  assert.match(result.errors.join('\n'), /media does not exist/);
});

test('runtime environment manifests require internally bound file identities', t => {
  const receipt = validReceipt();
  const fixtureValue = fixture(t, receipt);
  updateArtifact(
    receipt,
    fixtureValue.artifactDirectory,
    'python_environment_manifest',
    'python-environment-manifest.json',
    {files: 'not-an-array', sha256: receipt.execution.harness.python_environment_manifest_sha256},
  );
  const result = verifyAttested(fixtureValue, receipt);
  assert.equal(result.formal_ready, false);
  assert.match(result.errors.join('\n'), /Python environment manifest/);
});

test('model weights manifest must identify at least one concrete file', t => {
  const receipt = validReceipt();
  const fixtureValue = fixture(t, receipt);
  const emptyDigest = hash(canonicalStringify([]));
  receipt.execution.model.weights_manifest_sha256 = emptyDigest;
  updateArtifact(
    receipt,
    fixtureValue.artifactDirectory,
    'model_weights_manifest',
    'model-weights-manifest.json',
    {files: [], sha256: emptyDigest},
  );
  for (const [field, filename] of [
    ['raw_run_manifest', 'raw-run-manifest.json'],
    ['run_package', 'run-package.json'],
  ]) {
    const value = JSON.parse(fs.readFileSync(
      path.join(fixtureValue.artifactDirectory, filename),
    ));
    value.model = receipt.execution.model;
    updateArtifact(receipt, fixtureValue.artifactDirectory, field, filename, value);
  }
  const result = verifyAttested(fixtureValue, receipt);
  assert.equal(result.formal_ready, false);
  assert.match(result.errors.join('\n'), /model weights manifest must identify/);
});

function updateArtifact(receipt, artifactDirectory, field, filename, value) {
  receipt.artifacts[field] = writeArtifactJson(artifactDirectory, filename, value);
}

function verifyAttested(fixtureValue, receipt) {
  fs.writeFileSync(fixtureValue.receiptPath, `${JSON.stringify(receipt)}\n`);
  const receiptSha256 = hash(fs.readFileSync(fixtureValue.receiptPath));
  return verifyTrustedMediaRunReceipt({
    artifactDirectory: fixtureValue.artifactDirectory,
    authorizationPath: fixtureValue.authorizationPath,
    bundlePath: fixtureValue.bundlePath,
    candidateRoot: fixtureValue.candidateRoot,
    probeMediaDuration: () => 1000,
    receiptPath: fixtureValue.receiptPath,
    verifyAttestation: true,
    execFile: () => JSON.stringify([{
      verificationResult: {
        verifiedTimestamps: [{type: 'transparency_log'}],
        statement: {subject: [{digest: {sha256: receiptSha256}}]},
      },
    }]),
  });
}
