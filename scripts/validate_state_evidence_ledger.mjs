#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const LEDGER_RELATIVE_PATH =
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/state-evidence-ledger.md';
export const CONTRACT_RELATIVE_PATH =
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/grayscale-ux-state-contract.md';

export const MACHINE_SCHEMA = 'state-evidence-ledger.machine.v1';
export const TARGET_ENVIRONMENT_PROFILE = 'required-target-matrix-v1';
export const SOURCE_COHORT =
  'build=ux-architecture-v5-strict-4;commit=bd3ed0f54350b252f1554872de5a07cd09f97232;service=unproven';
export const BASELINE_FACTS_SHA256 =
  '5c90dfba3548a95ab271d723efd672d1074a632c39d1a808c2ba6986e3172afc';
export const CONTRACT_IDENTITY_SHA256 =
  '95af9dfb8a7bb9f5efc3f234765208514055a7df0569a96bac4ed82878b920dc';
export const COV_OWNER_AUTHORITY_SHA256 =
  'efbf93b9d20425a5c4b298014245ccbb6549a6c3f5d7c9699897403ee68bdcf1';

const LEGACY_HEADERS = [
  'State',
  'Contract transcript',
  'iOS phone browser',
  'Android phone browser',
  'iPadOS browser',
  'Android tablet browser',
  'Shared access-profile browser',
  'Native',
  'PC Web',
  'Evidence pointer',
];

export const MACHINE_HEADERS = [
  ...LEGACY_HEADERS,
  'Evidence class',
  'Owner',
  'Target environment',
  'Test case',
  'Build / commit / service cohort',
  'Current result',
];

const RESULT_COLUMNS = [
  'Contract transcript',
  'iOS phone browser',
  'Android phone browser',
  'iPadOS browser',
  'Android tablet browser',
  'Shared access-profile browser',
  'Native',
  'PC Web',
];

const COVERED_RESULTS = new Set([
  'covered_exact_transcript',
  'covered_browser_scenario',
  'covered_shared_browser_scenario',
]);

const ALLOWED_RESULTS = new Set([
  ...COVERED_RESULTS,
  'observed_browser_presentation_only',
  'blocked_not_rendered',
  'blocked_not_replayed',
  'blocked_partial_scenario',
  'blocked_origin_unproven',
  'failed_browser_scenario',
  'blocked_native',
  'blocked_pc_web_mapping',
  'not_applicable_with_authority',
]);

const COV_OWNERS = new Map([
  ['COV-01', 'A-SHELL+A-NAV'],
  ['COV-02', 'A-SHELL+A-LEARN+A-CHECKIN+A-SPACE+A-MEMBER'],
  ['COV-03', 'A-INTERACT+A-LEARN'],
  ['COV-04', 'A-INTERACT+A-PLATFORM'],
  ['COV-05', 'A-INTERACT+A-PLATFORM+A-WEB'],
  ['COV-06', 'A-MEMBER+A-LEARN+A-SPACE+A-MINE'],
  ['COV-07', 'A-MEMBER+A-PLATFORM+A-SHELL'],
  ['COV-08', 'A-MEMBER+A-SHELL+A-PLATFORM'],
  ['COV-09', 'A-MEMBER+A-BETA'],
  ['COV-10', 'A-SPACE+A-PLATFORM+A-LEARN'],
  ['COV-11', 'A-AUDIO+A-LEARN+A-PLATFORM'],
  ['COV-12', 'A-SHELL+A-MEMBER+A-PLATFORM'],
  ['COV-13', 'A-WEB+A-PLATFORM'],
]);

const EXPECTED_SEMANTIC_STATE_COUNT = 160;
const EXPECTED_COV_STATE_COUNT = 13;

function stripCode(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('`') && trimmed.endsWith('`')) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function code(value) {
  return `\`${value}\``;
}

function splitMarkdownRow(line) {
  return line
    .split('|')
    .slice(1, -1)
    .map((cell) => cell.trim());
}

function stateIdentity(stateCell) {
  const match = stripCode(stateCell).match(/^([A-Z][A-Z0-9-]*-\d{2})\s+(.+)$/);
  if (!match) return null;
  return { id: match[1], name: match[2] };
}

export function parseLedger(markdown) {
  const lines = markdown.split('\n');
  const headerIndex = lines.findIndex((line) =>
    line.startsWith('| State | Contract transcript | iOS phone browser |'),
  );
  if (headerIndex < 0) throw new Error('Per-state ledger table header was not found.');

  const headers = splitMarkdownRow(lines[headerIndex]);
  const rows = [];
  let endIndex = headerIndex + 2;

  for (; endIndex < lines.length; endIndex += 1) {
    const line = lines[endIndex];
    if (!line.startsWith('|')) break;
    const cells = splitMarkdownRow(line);
    const identity = stateIdentity(cells[0] ?? '');
    if (!identity) throw new Error(`Invalid state row at line ${endIndex + 1}.`);
    rows.push({
      lineIndex: endIndex,
      cells,
      ...identity,
    });
  }

  return { lines, headerIndex, endIndex, headers, rows };
}

