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
import {
  normalizeCloudBaseNumber,
  parseTcbJson,
  redactText,
} from './deployment-safety.mjs';

const require = createRequire(import.meta.url);
const {validateCardSourceForImport} = require('./functions/softbook-api');

const COMMAND_TIMEOUT_MS = 120_000;
const DOWNLOAD_TIMEOUT_MS = 10 * 60_000;
const STAGED_ARRAY_CHUNK_SIZES = Object.freeze({assets: 100, card_records: 64});
const ACTIVE_POINTER_SCHEMA = 'card-source-active-pointer.v1';

export function createCloudBaseCommandRunner({
  cwd = process.cwd(),
  env = process.env,
  spawn = spawnSync,
  tcb = process.env.CLOUDBASE_CLI || 'tcb',
} = {}) {
  return {
    async run(args, options = {}) {
      const result = spawn(tcb, args, {
        cwd: options.cwd ?? cwd,
        encoding: 'utf8',
        env,
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
  let storageBucketPromise = null;

  async function queryOne(collection, filter, label) {
    const output = await executeNoSql(runner, envId, [queryCommand(collection, filter)], label);
    const results = output?.data?.results?.[0];

    if (!Array.isArray(results) || results.length > 1) {
      throw new ReleaseDeliveryError(`${label} returned an invalid result.`);
    }

    return results[0] ? normalizeCloudBaseExtendedJson(results[0]) : null;
  }

  async function readActiveSource(track, label, {allowHybridPointer = false} = {}) {
    const document = await queryOne(CARD_SOURCE_COLLECTION, {_id: track}, label);
    if (!document) return null;
    if (document.schema_version !== ACTIVE_POINTER_SCHEMA) {
      return {document, normalized: normalizeStoredCardSource(document, track)};
    }
    const pointer = validateActivePointer(document, track, {allowHybridPointer});
    const version = await queryOne(
      CARD_SOURCE_VERSION_COLLECTION,
      {_id: pointer.version_id},
      `${label} version`,
    );
    if (!version || version.release_verification?.verified !== true) {
      throw new ReleaseDeliveryError('active release pointer target is not verified.');
    }
    const normalized = normalizeStoredCardSource(version, track);
    assertReleaseIdentity(normalized, pointer.release_id, pointer.content_version);
    const expectedVerificationSchema =
      normalized.release?.schema_version === 'pilot-content-release.v1'
        ? 'pilot-stage-verification.v1'
        : 'release-stage-verification.v1';
    if (version.release_verification.schema_version !== expectedVerificationSchema) {
      throw new ReleaseDeliveryError('active release verification schema is invalid.');
    }
    return {
      document,
      normalized,
      pointer,
      requiresReplacement: Object.keys(document).length !== 7,
    };
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

  async function completeStagedArrays({bundle, cardSource, document, versionId}) {
    let current = document;
    assertStagedSourcePrefix(current, bundle, cardSource);
    for (const field of ['assets', 'card_records']) {
      const expected = cardSource[field];
      while (current[field].length < expected.length) {
        const start = current[field].length;
        const chunk = expected.slice(start, start + STAGED_ARRAY_CHUNK_SIZES[field]);
        await executeNoSql(
          runner,
          envId,
          [pushArrayChunkCommand({bundle, cardSource, chunk, field, start, versionId})],
          `append staged release ${field}`,
        );
        const updated = await queryOne(
          CARD_SOURCE_VERSION_COLLECTION,
          {_id: versionId},
          `confirm staged release ${field}`,
        );
        if (!updated || updated[field]?.length <= start) {
          throw new ReleaseDeliveryError(`staged release ${field} did not advance.`);
        }
        assertStagedSourcePrefix(updated, bundle, cardSource);
        current = updated;
      }
    }
    const normalized = normalizeStoredCardSource(current, cardSource.track);
    assertReleaseIdentity(normalized, bundle.release_id, cardSource.content_version);
    assertRuntimeSourceEquivalent(normalized, cardSource);
  }

  return {
    async readVerifiedStaged({bundle}) {
      const versionId = createCardSourceVersionDocumentId(
        bundle.track,
        bundle.content.content_version,
      );
      const document = await queryOne(
        CARD_SOURCE_VERSION_COLLECTION,
        {_id: versionId},
        'read resumable verified release',
      );
      if (!document || document.release_verification?.verified !== true) return null;
      const normalized = normalizeStoredCardSource(document, bundle.track);
      assertReleaseIdentity(normalized, bundle.release_id, bundle.content.content_version);
      assertVerificationBinding(document.release_verification, bundle);
      return normalized;
    },

    async uploadAsset({absolutePath, asset, releaseId}) {
      const hashSuffix = asset.sha256.slice('sha256:'.length);
      const cloudPath = `softbook/releases/${releaseId}/audio/${hashSuffix}/${asset.asset_id}.mp3`;
      storageBucketPromise ??= readReceiverStorageBucket({envId, profile, runner});
      const bucket = await storageBucketPromise;
      const canonicalFileId = `cloud://${envId}.${bucket}/${cloudPath}`;
      try {
        await verifyRemoteAsset({asset, cloudPath, envId, runner});
        return canonicalFileId;
      } catch {
        // Missing or drifted bytes are replaced by the exact approved asset below.
      }
      const uploadOutput = await runner.run(
        ['-e', envId, 'storage', 'upload', absolutePath, cloudPath, '--json'],
        {label: `upload ${asset.asset_id}`, timeoutMs: DOWNLOAD_TIMEOUT_MS},
      );
      const uploadPayload = parseTcbJson(uploadOutput);
      const returnedFileId = findCloudBaseFileId(uploadPayload);
      if (returnedFileId && returnedFileId !== canonicalFileId) {
        throw new ReleaseDeliveryError(`upload ${asset.asset_id} returned a mismatched file ID.`);
      }
      if (!returnedFileId) {
        assertUploadSucceeded(uploadPayload, cloudPath, asset.asset_id);
      }

      await verifyRemoteAsset({
        asset,
        cloudPath,
        envId,
        runner,
      });
      return canonicalFileId;
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
        await completeStagedArrays({bundle, cardSource, document: existing, versionId});
        return;
      }

      const stagedAt = now().toISOString();
      const document = createVersionFields({...cardSource, assets: [], card_records: []}, {
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
      await completeStagedArrays({
        bundle,
        cardSource,
        document: {_id: versionId, ...document},
        versionId,
      });
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
      const current = await readActiveSource(cardSource.track, 'read active release', {
        allowHybridPointer: true,
      });

      if (current) {
        const normalizedCurrent = current.normalized;
        const sameRelease = normalizedCurrent.release?.release_id === bundle.release_id;
        if (sameRelease) {
          assertReleaseIdentity(normalizedCurrent, bundle.release_id, cardSource.content_version);
          assertRuntimeSourceEquivalent(normalizedCurrent, cardSource);
          if (!current.requiresReplacement) return;
        } else {
          if (controlledPilot) {
            throw new ReleaseDeliveryError(
              'controlled pilot activation refuses to replace a different active release.',
            );
          }

          const replacingDevelopmentSource =
            normalizedCurrent.release === null && bundle.parent_release_id === null;
          if (
            !replacingDevelopmentSource &&
            normalizedCurrent.release?.release_id !== bundle.parent_release_id
          ) {
            throw new ReleaseDeliveryError(
              'active release does not match the bundle parent release.',
            );
          }

          if (!replacingDevelopmentSource) {
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
          }
        }
      } else if (!controlledPilot && bundle.parent_release_id !== null) {
        throw new ReleaseDeliveryError(
          'bundle declares a parent release but the receiver has no active release.',
        );
      }

      const activatedAt = now().toISOString();
      const replacement = await executeNoSql(
        runner,
        envId,
        [
          replaceCommand(
            CARD_SOURCE_COLLECTION,
            {_id: cardSource.track},
            createActivePointerFields(verified.normalized, verified.versionId, activatedAt),
          ),
        ],
        'activate release pointer',
      );
      assertSingleUpdateResult(replacement, 'activate release pointer');
      const activated = await readActiveSource(cardSource.track, 'confirm active release');
      if (activated?.pointer?.version_id !== verified.versionId) {
        throw new ReleaseDeliveryError('active release pointer confirmation failed.');
      }
      assertRuntimeSourceEquivalent(activated.normalized, cardSource);
    },

    async verifyActiveRelease({contentVersion, releaseId, track = 'cet4'}) {
      const current = await readActiveSource(track, 'verify active release');
      if (!current) {
        throw new ReleaseDeliveryError('active release is missing.');
      }
      const normalized = current.normalized;
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

      const normalized = normalizeStoredCardSource(document, document.track);
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

      const current = await readActiveSource(
        cardSource.track,
        'read current release before rollback',
        {allowHybridPointer: true},
      );
      if (current) {
        const normalizedCurrent = current.normalized;
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

      const targetVersionId = createCardSourceVersionDocumentId(
        cardSource.track,
        cardSource.content_version,
      );
      const replacement = await executeNoSql(
        runner,
        envId,
        [
          replaceCommand(
            CARD_SOURCE_COLLECTION,
            {_id: cardSource.track},
            createActivePointerFields(
              cardSource,
              targetVersionId,
              now().toISOString(),
            ),
          ),
        ],
        'activate retained release pointer',
      );
      assertSingleUpdateResult(replacement, 'activate retained release pointer');
      const activated = await readActiveSource(
        cardSource.track,
        'confirm retained release pointer',
      );
      if (activated?.pointer?.version_id !== targetVersionId) {
        throw new ReleaseDeliveryError('retained release pointer confirmation failed.');
      }
      assertRuntimeSourceEquivalent(activated.normalized, cardSource);
    },
  };
}

async function readReceiverStorageBucket({envId, profile, runner}) {
  const output = await runner.run(['env', 'detail', '-e', envId, '--json'], {
    label: 'read receiver storage bucket',
  });
  const storages = parseTcbJson(output)?.data?.resources?.storages;
  if (!Array.isArray(storages) || storages.length !== 1) {
    throw new ReleaseDeliveryError('receiver environment must expose exactly one storage bucket.');
  }
  const storage = storages[0];
  if (
    storage?.Status !== 'NORMAL' ||
    storage?.Region !== profile.region ||
    !/^[a-z0-9][a-z0-9-]{2,127}$/.test(storage?.Bucket ?? '')
  ) {
    throw new ReleaseDeliveryError('receiver storage bucket metadata is invalid.');
  }
  return storage.Bucket;
}

function assertUploadSucceeded(payload, cloudPath, assetId) {
  const data = payload?.data;
  if (
    data?.type !== 'file' ||
    data?.cloudPath !== cloudPath ||
    data?.totalFiles !== 1 ||
    data?.successCount !== 1 ||
    data?.failedCount !== 0
  ) {
    throw new ReleaseDeliveryError(`upload ${assetId} returned an invalid result.`);
  }
}

function normalizeCloudBaseExtendedJson(value) {
  if (Array.isArray(value)) return value.map(normalizeCloudBaseExtendedJson);
  if (!value || typeof value !== 'object') return value;
  const keys = Object.keys(value);
  if (
    keys.length === 1 &&
    ['$numberDouble', '$numberInt', '$numberLong'].includes(keys[0])
  ) {
    const normalized = normalizeCloudBaseNumber(value);
    if (!Number.isFinite(normalized) || !Number.isSafeInteger(normalized)) {
      throw new ReleaseDeliveryError('receiver document contains an unsafe numeric value.');
    }
    return normalized;
  }
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, normalizeCloudBaseExtendedJson(item)]),
  );
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

function assertSingleUpdateResult(payload, label) {
  const result = payload?.data?.results?.[0];
  if (
    normalizeCloudBaseNumber(result?.ok) !== 1 ||
    normalizeCloudBaseNumber(result?.n) !== 1
  ) {
    throw new ReleaseDeliveryError(`${label} did not update exactly one document.`);
  }
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

function replaceCommand(collection, filter, document) {
  return {
    TableName: collection,
    CommandType: 'UPDATE',
    Command: JSON.stringify({
      update: collection,
      updates: [{q: filter, u: document, upsert: true}],
    }),
  };
}

function pushArrayChunkCommand({bundle, cardSource, chunk, field, start, versionId}) {
  const filter = {
    _id: versionId,
    content_version: cardSource.content_version,
    'release.release_id': bundle.release_id,
    [`${field}.${start}`]: {$exists: false},
  };
  if (start > 0) {
    const identityField = field === 'assets' ? 'asset_id' : 'card_id';
    filter[`${field}.${start - 1}.${identityField}`] =
      cardSource[field][start - 1][identityField];
  }
  return {
    TableName: CARD_SOURCE_VERSION_COLLECTION,
    CommandType: 'UPDATE',
    Command: JSON.stringify({
      update: CARD_SOURCE_VERSION_COLLECTION,
      updates: [{q: filter, u: {$push: {[field]: {$each: chunk}}}, upsert: false}],
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

function createActivePointerFields(cardSource, versionId, updatedAt) {
  return {
    _id: cardSource.track,
    schema_version: ACTIVE_POINTER_SCHEMA,
    track: cardSource.track,
    version_id: versionId,
    release_id: cardSource.release.release_id,
    content_version: cardSource.content_version,
    updated_at: updatedAt,
  };
}

function validateActivePointer(document, track, {allowHybridPointer = false} = {}) {
  const expectedKeys = [
    '_id',
    'schema_version',
    'track',
    'version_id',
    'release_id',
    'content_version',
    'updated_at',
  ];
  const actualKeys = Object.keys(document).sort();
  const requiredKeys = expectedKeys.sort();
  const allowedHybridKeys = new Set([
    ...requiredKeys,
    'assets',
    'card_records',
    'imported_via',
    'release',
    'source',
  ]);
  const keysAreValid = allowHybridPointer
    ? requiredKeys.every(key => actualKeys.includes(key)) &&
      actualKeys.every(key => allowedHybridKeys.has(key))
    : actualKeys.join('\0') === requiredKeys.join('\0');
  const updatedAt = new Date(document.updated_at ?? '');
  if (
    !keysAreValid ||
    document._id !== track ||
    document.schema_version !== ACTIVE_POINTER_SCHEMA ||
    document.track !== track ||
    !/^[0-9a-f]{64}$/.test(document.version_id ?? '') ||
    typeof document.release_id !== 'string' ||
    !/^sha256:[0-9a-f]{64}$/.test(document.content_version ?? '') ||
    !Number.isFinite(updatedAt.getTime()) ||
    updatedAt.toISOString() !== document.updated_at
  ) {
    throw new ReleaseDeliveryError('active release pointer is invalid.');
  }
  const expectedVersionId = createCardSourceVersionDocumentId(
    track,
    document.content_version,
  );
  if (document.version_id !== expectedVersionId) {
    throw new ReleaseDeliveryError('active release pointer version identity is invalid.');
  }
  return document;
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

function assertStagedSourcePrefix(document, bundle, expected) {
  assertVerificationBinding(document?.release_verification, bundle);
  assertReleaseIdentity(document, bundle.release_id, expected.content_version);
  const expectedFields = createCurrentSourceFields(expected, document.updated_at);
  for (const field of ['imported_via', 'release', 'source', 'track', 'updated_at']) {
    if (JSON.stringify(document[field]) !== JSON.stringify(expectedFields[field])) {
      throw new ReleaseDeliveryError(`staged release ${field} does not match publisher input.`);
    }
  }
  for (const field of ['assets', 'card_records']) {
    const actual = document[field];
    if (
      !Array.isArray(actual) ||
      actual.length > expected[field].length ||
      JSON.stringify(actual) !== JSON.stringify(expected[field].slice(0, actual.length))
    ) {
      throw new ReleaseDeliveryError(`staged release ${field} is not an exact prefix.`);
    }
  }
  const incomplete =
    document.assets.length < expected.assets.length ||
    document.card_records.length < expected.card_records.length;
  if (
    incomplete &&
    (document.retention_status !== 'staged' ||
      document.release_verification.verified !== false ||
      document.release_verification.verified_at !== null)
  ) {
    throw new ReleaseDeliveryError('incomplete staged release has invalid verification state.');
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
  normalizeCloudBaseExtendedJson,
  pushArrayChunkCommand,
  queryCommand,
  replaceCommand,
  upsertCommand,
};
