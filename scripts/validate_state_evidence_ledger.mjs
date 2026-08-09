#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, readFileSync, realpathSync } from 'node:fs';
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
  '323c9f6eb4fbaf30296bde988f1a029c7c223c7a98326e5c90baef871d06746a';
export const COV_OWNER_AUTHORITY_SHA256 =
  '714e619cdd6b8846f8dfbc41060729dc93ada5701c7c38fd025acf3975766688';
export const CONTRACT_DOCUMENT_SHA256 =
  'f753ca396ee2870a35d9a4fa2696a0b070ff2a60c2a414b6ba1be7777abbb0f4';
export const LEDGER_SEMANTIC_IDENTITY_SHA256 =
  '78ffea9f84f41d732fec6ddc118100b2c47e2e5b81acd1124527cbd5968ccc60';

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

const PLATFORM_BROWSER_RESULTS = new Set([
  'covered_browser_scenario',
  'observed_browser_presentation_only',
  'blocked_not_rendered',
  'blocked_not_replayed',
  'blocked_partial_scenario',
  'blocked_origin_unproven',
  'failed_browser_scenario',
  'not_applicable_with_authority',
]);

const SHARED_BROWSER_RESULTS = new Set([
  'covered_shared_browser_scenario',
  'observed_browser_presentation_only',
  'blocked_not_rendered',
  'blocked_not_replayed',
  'blocked_partial_scenario',
  'blocked_origin_unproven',
  'failed_browser_scenario',
  'not_applicable_with_authority',
]);

const RESULT_ALLOWLISTS = [
  new Set(['covered_exact_transcript']),
  PLATFORM_BROWSER_RESULTS,
  PLATFORM_BROWSER_RESULTS,
  PLATFORM_BROWSER_RESULTS,
  PLATFORM_BROWSER_RESULTS,
  SHARED_BROWSER_RESULTS,
  new Set(['blocked_native', 'not_applicable_with_authority']),
  new Set(['blocked_pc_web_mapping', 'not_applicable_with_authority']),
];

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
  ['COV-12', 'A-SHELL+A-MEMBER+A-PLATFORM+A-VISUAL'],
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

function normalizeDocument(markdown) {
  return markdown.replace(/\r\n/g, '\n').trimEnd();
}

export function contractDocumentDigest(markdown) {
  return sha256(normalizeDocument(markdown));
}

export function ledgerSemanticIdentityDigest(markdown) {
  const parsed = parseLedger(markdown);
  const proseWithoutMachineTable = [
    ...parsed.lines.slice(0, parsed.headerIndex),
    ...parsed.lines.slice(parsed.endIndex),
  ]
    .filter((line) => !line.startsWith('- Frozen ledger semantic identity digest:'))
    .join('\n');
  return sha256(normalizeDocument(proseWithoutMachineTable));
}

