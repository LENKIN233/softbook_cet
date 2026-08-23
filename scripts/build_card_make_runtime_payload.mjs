#!/usr/bin/env node

import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname, isAbsolute, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {
  catalogEntriesByRef,
  loadBoxCatalog,
  validateCardSourceCatalogMapping,
} from '../infra/cloudbase/card-source-catalog.mjs';

const require = createRequire(import.meta.url);
const {
  validateCardSourceForImport,
  validateCardSourceForReleaseBundle,
} = require('../infra/cloudbase/functions/softbook-api');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CARD_MAKE_ROOT = resolve(ROOT, '../card make');
const DEFAULT_SOURCE_ID = 'card-make-candidate-handoff';
const DEFAULT_SOURCE_LABEL = 'Card make candidate handoff';
const TRACKS = ['cet4', 'cet6'];
const BOX_CATALOG = loadBoxCatalog();
const CATALOG_ENTRIES_BY_TRACK = new Map(
  TRACKS.map(track => [track, catalogEntriesByRef(BOX_CATALOG, track)]),
);
const PAYLOAD_MODES = [
  'development',
  'audio-bundle-candidate',
  'controlled-pilot-candidate',
  'full-track-candidate',
];
const FULL_TRACK_CANDIDATE_POLICIES = new Map([
  ['cet4', {cardCount: 1180, boxCount: 108, audioCount: 301}],
  ['cet6', {cardCount: 1234, boxCount: 110, audioCount: 328}],
]);
const CONTROLLED_PILOT_LIBRARY_COUNTS = new Map([
  ['听力', 24],
  ['仔细阅读', 24],
  ['选词填空', 16],
  ['写作', 16],
  ['翻译', 16],
  ['词汇', 12],
  ['语法', 12],
]);

function printUsage() {
  console.log(`Usage: node scripts/build_card_make_runtime_payload.mjs --scope-card-ids <ids> --output-dir <dir> [options]

Builds mobile runtime card-source payloads from the external card make workspace.

Options:
  --card-make-root <dir>  External workspace root. Defaults to ../card make.
  --scope-card-ids <ids>  Comma-separated card IDs to include.
  --pilot-review <file>   Derive the exact controlled-pilot order from a current
                          model-owned controlled-pilot-review.v2 record.
  --output-dir <dir>      Directory for generated per-track JSON payloads. Required.
  --payload-mode <mode>   development (default), audio-bundle-candidate,
                          controlled-pilot-candidate, or full-track-candidate.
  --audio-technical-audit <file>
                          Required in audio-bearing candidate modes; binds and copies
                          technically verified audio without claiming perceptual QC.
  --source-id <id>        Payload source id. Defaults to ${DEFAULT_SOURCE_ID}.
  --source-label <label>  Payload source label. Defaults to ${DEFAULT_SOURCE_LABEL}.`);
}

