#!/usr/bin/env node

import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {validateCardSourceCatalogMapping} from '../infra/cloudbase/card-source-catalog.mjs';

const require = createRequire(import.meta.url);
const {
  createMemoryStore,
  createSoftbookApi,
  validateCardSourceForImport,
} = require('../infra/cloudbase/functions/softbook-api');

const TRACKS = ['cet4', 'cet6'];
const DEFAULT_OUTPUT = 'docs/release/content-gap-report.md';
const FREE_ACCESS_TARGET_RATIO = 0.5;

function parseArgs(argv) {
  const options = {
    candidateCardSources: [],
    format: 'markdown',
    output: DEFAULT_OUTPUT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
      case '--candidate-card-source':
        options.candidateCardSources.push(requireNextValue(argv, index, arg));
        index += 1;
        break;
      case '--format':
        options.format = requireNextValue(argv, index, arg);
        index += 1;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
      case '--output':
        options.output = requireNextValue(argv, index, arg);
        index += 1;
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!['json', 'markdown'].includes(options.format)) {
    throw new Error('--format must be markdown or json.');
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

function printUsage() {
  console.log(`Usage: node scripts/report_release_content_gap.mjs [--output <path>] [--format markdown|json] [--candidate-card-source <json>...]

Creates a release content gap report from spec/box-catalog.json and the current repository dev card source.
Pass one or more --candidate-card-source files to add a validated candidate handoff delta without changing the current-source baseline.`);
}

function repoRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function loadCandidateCardSources(root, filePaths) {
  return filePaths.map(filePath => {
    const resolvedPath = resolve(root, filePath);
    const payload = readJson(resolvedPath);
    const track = payload.track;

    if (!TRACKS.includes(track)) {
      throw new Error(`${filePath} must declare track cet4 or cet6.`);
    }

    const cardSource = validateCardSourceCatalogMapping(
      validateCardSourceForImport(payload, track),
    );

    return {
      card_records: cardSource.card_records,
      file: filePath,
      resolved_path: resolvedPath,
      source: cardSource.source,
      track,
    };
  });
}

async function loadCurrentCards() {
  const api = createSoftbookApi({
    smsCode: '2468',
    store: createMemoryStore(),
    tokenSecret: 'content-gap-report-secret',
  });
  const challenge = await api.handleHttpRequest({
    body: {phone_number: '13800138000'},
    clientIp: '127.0.0.1',
    headers: {},
    method: 'POST',
    path: '/v2/auth/request-code',
    query: {},
  });
  const auth = await api.handleHttpRequest({
    body: {
      challenge_id: challenge.body.data.challenge_id,
      phone_number: '13800138000',
      sms_code: '2468',
    },
    clientIp: '127.0.0.1',
    headers: {},
    method: 'POST',
    path: '/v2/auth/verify-code',
    query: {},
  });
  const authorization = `Bearer ${auth.body.data.access_token}`;
  const cardsByTrack = {};

  for (const track of TRACKS) {
    const response = await api.handleHttpRequest({
      headers: {authorization},
      method: 'GET',
      path: '/v1/learning/card-source',
      query: {track},
    });
    cardsByTrack[track] = response.body.data.card_records;
  }

  return cardsByTrack;
}

function flattenCatalog(catalog) {
  const rows = [];

  for (const library of catalog.libraries) {
    for (const group of library.groups) {
      for (const box of group.boxes) {
        rows.push({
          library: library.name,
          group: group.name,
          box: box.name,
          prefixes: {
            cet4: box.resolved_box_prefixes?.cet4,
            cet6: box.resolved_box_prefixes?.cet6,
          },
          planned: {
            cet4: box.card_counts?.cet4 ?? 0,
            cet6: box.card_counts?.cet6 ?? 0,
          },
          status: box.status ?? '',
        });
      }
    }
  }

  return rows;
}

function currentCardsByRef(cardsByTrack) {
  const byTrack = {};

  for (const track of TRACKS) {
    byTrack[track] = new Map();

    for (const card of cardsByTrack[track]) {
      const ref = cardCatalogRef(card);

      if (!byTrack[track].has(ref)) {
        byTrack[track].set(ref, []);
      }

      byTrack[track].get(ref).push(card);
    }
  }

  return byTrack;
}

function cardCatalogRef(card) {
  return card.space_metadata?.box_ref ?? card.knowledge_ref;
}

function summarize(catalogRows, cardsByTrack, candidateSources = []) {
  const currentByRef = currentCardsByRef(cardsByTrack);
  const catalogRefsByTrack = {
    cet4: new Set(catalogRows.map(row => row.prefixes.cet4).filter(Boolean)),
    cet6: new Set(catalogRows.map(row => row.prefixes.cet6).filter(Boolean)),
  };
  const rows = catalogRows.map(row => {
    const current = {};
    const gap = {};

    for (const track of TRACKS) {
      current[track] = currentByRef[track].get(row.prefixes[track])?.length ?? 0;
      gap[track] = Math.max(0, row.planned[track] - current[track]);
    }

    return {
      ...row,
      current,
      gap,
    };
  });
  const unmappedCards = {};
  const summary = {};

  for (const track of TRACKS) {
    unmappedCards[track] = cardsByTrack[track]
      .filter(card => !catalogRefsByTrack[track].has(cardCatalogRef(card)))
      .map(card => ({
        box_ref: card.space_metadata?.box_ref ?? '',
        card_id: card.card_id,
        interaction_id: card.interaction_id,
        knowledge_ref: card.knowledge_ref,
      }));

    const planned = rows.reduce((sum, row) => sum + row.planned[track], 0);
    const mappedCurrent = rows.reduce((sum, row) => sum + row.current[track], 0);
    const current = cardsByTrack[track].length;
    const freeTarget = Math.ceil(planned * FREE_ACCESS_TARGET_RATIO);

    summary[track] = {
      coverage_ratio: planned > 0 ? mappedCurrent / planned : 0,
      current,
      free_target_gap: Math.max(0, freeTarget - mappedCurrent),
      free_target_cards: freeTarget,
      gap: Math.max(0, planned - mappedCurrent),
      mapped_current: mappedCurrent,
      missing_boxes: rows.filter(row => row.planned[track] > 0 && row.current[track] === 0).length,
      planned,
      unmapped_current: unmappedCards[track].length,
    };
  }

  return {
    candidate_handoff_delta: summarizeCandidateDelta(rows, cardsByTrack, candidateSources),
    generated_at: new Date().toISOString(),
    product_truth: 'Public release content must satisfy the active CET4/CET6 box catalog, free users need near-half normal card access, and current card records must map to active box prefixes.',
    implementation_hypothesis: 'This report compares the active box catalog against the repository development card source. Candidate handoff deltas, when present, are dry-run projections only. They do not prove production content quality, production SMS, payment, content approval, import application, or App Store readiness.',
    rows,
    summary,
    unmapped_cards: unmappedCards,
  };
}

function summarizeCandidateDelta(rows, cardsByTrack, candidateSources) {
  if (candidateSources.length === 0) return null;

  const currentCardIds = Object.fromEntries(
    TRACKS.map(track => [track, new Set(cardsByTrack[track].map(card => card.card_id))]),
  );
  const candidateState = Object.fromEntries(
    TRACKS.map(track => [
      track,
      {
        duplicateCandidateIds: new Set(),
        rawCount: 0,
        recordsById: new Map(),
      },
    ]),
  );

  for (const source of candidateSources) {
    const state = candidateState[source.track];

    for (const card of source.card_records) {
      state.rawCount += 1;
      if (state.recordsById.has(card.card_id)) {
        state.duplicateCandidateIds.add(card.card_id);
        continue;
      }
      state.recordsById.set(card.card_id, card);
    }
  }

  const candidateNewByRef = Object.fromEntries(
    TRACKS.map(track => [track, new Map()]),
  );

  for (const track of TRACKS) {
    for (const card of candidateState[track].recordsById.values()) {
      if (currentCardIds[track].has(card.card_id)) continue;

      const ref = cardCatalogRef(card);
      if (!candidateNewByRef[track].has(ref)) {
        candidateNewByRef[track].set(ref, []);
      }
      candidateNewByRef[track].get(ref).push(card);
    }
  }

  const deltaRows = [];
  const summary = {};

  for (const row of rows) {
    for (const track of TRACKS) {
      const prefix = row.prefixes[track];
      if (!prefix) continue;

      const candidateNew = candidateNewByRef[track].get(prefix)?.length ?? 0;
      if (candidateNew === 0) continue;

      const current = row.current[track];
      const planned = row.planned[track];
      const projectedCurrent = current + candidateNew;

      deltaRows.push({
        box: row.box,
        candidate_new: candidateNew,
        current,
        gap_before: Math.max(0, planned - current),
        gap_delta: Math.min(candidateNew, Math.max(0, planned - current)),
        group: row.group,
        library: row.library,
        planned,
        prefix,
        projected_current: projectedCurrent,
        projected_gap: Math.max(0, planned - projectedCurrent),
        track,
      });
    }
  }

  for (const track of TRACKS) {
    const planned = rows.reduce((sum, row) => sum + row.planned[track], 0);
    const mappedCurrent = rows.reduce((sum, row) => sum + row.current[track], 0);
    const gapBefore = Math.max(0, planned - mappedCurrent);
    const freeTarget = Math.ceil(planned * FREE_ACCESS_TARGET_RATIO);
    const freeGapBefore = Math.max(0, freeTarget - mappedCurrent);
    const duplicateCurrentCards = [...candidateState[track].recordsById.keys()]
      .filter(cardId => currentCardIds[track].has(cardId))
      .length;
    const candidateNewMapped = deltaRows
      .filter(row => row.track === track)
      .reduce((sum, row) => sum + row.candidate_new, 0);
    const projectedMappedCurrent = mappedCurrent + candidateNewMapped;

    summary[track] = {
      candidate_cards: candidateState[track].rawCount,
      candidate_duplicate_cards: candidateState[track].duplicateCandidateIds.size,
      duplicate_current_cards: duplicateCurrentCards,
      free_target_gap_delta: Math.min(candidateNewMapped, freeGapBefore),
      gap_delta: Math.min(candidateNewMapped, gapBefore),
      new_mapped_cards: candidateNewMapped,
      projected_free_target_gap: Math.max(0, freeTarget - projectedMappedCurrent),
      projected_gap: Math.max(0, planned - projectedMappedCurrent),
      projected_mapped_current: projectedMappedCurrent,
      unique_candidate_cards: candidateState[track].recordsById.size,
    };
  }

  return {
    rows: deltaRows,
    source_files: candidateSources.map(source => ({
      cards: source.card_records.length,
      file: source.file,
      source_id: source.source.id,
      source_label: source.source.label,
      track: source.track,
    })),
    summary,
  };
}

function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function escapeCell(value) {
  return String(value).replaceAll('|', '\\|').replace(/\s+/g, ' ').trim();
}

function renderMarkdown(report) {
  const lines = [];

  lines.push('# Release Content Gap Report');
  lines.push('');
  lines.push('Referenced specs: `spec/requirement-memory.json`, `spec/product-core.json`, `spec/box-catalog.json`, `spec/membership.json`, `spec/runtime-boundaries.json`, `spec/platform-contract.json`.');
  lines.push('');
  lines.push(`Generated at: \`${report.generated_at}\``);
  lines.push('');
  lines.push(`\`product_truth\`: ${report.product_truth}`);
  lines.push('');
  lines.push(`\`implementation_hypothesis\`: ${report.implementation_hypothesis}`);
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Track | Planned cards | Current cards | Mapped current | Unmapped current | Gap to full catalog | Mapped coverage | Near-half free target | Gap to free target | Missing boxes |');
  lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');

  for (const track of TRACKS) {
    const item = report.summary[track];
    lines.push(`| ${track.toUpperCase()} | ${item.planned} | ${item.current} | ${item.mapped_current} | ${item.unmapped_current} | ${item.gap} | ${percent(item.coverage_ratio)} | ${item.free_target_cards} | ${item.free_target_gap} | ${item.missing_boxes} |`);
  }

  if (report.candidate_handoff_delta) {
    lines.push('');
    lines.push('## Candidate Handoff Delta');
    lines.push('');
    lines.push('These dry-run figures are calculated from validated candidate `card-source` payloads. They do not approve content, apply an import, or change the current repository development source.');
    lines.push('');
    lines.push('### Candidate Sources');
    lines.push('');
    lines.push('| Track | Cards | Source ID | File |');
    lines.push('| --- | ---: | --- | --- |');

    for (const source of report.candidate_handoff_delta.source_files) {
      lines.push(`| ${source.track.toUpperCase()} | ${source.cards} | ${escapeCell(source.source_id)} | ${escapeCell(source.file)} |`);
    }

    lines.push('');
    lines.push('### Candidate Summary');
    lines.push('');
    lines.push('| Track | Candidate cards | Unique candidate cards | New mapped cards | Duplicate current cards | Gap delta | Projected full gap | Free-target gap delta | Projected free-target gap |');
    lines.push('| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');

    for (const track of TRACKS) {
      const item = report.candidate_handoff_delta.summary[track];
      lines.push(`| ${track.toUpperCase()} | ${item.candidate_cards} | ${item.unique_candidate_cards} | ${item.new_mapped_cards} | ${item.duplicate_current_cards} | ${item.gap_delta} | ${item.projected_gap} | ${item.free_target_gap_delta} | ${item.projected_free_target_gap} |`);
    }

    lines.push('');
    lines.push('### Candidate Box Delta');
    lines.push('');
    lines.push('| Track | Library | Group | Box | Prefix | Planned | Current | Candidate new | Projected current | Gap before | Projected gap |');
    lines.push('| --- | --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |');

    for (const row of report.candidate_handoff_delta.rows) {
      lines.push([
        row.track.toUpperCase(),
        escapeCell(row.library),
        escapeCell(row.group),
        escapeCell(row.box),
        row.prefix,
        row.planned,
        row.current,
        row.candidate_new,
        row.projected_current,
        row.gap_before,
        row.projected_gap,
      ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
    }
  }

  lines.push('');
  lines.push('## Current Unmapped Cards');
  lines.push('');
  lines.push('These cards exist in the repository development card source but do not map to active `box-catalog` prefixes for their track.');
  lines.push('');
  lines.push('| Track | Card ID | Knowledge Ref | Box Ref | Interaction |');
  lines.push('| --- | --- | --- | --- | --- |');

  for (const track of TRACKS) {
    const cards = report.unmapped_cards[track];

    if (cards.length === 0) {
      lines.push(`| ${track.toUpperCase()} | - | - | - | - |`);
      continue;
    }

    for (const card of cards) {
      lines.push(`| ${track.toUpperCase()} | ${card.card_id} | ${card.knowledge_ref} | ${card.box_ref} | ${card.interaction_id} |`);
    }
  }

  lines.push('');
  lines.push('## Box Gap Table');
  lines.push('');
  lines.push('| Library | Group | Box | CET4 Prefix | CET4 Planned | CET4 Current | CET4 Gap | CET6 Prefix | CET6 Planned | CET6 Current | CET6 Gap |');
  lines.push('| --- | --- | --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |');

  for (const row of report.rows) {
    lines.push([
      escapeCell(row.library),
      escapeCell(row.group),
      escapeCell(row.box),
      row.prefixes.cet4,
      row.planned.cet4,
      row.current.cet4,
      row.gap.cet4,
      row.prefixes.cet6,
      row.planned.cet6,
      row.current.cet6,
      row.gap.cet6,
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'));
  }

  lines.push('');
  lines.push('## Immediate Implications');
  lines.push('');
  lines.push('- The current development source is enough to prove the five core interaction shapes, but it is not enough for public release content.');
  lines.push('- The current development cards map to active `box-catalog` prefixes, but mapped coverage is still far below the free-after-trial near-half target.');
  lines.push('- Candidate handoff deltas quantify validated dry-run payload contribution only; they do not approve content or apply production imports.');
  lines.push('- To reach the free-after-trial near-half target before full catalog completion, the current mapped content must reach the `Near-half free target` counts above.');

  return `${lines.join('\n')}\n`;
}

function writeOutput(path, text) {
  mkdirSync(dirname(path), {recursive: true});
  writeFileSync(path, text);
}

async function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const root = repoRoot();
    const catalog = readJson(resolve(root, 'spec/box-catalog.json'));
    const cardsByTrack = await loadCurrentCards();
    const candidateSources = loadCandidateCardSources(root, options.candidateCardSources);
    const report = summarize(flattenCatalog(catalog), cardsByTrack, candidateSources);
    const outputPath = resolve(root, options.output);
    const rendered =
      options.format === 'json'
        ? `${JSON.stringify(report, null, 2)}\n`
        : renderMarkdown(report);

    writeOutput(outputPath, rendered);
    console.log(`[ok] wrote ${options.format} content gap report to ${options.output}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[content-gap-report] ${message}`);
    process.exit(1);
  }
}

main();
