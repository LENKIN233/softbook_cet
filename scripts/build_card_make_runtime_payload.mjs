#!/usr/bin/env node

import {mkdirSync, readFileSync, readdirSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {validateCardSourceCatalogMapping} from '../infra/cloudbase/card-source-catalog.mjs';

const require = createRequire(import.meta.url);
const {validateCardSourceForImport} = require('../infra/cloudbase/functions/softbook-api');

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_CARD_MAKE_ROOT = resolve(ROOT, '../card make');
const DEFAULT_SOURCE_ID = 'card-make-candidate-handoff';
const DEFAULT_SOURCE_LABEL = 'Card make candidate handoff';
const TRACKS = ['cet4', 'cet6'];

function printUsage() {
  console.log(`Usage: node scripts/build_card_make_runtime_payload.mjs --scope-card-ids <ids> --output-dir <dir> [options]

Builds mobile runtime card-source payloads from the external card make workspace.

Options:
  --card-make-root <dir>  External workspace root. Defaults to ../card make.
  --scope-card-ids <ids>  Comma-separated card IDs to include. Required.
  --output-dir <dir>      Directory for generated per-track JSON payloads. Required.
  --source-id <id>        Payload source id. Defaults to ${DEFAULT_SOURCE_ID}.
  --source-label <label>  Payload source label. Defaults to ${DEFAULT_SOURCE_LABEL}.`);
}

function parseArgs(argv) {
  const options = {
    cardMakeRoot: DEFAULT_CARD_MAKE_ROOT,
    outputDir: null,
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
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      case '--output-dir':
        options.outputDir = resolve(requireNextValue(argv, index, arg));
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

  if (options.scopeCardIds.length === 0) {
    throw new Error('--scope-card-ids is required.');
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

      found.set(String(card.card_id), {
        card,
        file: filePath,
      });
    }
  }

  const missing = options.scopeCardIds.filter(cardId => !found.has(cardId));
  if (missing.length > 0) {
    throw new Error(`Missing card ids in card make workspace: ${missing.join(', ')}`);
  }

  return options.scopeCardIds.map(cardId => found.get(cardId));
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function firstText(...values) {
  for (const value of values) {
    const text = nonEmptyString(value);
    if (text) return text;
  }

  return null;
}

function knowledgeRef(card) {
  const ref = card.knowledge_ref && typeof card.knowledge_ref === 'object'
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

function buildRuntimeCard(record) {
  const {card} = record;
  const ref = knowledgeRef(card);
  const track = requireTrack(card.track || ref.track, card.card_id);
  const interactionId = requiredText(card, 'interaction_id', card.interaction_id);
  const base = {
    card_id: String(card.card_id),
    track,
    knowledge_ref: ref.box_ref,
    interaction_id: interactionId,
    front: buildFront(card, ref),
    analysis: buildAnalysis(card, ref),
    space_metadata: {
      box_ref: ref.box_ref,
      library: requiredText(card, 'space_metadata.library', ref.library),
      group: requiredText(card, 'space_metadata.group', ref.group),
      box: requiredText(card, 'space_metadata.box', ref.box),
    },
  };

  switch (interactionId) {
    case 'flip':
      return {
        ...base,
        back_text: requiredText(card, 'back_text', card.back_content?.text),
      };
    case 'multiple_choice':
      return {
        ...base,
        options: buildOptions(card),
        auto_scoring: true,
        answer_key: {
          correct_option: requiredText(
            card,
            'answer_key.correct_option',
            card.answer_key?.correct_option,
          ),
        },
      };
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
          correct_state: requiredText(
            card,
            'answer_key.correct_state',
            card.answer_key?.correct_state,
          ),
        },
      };
    default:
      throw new Error(`${card.card_id} has unsupported interaction_id: ${interactionId}`);
  }
}

function requireTrack(value, cardId) {
  const track = firstText(value);

  if (!TRACKS.includes(track)) {
    throw new Error(`${cardId} track must be cet4 or cet6.`);
  }

  return track;
}

function buildOptions(card) {
  const options = Array.isArray(card.options) ? card.options : [];

  if (options.length !== 4) {
    throw new Error(`${card.card_id} multiple_choice must have exactly 4 options.`);
  }

  return options.map((option, index) => {
    const key = firstText(option?.key, option?.id, String.fromCharCode(65 + index));
    return {
      id: key,
      label: key,
      text: requiredText(card, `options[${index}].text`, option?.text),
    };
  });
}

function buildLockSlots(card, lockPattern) {
  const sourceSlots = Array.isArray(card.lock_slots) ? card.lock_slots : [];
  const wordBank = requireStringArray(card.word_bank, `${card.card_id} word_bank`);

  return lockPattern.map((expected, index) => {
    const sourceSlot = sourceSlots[index] || {};
    const sourceOptions = Array.isArray(sourceSlot.options) ? sourceSlot.options : wordBank;
    const options = uniqueStrings([...sourceOptions, expected]);

    return {
      id: firstText(sourceSlot.id, `slot_${index + 1}`),
      label: firstText(sourceSlot.label, `空 ${index + 1}`),
      options,
    };
  });
}

function buildEliminationItems(card) {
  const items = Array.isArray(card.elimination_items) ? card.elimination_items : [];

  if (items.length === 0) {
    throw new Error(`${card.card_id} elimination_items must not be empty.`);
  }

  return items.map((item, index) => ({
    id: requiredText(card, `elimination_items[${index}].id`, item?.id, item?.text),
    text: requiredText(card, `elimination_items[${index}].text`, item?.text),
  }));
}

function buildSwipeStates(card) {
  const states = Array.isArray(card.swipe_states) ? card.swipe_states : [];

  if (states.length !== 2) {
    throw new Error(`${card.card_id} swipe_states must contain exactly 2 states.`);
  }

  return states.map((state, index) => ({
    id: requiredText(card, `swipe_states[${index}].id`, state?.id),
    label: requiredText(card, `swipe_states[${index}].label`, state?.label),
    description: requiredText(
      card,
      `swipe_states[${index}].description`,
      state?.description,
      state?.label,
    ),
  }));
}

function requireStringArray(value, fieldName) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${fieldName} must be a non-empty array.`);
  }

  return uniqueStrings(value);
}

function uniqueStrings(values) {
  return [...new Set(values.map(value => String(value).trim()).filter(Boolean))];
}

function groupByTrack(cards) {
  const groups = new Map(TRACKS.map(track => [track, []]));

  for (const card of cards) {
    groups.get(card.track).push(card);
  }

  return groups;
}

function sanitizeFilePart(value) {
  return String(value).replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
}

function writePayloads(options, runtimeCards) {
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
    const validated = validateCardSourceCatalogMapping(
      validateCardSourceForImport(payload, track),
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
    });
  }

  return outputs;
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const scopedCards = loadScopedCards(options);
    const runtimeCards = scopedCards.map(buildRuntimeCard);
    const outputs = writePayloads(options, runtimeCards);

    console.log(JSON.stringify({
      ok: true,
      card_make_root: options.cardMakeRoot,
      outputs,
      scope_card_ids: options.scopeCardIds,
    }, null, 2));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[card-make-runtime-payload] ${message}`);
    process.exit(1);
  }
}

main();