function parseArgs(argv) {
  const options = {
    cardMakeRoot: DEFAULT_CARD_MAKE_ROOT,
    audioTechnicalAudit: null,
    pilotReviewPath: null,
    outputDir: null,
    payloadMode: 'development',
    scopeCardIds: [],
    sourceId: DEFAULT_SOURCE_ID,
    sourceLabel: DEFAULT_SOURCE_LABEL,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case '--card-make-root':
        options.cardMakeRoot = resolve(requireNextValue(argv, index, arg));
        index += 1;
        break;
      case '--audio-technical-audit':
        options.audioTechnicalAudit = resolve(
          requireNextValue(argv, index, arg),
        );
        index += 1;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      case '--output-dir':
        options.outputDir = resolve(requireNextValue(argv, index, arg));
        index += 1;
        break;
      case '--payload-mode':
        options.payloadMode = requireNextValue(argv, index, arg);
        index += 1;
        break;
      case '--pilot-review':
        options.pilotReviewPath = requireNextValue(argv, index, arg);
        index += 1;
        break;
      case '--scope-card-ids':
        options.scopeCardIds = parseCardIds(requireNextValue(argv, index, arg));
        index += 1;
        break;
      case '--source-id':
        options.sourceId = requireNextValue(argv, index, arg);
        index += 1;
        break;
      case '--source-label':
        options.sourceLabel = requireNextValue(argv, index, arg);
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!options.outputDir) {
    throw new Error('--output-dir is required.');
  }

  if (!PAYLOAD_MODES.includes(options.payloadMode)) {
    throw new Error(
      `--payload-mode must be one of: ${PAYLOAD_MODES.join(', ')}.`,
    );
  }

  if (options.scopeCardIds.length > 0 && options.pilotReviewPath) {
    throw new Error(
      '--scope-card-ids and --pilot-review are mutually exclusive.',
    );
  }

  if (options.scopeCardIds.length === 0 && !options.pilotReviewPath) {
    throw new Error('--scope-card-ids or --pilot-review is required.');
  }

  if (options.pilotReviewPath) {
    options.pilotReviewPath = isAbsolute(options.pilotReviewPath)
      ? options.pilotReviewPath
      : resolve(options.cardMakeRoot, options.pilotReviewPath);
  }

  if (
    options.payloadMode === 'controlled-pilot-candidate' &&
    (!options.pilotReviewPath || !options.audioTechnicalAudit)
  ) {
    throw new Error(
      'controlled-pilot-candidate mode requires --pilot-review and --audio-technical-audit.',
    );
  }

  if (
    options.payloadMode === 'audio-bundle-candidate' &&
    (!options.audioTechnicalAudit || options.scopeCardIds.length === 0)
  ) {
    throw new Error(
      'audio-bundle-candidate mode requires --scope-card-ids and --audio-technical-audit.',
    );
  }

  if (
    options.payloadMode === 'full-track-candidate' &&
    (!options.audioTechnicalAudit || options.scopeCardIds.length === 0)
  ) {
    throw new Error(
      'full-track-candidate mode requires --scope-card-ids and --audio-technical-audit.',
    );
  }

  if (
    ['audio-bundle-candidate', 'full-track-candidate'].includes(
      options.payloadMode,
    ) &&
    options.pilotReviewPath
  ) {
    throw new Error(
      `${options.payloadMode} mode does not accept --pilot-review.`,
    );
  }

  return options;
}

function requireNextValue(argv, index, optionName) {
  const value = argv[index + 1];

  if (!value || value.startsWith('--')) {
    throw new Error(`${optionName} requires a value.`);
  }

  return value;
}

function parseCardIds(value) {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .map(item => {
      if (!/^\d{6}$/.test(item)) {
        throw new Error(`Invalid card id: ${item}`);
      }
      return item;
    });
}

function readJson(filePath) {
  return JSON.parse(readFileSync(filePath, 'utf8'));
}

function sha256File(filePath) {
  return `sha256:${createHash('sha256')
    .update(readFileSync(filePath))
    .digest('hex')}`;
}

function deriveModelOwnedPilotScope(options) {
  const review = readJson(options.pilotReviewPath);
  const scope = review?.scope;
  const boxes = review?.coverage?.boxes;
  if (
    review?.schema_version !== 'controlled-pilot-review.v2' ||
    review?.status !== 'ready_for_model_authorization' ||
    scope?.track !== 'cet4' ||
    scope?.purpose !== 'controlled_pilot' ||
    scope?.card_count !== 120 ||
    !Array.isArray(scope?.card_ids) ||
    scope.card_ids.length !== 120 ||
    new Set(scope.card_ids).size !== 120 ||
    !Array.isArray(scope?.box_prefixes) ||
    scope.box_prefixes.length !== 14 ||
    new Set(scope.box_prefixes).size !== 14 ||
    !Array.isArray(review.source_records?.model_reviews) ||
    review.source_records.model_reviews.length === 0 ||
    review.coverage?.reviewed_cards !== 120 ||
    !Array.isArray(boxes) ||
    boxes.length !== 14
  ) {
    throw new Error(
      'Controlled-pilot model review is invalid or outside the exact 120-card candidate boundary.',
    );
  }
  const selectedByBox = [];
  const seenCardIds = new Set();
  for (const box of boxes) {
    const cardIds = Array.isArray(box?.card_ids)
      ? [...box.card_ids].map(String).sort()
      : [];
    if (
      !/^\d{4}$/.test(box?.box_prefix) ||
      box?.status !== 'passed' ||
      cardIds.length === 0 ||
      cardIds.length % 2 !== 0 ||
      new Set(cardIds).size !== cardIds.length ||
      cardIds.some(cardId =>
        !/^\d{6}$/.test(cardId) || !cardId.startsWith(box.box_prefix))
    ) {
      throw new Error(
        'Controlled-pilot model review contains an invalid box scope.',
      );
    }
    for (const cardId of cardIds) {
      if (seenCardIds.has(cardId)) {
        throw new Error(
          `Controlled-pilot scope contains duplicate card id ${cardId}.`,
        );
      }
      seenCardIds.add(cardId);
    }

    const midpoint = cardIds.length / 2;
    selectedByBox.push({
      box_prefix: box.box_prefix,
      card_ids: cardIds,
      free_card_ids: cardIds.slice(0, midpoint),
      continuation_card_ids: cardIds.slice(midpoint),
      target_card_count: cardIds.length,
    });
  }

  const freeCardIds = roundRobin(selectedByBox.map(box => box.free_card_ids));
  const continuationCardIds = roundRobin(
    selectedByBox.map(box => box.continuation_card_ids),
  );
  const cardIds = [...freeCardIds, ...continuationCardIds];
  const freeLibraries = new Set(freeCardIds.map(cardId => cardId[1]));

  if (
    cardIds.length !== 120 ||
    !sameSet(cardIds, scope.card_ids) ||
    !sameSet(selectedByBox.map(box => box.box_prefix), scope.box_prefixes) ||
    freeCardIds.length !== 60 ||
    continuationCardIds.length !== 60 ||
    freeLibraries.size !== 7
  ) {
    throw new Error(
      `Derived controlled-pilot order violates the boundary: total=${cardIds.length}, free=${freeCardIds.length}, continuation=${continuationCardIds.length}, free_libraries=${freeLibraries.size}.`,
    );
  }

  return {
    cardIds,
    manifest: {
      schema_version: 'controlled-pilot-candidate-selection.v2',
      review_id: review.review_id,
      review_path: relativeCardMakePath(
        options.cardMakeRoot,
        options.pilotReviewPath,
      ),
      review_sha256: sha256File(options.pilotReviewPath),
      track: 'cet4',
      purpose: 'controlled_pilot',
      status: 'model_reviewed_candidate_pending_authorization',
      card_count: 120,
      free_card_count: 60,
      free_card_ids: freeCardIds,
      continuation_card_ids: continuationCardIds,
      boxes: selectedByBox,
      gate_eligible: false,
    },
  };
}