function isContainedPath(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function githubHeadingAnchors(markdown) {
  const anchors = new Set();
  const occurrences = new Map();
  for (const line of markdown.split('\n')) {
    const match = line.match(/^#{1,6}\s+(.+?)\s*#*\s*$/);
    if (!match) continue;
    const base = match[1]
      .replace(/<[^>]*>/g, '')
      .replace(/[`*_~]/g, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .trim()
      .replace(/\s+/g, '-');
    if (!base) continue;
    const count = occurrences.get(base) ?? 0;
    occurrences.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }
  return anchors;
}

export function evidencePointerErrors(pointerCell, { repoRoot, stateId, sourceCommit }) {
  const errors = [];
  const raw = pointerCell.trim();
  if (!/^`[^`\r\n]+`(?:; `[^`\r\n]+`)*$/.test(raw)) {
    return [`${stateId} Evidence pointer has invalid reference-list syntax.`];
  }

  const root = path.resolve(repoRoot);
  let realRoot;
  try {
    realRoot = realpathSync(root);
  } catch {
    return [`${stateId} Evidence pointer repository root does not exist.`];
  }
  const ledgerDirectory = path.resolve(root, path.dirname(LEDGER_RELATIVE_PATH));
  const references = [...raw.matchAll(/`([^`]+)`/g)].map((match) => match[1]);

  for (const reference of references) {
    const hashIndex = reference.indexOf('#');
    if (hashIndex !== reference.lastIndexOf('#')) {
      errors.push(`${stateId} Evidence pointer ${reference} contains multiple anchors.`);
      continue;
    }
    const relativeFile = hashIndex < 0 ? reference : reference.slice(0, hashIndex);
    const anchor = hashIndex < 0 ? '' : reference.slice(hashIndex + 1);
    const pathSegments = relativeFile.split('/');
    if (
      !relativeFile ||
      path.isAbsolute(relativeFile) ||
      /^[A-Za-z]:/.test(relativeFile) ||
      relativeFile.includes('\\') ||
      relativeFile.includes('?') ||
      relativeFile.includes('\0') ||
      pathSegments.some((segment) => segment === '' || segment === '.' || segment === '..')
    ) {
      errors.push(`${stateId} Evidence pointer ${reference} is not a safe repository-relative reference.`);
      continue;
    }

    const candidate = path.resolve(ledgerDirectory, relativeFile);
    if (!isContainedPath(root, candidate)) {
      errors.push(`${stateId} Evidence pointer ${reference} escapes the repository root.`);
      continue;
    }
    if (!existsSync(candidate)) {
      errors.push(`${stateId} Evidence pointer ${reference} does not exist.`);
      continue;
    }
    if (!lstatSync(candidate).isFile()) {
      errors.push(`${stateId} Evidence pointer ${reference} is not a regular file.`);
      continue;
    }
    const realCandidate = realpathSync(candidate);
    if (!isContainedPath(realRoot, realCandidate)) {
      errors.push(`${stateId} Evidence pointer ${reference} resolves outside the repository root.`);
      continue;
    }

    const currentContent = readFileSync(candidate, 'utf8');
    let anchorIsWellFormed = true;
    if (!anchor) {
      if (path.basename(relativeFile) !== path.basename(CONTRACT_RELATIVE_PATH)) {
        errors.push(`${stateId} Evidence pointer ${reference} must include an exact heading anchor.`);
      }
    } else if (!/^[\p{L}\p{N}][\p{L}\p{N}-]*$/u.test(anchor)) {
      errors.push(`${stateId} Evidence pointer ${reference} has malformed heading anchor ${anchor}.`);
      anchorIsWellFormed = false;
    } else if (!githubHeadingAnchors(currentContent).has(anchor)) {
      errors.push(`${stateId} Evidence pointer ${reference} has no matching heading anchor.`);
    }

    if (!/^[0-9a-f]{40}$/.test(sourceCommit ?? '')) {
      errors.push(`${stateId} Evidence pointer ${reference} has no valid source-cohort commit binding.`);
      continue;
    }
    const repoRelative = path.relative(root, candidate).split(path.sep).join('/');
    const objectSpec = `${sourceCommit}:${repoRelative}`;
    const objectType = spawnSync('git', ['-C', root, 'cat-file', '-t', objectSpec], {
      encoding: 'utf8',
    });
    if (objectType.status !== 0 || objectType.stdout.trim() !== 'blob') {
      errors.push(
        `${stateId} Evidence pointer ${reference} is not a tracked blob in source commit ${sourceCommit}.`,
      );
      continue;
    }
    if (anchor && anchorIsWellFormed) {
      const snapshot = spawnSync('git', ['-C', root, 'show', objectSpec], {
        encoding: 'utf8',
        maxBuffer: 5 * 1024 * 1024,
      });
      if (snapshot.status !== 0 || !githubHeadingAnchors(snapshot.stdout).has(anchor)) {
        errors.push(
          `${stateId} Evidence pointer ${reference} has no matching heading anchor in source commit ${sourceCommit}.`,
        );
      }
    }
  }
  return errors;
}

const SOURCE_COHORT_PATTERN =
  /^build=([a-z0-9][a-z0-9._-]*);commit=([0-9a-f]{40});service=([a-z0-9][a-z0-9._-]*)$/;

function sourceCommitFromCohort(value) {
  return value.match(SOURCE_COHORT_PATTERN)?.[2] ?? null;
}

export function sourceCohortErrors(value, { repoRoot, headRef = 'HEAD' }) {
  const errors = [];
  const match = value.match(SOURCE_COHORT_PATTERN);
  if (!match) return [`Source cohort has invalid syntax: ${value}.`];

  const commit = match[2];
  const exists = spawnSync(
    'git',
    ['-C', path.resolve(repoRoot), 'cat-file', '-e', `${commit}^{commit}`],
    { encoding: 'utf8' },
  );
  if (exists.status !== 0) {
    errors.push(`Source cohort commit ${commit} does not exist as a commit object.`);
    return errors;
  }

  const reachable = spawnSync(
    'git',
    ['-C', path.resolve(repoRoot), 'merge-base', '--is-ancestor', commit, headRef],
    { encoding: 'utf8' },
  );
  if (reachable.status !== 0) {
    errors.push(`Source cohort commit ${commit} is not reachable from ${headRef}.`);
  }
  return errors;
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

    const owner = normalizeOwner(cells[1] ?? '');
    if (identity.id.startsWith('COV-') && owner !== COV_OWNERS.get(identity.id)) {
      throw new Error(
        `${identity.id} COV owner mismatch: expected ${COV_OWNERS.get(identity.id)}, found ${owner}.`,
      );
    }
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
  const documentDigest = contractDocumentDigest(markdown);
  if (documentDigest !== CONTRACT_DOCUMENT_SHA256) {
    throw new Error(
      `Contract document semantic identity changed: expected ${CONTRACT_DOCUMENT_SHA256}, found ${documentDigest}.`,
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

export function deriveGateBoundary(rows) {
  return rows.every((row) => deriveCurrentResult(row) === 'covered_required_targets')
    ? 'architecture_evidence_matrix_complete_owner_acceptance_pending'
    : 'architecture_gate_blocked';
}

function expectedGateSection(rows) {
  const boundary = deriveGateBoundary(rows);
  if (boundary === 'architecture_evidence_matrix_complete_owner_acceptance_pending') {
    return [
      '## Gate result',
      '',
      `- Derived gate boundary: \`${boundary}\`.`,
      '',
      'The architecture evidence matrix is **complete, with owner acceptance still pending**. Completeness cannot pass the architecture checkpoint automatically: an independent frozen review and explicit product-owner acceptance of the exact cohort remain required.',
    ].join('\n');
  }
  return [
    '## Gate result',
    '',
    `- Derived gate boundary: \`${boundary}\`.`,
    '',
    'The architecture gate remains **blocked** while any required Tier 2 device-class result, forced cross-state result, native final-acceptance result, or PC Web parity mapping is blocked. Changing a cell requires an exact evidence pointer and an independent frozen-hash review; source availability or a locally simulated timer is insufficient.',
  ].join('\n');
}

function gateBoundaryChecks(markdown, rows, errors) {
  const lines = markdown.split('\n');
  const headingIndexes = lines
    .map((line, index) => (line === '## Gate result' ? index : -1))
    .filter((index) => index >= 0);
  if (headingIndexes.length !== 1) {
    errors.push(`Expected exactly one Gate result section, found ${headingIndexes.length}.`);
    return;
  }
  const start = headingIndexes[0];
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith('## ')) {
      end = index;
      break;
    }
  }
  const actual = lines.slice(start, end).join('\n').trimEnd();
  const expected = expectedGateSection(rows);
  if (actual !== expected) {
    errors.push(
      `Gate result prose does not match derived boundary ${deriveGateBoundary(rows)}.`,
    );
  }
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
    `- Frozen contract document semantic digest: \`${CONTRACT_DOCUMENT_SHA256}\`.`,
    `- Frozen ledger semantic identity digest: \`${LEDGER_SEMANTIC_IDENTITY_SHA256}\`.`,
    `- Target environment profile: \`${TARGET_ENVIRONMENT_PROFILE}\`.`,
    `- Frozen source cohort: \`${SOURCE_COHORT}\`.`,
  ];
  for (const marker of requiredMarkers) {
    if (!markdown.includes(marker)) errors.push(`Missing machine contract marker: ${marker}`);
  }
}

export function validateLedger({
  ledgerMarkdown,
  contractMarkdown,
  repoRoot = process.cwd(),
  headRef = 'HEAD',
}) {
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
  const seenTestCases = new Set();
  const sourceCohorts = new Set();
  const pointerValidationCache = new Map();
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
      } else if (!RESULT_ALLOWLISTS[index - 1].has(result)) {
        errors.push(
          `${row.id} ${RESULT_COLUMNS[index - 1]} result ${result} is not allowed in this column.`,
        );
      }
    }

    const rowSourceCohort = stripCode(row.cells[14]);
    const sourceCommit = sourceCommitFromCohort(rowSourceCohort);
    const pointerCacheKey = `${sourceCommit ?? '<invalid>'}\u001f${row.cells[9]}`;
    let pointerErrorSuffixes = pointerValidationCache.get(pointerCacheKey);
    if (!pointerErrorSuffixes) {
      const directPointerErrors = evidencePointerErrors(row.cells[9], {
        repoRoot,
        stateId: row.id,
        sourceCommit,
      });
      const statePrefix = `${row.id} `;
      pointerErrorSuffixes = directPointerErrors.map((error) =>
        error.startsWith(statePrefix) ? error.slice(statePrefix.length) : error,
      );
      pointerValidationCache.set(pointerCacheKey, pointerErrorSuffixes);
    }
    errors.push(...pointerErrorSuffixes.map((error) => `${row.id} ${error}`));

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

    const testCase = stripCode(row.cells[13]);
    if (seenTestCases.has(testCase)) errors.push(`Duplicate machine test case ${testCase}.`);
    seenTestCases.add(testCase);
    sourceCohorts.add(rowSourceCohort);

    if (resultValues(row).includes('not_applicable_with_authority')) {
      if (stripCode(row.cells[15]) !== 'blocked_required_target') {
        errors.push(`${row.id} N/A-like target did not fail closed.`);
      }
    }
  }

  for (const stateId of contractStates.keys()) {
    if (!seen.has(stateId)) errors.push(`Contract state ${stateId} is absent from the ledger.`);
  }

  for (const sourceCohort of sourceCohorts) {
    for (const error of sourceCohortErrors(sourceCohort, { repoRoot, headRef })) {
      errors.push(`Build / commit / service cohort: ${error}`);
    }
  }

  if (parsed.rows.every((row) => row.cells.length === MACHINE_HEADERS.length)) {
    gateBoundaryChecks(ledgerMarkdown, parsed.rows, errors);
  }

  const digest = factsDigest(parsed.rows);
  if (digest !== BASELINE_FACTS_SHA256) {
    errors.push(
      `Frozen exact/blocked facts changed: expected ${BASELINE_FACTS_SHA256}, found ${digest}.`,
    );
  }

  const semanticDigest = ledgerSemanticIdentityDigest(ledgerMarkdown);
  if (semanticDigest !== LEDGER_SEMANTIC_IDENTITY_SHA256) {
    errors.push(
      `Ledger document semantic identity changed: expected ${LEDGER_SEMANTIC_IDENTITY_SHA256}, found ${semanticDigest}.`,
    );
  }

  return { errors, rowCount: parsed.rows.length, digest, semanticDigest };
}

function divider(columns) {
  return `| ${columns.map(() => '---').join(' | ')} |`;
}

function renderRow(cells) {
  return `| ${cells.join(' | ')} |`;
}

export function renderLedger({
  ledgerMarkdown,
  contractMarkdown,
  repoRoot = process.cwd(),
  headRef = 'HEAD',
}) {
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
  const semanticDigest = ledgerSemanticIdentityDigest(ledgerMarkdown);
  if (semanticDigest !== LEDGER_SEMANTIC_IDENTITY_SHA256) {
    throw new Error(
      `Refusing to render changed ledger semantics: expected ${LEDGER_SEMANTIC_IDENTITY_SHA256}, found ${semanticDigest}.`,
    );
  }
  const gateErrors = [];
  gateBoundaryChecks(ledgerMarkdown, parsed.rows, gateErrors);
  if (gateErrors.length > 0) throw new Error(`Refusing to render: ${gateErrors.join(' ')}`);
  const pointerValidationCache = new Map();
  for (const row of parsed.rows) {
    const pointerCacheKey = row.cells[9];
    let pointerErrors = pointerValidationCache.get(pointerCacheKey);
    if (!pointerErrors) {
      pointerErrors = evidencePointerErrors(row.cells[9], {
        repoRoot,
        stateId: row.id,
        sourceCommit: sourceCommitFromCohort(SOURCE_COHORT),
      });
      pointerValidationCache.set(pointerCacheKey, pointerErrors);
    }
    if (pointerErrors.length > 0) {
      throw new Error(`Refusing to render: ${pointerErrors.join(' ')}`);
    }
  }
  const cohortErrors = sourceCohortErrors(SOURCE_COHORT, { repoRoot, headRef });
  if (cohortErrors.length > 0) {
    throw new Error(`Refusing to render: ${cohortErrors.join(' ')}`);
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
    const rendered = renderLedger({ ledgerMarkdown, contractMarkdown, repoRoot: root });
    await writeFile(ledgerPath, rendered);
    process.stdout.write(`WROTE ${LEDGER_RELATIVE_PATH}\n`);
    return;
  }

  const result = validateLedger({ ledgerMarkdown, contractMarkdown, repoRoot: root });
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
