import {createHash} from 'node:crypto';
import {mkdtempSync, readFileSync, rmSync, statSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {validateCardSourceCatalogMapping} from './card-source-catalog.mjs';
import {
  CARD_SOURCE_COLLECTION,
  CARD_SOURCE_VERSION_COLLECTION,
  createCardSourceVersionDocumentId,
} from './card-source-import-commands.mjs';
import {ReleaseDeliveryError, validateDeliveryProfile} from './release-delivery-v1.mjs';
import {validateControlledPilotProfile} from './controlled-pilot-v1.mjs';
import {parseTcbJson, redactText} from './deployment-safety.mjs';

const require = createRequire(import.meta.url);
const {validateCardSourceForImport} = require('./functions/softbook-api');

const COMMAND_TIMEOUT_MS = 120_000;
const DOWNLOAD_TIMEOUT_MS = 10 * 60_000;

export function createCloudBaseCommandRunner({
  cwd = process.cwd(),
  spawn = spawnSync,
  tcb = process.env.CLOUDBASE_CLI || 'tcb',
} = {}) {
  return {
    async run(args, options = {}) {
      const result = spawn(tcb, args, {
        cwd: options.cwd ?? cwd,
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        timeout: options.timeoutMs ?? COMMAND_TIMEOUT_MS,
      });

      if (result.error || result.status !== 0) {
        const diagnostic =
          result.stderr || result.stdout || result.error?.message || 'unknown error';
        throw new ReleaseDeliveryError(
          `${options.label ?? 'CloudBase command'} failed: ${redactText(diagnostic).slice(-2000)}`,
        );
      }

      return result.stdout;
    },
  };
}

export function createCloudBaseReceiverAdapter({
  now = () => new Date(),
  profile: profileInput,
  runner = createCloudBaseCommandRunner(),
} = {}) {
  const profile = validateReceiverProfile(profileInput);
  const controlledPilot = profile.schema_version === 'controlled-pilot-profile.v1';
  const envId = profile.environment_id;

  async function queryOne(collection, filter, label) {
    const output = await executeNoSql(runner, envId, [queryCommand(collection, filter)], label);
    const results = output?.data?.results?.[0];

    if (!Array.isArray(results) || results.length > 1) {
      throw new ReleaseDeliveryError(`${label} returned an invalid result.`);
    }

    return results[0] ?? null;
  }

  async function requireVerifiedVersion(cardSource, bundle) {
    const versionId = createCardSourceVersionDocumentId(
      cardSource.track,
      cardSource.content_version,
    );
    const document = await queryOne(
      CARD_SOURCE_VERSION_COLLECTION,
      {_id: versionId},
      'read staged release',
    );

    if (!document) {
      throw new ReleaseDeliveryError('staged release is missing.');
    }

    const normalized = normalizeStoredCardSource(document, cardSource.track);
    assertReleaseIdentity(normalized, bundle.release_id, cardSource.content_version);
    assertRuntimeSourceEquivalent(normalized, cardSource);
    assertVerificationBinding(document.release_verification, bundle);

    if (document.release_verification?.verified !== true) {
      throw new ReleaseDeliveryError('staged release has not been verified.');
    }

    return {document, normalized, versionId};
  }

  return {
    async uploadAsset({absolutePath, asset, releaseId}) {
      const hashSuffix = asset.sha256.slice('sha256:'.length);
      const cloudPath = `softbook/releases/${releaseId}/audio/${hashSuffix}/${asset.asset_id}.mp3`;
      const uploadOutput = await runner.run(
        ['-e', envId, 'storage', 'upload', absolutePath, cloudPath, '--json'],
        {label: `upload ${asset.asset_id}`, timeoutMs: DOWNLOAD_TIMEOUT_MS},
      );
      const fileId = findCloudBaseFileId(parseTcbJson(uploadOutput));

      if (!fileId) {
        throw new ReleaseDeliveryError(
          `upload ${asset.asset_id} did not return a CloudBase file ID.`,
        );
      }

      await verifyRemoteAsset({
        asset,
        cloudPath,
        envId,
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
        'read existing release stage',
      );

      if (existing) {
        const normalized = normalizeStoredCardSource(existing, cardSource.track);
        assertReleaseIdentity(normalized, bundle.release_id, cardSource.content_version);
        assertRuntimeSourceEquivalent(normalized, cardSource);
        assertVerificationBinding(existing.release_verification, bundle);
        return;
      }

      const stagedAt = now().toISOString();
      const document = createVersionFields(cardSource, {
        retentionStatus: 'staged',
        updatedAt: stagedAt,
        verification: createReleaseVerification(bundle, false, stagedAt),
      });
      await executeNoSql(
        runner,
        envId,
        [upsertCommand(CARD_SOURCE_VERSION_COLLECTION, {_id: versionId}, document)],
        'stage release content',
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
        'verify staged release',
      );

      if (!document) {
        throw new ReleaseDeliveryError('staged release is missing.');
      }

      const normalized = normalizeStoredCardSource(document, cardSource.track);
      assertReleaseIdentity(normalized, bundle.release_id, cardSource.content_version);
      assertRuntimeSourceEquivalent(normalized, cardSource);
      assertVerificationBinding(document.release_verification, bundle);

      if (document.release_verification?.verified === true) {
        return;
      }

      const verifiedAt = now().toISOString();
      await executeNoSql(
        runner,
        envId,
        [
          upsertCommand(
            CARD_SOURCE_VERSION_COLLECTION,
            {_id: versionId},
            {
              release_verification: createReleaseVerification(
                bundle,
                true,
                document.release_verification.staged_at,
                verifiedAt,
              ),
              retention_status: 'verified',
              updated_at: verifiedAt,
            },
          ),
        ],
        'mark staged release verified',
      );
    },

    async activateRelease({bundle, cardSource}) {
      const verified = await requireVerifiedVersion(cardSource, bundle);
      const current = await queryOne(
        CARD_SOURCE_COLLECTION,
        {_id: cardSource.track},
        'read active release',
      );

      if (current) {
        const normalizedCurrent = normalizeStoredCardSource(current, cardSource.track);
        if (normalizedCurrent.release?.release_id === bundle.release_id) {
          assertReleaseIdentity(normalizedCurrent, bundle.release_id, cardSource.content_version);
          assertRuntimeSourceEquivalent(normalizedCurrent, cardSource);
          return;
        }

        if (controlledPilot) {
          throw new ReleaseDeliveryError(
            'controlled pilot activation refuses to replace a different active release.',
          );
        }

        if (normalizedCurrent.release?.release_id !== bundle.parent_release_id) {
          throw new ReleaseDeliveryError(
            'active release does not match the bundle parent release.',
          );
        }

        const previousVersionId = createCardSourceVersionDocumentId(
          cardSource.track,
          normalizedCurrent.content_version,
        );
        await executeNoSql(
          runner,
          envId,
          [
            upsertCommand(
              CARD_SOURCE_VERSION_COLLECTION,
              {_id: previousVersionId},
              {retention_status: 'retained', updated_at: now().toISOString()},
            ),
          ],
          'retain previous release',
        );
      } else if (!controlledPilot && bundle.parent_release_id !== null) {
        throw new ReleaseDeliveryError(
          'bundle declares a parent release but the receiver has no active release.',
        );
      }

      const activatedAt = now().toISOString();
      await executeNoSql(
        runner,
        envId,
        [
          upsertCommand(
            CARD_SOURCE_COLLECTION,
            {_id: cardSource.track},
            createCurrentSourceFields(verified.normalized, activatedAt),
          ),
        ],
        'activate release pointer',
      );
    },

    async verifyActiveRelease({contentVersion, releaseId, track = 'cet4'}) {
      const current = await queryOne(CARD_SOURCE_COLLECTION, {_id: track}, 'verify active release');
      if (!current) {
        throw new ReleaseDeliveryError('active release is missing.');
      }
      const normalized = normalizeStoredCardSource(current, track);
      assertReleaseIdentity(
        normalized,
        releaseId,
        contentVersion ?? normalized.content_version,
      );
      return normalized;
    },

    async verifyRetainedRelease(releaseId) {
      const document = await queryOne(
        CARD_SOURCE_VERSION_COLLECTION,
        {'release.release_id': releaseId},
        'read retained release',
      );

      if (
        !document ||
        document.retention_status !== 'retained' ||
        document.release_verification?.verified !== true
      ) {
        return null;
      }

      const normalized = normalizeStoredCardSource(document, 'cet4');
      assertReleaseIdentity(normalized, releaseId, normalized.content_version);
      return {
        card_source: normalized,
        release_id: releaseId,
        verified: true,
      };
    },

    async activateRetainedRelease(retained) {
      const cardSource = retained?.card_source;
      if (!cardSource || cardSource.release?.release_id !== retained.release_id) {
        throw new ReleaseDeliveryError('retained release payload is invalid.');
      }

      const current = await queryOne(
        CARD_SOURCE_COLLECTION,
        {_id: cardSource.track},
        'read current release before rollback',
      );
      if (current) {
        const normalizedCurrent = normalizeStoredCardSource(current, cardSource.track);
        const currentVersionId = createCardSourceVersionDocumentId(
          cardSource.track,
          normalizedCurrent.content_version,
        );
        await executeNoSql(
          runner,
          envId,
          [
            upsertCommand(
              CARD_SOURCE_VERSION_COLLECTION,
              {_id: currentVersionId},
              {retention_status: 'retained', updated_at: now().toISOString()},
            ),
          ],
          'retain replaced release before rollback',
        );
      }

      await executeNoSql(
        runner,
        envId,
        [
          upsertCommand(
            CARD_SOURCE_COLLECTION,
            {_id: cardSource.track},
            createCurrentSourceFields(cardSource, now().toISOString()),
          ),
        ],
        'activate retained release pointer',
      );
    },
  };
}

async function verifyRemoteAsset({asset, cloudPath, envId, runner}) {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'softbook-audio-verify-'));
  const downloadPath = join(temporaryDirectory, `${asset.asset_id}.mp3`);

  try {
    await runner.run(['-e', envId, 'storage', 'download', cloudPath, downloadPath, '--json'], {
      label: `verify uploaded ${asset.asset_id}`,
      timeoutMs: DOWNLOAD_TIMEOUT_MS,
    });
    const bytes = readFileSync(downloadPath);
    const hash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;

    if (hash !== asset.sha256 || statSync(downloadPath).size !== asset.size_bytes) {
      throw new ReleaseDeliveryError(
        `uploaded ${asset.asset_id} does not match its approved bytes.`,
      );
    }
  } finally {
    rmSync(temporaryDirectory, {force: true, recursive: true});
  }
}