function normalizeOwner(authorityCell) {
  return authorityCell
    .split(',')
    .map((part) => stripCode(part))
    .filter(Boolean)
    .join('+');
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function parseAuthorityShorthand(markdown) {
  const authorities = new Map();
  for (const line of markdown.split('\n')) {
    if (!line.startsWith('| `A-')) continue;
    const cells = splitMarkdownRow(line);
    const codeValue = stripCode(cells[0] ?? '');
    if (!/^A-[A-Z]+$/.test(codeValue)) continue;
    const authority = cells[1]?.trim() ?? '';
    if (!authority) throw new Error(`Authority shorthand ${codeValue} has no anchor.`);
    if (authorities.has(codeValue)) {
      throw new Error(`Duplicate authority shorthand ${codeValue}.`);
    }
    authorities.set(codeValue, authority);
  }
  if (authorities.size === 0) throw new Error('No Authority shorthand table was found.');
  return authorities;
}

function ownerCodes(owner) {
  if (!owner) return [];
  return owner.split('+').filter(Boolean);
}

function assertKnownOwner({ owner, authorities, stateId }) {
  const codes = ownerCodes(owner);
  if (codes.length === 0) throw new Error(`No owner can be derived for ${stateId}.`);
  for (const authorityCode of codes) {
    if (!/^A-[A-Z]+$/.test(authorityCode)) {
      throw new Error(`${stateId} uses malformed owner code ${authorityCode}.`);
    }
    if (!authorities.has(authorityCode)) {
      throw new Error(`${stateId} uses unknown Authority shorthand ${authorityCode}.`);
    }
  }
}

function covOwnerAuthorityDigest() {
  return sha256(
    [...COV_OWNERS.entries()]
      .map(([stateId, owner]) => `${stateId}\u001f${owner}`)
      .join('\n'),
  );
}

function contractIdentityDigest({ authorities, states }) {
  const authorityIdentity = [...authorities.entries()]
    .map(([authorityCode, anchor]) => `AUTH\u001f${authorityCode}\u001f${anchor}`)
    .join('\n');
  const stateIdentity = [...states.values()]
    .map(({ id, name, owner }) => `STATE\u001f${id}\u001f${name}\u001f${owner}`)
    .join('\n');
  return sha256(`${authorityIdentity}\n${stateIdentity}`);
}

export function parseContract(markdown) {
  const authorities = parseAuthorityShorthand(markdown);
  const states = new Map();

  for (const line of markdown.split('\n')) {
    if (!line.startsWith('| `')) continue;
    const cells = splitMarkdownRow(line);
    const identity = stateIdentity(cells[0] ?? '');
    if (!identity) continue;

    const owner = identity.id.startsWith('COV-')
      ? COV_OWNERS.get(identity.id)
      : normalizeOwner(cells[1] ?? '');
    assertKnownOwner({ owner, authorities, stateId: identity.id });
    if (states.has(identity.id)) throw new Error(`Duplicate contract state ${identity.id}.`);
    states.set(identity.id, { ...identity, owner });
  }

  const semanticCount = [...states.keys()].filter((stateId) => !stateId.startsWith('COV-')).length;
  const covCount = states.size - semanticCount;
  if (semanticCount !== EXPECTED_SEMANTIC_STATE_COUNT) {
    throw new Error(
      `Expected ${EXPECTED_SEMANTIC_STATE_COUNT} semantic contract states, found ${semanticCount}.`,
    );
  }
  if (covCount !== EXPECTED_COV_STATE_COUNT) {
    throw new Error(`Expected ${EXPECTED_COV_STATE_COUNT} COV contract states, found ${covCount}.`);
  }
  for (const stateId of COV_OWNERS.keys()) {
    if (!states.has(stateId)) throw new Error(`Frozen COV owner anchor ${stateId} is absent.`);
  }

  const covDigest = covOwnerAuthorityDigest();
  if (covDigest !== COV_OWNER_AUTHORITY_SHA256) {
    throw new Error(
      `Frozen COV owner authority changed: expected ${COV_OWNER_AUTHORITY_SHA256}, found ${covDigest}.`,
    );
  }
  const identityDigest = contractIdentityDigest({ authorities, states });
  if (identityDigest !== CONTRACT_IDENTITY_SHA256) {
    throw new Error(
      `Contract ID/title/owner identity changed: expected ${CONTRACT_IDENTITY_SHA256}, found ${identityDigest}.`,
    );
  }

  return states;
}

function resultValues(row) {
  return row.cells.slice(1, 9).map(stripCode);
}

export function deriveEvidenceClass(row) {
  const values = resultValues(row);
  const classes = ['architecture_transcript'];

  if (values.includes('covered_browser_scenario')) classes.push('browser_scenario');
  if (values.includes('covered_shared_browser_scenario')) {
    classes.push('shared_browser_scenario');
  }
  if (values.includes('observed_browser_presentation_only')) {
    classes.push('browser_presentation_only');
  }
  if (values.includes('blocked_partial_scenario')) classes.push('browser_partial_scenario');
  if (values.includes('blocked_origin_unproven')) classes.push('browser_origin_unproven');

  return classes.join('+');
}

export function deriveCurrentResult(row) {
  // `not_applicable_with_authority` is deliberately unresolved here. A target can
  // be removed from a future profile only by changing the profile and its owner
  // contract; inserting N/A into a cell can never manufacture a passing row.
  return resultValues(row).every((result) => COVERED_RESULTS.has(result))
    ? 'covered_required_targets'
    : 'blocked_required_target';
}

function expectedTestCase(stateId) {
  return `UXSTATE::${stateId}::${TARGET_ENVIRONMENT_PROFILE}`;
}

function factCells(row) {
  return row.cells.slice(0, 10).map(stripCode);
}

export function factsDigest(rows) {
  const canonical = rows.map((row) => factCells(row).join('\u001f')).join('\n');
  return createHash('sha256').update(canonical).digest('hex');
}

function expectedMachineCells(row, contractState) {
  return [
    code(deriveEvidenceClass(row)),
    code(contractState.owner),
    code(TARGET_ENVIRONMENT_PROFILE),
    code(expectedTestCase(row.id)),
    code(SOURCE_COHORT),
    code(deriveCurrentResult(row)),
  ];
}

function hasBareNotApplicable(value) {
  return /^(?:n\/?a|not[ _-]?applicable|none)$/i.test(stripCode(value));
}

function machineMarkerChecks(markdown, errors) {
  const requiredMarkers = [
    `- Machine schema: \`${MACHINE_SCHEMA}\`.`,
    `- Frozen fact digest: \`${BASELINE_FACTS_SHA256}\`.`,
    `- Frozen contract ID/title/owner digest: \`${CONTRACT_IDENTITY_SHA256}\`.`,
    `- Frozen COV owner authority digest: \`${COV_OWNER_AUTHORITY_SHA256}\`.`,
    `- Target environment profile: \`${TARGET_ENVIRONMENT_PROFILE}\`.`,
    `- Frozen source cohort: \`${SOURCE_COHORT}\`.`,
  ];
  for (const marker of requiredMarkers) {
    if (!markdown.includes(marker)) errors.push(`Missing machine contract marker: ${marker}`);
  }
}

export function validateLedger({ ledgerMarkdown, contractMarkdown }) {
  const errors = [];
  let parsed;
  let contractStates;

  try {
    parsed = parseLedger(ledgerMarkdown);
  } catch (error) {
    return { errors: [error.message], rowCount: 0 };
  }
  try {
    contractStates = parseContract(contractMarkdown);
  } catch (error) {
    return { errors: [error.message], rowCount: parsed.rows.length };
  }

  machineMarkerChecks(ledgerMarkdown, errors);

  if (parsed.headers.length !== MACHINE_HEADERS.length) {
    errors.push(
      `Expected ${MACHINE_HEADERS.length} columns, found ${parsed.headers.length}.`,
    );
  }
  if (parsed.headers.join('\u001f') !== MACHINE_HEADERS.join('\u001f')) {
    errors.push('Machine ledger headers do not match the v1 schema.');
  }
  if (parsed.rows.length !== 173) errors.push(`Expected 173 rows, found ${parsed.rows.length}.`);
  if (contractStates.size !== 173) {
    errors.push(`Expected 173 contract states, found ${contractStates.size}.`);
  }

  const seen = new Set();
  for (const row of parsed.rows) {
    if (seen.has(row.id)) errors.push(`Duplicate ledger state ${row.id}.`);
    seen.add(row.id);

    const contractState = contractStates.get(row.id);
    if (!contractState) {
      errors.push(`Ledger state ${row.id} is absent from the contract.`);
      continue;
    }
    if (row.name !== contractState.name) {
      errors.push(
        `${row.id} name mismatch: ledger=${JSON.stringify(row.name)} contract=${JSON.stringify(contractState.name)}.`,
      );
    }
    if (row.cells.length !== MACHINE_HEADERS.length) {
      errors.push(`${row.id} expected ${MACHINE_HEADERS.length} cells, found ${row.cells.length}.`);
      continue;
    }

    for (let index = 1; index <= 8; index += 1) {
      const result = stripCode(row.cells[index]);
      if (hasBareNotApplicable(result)) {
        errors.push(`${row.id} ${RESULT_COLUMNS[index - 1]} uses bare N/A.`);
      } else if (!ALLOWED_RESULTS.has(result)) {
        errors.push(`${row.id} ${RESULT_COLUMNS[index - 1]} has unknown result ${result}.`);
      }
    }

    if (stripCode(row.cells[1]) !== 'covered_exact_transcript') {
      errors.push(`${row.id} transcript result changed from the frozen exact fact.`);
    }
    if (stripCode(row.cells[7]) !== 'blocked_native') {
      errors.push(`${row.id} native result changed without a registered native evidence class.`);
    }
    if (stripCode(row.cells[8]) !== 'blocked_pc_web_mapping') {
      errors.push(`${row.id} PC Web result changed without a registered PC Web mapping class.`);
    }

    const expected = expectedMachineCells(row, contractState).map(stripCode);
    const actual = row.cells.slice(10, 16).map(stripCode);
    expected.forEach((value, offset) => {
      if (actual[offset] !== value) {
        errors.push(
          `${row.id} ${MACHINE_HEADERS[offset + 10]} mismatch: expected ${value}, found ${actual[offset] ?? '<missing>'}.`,
        );
      }
    });

    if (resultValues(row).includes('not_applicable_with_authority')) {
      if (stripCode(row.cells[15]) !== 'blocked_required_target') {
        errors.push(`${row.id} N/A-like target did not fail closed.`);
      }
    }
  }

  for (const stateId of contractStates.keys()) {
    if (!seen.has(stateId)) errors.push(`Contract state ${stateId} is absent from the ledger.`);
  }

  const digest = factsDigest(parsed.rows);
  if (digest !== BASELINE_FACTS_SHA256) {
    errors.push(
      `Frozen exact/blocked facts changed: expected ${BASELINE_FACTS_SHA256}, found ${digest}.`,
    );
  }

  return { errors, rowCount: parsed.rows.length, digest };
}

function divider(columns) {
  return `| ${columns.map(() => '---').join(' | ')} |`;
}

function renderRow(cells) {
  return `| ${cells.join(' | ')} |`;
}

export function renderLedger({ ledgerMarkdown, contractMarkdown }) {
  const parsed = parseLedger(ledgerMarkdown);
  const contractStates = parseContract(contractMarkdown);

  if (parsed.rows.length !== 173 || contractStates.size !== 173) {
    throw new Error(
      `Refusing to render: ledger=${parsed.rows.length}, contract=${contractStates.size}; expected 173 each.`,
    );
  }
  const digest = factsDigest(parsed.rows);
  if (digest !== BASELINE_FACTS_SHA256) {
    throw new Error(
      `Refusing to render changed facts: expected ${BASELINE_FACTS_SHA256}, found ${digest}.`,
    );
  }

  const renderedRows = parsed.rows.map((row) => {
    const contractState = contractStates.get(row.id);
    if (!contractState || row.name !== contractState.name) {
      throw new Error(`Refusing to render unmatched state ${row.id}.`);
    }
    return renderRow([
      ...row.cells.slice(0, 10),
      ...expectedMachineCells(row, contractState),
    ]);
  });

  const replacement = [
    renderRow(MACHINE_HEADERS),
    divider(MACHINE_HEADERS),
    ...renderedRows,
  ];
  return [
    ...parsed.lines.slice(0, parsed.headerIndex),
    ...replacement,
    ...parsed.lines.slice(parsed.endIndex),
  ].join('\n');
}

async function runCli() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');
  const rootArgument = args.find((arg) => !arg.startsWith('--'));
  const root = path.resolve(rootArgument ?? process.cwd());
  const ledgerPath = path.join(root, LEDGER_RELATIVE_PATH);
  const contractPath = path.join(root, CONTRACT_RELATIVE_PATH);
  const [ledgerMarkdown, contractMarkdown] = await Promise.all([
    readFile(ledgerPath, 'utf8'),
    readFile(contractPath, 'utf8'),
  ]);

  if (write) {
    const rendered = renderLedger({ ledgerMarkdown, contractMarkdown });
    await writeFile(ledgerPath, rendered);
    process.stdout.write(`WROTE ${LEDGER_RELATIVE_PATH}\n`);
    return;
  }

  const result = validateLedger({ ledgerMarkdown, contractMarkdown });
  if (result.errors.length > 0) {
    for (const error of result.errors) process.stderr.write(`ERROR: ${error}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `STATE EVIDENCE LEDGER OK: ${result.rowCount} rows; facts sha256 ${result.digest}\n`,
  );
}

const isMain = path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url);
if (isMain) {
  runCli().catch((error) => {
    process.stderr.write(`${error.stack ?? error.message}\n`);
    process.exitCode = 1;
  });
}
