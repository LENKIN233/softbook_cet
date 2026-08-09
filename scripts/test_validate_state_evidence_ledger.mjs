#!/usr/bin/env node

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  CONTRACT_RELATIVE_PATH,
  LEDGER_RELATIVE_PATH,
  deriveCurrentResult,
  parseLedger,
  renderLedger,
  validateLedger,
} from './validate_state_evidence_ledger.mjs';

const root = path.resolve(process.argv[2] ?? process.cwd());
const [ledgerMarkdown, contractMarkdown] = await Promise.all([
  readFile(path.join(root, LEDGER_RELATIVE_PATH), 'utf8'),
  readFile(path.join(root, CONTRACT_RELATIVE_PATH), 'utf8'),
]);

function errorsFor(markdown, contract = contractMarkdown) {
  return validateLedger({ ledgerMarkdown: markdown, contractMarkdown: contract }).errors;
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

const baseline = validateLedger({ ledgerMarkdown, contractMarkdown });
assert.deepEqual(baseline.errors, []);
assert.equal(baseline.rowCount, 173);

assert.equal(
  renderLedger({ ledgerMarkdown, contractMarkdown }),
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

process.stdout.write('STATE EVIDENCE LEDGER TESTS OK: 10 assertions\n');
