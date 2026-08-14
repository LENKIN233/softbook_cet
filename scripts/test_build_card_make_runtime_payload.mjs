#!/usr/bin/env node

import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {
  buildRuntimeAudio,
  buildSwipeStates,
  deriveConfirmedPilotScope,
  loadAudioContext,
  parseArgs,
  roundRobin,
  validateAudioBundleCandidateSummary,
  writePayloads,
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

function testAudioBundleCandidate() {
  const root = mkdtempSync(join(tmpdir(), 'softbook-audio-bundle-candidate-'));

  try {
    const cardMakeRoot = join(root, 'card-make');
    const outputDir = join(root, 'output');
    const assetPath = 'ai_tts/cet4/0012/001201.mp3';
    const absoluteAssetPath = join(cardMakeRoot, assetPath);
    const auditPath = join(root, 'audio-technical-audit.json');
    const bytes = Buffer.from('fixture-mp3-bytes');
    const digest = createHash('sha256').update(bytes).digest('hex');
    mkdirSync(join(cardMakeRoot, 'ai_tts', 'cet4', '0012'), {recursive: true});
    writeFileSync(absoluteAssetPath, bytes);
    writeJson(auditPath, {
      schema_version: 'audio-technical-audit.v1',
      track: 'cet4',
      ok: true,
      summary: {
        referenced_audio_cards: 1,
        unique_audio_paths: 1,
        technically_verified_assets: 1,
        errors: 0,
      },
      verification: {
        unique_asset_path_per_card: 'passed',
        file_hash_and_size: 'passed',
        decoder_probe: 'passed',
        declared_duration_binding: 'passed',
        transcript_presence_and_hash: 'passed',
        speech_to_transcript_match:
          'not_verified_requires_listening_or_independent_ASR_review',
        clipping_noise_pronunciation_rhythm_stress_pauses:
          'not_verified_requires_perceptual_QC',
        formal_audio_qc_records_created: 0,
      },
      assets: [
        {
          card_id: '001201',
          asset_path: assetPath,
          declared_duration_ms: 2100,
          file_sha256: digest,
          size_bytes: bytes.length,
          technical: {duration_ms: 2100},
        },
      ],
    });

    assert.throws(
      () =>
        parseArgs([
          '--payload-mode',
          'audio-bundle-candidate',
          '--scope-card-ids',
          '001201',
          '--output-dir',
          outputDir,
        ]),
      /requires --scope-card-ids and --audio-technical-audit/,
    );

    const parsed = parseArgs([
      '--card-make-root',
      cardMakeRoot,
      '--payload-mode',
      'audio-bundle-candidate',
      '--scope-card-ids',
      '001201',
      '--audio-technical-audit',
      auditPath,
      '--output-dir',
      outputDir,
    ]);
    const audioContext = loadAudioContext(parsed);
    const audio = buildRuntimeAudio(
      {
        card: {
          card_id: '001201',
          track: 'cet4',
          knowledge_ref: {
            track: 'cet4',
            box_prefix: '0012',
          },
          audio: {
            path: assetPath,
            duration_ms: 2100,
            transcript: 'A listening fixture.',
          },
        },
      },
      audioContext,
    );
    audioContext.assets.push(audio.asset);

    const runtimeCard = {
      card_id: '001201',
      track: 'cet4',
      knowledge_ref: '0012',
      interaction_id: 'multiple_choice',
      front: {
        eyebrow: '这张练习 | 语音现象',
        prompt: '听音后选择答案。',
        support: '辨认失去爆破。',
        context: '用于 CET4 听力辨音。',
      },
      analysis: {
        title: '失去爆破',
        summary: '辅音相邻时前一个爆破音可能不完全释放。',
        exam_tip: '先听辅音边界，再判断词组。',
      },
      space_metadata: {
        box_ref: '0012',
        library: '听力',
        group: '语音现象',
        box: '失去爆破',
      },
      options: [
        {id: 'A', label: 'A', text: 'A'},
        {id: 'B', label: 'B', text: 'B'},
        {id: 'C', label: 'C', text: 'C'},
        {id: 'D', label: 'D', text: 'D'},
      ],
      auto_scoring: true,
      answer_key: {correct_option: 'A'},
      audio: audio.cardAudio,
    };
    validateAudioBundleCandidateSummary([runtimeCard], audioContext);
    assert.throws(
      () =>
        validateAudioBundleCandidateSummary(
          [{...runtimeCard, audio: undefined}],
          {assets: []},
        ),
      /must bind one technically audited asset per scoped card/,
    );
    assert.throws(
      () =>
        validateAudioBundleCandidateSummary(
          [{...runtimeCard, space_metadata: {...runtimeCard.space_metadata, library: '语法'}}],
          audioContext,
        ),
      /accepts listening-library cards only/,
    );
    assert.throws(
      () =>
        validateAudioBundleCandidateSummary(
          [{...runtimeCard, track: 'cet6'}],
          audioContext,
        ),
      /must match the technical-audit track/,
    );
    const outputs = writePayloads(
      {
        ...parsed,
        sourceId: 'audio-bundle-fixture',
        sourceLabel: 'Audio bundle fixture',
      },
      [runtimeCard],
      audioContext,
    );
    assert.equal(outputs[0].cards, 1);
    assert.equal(outputs[0].audio_assets, 1);
    const payload = JSON.parse(readFileSync(outputs[0].file, 'utf8'));
    assert.equal(payload.card_records[0].audio.sha256, `sha256:${digest}`);
    assert.equal(payload.assets[0].asset_path, 'audio/cet4/0012/001201.mp3');
    assert.deepEqual(
      readFileSync(join(outputDir, payload.assets[0].asset_path)),
      bytes,
    );
    const incompleteAudit = JSON.parse(readFileSync(auditPath, 'utf8'));
    incompleteAudit.verification.decoder_probe = 'not_recorded';
    writeJson(auditPath, incompleteAudit);
    assert.throws(
      () => loadAudioContext(parsed),
      /Audio technical audit is invalid or not fully passing/,
    );
  } finally {
    rmSync(root, {recursive: true, force: true});
  }
}

assert.deepEqual(roundRobin([['a', 'b'], ['c']]), ['a', 'c', 'b']);
testBooleanSwipeIdentifiers();
testAudioBundleCandidate();
testConfirmedPilotOrder();
console.log('build_card_make_runtime_payload tests passed');