function roundRobin(groups) {
  const values = [];
  const longest = Math.max(...groups.map(group => group.length));

  for (let index = 0; index < longest; index += 1) {
    for (const group of groups) {
      if (group[index] !== undefined) values.push(group[index]);
    }
  }

  return values;
}

function sameSet(left, right) {
  return Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    new Set(left).size === left.length &&
    new Set(right).size === right.length &&
    left.every(value => right.includes(value));
}

function relativeCardMakePath(cardMakeRoot, filePath) {
  const normalizedRoot = `${resolve(cardMakeRoot)}/`;
  const normalizedFile = resolve(filePath);

  if (!normalizedFile.startsWith(normalizedRoot)) {
    throw new Error(`Path escapes card make workspace: ${filePath}`);
  }

  return normalizedFile.slice(normalizedRoot.length);
}

function cardBoxFiles(cardMakeRoot) {
  const dir = join(cardMakeRoot, 'card_boxes_json');

  return readdirSync(dir)
    .filter(file => file.endsWith('.json') && file !== 'TEMPLATE.json')
    .sort()
    .map(file => join(dir, file));
}

function loadScopedCards(options) {
  const wanted = new Set(options.scopeCardIds);
  const found = new Map();

  for (const filePath of cardBoxFiles(options.cardMakeRoot)) {
    const payload = readJson(filePath);

    for (const card of payload.cards || []) {
      if (!wanted.has(String(card.card_id))) continue;

      if (found.has(String(card.card_id))) {
        throw new Error(
          `Duplicate card id in card make workspace: ${card.card_id}`,
        );
      }

      found.set(String(card.card_id), {
        card,
        file: filePath,
      });
    }
  }

  const missing = options.scopeCardIds.filter(cardId => !found.has(cardId));
  if (missing.length > 0) {
    throw new Error(
      `Missing card ids in card make workspace: ${missing.join(', ')}`,
    );
  }

  return options.scopeCardIds.map(cardId => found.get(cardId));
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function firstText(...values) {
  for (const value of values) {
    const text = nonEmptyString(value);
    if (text) return text;
  }

  return null;
}

function knowledgeRef(card) {
  const ref =
    card.knowledge_ref && typeof card.knowledge_ref === 'object'
      ? card.knowledge_ref
      : {};
  const boxPrefix = firstText(ref.box_prefix, card.card_box_code);

  if (!boxPrefix || !/^\d{4}$/.test(boxPrefix)) {
    throw new Error(`${card.card_id} is missing a 4-digit box prefix.`);
  }

  return {
    box: firstText(ref.box_name, card.card_box_name),
    box_ref: boxPrefix,
    group: firstText(ref.group_name, card.card_group_name),
    library: firstText(ref.library_name),
    track: firstText(ref.track, card.track),
  };
}

function buildFront(card, ref) {
  const metadata = card.quality_metadata || {};
  const analysis = card.analysis || card.analysis_content || {};
  const tips = Array.isArray(analysis.tips) ? analysis.tips : [];

  return {
    eyebrow: `这张练习 | ${ref.group || ref.library || 'CET'}`,
    prompt: requiredText(
      card,
      'front.prompt',
      card.front?.task_prompt,
      card.front?.text,
      card.front_content?.text,
    ),
    support: requiredText(
      card,
      'front.support',
      metadata.main_training_goal,
      tips[0],
      card.back_content?.explanation,
      ref.box,
    ),
    context: requiredText(
      card,
      'front.context',
      metadata.exam_value,
      card.back_content?.explanation,
      analysis.text,
      ref.box,
    ),
  };
}

function buildAnalysis(card, ref) {
  const metadata = card.quality_metadata || {};
  const analysis = card.analysis || card.analysis_content || {};
  const tips = Array.isArray(analysis.tips) ? analysis.tips : [];

  return {
    title: requiredText(
      card,
      'analysis.title',
      metadata.main_training_goal,
      `${ref.box || 'CET'}训练`,
    ),
    summary: requiredText(
      card,
      'analysis.summary',
      analysis.text,
      card.back_content?.text,
      card.back_content?.explanation,
    ),
    exam_tip: requiredText(
      card,
      'analysis.exam_tip',
      tips[0],
      metadata.exam_value,
      card.back_content?.explanation,
    ),
  };
}

function requiredText(card, fieldName, ...values) {
  const value = firstText(...values);

  if (!value) {
    throw new Error(`${card.card_id} cannot derive ${fieldName}.`);
  }

  return value;
}

function buildRuntimeCard(record, audioContext = null) {
  const runtimeCard = buildRuntimeCardWithoutAudio(record);

  if (!record.card.audio) return runtimeCard;
  if (!audioContext) return runtimeCard;

  const audio = buildRuntimeAudio(record, audioContext);
  audioContext.assets.push(audio.asset);
  return {...runtimeCard, audio: audio.cardAudio};
}

function buildRuntimeCardWithoutAudio(record) {
  const {card} = record;
  const ref = knowledgeRef(card);
  const track = requireTrack(card.track || ref.track, card.card_id);
  const interactionId = requiredText(
    card,
    'interaction_id',
    card.interaction_id,
  );
  const base = {
    card_id: String(card.card_id),
    track,
    knowledge_ref: ref.box_ref,
    interaction_id: interactionId,
    front: buildFront(card, ref),
    analysis: buildAnalysis(card, ref),
    space_metadata: buildCanonicalSpaceMetadata(card, track, ref.box_ref),
  };

  switch (interactionId) {
    case 'flip':
      return {
        ...base,
        back_text: requiredText(card, 'back_text', card.back_content?.text),
      };
    case 'multiple_choice': {
      const options = buildOptions(card);
      return {
        ...base,
        options,
        auto_scoring: true,
        answer_key: {
          correct_option: buildCorrectOption(card, options),
        },
      };
    }
    case 'lock': {
      const lockPattern = requireStringArray(
        card.answer_key?.lock_pattern,
        `${card.card_id} answer_key.lock_pattern`,
      );
      return {
        ...base,
        lock_slots: buildLockSlots(card, lockPattern),
        auto_scoring: true,
        answer_key: {
          lock_pattern: lockPattern,
        },
      };
    }
    case 'elimination':
      return {
        ...base,
        elimination_items: buildEliminationItems(card),
        auto_scoring: true,
        answer_key: {
          correct_items: requireStringArray(
            card.answer_key?.correct_items,
            `${card.card_id} answer_key.correct_items`,
          ),
        },
      };
    case 'swipe':
      return {
        ...base,
        swipe_states: buildSwipeStates(card),
        auto_scoring: true,
        answer_key: {
          correct_state: requiredScalarId(
            card.answer_key?.correct_state,
            `${card.card_id} answer_key.correct_state`,
          ),
        },
      };
    default:
      throw new Error(
        `${card.card_id} has unsupported interaction_id: ${interactionId}`,
      );
  }
}

function buildCanonicalSpaceMetadata(card, track, boxRef) {
  const entry = CATALOG_ENTRIES_BY_TRACK.get(track)?.get(boxRef);
  if (!entry) {
    throw new Error(`${card.card_id} uses unmapped knowledge_ref ${boxRef}.`);
  }

  return {
    box_ref: boxRef,
    library: entry.library,
    group: entry.group,
    box: entry.box,
  };
}

function loadAudioContext(options) {
  if (options.payloadMode === 'development') return null;

  const audit = readJson(options.audioTechnicalAudit);
  const requiredTechnicalPasses = [
    'unique_asset_path_per_card',
    'file_hash_and_size',
    'decoder_probe',
    'declared_duration_binding',
    'transcript_presence_and_hash',
  ];
  if (
    audit?.schema_version !== 'audio-technical-audit.v1' ||
    !TRACKS.includes(audit?.track) ||
    audit?.ok !== true ||
    audit?.summary?.errors !== 0 ||
    !Array.isArray(audit?.assets) ||
    audit.assets.length === 0 ||
    audit?.summary?.referenced_audio_cards !== audit.assets.length ||
    audit?.summary?.unique_audio_paths !== audit.assets.length ||
    audit?.summary?.technically_verified_assets !== audit.assets.length ||
    requiredTechnicalPasses.some(
      field => audit?.verification?.[field] !== 'passed',
    ) ||
    audit?.verification?.speech_to_transcript_match !==
      'not_verified_requires_listening_or_independent_ASR_review' ||
    audit?.verification?.clipping_noise_pronunciation_rhythm_stress_pauses !==
      'not_verified_requires_perceptual_QC' ||
    audit?.verification?.formal_audio_qc_records_created !== 0
  ) {
    throw new Error('Audio technical audit is invalid or not fully passing.');
  }

  const auditByCardId = new Map();
  for (const asset of audit.assets) {
    const cardId = String(asset?.card_id || '');
    if (!/^\d{6}$/.test(cardId) || auditByCardId.has(cardId)) {
      throw new Error(
        'Audio technical audit contains an invalid or duplicate card id.',
      );
    }
    auditByCardId.set(cardId, asset);
  }

  return {
    assets: [],
    auditByCardId,
    cardMakeRoot: options.cardMakeRoot,
    outputDir: options.outputDir,
    track: audit.track,
  };
}

function buildRuntimeAudio(record, context) {
  const sourceAudio = record.card.audio;
  const audit = context.auditByCardId.get(String(record.card.card_id));
  const sourcePath = firstText(sourceAudio.path, sourceAudio.url);
  const ref = knowledgeRef(record.card);
  const track = requireTrack(
    record.card.track || ref.track,
    record.card.card_id,
  );

  if (
    track !== context.track ||
    !audit ||
    audit.asset_path !== sourcePath ||
    audit.declared_duration_ms !== sourceAudio.duration_ms ||
    !Number.isFinite(audit.technical?.duration_ms) ||
    Math.abs(audit.technical.duration_ms - sourceAudio.duration_ms) > 50 ||
    !/^[a-f0-9]{64}$/.test(String(audit.file_sha256 || '')) ||
    !Number.isSafeInteger(audit.size_bytes) ||
    audit.size_bytes <= 0 ||
    !nonEmptyString(sourceAudio.transcript)
  ) {
    throw new Error(
      `Audio evidence for card ${record.card.card_id} is incomplete or mismatched.`,
    );
  }

  if (
    !/^ai_tts\/[a-z0-9/_-]+\.mp3$/.test(sourcePath) ||
    !sourcePath.startsWith(`ai_tts/${track}/`)
  ) {
    throw new Error(`Audio path for card ${record.card.card_id} is invalid.`);
  }

  const absoluteSourcePath = resolve(context.cardMakeRoot, sourcePath);
  const expectedRoot = `${resolve(context.cardMakeRoot, 'ai_tts')}/`;
  if (!absoluteSourcePath.startsWith(expectedRoot)) {
    throw new Error(
      `Audio path for card ${record.card.card_id} escapes ai_tts.`,
    );
  }
  if (statSync(absoluteSourcePath).size !== audit.size_bytes) {
    throw new Error(
      `Audio bytes for card ${record.card.card_id} changed after technical audit.`,
    );
  }
  if (sha256File(absoluteSourcePath) !== `sha256:${audit.file_sha256}`) {
    throw new Error(
      `Audio hash for card ${record.card.card_id} changed after technical audit.`,
    );
  }

  const assetId = `${track}-${record.card.card_id}-audio`;
  const assetPath = `audio/${track}/${record.card.card_id.slice(0, 4)}/${
    record.card.card_id
  }.mp3`;
  const absoluteOutputPath = resolve(context.outputDir, assetPath);
  mkdirSync(dirname(absoluteOutputPath), {recursive: true});
  copyFileSync(absoluteSourcePath, absoluteOutputPath);

  return {
    asset: {
      asset_id: assetId,
      asset_path: assetPath,
      duration_ms: sourceAudio.duration_ms,
      media_type: 'audio/mpeg',
      sha256: `sha256:${audit.file_sha256}`,
      size_bytes: audit.size_bytes,
    },
    cardAudio: {
      asset_id: assetId,
      duration_ms: sourceAudio.duration_ms,
      sha256: `sha256:${audit.file_sha256}`,
      transcript: sourceAudio.transcript.trim(),
    },
  };
}

function requireTrack(value, cardId) {
  const track = firstText(value);

  if (!TRACKS.includes(track)) {
    throw new Error(`${cardId} track must be cet4 or cet6.`);
  }

  return track;
}

function buildOptions(card) {
  const options = sourceMultipleChoiceOptions(card);

  if (options.length !== 4) {
    throw new Error(
      `${card.card_id} multiple_choice must have exactly 4 options.`,
    );
  }

  return options.map((option, index) => {
    const key = firstText(
      option?.key,
      option?.id,
      option?.label,
      String.fromCharCode(65 + index),
    );
    return {
      id: key,
      label: key,
      text: requiredText(
        card,
        `options[${index}].text`,
        option?.text,
        option?.form,
      ),
    };
  });
}

function sourceMultipleChoiceOptions(card) {
  return Array.isArray(card.options) && card.options.length > 0
    ? card.options
    : Array.isArray(card.form_options)
    ? card.form_options
    : [];
}

function buildCorrectOption(card, runtimeOptions) {
  const declared = requiredText(
    card,
    'answer_key.correct_option',
    card.answer_key?.correct_option,
  );
  const declaredMatch = runtimeOptions.find(
    option =>
      option.id === declared ||
      option.label === declared ||
      option.text === declared,
  );
  const flaggedIndexes = sourceMultipleChoiceOptions(card)
    .map((option, index) => (option?.is_correct === true ? index : -1))
    .filter(index => index >= 0);

  if (flaggedIndexes.length > 1) {
    throw new Error(
      `${card.card_id} multiple_choice has more than one is_correct option.`,
    );
  }

  const flaggedMatch =
    flaggedIndexes.length === 1 ? runtimeOptions[flaggedIndexes[0]] : null;
  if (declaredMatch && flaggedMatch && declaredMatch.id !== flaggedMatch.id) {
    throw new Error(
      `${card.card_id} answer_key.correct_option conflicts with is_correct.`,
    );
  }
  if (declaredMatch) return declaredMatch.id;
  if (flaggedMatch) return flaggedMatch.id;
  throw new Error(
    `${card.card_id} answer_key.correct_option does not identify an option.`,
  );
}

function buildLockSlots(card, lockPattern) {
  const sourceSlots = Array.isArray(card.lock_slots) ? card.lock_slots : [];
  const wordBank = requireStringArray(
    card.word_bank,
    `${card.card_id} word_bank`,
  );

  return lockPattern.map((expected, index) => {
    const sourceSlot = sourceSlots[index] || {};
    const sourceOptions = Array.isArray(sourceSlot.options)
      ? sourceSlot.options
      : wordBank;
    const options = uniqueStrings([...sourceOptions, expected]);

    return {
      id: firstText(sourceSlot.id, `slot_${index + 1}`),
      label: firstText(sourceSlot.label, `空 ${index + 1}`),
      options,
    };
  });
}

function buildEliminationItems(card) {
  const items = Array.isArray(card.elimination_items)
    ? card.elimination_items
    : [];

  if (items.length === 0) {
    throw new Error(`${card.card_id} elimination_items must not be empty.`);
  }

  return items.map((item, index) => ({
    id: requiredText(
      card,
      `elimination_items[${index}].id`,
      item?.id,
      item?.text,
    ),
    text: requiredText(card, `elimination_items[${index}].text`, item?.text),
  }));
}

function buildSwipeStates(card) {
  const states = Array.isArray(card.swipe_states) ? card.swipe_states : [];

  if (states.length !== 2) {
    throw new Error(
      `${card.card_id} swipe_states must contain exactly 2 states.`,
    );
  }

  return states.map((state, index) => ({
    id: requiredScalarId(
      state?.id,
      `${card.card_id} swipe_states[${index}].id`,
    ),
    label: requiredText(card, `swipe_states[${index}].label`, state?.label),
    description: requiredText(
      card,
      `swipe_states[${index}].description`,
      state?.description,
      state?.label,
    ),
  }));
}

function requiredScalarId(value, fieldName) {
  if (
    typeof value !== 'string' &&
    typeof value !== 'number' &&
    typeof value !== 'boolean'
  ) {
    throw new Error(
      `${fieldName} must be a string, number, or boolean identifier.`,
    );
  }

  const normalized = String(value).trim();
  if (!normalized) throw new Error(`${fieldName} must not be empty.`);
  return normalized;
}

function requireStringArray(value, fieldName) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${fieldName} must be a non-empty array.`);
  }

  return uniqueStrings(value);
}

function uniqueStrings(values) {
  return [
    ...new Set(values.map(value => String(value).trim()).filter(Boolean)),
  ];
}

function groupByTrack(cards) {
  const groups = new Map(TRACKS.map(track => [track, []]));

  for (const card of cards) {
    groups.get(card.track).push(card);
  }

  return groups;
}

function validateControlledPilotCandidateSummary(
  runtimeCards,
  audioContext,
  manifest,
) {
  if (runtimeCards.length !== 120 || manifest?.free_card_ids?.length !== 60) {
    throw new Error(
      'Controlled-pilot candidate must contain exactly 120 cards and a 60-card free prefix.',
    );
  }

  const cardsById = new Map(runtimeCards.map(card => [card.card_id, card]));
  const libraryCounts = countValues(
    runtimeCards,
    card => card.space_metadata.library,
  );
  const freeLibraryCounts = countValues(
    manifest.free_card_ids.map(cardId => cardsById.get(cardId)),
    card => card?.space_metadata?.library,
  );
  const boxesByLibrary = new Map();

  for (const card of runtimeCards) {
    const library = card.space_metadata.library;
    if (!boxesByLibrary.has(library)) boxesByLibrary.set(library, new Set());
    boxesByLibrary.get(library).add(card.knowledge_ref);
  }

  for (const [library, expectedCount] of CONTROLLED_PILOT_LIBRARY_COUNTS) {
    if (
      libraryCounts.get(library) !== expectedCount ||
      freeLibraryCounts.get(library) !== expectedCount / 2 ||
      boxesByLibrary.get(library)?.size < 2
    ) {
      throw new Error(
        `Controlled-pilot candidate distribution is invalid for ${library}.`,
      );
    }
  }

  const interactions = new Set(runtimeCards.map(card => card.interaction_id));
  if (
    interactions.size !== 5 ||
    !['flip', 'multiple_choice', 'lock', 'elimination', 'swipe'].every(value =>
      interactions.has(value),
    )
  ) {
    throw new Error(
      'Controlled-pilot candidate must cover all five core interactions.',
    );
  }

  const audioCards = runtimeCards.filter(card => card.audio);
  if (
    audioCards.length !== 24 ||
    audioContext?.assets?.length !== 24 ||
    audioCards.some(card => card.space_metadata.library !== '听力')
  ) {
    throw new Error(
      'Controlled-pilot candidate must bind exactly 24 listening audio assets.',
    );
  }
}

function validateAudioBundleCandidateSummary(runtimeCards, audioContext) {
  const audioCards = runtimeCards.filter(card => card.audio);

  if (
    runtimeCards.length === 0 ||
    audioCards.length !== runtimeCards.length ||
    audioContext?.assets?.length !== runtimeCards.length
  ) {
    throw new Error(
      'Audio-bundle candidate must bind one technically audited asset per scoped card.',
    );
  }

  if (runtimeCards.some(card => card.space_metadata.library !== '听力')) {
    throw new Error(
      'Audio-bundle candidate accepts listening-library cards only.',
    );
  }

  if (runtimeCards.some(card => card.track !== audioContext?.track)) {
    throw new Error(
      'Audio-bundle candidate cards must match the technical-audit track.',
    );
  }
}

function validateFullTrackCandidateSummary(runtimeCards, audioContext) {
  const tracks = new Set(runtimeCards.map(card => card.track));
  const track = tracks.size === 1 ? runtimeCards[0]?.track : null;
  const policy = FULL_TRACK_CANDIDATE_POLICIES.get(track);
  const audioCards = runtimeCards.filter(card => card.audio);
  const boxCount = new Set(runtimeCards.map(card => card.knowledge_ref)).size;
  const interactions = new Set(runtimeCards.map(card => card.interaction_id));

  if (!policy || audioContext?.track !== track) {
    throw new Error(
      'Full-track candidate must contain exactly one technically audited track.',
    );
  }
  if (
    runtimeCards.length !== policy.cardCount ||
    boxCount !== policy.boxCount
  ) {
    throw new Error(
      `Full-track ${track} candidate must contain exactly ${policy.cardCount} cards and ${policy.boxCount} boxes.`,
    );
  }
  if (
    audioCards.length !== policy.audioCount ||
    audioContext.assets.length !== policy.audioCount ||
    audioContext.auditByCardId.size !== policy.audioCount
  ) {
    throw new Error(
      `Full-track ${track} candidate must bind exactly ${policy.audioCount} technically audited audio assets.`,
    );
  }
  if (
    !['flip', 'multiple_choice', 'lock', 'elimination', 'swipe'].every(value =>
      interactions.has(value),
    )
  ) {
    throw new Error(
      'Full-track candidate must cover all five core interactions.',
    );
  }
}

function countValues(values, selector) {
  const counts = new Map();
  for (const value of values) {
    const key = selector(value);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function sanitizeFilePart(value) {
  return String(value)
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function writePayloads(options, runtimeCards, audioContext) {
  mkdirSync(options.outputDir, {recursive: true});

  const groups = groupByTrack(runtimeCards);
  const outputs = [];

  for (const track of TRACKS) {
    const cardRecords = groups.get(track);
    if (cardRecords.length === 0) continue;

    const payload = {
      card_records: cardRecords,
      source: {
        id: options.sourceId,
        label: options.sourceLabel,
      },
      track,
    };
    if (audioContext?.assets.length > 0) {
      payload.assets = audioContext.assets.filter(asset =>
        cardRecords.some(card => card.audio?.asset_id === asset.asset_id),
      );
    }
    const validated = validateCardSourceCatalogMapping(
      options.payloadMode !== 'development'
        ? validateCardSourceForReleaseBundle(payload, track)
        : validateCardSourceForImport(payload, track),
    );
    const filePath = join(
      options.outputDir,
      `${sanitizeFilePart(options.sourceId)}-${track}-card-source.json`,
    );

    writeFileSync(filePath, `${JSON.stringify(validated, null, 2)}\n`);
    outputs.push({
      file: filePath,
      track,
      cards: validated.card_records.length,
      audio_assets: validated.assets.length,
      content_version: validated.content_version,
    });
  }

  return outputs;
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const confirmedScope = options.pilotReviewPath
      ? deriveModelOwnedPilotScope(options)
      : null;
    if (confirmedScope) options.scopeCardIds = confirmedScope.cardIds;
    const scopedCards = loadScopedCards(options);
    const audioContext = loadAudioContext(options);
    const runtimeCards = scopedCards.map(record =>
      buildRuntimeCard(record, audioContext),
    );
    if (options.payloadMode === 'audio-bundle-candidate') {
      validateAudioBundleCandidateSummary(runtimeCards, audioContext);
    }
    if (options.payloadMode === 'controlled-pilot-candidate') {
      validateControlledPilotCandidateSummary(
        runtimeCards,
        audioContext,
        confirmedScope?.manifest,
      );
    }
    if (options.payloadMode === 'full-track-candidate') {
      validateFullTrackCandidateSummary(runtimeCards, audioContext);
    }
    const outputs = writePayloads(options, runtimeCards, audioContext);

    let selectionManifest = null;
    if (confirmedScope) {
      selectionManifest = join(
        options.outputDir,
        'controlled-pilot-candidate-selection.json',
      );
      writeFileSync(
        selectionManifest,
        `${JSON.stringify(confirmedScope.manifest, null, 2)}\n`,
      );
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          card_make_root: options.cardMakeRoot,
          payload_mode: options.payloadMode,
          outputs,
          selection_manifest: selectionManifest,
          scope_card_ids: options.scopeCardIds,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[card-make-runtime-payload] ${message}`);
    process.exit(1);
  }
}

if (resolve(process.argv[1] || '') === fileURLToPath(import.meta.url)) {
  main();
}

export {
  buildCanonicalSpaceMetadata,
  buildCorrectOption,
  buildOptions,
  buildRuntimeAudio,
  buildRuntimeCardWithoutAudio,
  buildSwipeStates,
  deriveModelOwnedPilotScope,
  loadAudioContext,
  parseArgs,
  roundRobin,
  validateAudioBundleCandidateSummary,
  validateControlledPilotCandidateSummary,
  validateFullTrackCandidateSummary,
  writePayloads,
};