async function executeNoSql(runner, envId, commands, label) {
  const output = await runner.run(
    ['db', 'nosql', 'execute', '-e', envId, '--command', JSON.stringify(commands), '--json'],
    {label},
  );
  return parseTcbJson(output);
}

function queryCommand(collection, filter) {
  return {
    TableName: collection,
    CommandType: 'QUERY',
    Command: JSON.stringify({find: collection, filter, limit: 1}),
  };
}

function upsertCommand(collection, filter, fields) {
  return {
    TableName: collection,
    CommandType: 'UPDATE',
    Command: JSON.stringify({
      update: collection,
      updates: [{q: filter, u: {$set: fields}, upsert: true}],
    }),
  };
}

function createVersionFields(cardSource, options) {
  return {
    ...createCurrentSourceFields(cardSource, options.updatedAt),
    release_verification: options.verification,
    retained_until: null,
    retention_status: options.retentionStatus,
  };
}

function createCurrentSourceFields(cardSource, updatedAt) {
  return {
    assets: cardSource.assets,
    card_records: cardSource.card_records,
    content_version: cardSource.content_version,
    imported_via:
      cardSource.release?.schema_version === 'pilot-content-release.v1'
        ? 'infra/cloudbase/deliver-controlled-pilot.mjs'
        : 'infra/cloudbase/deliver-release.mjs',
    release: cardSource.release,
    source: cardSource.source,
    track: cardSource.track,
    updated_at: updatedAt,
  };
}

