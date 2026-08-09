#!/usr/bin/env node

import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  CONTRACT_RELATIVE_PATH,
  LEDGER_RELATIVE_PATH,
  deriveCurrentResult,
  deriveGateBoundary,
  parseLedger,
  renderLedger,
  sourceCohortErrors,
  validateLedger,
} from './validate_state_evidence_ledger.mjs';

const root = path.resolve(process.argv[2] ?? process.cwd());
const [ledgerMarkdown, contractMarkdown] = await Promise.all([
  readFile(path.join(root, LEDGER_RELATIVE_PATH), 'utf8'),
  readFile(path.join(root, CONTRACT_RELATIVE_PATH), 'utf8'),
]);

function errorsFor(markdown, contract = contractMarkdown) {
  return validateLedger({
    ledgerMarkdown: markdown,
    contractMarkdown: contract,
    repoRoot: root,
  }).errors;
}

function expectError(markdown, fragment) {
  const errors = errorsFor(markdown);
  assert(
    errors.some((error) => error.includes(fragment)),
    `Expected an error containing ${JSON.stringify(fragment)}; got:\n${errors.join('\n')}`,
  );
}

function expectPairError(markdown, contract, fragment) {
  const errors = errorsFor(markdown, contract);
  assert(
    errors.some((error) => error.includes(fragment)),
    `Expected an error containing ${JSON.stringify(fragment)}; got:\n${errors.join('\n')}`,
  );
}

function mutateFirstRowCell(markdown, columnIndex, value) {
  const parsed = parseLedger(markdown);
  const row = parsed.rows[0];
  const cells = [...row.cells];
  cells[columnIndex] = value;
  const replacement = `| ${cells.join(' | ')} |`;
  return markdown.replace(parsed.lines[row.lineIndex], replacement);
}

const baseline = validateLedger({ ledgerMarkdown, contractMarkdown, repoRoot: root });
assert.deepEqual(baseline.errors, []);
assert.equal(baseline.rowCount, 173);

assert.equal(
  renderLedger({ ledgerMarkdown, contractMarkdown, repoRoot: root }),
  ledgerMarkdown,
  'generator must be idempotent',
);

expectError(
  mutateFirstRowCell(ledgerMarkdown, 7, 'covered_browser_scenario'),
  'native result changed without a registered native evidence class',
);
expectError(
  mutateFirstRowCell(ledgerMarkdown, 8, 'covered_browser_scenario'),
  'PC Web result changed without a registered PC Web mapping class',
);
expectError(
  mutateFirstRowCell(ledgerMarkdown, 11, '`A-SHELL`'),
  'Owner mismatch',
);
expectError(
  mutateFirstRowCell(ledgerMarkdown, 15, '`covered_required_targets`'),
  'Current result mismatch',
);
expectError(
  mutateFirstRowCell(
    ledgerMarkdown,
    14,
    '`build=ux-architecture-v5-strict-4;commit=bd3ed0f54350b252f1554872de5a07cd09f97232;service=fabricated-local-pass`',
  ),
  'Build / commit / service cohort mismatch',
);
expectError(
  mutateFirstRowCell(ledgerMarkdown, 2, 'N/A'),
  'uses bare N/A',
);
expectError(
  mutateFirstRowCell(ledgerMarkdown, 2, 'covered_shared_browser_scenario'),
  'iOS phone browser result covered_shared_browser_scenario is not allowed in this column',
);
expectError(
  mutateFirstRowCell(ledgerMarkdown, 6, 'covered_browser_scenario'),
  'Shared access-profile browser result covered_browser_scenario is not allowed in this column',
);
expectError(
  mutateFirstRowCell(ledgerMarkdown, 9, '`./grayscale-ux-state-contract.md`'),
  'is not a safe repository-relative reference',
);
expectError(
  mutateFirstRowCell(ledgerMarkdown, 9, '`/etc/hosts`'),
  'is not a safe repository-relative reference',
);
expectError(
  mutateFirstRowCell(ledgerMarkdown, 9, '`missing-evidence.md#missing`'),
  'does not exist',
);
expectError(
  mutateFirstRowCell(ledgerMarkdown, 9, '`browser-evidence.md#missing-heading`'),
  'has no matching heading anchor',
);
expectError(
  mutateFirstRowCell(
    ledgerMarkdown,
    9,
    '`browser-evidence.md#responsive-and-platform-measurements`',
  ),
  'Evidence pointer policy mismatch',
);
expectError(
  mutateFirstRowCell(
    ledgerMarkdown,
    9,
    '`browser-evidence.md#strict-5-focus-correction-and-delta-replay`',
  ),
  'has no matching heading anchor in source commit',
);
expectError(
  mutateFirstRowCell(
    ledgerMarkdown,
    9,
    '`pc-web-v5-state-mapping.md#status-and-authority-boundary`',
  ),
  'is not a tracked blob in source commit',
);
expectError(
  mutateFirstRowCell(
    ledgerMarkdown,
    14,
    '`build=ux-architecture-v5-strict-4;commit=bd3ed0f;service=unproven`',
  ),
  'Source cohort has invalid syntax',
);
expectError(
  mutateFirstRowCell(
    ledgerMarkdown,
    14,
    '`build=ux-architecture-v5-strict-4;commit=0000000000000000000000000000000000000000;service=unproven`',
  ),
  'does not exist as a commit object',
);

