import {createHash} from 'node:crypto';
import {mkdtempSync, readFileSync, rmSync, statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createRequire} from 'node:module';

import {validateCardSourceCatalogMapping} from './card-source-catalog.mjs';
import {
  CARD_SOURCE_COLLECTION,
  CARD_SOURCE_VERSION_COLLECTION,
  createCardSourceVersionDocumentId,
} from './card-source-import-commands.mjs';
import {
  createCloudBaseCommandRunner,
  receiverAdapterInternals,
} from './cloudbase-receiver-adapter.mjs';
import {validateControlledPilotProfile} from './controlled-pilot-v1.mjs';
import {ControlledPilotPublisherError} from './controlled-pilot-publisher-v1.mjs';
import {parseTcbJson} from './deployment-safety.mjs';

const require = createRequire(import.meta.url);
const {validateCardSourceForImport} = require('./functions/softbook-api');
const DOWNLOAD_TIMEOUT_MS = 10 * 60_000;

export function createCloudBasePilotReceiverAdapter({
  now = () => new Date(),
  profile: profileInput,
  runner = createCloudBaseCommandRunner(),
} = {}) {
  const profile = validateControlledPilotProfile(profileInput);
  const environmentId = profile.environment_id;

  async function queryOne(collection, filter, label) {
    const output = await executeNoSql(
      runner,
      environmentId,
      [receiverAdapterInternals.queryCommand(collection, filter)],
      label,
    );
    const results = output?.data?.results?.[0];
    if (!Array.isArray(results) || results.length > 1) {
      fail(`${label} returned an invalid result.`);
    }
    return results[0] ?? null;
  }

  async function requireVerifiedVersion(bundle, cardSource) {
    const versionId = createCardSourceVersionDocumentId(
      cardSource.track,
      cardSource.content_version,
    );
    const document = await queryOne(
      CARD_SOURCE_VERSION_COLLECTION,
      {_id: versionId},
      'read staged controlled pilot release',
    );
    if (!document) fail('staged controlled pilot release is missing.');
    const normalized = normalizeStoredCardSource(document, cardSource.track);
    assertRuntimeSourceEquivalent(normalized, cardSource);
    assertVerificationBinding(document.pilot_release_verification, bundle);
    if (document.pilot_release_verification.verified !== true) {
      fail('staged controlled pilot release has not been verified.');
    }
    return {document, normalized, versionId};
  }

  return {
    async uploadAsset({absolutePath, asset, pilotId, releaseId}) {
      const hashSuffix = asset.sha256.slice('sha256:'.length);
      const cloudPath = `softbook/pilots/${pilotId}/${releaseId}/audio/${hashSuffix}/${asset.asset_id}.mp3`;
      const output = await runner.run(
        [
          '-e',
          environmentId,
          'storage',
          'upload',
          absolutePath,
          cloudPath,
          '--json',
        ],
        {label: `upload pilot ${asset.asset_id}`, timeoutMs: DOWNLOAD_TIMEOUT_MS},
      );
      const fileId = receiverAdapterInternals.findCloudBaseFileId(
        parseTcbJson(output),
      );
      if (!fileId) fail(`upload ${asset.asset_id} returned no CloudBase file ID.`);
      await verifyRemoteAsset({
        asset,
        cloudPath,
        environmentId,
        runner,
      });
      return fileId;
    },

    async stageContent({bundle, cardSource}) {
      const versionId = createCardSourceVersionDocumentId(
        cardSource.track,
        cardSource.content_version,
      );
      const existing = await queryOne(
        CARD_SOURCE_VERSION_COLLECTION,
        {_id: versionId},
        'read existing pilot stage',
      );
      if (existing) {
        const normalized = normalizeStoredCardSource(existing, cardSource.track);
        assertRuntimeSourceEquivalent(normalized, cardSource);
        assertVerificationBinding(existing.pilot_release_verification, bundle);
        return;
      }
      const stagedAt = now().toISOString();
      await executeNoSql(
        runner,
        environmentId,
        [
          receiverAdapterInternals.upsertCommand(
            CARD_SOURCE_VERSION_COLLECTION,
            {_id: versionId},
            {
              ...currentSourceFields(cardSource, stagedAt),
              pilot_release_verification: createVerification(
                bundle,
                false,
                stagedAt,
              ),
              retained_until: bundle.pilot_expires_at,
              retention_status: 'pilot_staged',
            },
          ),
        ],
        'stage controlled pilot content',
      );
    },

    async verifyStaged({bundle, cardSource}) {
      const versionId = createCardSourceVersionDocumentId(
        cardSource.track,
        cardSource.content_version,
      );
      const document = await queryOne(
        CARD_SOURCE_VERSION_COLLECTION,
        {_id: versionId},
        'verify controlled pilot stage',
      );
      if (!document) fail('staged controlled pilot release is missing.');
      const normalized = normalizeStoredCardSource(document, cardSource.track);
      assertRuntimeSourceEquivalent(normalized, cardSource);
      assertVerificationBinding(document.pilot_release_verification, bundle);
      if (document.pilot_release_verification.verified === true) return;
      const verifiedAt = now().toISOString();
      await executeNoSql(
        runner,
        environmentId,
        [
          receiverAdapterInternals.upsertCommand(
            CARD_SOURCE_VERSION_COLLECTION,
            {_id: versionId},
            {
              pilot_release_verification: createVerification(
                bundle,
                true,
                document.pilot_release_verification.staged_at,
                verifiedAt,
              ),
              retention_status: 'pilot_verified',
              updated_at: verifiedAt,
            },
          ),
        ],
        'mark controlled pilot stage verified',
      );
    },

    async activateRelease({bundle, cardSource}) {
      const verified = await requireVerifiedVersion(bundle, cardSource);
      const current = await queryOne(
        CARD_SOURCE_COLLECTION,
        {_id: 'cet4'},
        'read active controlled pilot release',
      );
      if (current) {
        const normalizedCurrent = normalizeStoredCardSource(current, 'cet4');
        if (
          normalizedCurrent.release?.release_id === bundle.release_id &&
          normalizedCurrent.content_version === cardSource.content_version
        ) {
          return;
        }
        fail('controlled pilot environment already has another active release.');
      }
      const activatedAt = now().toISOString();
      await executeNoSql(
        runner,
        environmentId,
        [
          receiverAdapterInternals.upsertCommand(
            CARD_SOURCE_COLLECTION,
            {_id: 'cet4'},
            currentSourceFields(verified.normalized, activatedAt),
          ),
          receiverAdapterInternals.upsertCommand(
            CARD_SOURCE_VERSION_COLLECTION,
            {_id: verified.versionId},
            {retention_status: 'pilot_active', updated_at: activatedAt},
          ),
        ],
        'activate controlled pilot release',
      );
    },

    async verifyActiveRelease({contentVersion, pilotId, releaseId}) {
      const current = await queryOne(
        CARD_SOURCE_COLLECTION,
        {_id: 'cet4'},
        'reread active controlled pilot release',
      );
      if (!current) fail('active controlled pilot release is missing.');
      const normalized = normalizeStoredCardSource(current, 'cet4');
      if (
        normalized.content_version !== contentVersion ||
        normalized.release?.release_id !== releaseId ||
        normalized.release?.pilot_id !== pilotId ||
        normalized.release?.gate_eligible !== false
      ) {
        fail('active controlled pilot release identity is invalid.');
      }
      return normalized;
    },
  };
}

