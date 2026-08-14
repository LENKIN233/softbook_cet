#!/usr/bin/env node

import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {
  chmodSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {dirname, isAbsolute, join, relative, resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

import {validateCardSourceCatalogMapping} from '../infra/cloudbase/card-source-catalog.mjs';

const require = createRequire(import.meta.url);
const {validateCardSourceForReleaseBundle} = require(
  '../infra/cloudbase/functions/softbook-api',
);

const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const REPOSITORY_ROOT = realpathSync(resolve(SCRIPT_DIRECTORY, '..'));
const MOBILE_ROOT = join(REPOSITORY_ROOT, 'apps', 'mobile');
const INTERACTION_ORDER = Object.freeze([
  'flip',
  'multiple_choice',
  'lock',
  'elimination',
  'swipe',
]);
const CANDIDATE_KEYS = Object.freeze([
  'assets',
  'card_records',
  'content_version',
  'release',
  'source',
  'track',
]);
const SAFE_REPORT_KEYS = Object.freeze([
  'all_cards_audio_bound',
  'all_cards_learning_completable',
  'all_cards_parseable',
  'audio_asset_count',
  'candidate_payload_sha256',
  'card_count',
  'checked_at',
  'content_version',
  'gate_eligible',
  'human_audio_qc_verified',
  'interaction_card_counts',
  'persistent_receiver_verified',
  'real_device_verified',
  'representative_audio_controls_verified',
  'representative_card_ids',
  'representative_ui_completions_verified',
  'schema_version',
  'signed_manifest_verified',
  'simulated_manifest_binding_verified',
  'track',
  'visible_runtime_metadata_leak_guard_verified',
]);

export class AudioBundleCandidateMobileAcceptanceError extends Error {}

export function normalizeAudioBundleCandidate(value) {
  if (!hasExactKeys(value, CANDIDATE_KEYS)) {
    fail('Audio bundle candidate must have the exact candidate payload shape.');
  }
  if (!['cet4', 'cet6'].includes(value.track)) {
    fail('Audio bundle candidate track must be cet4 or cet6.');
  }

  let normalized;
  try {
    normalized = validateCardSourceCatalogMapping(
      validateCardSourceForReleaseBundle(value, value.track),
    );
  } catch (error) {
    fail(
      `Audio bundle candidate failed release-bundle validation: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  if (normalized.release !== null) {
    fail('Audio bundle candidate must remain unpublished with release=null.');
  }
  if (
    normalized.card_records.some(
      card => card.space_metadata?.library !== '听力' || !card.audio,
    )
  ) {
    fail('Audio bundle candidate must contain only audio-bound listening cards.');
  }
  if (normalized.assets.length !== normalized.card_records.length) {
    fail('Audio bundle candidate must bind exactly one asset per card.');
  }

  return normalized;
}

export function summarizeCandidate(candidate, candidatePayloadSha256, checkedAt) {
  const interactionCardCounts = {};
  for (const card of candidate.card_records) {
    interactionCardCounts[card.interaction_id] =
      (interactionCardCounts[card.interaction_id] ?? 0) + 1;
  }
  const representativeCardIds = INTERACTION_ORDER.flatMap(interactionId => {
    const card = candidate.card_records.find(
      candidateCard => candidateCard.interaction_id === interactionId,
    );
    return card ? [card.card_id] : [];
  });

  return {
    checkedAt,
    candidatePayloadSha256,
    contentVersion: candidate.content_version,
    track: candidate.track,
    cardCount: candidate.card_records.length,
    audioAssetCount: candidate.assets.length,
    interactionCardCounts,
    representativeCardIds,
  };
}

export function normalizeSafeMobileReport(report, expected) {
  const valid =
    hasExactKeys(report, SAFE_REPORT_KEYS) &&
    report.schema_version ===
      'audio-bundle-candidate-mobile-learning-smoke.v1' &&
    report.checked_at === expected.checkedAt &&
    report.candidate_payload_sha256 === expected.candidatePayloadSha256 &&
    report.content_version === expected.contentVersion &&
    report.track === expected.track &&
    report.card_count === expected.cardCount &&
    report.audio_asset_count === expected.audioAssetCount &&
    hasExactKeys(
      report.interaction_card_counts,
      Object.keys(expected.interactionCardCounts),
    ) &&
    Object.entries(expected.interactionCardCounts).every(
      ([interactionId, count]) =>
        report.interaction_card_counts[interactionId] === count,
    ) &&
    hasExactOrderedValues(
      report.representative_card_ids,
      expected.representativeCardIds,
    ) &&
    report.all_cards_parseable === true &&
    report.all_cards_audio_bound === true &&
    report.all_cards_learning_completable === true &&
    report.representative_ui_completions_verified ===
      expected.representativeCardIds.length &&
    report.representative_audio_controls_verified ===
      expected.representativeCardIds.length &&
    report.simulated_manifest_binding_verified === true &&
    report.visible_runtime_metadata_leak_guard_verified === true &&
    report.signed_manifest_verified === false &&
    report.human_audio_qc_verified === false &&
    report.persistent_receiver_verified === false &&
    report.real_device_verified === false &&
    report.gate_eligible === false;
  if (!valid) {
    fail('Mobile audio-bundle acceptance safe report is incomplete or invalid.');
  }

  return {
    schema_version: report.schema_version,
    checked_at: report.checked_at,
    candidate_payload_sha256: report.candidate_payload_sha256,
    content_version: report.content_version,
    track: report.track,
    card_count: report.card_count,
    audio_asset_count: report.audio_asset_count,
    interaction_card_counts: {...expected.interactionCardCounts},
    all_cards_parseable: report.all_cards_parseable,
    all_cards_audio_bound: report.all_cards_audio_bound,
    all_cards_learning_completable: report.all_cards_learning_completable,
    representative_card_ids: [...expected.representativeCardIds],
    representative_ui_completions_verified:
      report.representative_ui_completions_verified,
    representative_audio_controls_verified:
      report.representative_audio_controls_verified,
    simulated_manifest_binding_verified:
      report.simulated_manifest_binding_verified,
    visible_runtime_metadata_leak_guard_verified:
      report.visible_runtime_metadata_leak_guard_verified,
    signed_manifest_verified: report.signed_manifest_verified,
    human_audio_qc_verified: report.human_audio_qc_verified,
    persistent_receiver_verified: report.persistent_receiver_verified,
    real_device_verified: report.real_device_verified,
    gate_eligible: report.gate_eligible,
  };
}

export function runAudioBundleCandidateMobileAcceptance(options) {
  const checkedAt = requireCanonicalTimestamp(
    options.checkedAt ?? new Date().toISOString(),
    'checkedAt',
  );
  const candidatePayloadPath = requireExternalRegularFile(
    options.candidatePayloadPath,
    'candidate payload',
  );
  const candidateBytes = readFileSync(candidatePayloadPath);
  const candidatePayloadSha256 = `sha256:${createHash('sha256')
    .update(candidateBytes)
    .digest('hex')}`;
  let rawCandidate;
  try {
    rawCandidate = JSON.parse(candidateBytes.toString('utf8'));
  } catch {
    fail('Audio bundle candidate must be valid JSON.');
  }
  const candidate = normalizeAudioBundleCandidate(rawCandidate);
  const expected = summarizeCandidate(
    candidate,
    candidatePayloadSha256,
    checkedAt,
  );
  const initialStatus = readWorktreeStatus();
  const temporaryRoot = mkdtempSync(
    join(tmpdir(), 'softbook-audio-bundle-mobile-acceptance-'),
  );
  chmodSync(temporaryRoot, 0o700);
  const fixturePath = join(temporaryRoot, 'mobile-fixture.json');
  const reportPath = join(temporaryRoot, 'mobile-report.json');

  try {
    writeFileSync(
      fixturePath,
      `${JSON.stringify({
        schema_version:
          'audio-bundle-candidate-mobile-acceptance-fixture.v1',
        checked_at: checkedAt,
        candidate_payload_sha256: candidatePayloadSha256,
        candidate,
      })}\n`,
      {encoding: 'utf8', mode: 0o600},
    );

    const jestBinary = join(MOBILE_ROOT, 'node_modules', '.bin', 'jest');
    if (!isRegularFile(jestBinary)) {
      fail('Mobile dependencies are missing; run npm ci in apps/mobile first.');
    }
    const jest = spawnSync(
      jestBinary,
      [
        '--config',
        'jest.audio-bundle-candidate-acceptance.config.js',
        '--runInBand',
        '--no-watchman',
      ],
      {
        cwd: MOBILE_ROOT,
        encoding: 'utf8',
        env: {
          ...process.env,
          SOFTBOOK_AUDIO_BUNDLE_ACCEPTANCE_FIXTURE: fixturePath,
          SOFTBOOK_AUDIO_BUNDLE_ACCEPTANCE_REPORT: reportPath,
        },
      },
    );
    if (jest.error || jest.status !== 0) {
      fail(
        `Mobile audio-bundle acceptance Jest failed.${formatChildOutput(
          jest.stdout,
          jest.stderr,
        )}`,
      );
    }
    if (!isRegularFile(reportPath)) {
      fail('Mobile audio-bundle acceptance did not produce its safe report.');
    }
    return normalizeSafeMobileReport(
      JSON.parse(readFileSync(reportPath, 'utf8')),
      expected,
    );
  } finally {
    rmSync(temporaryRoot, {force: true, recursive: true});
    if (readWorktreeStatus() !== initialStatus) {
      fail('Mobile audio-bundle acceptance changed the repository worktree.');
    }
  }
}

function hasExactKeys(value, expectedKeys) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const actualKeys = Object.keys(value).sort();
  const sortedExpectedKeys = [...expectedKeys].sort();
  return (
    actualKeys.length === sortedExpectedKeys.length &&
    actualKeys.every((key, index) => key === sortedExpectedKeys[index])
  );
}

function hasExactOrderedValues(value, expectedValues) {
  return (
    Array.isArray(value) &&
    value.length === expectedValues.length &&
    value.every((item, index) => item === expectedValues[index])
  );
}

function requireExternalRegularFile(value, label) {
  if (typeof value !== 'string' || value.length === 0) {
    fail(`${label} path is required.`);
  }
  const absolutePath = realpathSync(resolve(value));
  if (!isRegularFile(absolutePath)) {
    fail(`${label} must be a regular file.`);
  }
  const pathFromRepository = relative(REPOSITORY_ROOT, absolutePath);
  if (
    pathFromRepository === '' ||
    (!pathFromRepository.startsWith(`..${sep}`) &&
      pathFromRepository !== '..' &&
      !isAbsolute(pathFromRepository))
  ) {
    fail(`${label} must remain outside the product repository.`);
  }
  return absolutePath;
}

function isRegularFile(path) {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function readWorktreeStatus() {
  const status = spawnSync(
    'git',
    ['status', '--porcelain=v1', '-z', '--untracked-files=all'],
    {cwd: REPOSITORY_ROOT, encoding: 'utf8'},
  );
  if (status.error || status.status !== 0) {
    fail('Unable to read repository worktree status.');
  }
  return status.stdout;
}

function requireCanonicalTimestamp(value, label) {
  const parsed = new Date(value);
  if (
    typeof value !== 'string' ||
    !Number.isFinite(parsed.getTime()) ||
    parsed.toISOString() !== value
  ) {
    fail(`${label} must be a canonical UTC ISO timestamp.`);
  }
  return value;
}

function formatChildOutput(stdout, stderr) {
  const combined = [stdout, stderr]
    .filter(value => typeof value === 'string' && value.trim().length > 0)
    .join('\n')
    .trim();
  return combined ? `\n${combined}` : '';
}

function parseArgs(argv) {
  const parsed = {};
  const names = new Map([
    ['--candidate-payload', 'candidatePayloadPath'],
    ['--checked-at', 'checkedAt'],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const key = names.get(argv[index]);
    const value = argv[index + 1];
    if (!key || !value || value.startsWith('--')) {
      fail(`Unknown or incomplete argument: ${argv[index]}`);
    }
    parsed[key] = value;
    index += 1;
  }
  if (!parsed.candidatePayloadPath) {
    fail('Missing required option for candidatePayloadPath.');
  }
  return parsed;
}

function fail(message) {
  throw new AudioBundleCandidateMobileAcceptanceError(message);
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    console.log(
      JSON.stringify(
        runAudioBundleCandidateMobileAcceptance(
          parseArgs(process.argv.slice(2)),
        ),
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(`[audio-bundle-mobile-acceptance] ${error.message}`);
    process.exitCode = 1;
  }
}