const spoofedOwnerLedger = mutateFirstRowCell(ledgerMarkdown, 11, '`A-FAKE`');
const spoofedOwnerContract = contractMarkdown.replace(
  '| `SHELL-01 Cold launch` | `A-SHELL`, `A-NAV` |',
  '| `SHELL-01 Cold launch` | `A-FAKE` |',
);
expectPairError(
  spoofedOwnerLedger,
  spoofedOwnerContract,
  'uses unknown Authority shorthand A-FAKE',
);
expectPairError(
  ledgerMarkdown,
  contractMarkdown.replace(
    'one shared semantic state ledger',
    'one altered semantic state ledger',
  ),
  'Contract document semantic identity changed',
);
expectPairError(
  ledgerMarkdown,
  contractMarkdown.replace(
    '| `COV-12 Copy × exposure channel` | `A-SHELL`, `A-MEMBER`, `A-PLATFORM`, `A-VISUAL` |',
    '| `COV-12 Copy × exposure channel` | `A-SHELL`, `A-MEMBER`, `A-PLATFORM` |',
  ),
  'COV-12 COV owner mismatch',
);

expectError(
  ledgerMarkdown.replace(
    'It is never browser, native, store, audio, service, or release evidence.',
    'It is browser evidence.',
  ),
  'Ledger document semantic identity changed',
);
expectError(
  ledgerMarkdown.replace(
    'The architecture gate remains **blocked** while',
    'The architecture gate is **passed** although',
  ),
  'Gate result prose does not match derived boundary architecture_gate_blocked',
);

const parsed = parseLedger(ledgerMarkdown);
const nAResultRow = {
  ...parsed.rows[0],
  cells: [...parsed.rows[0].cells],
};
nAResultRow.cells[2] = 'not_applicable_with_authority';
assert.equal(
  deriveCurrentResult(nAResultRow),
  'blocked_required_target',
  'authority-labelled N/A must remain unresolved and fail closed',
);

const firstRow = parsed.lines[parsed.rows[0].lineIndex];
expectError(ledgerMarkdown.replace(`${firstRow}\n`, ''), 'Expected 173 rows');

const dividerLine = parsed.lines[parsed.headerIndex + 1];
expectError(
  ledgerMarkdown.replace(
    dividerLine,
    '<div data-gate="accepted">Release and owner acceptance passed.</div>',
  ),
  'Machine ledger divider mismatch',
);

const cov12 = parsed.rows.find((row) => row.id === 'COV-12');
assert.equal(
  cov12?.cells[11],
  '`A-SHELL+A-MEMBER+A-PLATFORM+A-VISUAL`',
  'COV-12 must retain the visual leakage/quarantine authority',
);

const fullyCoveredRows = parsed.rows.map((row) => {
  const cells = [...row.cells];
  cells[1] = 'covered_exact_transcript';
  for (let index = 2; index <= 8; index += 1) cells[index] = 'covered_browser_scenario';
  return { ...row, cells };
});
assert.equal(
  deriveGateBoundary(fullyCoveredRows),
  'architecture_evidence_matrix_complete_owner_acceptance_pending',
  'a complete matrix must not auto-pass the owner-controlled architecture checkpoint',
);

const headCommit = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
  encoding: 'utf8',
}).trim();
const unreachableErrors = sourceCohortErrors(
  `build=test;commit=${headCommit};service=unproven`,
  { repoRoot: root, headRef: 'HEAD^' },
);
assert(
  unreachableErrors.some((error) => error.includes('is not reachable from HEAD^')),
  `Expected reachability failure; got:\n${unreachableErrors.join('\n')}`,
);

process.stdout.write('STATE EVIDENCE LEDGER TESTS OK: hardened fail-closed suite\n');
