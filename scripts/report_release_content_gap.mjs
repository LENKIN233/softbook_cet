#!/usr/bin/env node

import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require = createRequire(import.meta.url);
const {
  createMemoryStore,
  createSoftbookApi,
} = require('../infra/cloudbase/functions/softbook-api');

const TRACKS = ['cet4', 'cet6'];
const DEFAULT_OUTPUT = 'docs/release/content-gap-report.md';
const FREE_ACCESS_TARGET_RATIO = 0.5;

function parseArgs(argv) {
  const options = {
    format: 'markdown',
    output: DEFAULT_OUTPUT,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    switch (arg) {
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
  console.log(`Usage: node scripts/report_release_content_gap.mjs [--output <path>] [--format markdown|json]

Creates a release content gap report from spec/box-catalog.json and the current repository dev card source.`);
}

function repoRoot() {
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

async function loadCurrentCards() {
  const api = createSoftbookApi({
    smsCode: '2468',
    store: createMemoryStore(),
    tokenSecret: 'content-gap-report-secret',
  });
  const auth = await api.handleHttpRequest({
    body: {
      phone_number: '13800138000',
      sms_code: '2468',
    },
    headers: {},
    method: 'POST',
    path: '/v1/auth/verify-code',
    query: {},
  });
  const authorization = `Bearer ${auth.body.data.auth_token}`;
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

function summarize(catalogRows, cardsByTrack) {
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
    generated_at: new Date().toISOString(),
    product_truth: 'Public release content must satisfy the active CET4/CET6 box catalog, free users need near-half normal card access, and current card records must map to active box prefixes.',
    implementation_hypothesis: 'This report compares the active box catalog against the repository development card source. It does not prove production content quality, production SMS, payment, or App Store readiness.',
    rows,
    summary,
    unmapped_cards: unmappedCards,
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
  lines.push('- CET6 currently has repository dev cards, but they are unmapped against the active `box-catalog` prefixes and therefore should not be counted as catalog coverage until corrected or the catalog is intentionally revised.');
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
    const report = summarize(flattenCatalog(catalog), cardsByTrack);
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