function createReleaseVerification(bundle, verified, stagedAt, verifiedAt = null) {
  return {
    schema_version:
      bundle.schema_version === 'controlled-pilot-bundle.v1'
        ? 'pilot-stage-verification.v1'
        : 'release-stage-verification.v1',
    approval_record_sha256: bundle.approval.record_sha256,
    audit_report_sha256: bundle.audit.report_sha256,
    audio_manifest_sha256: bundle.audio.manifest_sha256,
    audio_qc_index_sha256: bundle.audio.qc_index_sha256,
    bundle_id: bundle.bundle_id,
    staged_at: stagedAt,
    verified,
    verified_at: verifiedAt,
  };
}

function assertVerificationBinding(value, bundle) {
  const expectedSchema =
    bundle.schema_version === 'controlled-pilot-bundle.v1'
      ? 'pilot-stage-verification.v1'
      : 'release-stage-verification.v1';
  if (
    !value ||
    value.schema_version !== expectedSchema ||
    value.bundle_id !== bundle.bundle_id ||
    value.approval_record_sha256 !== bundle.approval.record_sha256 ||
    value.audit_report_sha256 !== bundle.audit.report_sha256 ||
    value.audio_manifest_sha256 !== bundle.audio.manifest_sha256 ||
    value.audio_qc_index_sha256 !== bundle.audio.qc_index_sha256
  ) {
    throw new ReleaseDeliveryError('staged release evidence does not match the verified bundle.');
  }
}

function validateReceiverProfile(value) {
  if (value?.schema_version === 'controlled-pilot-profile.v1') {
    return validateControlledPilotProfile(value);
  }
  return validateDeliveryProfile(value);
}

function normalizeStoredCardSource(document, track) {
  return validateCardSourceCatalogMapping(validateCardSourceForImport(document, track));
}

function assertReleaseIdentity(cardSource, releaseId, contentVersion) {
  if (
    cardSource.content_version !== contentVersion ||
    cardSource.release?.release_id !== releaseId ||
    cardSource.release?.content_version !== contentVersion
  ) {
    throw new ReleaseDeliveryError('release identity does not match expected content.');
  }
}

function assertRuntimeSourceEquivalent(actual, expected) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new ReleaseDeliveryError(
      'staged runtime content or storage locators do not match the publisher input.',
    );
  }
}

function findCloudBaseFileId(value) {
  if (typeof value === 'string') {
    return /^cloud:\/\/[^\s?#]+$/.test(value) ? value : null;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const match = findCloudBaseFileId(item);
      if (match) return match;
    }
  } else if (value && typeof value === 'object') {
    for (const item of Object.values(value)) {
      const match = findCloudBaseFileId(item);
      if (match) return match;
    }
  }
  return null;
}

export const receiverAdapterInternals = {
  createReleaseVerification,
  findCloudBaseFileId,
  queryCommand,
  upsertCommand,
};