async function verifyRemoteAsset({
  asset,
  cloudPath,
  environmentId,
  runner,
}) {
  const directory = mkdtempSync(join(tmpdir(), 'softbook-pilot-audio-verify-'));
  const path = join(directory, `${asset.asset_id}.mp3`);
  try {
    await runner.run(
      [
        '-e',
        environmentId,
        'storage',
        'download',
        cloudPath,
        path,
        '--json',
      ],
      {label: `reread pilot ${asset.asset_id}`, timeoutMs: DOWNLOAD_TIMEOUT_MS},
    );
    const bytes = readFileSync(path);
    const hash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    if (hash !== asset.sha256 || statSync(path).size !== asset.size_bytes) {
      fail(`uploaded ${asset.asset_id} does not match its approved bytes.`);
    }
  } finally {
    rmSync(directory, {force: true, recursive: true});
  }
}

async function executeNoSql(runner, environmentId, commands, label) {
  const output = await runner.run(
    [
      'db',
      'nosql',
      'execute',
      '-e',
      environmentId,
      '--command',
      JSON.stringify(commands),
      '--json',
    ],
    {label},
  );
  return parseTcbJson(output);
}

function currentSourceFields(cardSource, updatedAt) {
  return {
    assets: cardSource.assets,
    card_records: cardSource.card_records,
    content_version: cardSource.content_version,
    imported_via: 'infra/cloudbase/manage-controlled-pilot.mjs',
    release: cardSource.release,
    source: cardSource.source,
    track: cardSource.track,
    updated_at: updatedAt,
  };
}

function createVerification(bundle, verified, stagedAt, verifiedAt = null) {
  return {
    schema_version: 'pilot-release-stage-verification.v1',
    approval_record_sha256: bundle.approval.record_sha256,
    audit_report_sha256: bundle.audit.report_sha256,
    audio_manifest_sha256: bundle.audio.manifest_sha256,
    audio_qc_index_sha256: bundle.audio.qc_index_sha256,
    bundle_id: bundle.bundle_id,
    content_payload_sha256: bundle.content.payload_sha256,
    gate_eligible: false,
    pilot_id: bundle.pilot_id,
    staged_at: stagedAt,
    verified,
    verified_at: verifiedAt,
  };
}

function assertVerificationBinding(value, bundle) {
  const expected = createVerification(
    bundle,
    value?.verified,
    value?.staged_at,
    value?.verified_at ?? null,
  );
  if (JSON.stringify(value) !== JSON.stringify(expected)) {
    fail('staged controlled pilot evidence does not match the bundle.');
  }
}

function normalizeStoredCardSource(document, track) {
  return validateCardSourceCatalogMapping(
    validateCardSourceForImport(document, track),
  );
}

function assertRuntimeSourceEquivalent(actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    fail('staged controlled pilot runtime source differs from publisher input.');
  }
}

function fail(message) {
  throw new ControlledPilotPublisherError(message);
}

export const pilotReceiverAdapterInternals = {
  createVerification,
  currentSourceFields,
};
