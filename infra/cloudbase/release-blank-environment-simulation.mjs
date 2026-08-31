import {createHash} from 'node:crypto';
import {readFileSync, writeFileSync} from 'node:fs';
import {
  CARD_SOURCE_COLLECTION,
  CARD_SOURCE_VERSION_COLLECTION,
} from './card-source-import-commands.mjs';
import {createCloudBaseReceiverAdapter} from './cloudbase-receiver-adapter.mjs';
import {REQUIRED_COLLECTIONS} from './deployment-safety.mjs';
import {
  ReleaseDeliveryError,
  publishVerifiedRelease,
  rollbackToRetainedRelease,
} from './release-delivery-v1.mjs';

export const RELEASE_BLANK_ENVIRONMENT_SIMULATION_SCHEMA =
  'release-blank-environment-simulation.v1';

const USER_DATA_COLLECTIONS = Object.freeze(
  REQUIRED_COLLECTIONS.filter(
    collection =>
      collection !== CARD_SOURCE_COLLECTION &&
      collection !== CARD_SOURCE_VERSION_COLLECTION,
  ),
);
const SIMULATION_SEQUENCE = Object.freeze([
  'assert_blank',
  'publish_a',
  'verify_a',
  'seed_user_data_sentinel',
  'publish_b',
  'verify_b',
  'rollback_a',
  'reverify_a',
]);

export async function runReleaseBlankEnvironmentSimulation({
  releaseA,
  releaseB,
} = {}) {
  validateSimulationInputs(releaseA, releaseB);

  const receiver = createInMemoryReleaseReceiver({
    environmentId: releaseA.profile.environment_id,
    region: releaseA.profile.region,
  });
  const initialSnapshot = receiver.snapshot();
  const initialUserData = receiver.snapshotCollections(USER_DATA_COLLECTIONS);
  assertSimulation(
    initialSnapshot.document_count === 0 && initialSnapshot.storage_object_count === 0,
    'simulation receiver must start empty.',
  );

  const adapter = createCloudBaseReceiverAdapter({
    now: createSimulationClock(),
    profile: releaseA.profile,
    runner: receiver.runner,
  });
  const publishedA = await publishVerifiedRelease(releaseA, adapter);
  assertSimulation(
    publishedA.uploaded_asset_count === releaseA.audio_manifest.assets.length,
    'release A did not preserve every private asset identity.',
  );
  const activeA = await adapter.verifyActiveRelease({
    contentVersion: releaseA.bundle.content.content_version,
    releaseId: releaseA.bundle.release_id,
    track: releaseA.bundle.track,
  });
  assertActiveRelease(activeA, releaseA, 'release A');
  assertSimulation(
    receiver.snapshotCollections(USER_DATA_COLLECTIONS) === initialUserData,
    'release A publish wrote a user-data collection.',
  );

  receiver.seedDocument(
    'softbook_learning_events',
    Object.freeze({
      _id: 'simulation-learning-event-sentinel',
      account_key: 'simulation-account',
      event_id: 'simulation-event',
      payload_sha256: `sha256:${'5'.repeat(64)}`,
      simulation_only: true,
    }),
  );
  const userDataBefore = receiver.snapshotCollections(USER_DATA_COLLECTIONS);

  const publishedB = await publishVerifiedRelease(releaseB, adapter);
  assertSimulation(
    publishedB.uploaded_asset_count === releaseB.audio_manifest.assets.length,
    'release B did not preserve every private asset identity.',
  );
  const activeB = await adapter.verifyActiveRelease({
    contentVersion: releaseB.bundle.content.content_version,
    releaseId: releaseB.bundle.release_id,
    track: releaseB.bundle.track,
  });
  assertActiveRelease(activeB, releaseB, 'release B');
  assertRetainedRelease(receiver, releaseA.bundle.release_id, 'release A');

  const rollback = await rollbackToRetainedRelease(
    releaseA.bundle.release_id,
    adapter,
  );
  assertSimulation(
    rollback.release_id === releaseA.bundle.release_id &&
      rollback.activated === true,
    'rollback did not activate release A.',
  );
  const activeAfterRollback = await adapter.verifyActiveRelease({
    contentVersion: releaseA.bundle.content.content_version,
    releaseId: releaseA.bundle.release_id,
    track: releaseA.bundle.track,
  });
  assertActiveRelease(activeAfterRollback, releaseA, 'release A after rollback');
  assertRetainedRelease(
    receiver,
    releaseA.bundle.release_id,
    'release A after rollback',
  );
  assertRetainedRelease(receiver, releaseB.bundle.release_id, 'release B');

  const userDataAfter = receiver.snapshotCollections(USER_DATA_COLLECTIONS);
  assertSimulation(
    userDataAfter === userDataBefore,
    'publish and rollback changed the user-data sentinel.',
  );
  assertSimulation(
    receiver.deleteAttemptCount === 0,
    'publish or rollback attempted a delete operation.',
  );
  assertSimulation(
    receiver.forbiddenCommandAttemptCount === 0,
    'publish or rollback attempted an unsupported external command.',
  );
  const userDataUpdateCount = receiver.operations.filter(
    operation =>
      operation.kind === 'database_update' &&
      USER_DATA_COLLECTIONS.includes(operation.collection),
  ).length;
  assertSimulation(
    userDataUpdateCount === 0,
    'publish or rollback wrote a user-data collection.',
  );

  const finalSnapshot = receiver.snapshot();
  assertSimulation(
    finalSnapshot.release_version_count === 2 &&
      finalSnapshot.retained_release_count === 2,
    'simulation did not retain exactly release A and release B.',
  );
  assertSimulation(
    finalSnapshot.storage_object_count ===
      releaseA.audio_manifest.assets.length +
        releaseB.audio_manifest.assets.length,
    'simulation storage does not contain both release asset sets.',
  );
  const operationCounts = countOperations(receiver.operations);
  return {
    schema_version: RELEASE_BLANK_ENVIRONMENT_SIMULATION_SCHEMA,
    status: 'passed',
    simulation: true,
    gate_eligible: false,
    execution_mode: 'repository_in_memory',
    credential_mode: 'none',
    network_access: false,
    environment: {
      kind: 'in_memory',
      initially_blank: true,
      required_collection_count: REQUIRED_COLLECTIONS.length,
    },
    sequence: [...SIMULATION_SEQUENCE],
    releases: {
      a: releaseSummary(releaseA, publishedA),
      b: releaseSummary(releaseB, publishedB),
      active_after_rollback: {
        content_version: activeAfterRollback.content_version,
        release_id: activeAfterRollback.release.release_id,
      },
    },
    assertions: {
      release_a_verified_before_upgrade: true,
      release_a_publish_left_user_data_blank: true,
      release_a_retained_before_rollback: true,
      release_b_verified_before_rollback: true,
      release_b_retained_after_rollback: true,
      release_a_active_identity_reverified_after_rollback: true,
      user_data_sentinel_unchanged: true,
      user_data_snapshot_sha256: hashText(userDataAfter),
      delete_attempt_count: receiver.deleteAttemptCount,
      forbidden_command_attempt_count: receiver.forbiddenCommandAttemptCount,
      user_data_database_update_count: userDataUpdateCount,
      release_version_count: finalSnapshot.release_version_count,
      retained_release_count: finalSnapshot.retained_release_count,
      storage_object_count: finalSnapshot.storage_object_count,
    },
    operations: operationCounts,
  };
}

export function createInMemoryReleaseReceiver({environmentId, region = 'ap-shanghai'} = {}) {
  if (typeof environmentId !== 'string' || environmentId.length === 0) {
    throw new ReleaseDeliveryError('simulation environment ID is required.');
  }
  if (typeof region !== 'string' || region.length === 0) {
    throw new ReleaseDeliveryError('simulation region is required.');
  }

  const collections = new Map(
    REQUIRED_COLLECTIONS.map(collection => [collection, new Map()]),
  );
  const storage = new Map();
  const operations = [];
  let deleteAttemptCount = 0;
  let forbiddenCommandAttemptCount = 0;

  function requireEnvironment(args) {
    const environmentIndex = args.indexOf('-e');
    if (
      environmentIndex === -1 ||
      args[environmentIndex + 1] !== environmentId
    ) {
      throw new ReleaseDeliveryError(
        'simulation command targeted an unexpected environment.',
      );
    }
  }

  function requireCollection(name) {
    const collection = collections.get(name);
    if (!collection) {
      throw new ReleaseDeliveryError(
        `simulation command targeted a non-allowlisted collection: ${String(name)}`,
      );
    }
    return collection;
  }

  const runner = {
    async run(args) {
      if (!Array.isArray(args)) {
        forbiddenCommandAttemptCount += 1;
        throw new ReleaseDeliveryError('simulation runner requires argument arrays.');
      }
      requireEnvironment(args);

      if (
        args.length === 5 &&
        args[0] === 'env' &&
        args[1] === 'detail' &&
        args[2] === '-e' &&
        args[4] === '--json'
      ) {
        return JSON.stringify({
          data: {
            resources: {
              storages: [
                {
                  Bucket: 'simulation-storage-bucket',
                  Region: region,
                  Status: 'NORMAL',
                },
              ],
            },
          },
        });
      }

      const isStorageSurface =
        args[0] === '-e' &&
        args[2] === 'storage';
      if (isStorageSurface) {
        if (
          args.length !== 7 ||
          args[1] !== environmentId ||
          args[6] !== '--json'
        ) {
          forbiddenCommandAttemptCount += 1;
          throw new ReleaseDeliveryError(
            'simulation runner forbids extended storage commands.',
          );
        }
        const operation = args[3];
        if (operation === 'upload') {
          const absolutePath = args[4];
          const cloudPath = args[5];
          const bytes = readFileSync(absolutePath);
          storage.set(cloudPath, Buffer.from(bytes));
          operations.push({kind: 'storage_upload'});
          return JSON.stringify({
            data: {
              fileID:
                `cloud://${environmentId}.simulation-storage-bucket/${cloudPath}`,
            },
          });
        }
        if (operation === 'download') {
          const cloudPath = args[4];
          const downloadPath = args[5];
          const bytes = storage.get(cloudPath);
          if (!bytes) {
            throw new ReleaseDeliveryError(
              'simulation storage object is missing.',
            );
          }
          writeFileSync(downloadPath, bytes);
          operations.push({kind: 'storage_download'});
          return JSON.stringify({data: {ok: true}});
        }
        forbiddenCommandAttemptCount += 1;
        throw new ReleaseDeliveryError(
          `simulation storage command is forbidden: ${String(operation)}`,
        );
      }

      const isDatabaseSurface =
        args[0] === 'db' &&
        args[1] === 'nosql' &&
        args[2] === 'execute';
      if (
        !isDatabaseSurface ||
        args.length !== 8 ||
        args[3] !== '-e' ||
        args[4] !== environmentId ||
        args[5] !== '--command' ||
        args[7] !== '--json'
      ) {
        forbiddenCommandAttemptCount += 1;
        throw new ReleaseDeliveryError(
          'simulation runner forbids network and external commands.',
        );
      }

      let commands;
      try {
        commands = JSON.parse(args[6]);
      } catch {
        throw new ReleaseDeliveryError('simulation database command is invalid.');
      }
      if (!Array.isArray(commands)) {
        throw new ReleaseDeliveryError(
          'simulation database command must be an array.',
        );
      }

      const results = [];
      for (const command of commands) {
        const body = parseCommandBody(command?.Command);
        if (
          ['DELETE', 'REMOVE'].includes(command?.CommandType) ||
          ['delete', 'deletes', 'remove', 'removes'].some(key =>
            Object.hasOwn(body, key),
          )
        ) {
          deleteAttemptCount += 1;
          throw new ReleaseDeliveryError(
            'simulation runner forbids delete operations.',
          );
        }
        const collection = requireCollection(command?.TableName);
        if (command?.CommandType === 'QUERY') {
          assertExactKeys(body, ['filter', 'find', 'limit'], 'query command');
          if (body.find !== command.TableName || body.limit !== 1) {
            throw new ReleaseDeliveryError(
              'simulation query command is not exact.',
            );
          }
          const matches = [...collection.values()].filter(document =>
            matchesFilter(document, body.filter),
          );
          operations.push({
            collection: command.TableName,
            kind: 'database_query',
          });
          results.push(
            matches.slice(0, body.limit ?? matches.length).map(deepClone),
          );
          continue;
        }
        if (command?.CommandType === 'UPDATE') {
          assertExactKeys(body, ['update', 'updates'], 'update command');
          if (body.update !== command.TableName) {
            throw new ReleaseDeliveryError(
              'simulation update command is not exact.',
            );
          }
          const updated = applyUpdate(collection, body, command.TableName);
          operations.push({
            collection: command.TableName,
            kind: 'database_update',
          });
          results.push({n: updated, ok: 1});
          continue;
        }

        forbiddenCommandAttemptCount += 1;
        throw new ReleaseDeliveryError(
          `simulation database command is forbidden: ${String(
            command?.CommandType,
          )}`,
        );
      }
      return JSON.stringify({data: {results}});
    },
  };

  return {
    runner,
    operations,
    get deleteAttemptCount() {
      return deleteAttemptCount;
    },
    get forbiddenCommandAttemptCount() {
      return forbiddenCommandAttemptCount;
    },
    findVersion(releaseId) {
      const matches = [
        ...collections.get(CARD_SOURCE_VERSION_COLLECTION).values(),
      ].filter(document => document.release?.release_id === releaseId);
      if (matches.length > 1) {
        throw new ReleaseDeliveryError(
          'simulation contains duplicate release versions.',
        );
      }
      return matches[0] ? deepClone(matches[0]) : null;
    },
    seedDocument(collectionName, document) {
      const collection = requireCollection(collectionName);
      if (!document || typeof document._id !== 'string') {
        throw new ReleaseDeliveryError(
          'simulation sentinel requires a document ID.',
        );
      }
      collection.set(document._id, deepClone(document));
      operations.push({collection: collectionName, kind: 'simulation_seed'});
    },
    snapshot() {
      const documentCount = [...collections.values()].reduce(
        (total, collection) => total + collection.size,
        0,
      );
      const releaseVersions = collections.get(
        CARD_SOURCE_VERSION_COLLECTION,
      );
      return {
        document_count: documentCount,
        release_version_count: releaseVersions.size,
        retained_release_count: [...releaseVersions.values()].filter(
          document => document.retention_status === 'retained',
        ).length,
        storage_object_count: storage.size,
      };
    },
    snapshotCollections(collectionNames) {
      return canonicalJson(
        collectionNames.map(collectionName => [
          collectionName,
          [...requireCollection(collectionName).values()],
        ]),
      );
    },
  };
}

function validateSimulationInputs(releaseA, releaseB) {
  for (const [label, release] of [
    ['release A', releaseA],
    ['release B', releaseB],
  ]) {
    if (
      !release?.profile ||
      !release?.bundle ||
      !release?.content ||
      !release?.audio_manifest ||
      !release?.bundle_directory
    ) {
      throw new ReleaseDeliveryError(
        `${label} must be a verified release bundle result.`,
      );
    }
    if (
      !Array.isArray(release.audio_manifest.assets) ||
      release.audio_manifest.assets.length === 0
    ) {
      throw new ReleaseDeliveryError(
        `${label} must exercise at least one private asset.`,
      );
    }
  }

  if (canonicalJson(releaseA.profile) !== canonicalJson(releaseB.profile)) {
    throw new ReleaseDeliveryError(
      'release A and release B must use the same delivery profile.',
    );
  }
  if (releaseA.bundle.parent_release_id !== null) {
    throw new ReleaseDeliveryError(
      'release A must be the first release in a blank environment.',
    );
  }
  if (releaseB.bundle.parent_release_id !== releaseA.bundle.release_id) {
    throw new ReleaseDeliveryError(
      'release B must name release A as its parent.',
    );
  }
  if (
    releaseA.bundle.release_id === releaseB.bundle.release_id ||
    releaseA.bundle.content.content_version ===
      releaseB.bundle.content.content_version
  ) {
    throw new ReleaseDeliveryError(
      'release A and release B must have distinct identities and content.',
    );
  }
  if (releaseA.bundle.track !== releaseB.bundle.track) {
    throw new ReleaseDeliveryError(
      'release A and release B must target the same track.',
    );
  }
}

function parseCommandBody(value) {
  try {
    const body = JSON.parse(value);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new Error('invalid');
    }
    return body;
  } catch {
    throw new ReleaseDeliveryError('simulation database body is invalid.');
  }
}

function applyUpdate(collection, body, collectionName) {
  if (!Array.isArray(body.updates) || body.updates.length !== 1) {
    throw new ReleaseDeliveryError(
      'simulation supports one exact update at a time.',
    );
  }
  const update = body.updates[0];
  const operator = update?.u && Object.keys(update.u);
  const replacement =
    operator?.length > 0 && operator.every(key => !key.startsWith('$'));
  if (replacement) {
    if (!update.q) {
      throw new ReleaseDeliveryError('simulation replacement filter is required.');
    }
    assertExactKeys(update.q, ['_id'], 'replacement filter');
    assertExactKeys(
      update.u,
      [
        '_id',
        'content_version',
        'release_id',
        'schema_version',
        'track',
        'updated_at',
        'version_id',
      ],
      'active pointer replacement',
    );
    if (
      collectionName !== CARD_SOURCE_COLLECTION ||
      update.upsert !== true ||
      update.u._id !== update.q._id ||
      update.u.track !== update.q._id ||
      update.u.schema_version !== 'card-source-active-pointer.v1' ||
      !/^[0-9a-f]{64}$/.test(update.u.version_id ?? '') ||
      !/^sha256:[0-9a-f]{64}$/.test(update.u.content_version ?? '') ||
      typeof update.u.release_id !== 'string' ||
      !Number.isFinite(Date.parse(update.u.updated_at ?? ''))
    ) {
      throw new ReleaseDeliveryError('simulation active pointer replacement is invalid.');
    }
    collection.set(update.u._id, deepClone(update.u));
    return 1;
  }
  if (!update?.q || operator?.length !== 1) {
    throw new ReleaseDeliveryError(
      'simulation supports only one allowlisted update operator.',
    );
  }

  const existing = [...collection.values()].find(document =>
    matchesFilter(document, update.q),
  );
  if (operator[0] === '$push') {
    if (update.upsert !== false || !existing) return 0;
    const entries = Object.entries(update.u.$push ?? {});
    if (
      entries.length !== 1 ||
      !['assets', 'card_records'].includes(entries[0][0]) ||
      !Array.isArray(entries[0][1]?.$each) ||
      entries[0][1].$each.length === 0
    ) {
      throw new ReleaseDeliveryError('simulation staged-array push is invalid.');
    }
    const [field, operation] = entries[0];
    collection.set(existing._id, {
      ...existing,
      [field]: [...existing[field], ...deepClone(operation.$each)],
    });
    return 1;
  }
  if (operator[0] !== '$set' || update.upsert !== true || !update.u.$set) {
    throw new ReleaseDeliveryError(
      'simulation supports only allowlisted upsert $set updates.',
    );
  }
  const id = existing?._id ?? update.q._id;
  if (typeof id !== 'string' || id.length === 0) {
    throw new ReleaseDeliveryError(
      'simulation upsert requires an exact document ID.',
    );
  }
  collection.set(id, {
    ...(existing ?? {_id: id}),
    ...deepClone(update.u.$set),
  });
  return 1;
}

function assertExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  if (
    actual.length !== required.length ||
    actual.some((key, index) => key !== required[index])
  ) {
    throw new ReleaseDeliveryError(
      `simulation ${label} contains unsupported fields.`,
    );
  }
}

function matchesFilter(document, filter) {
  if (!filter || typeof filter !== 'object' || Array.isArray(filter)) {
    throw new ReleaseDeliveryError('simulation query filter is invalid.');
  }
  return Object.entries(filter).every(([key, expected]) => {
    const actual = key
      .split('.')
      .reduce((value, segment) => value?.[segment], document);
    if (expected && typeof expected === 'object' && '$exists' in expected) {
      return (actual !== undefined) === expected.$exists;
    }
    return actual === expected;
  });
}

function assertActiveRelease(active, release, label) {
  assertSimulation(
    active?.release?.release_id === release.bundle.release_id &&
      active.content_version === release.bundle.content.content_version,
    `${label} is not the active verified release.`,
  );
}

function assertRetainedRelease(receiver, releaseId, label) {
  const retained = receiver.findVersion(releaseId);
  assertSimulation(
    retained?.release_verification?.verified === true &&
      retained.retention_status === 'retained',
    `${label} is not a verified retained release.`,
  );
}

function releaseSummary(release, published) {
  return {
    release_id: release.bundle.release_id,
    content_version: release.bundle.content.content_version,
    uploaded_asset_count: published.uploaded_asset_count,
    activated: published.activated,
  };
}

function countOperations(operations) {
  const counts = {
    database_query: 0,
    database_update: 0,
    simulation_seed: 0,
    storage_download: 0,
    storage_upload: 0,
  };
  for (const operation of operations) {
    if (Object.hasOwn(counts, operation.kind)) {
      counts[operation.kind] += 1;
    }
  }
  return counts;
}

function hashText(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function createSimulationClock() {
  let tick = 0;
  return () => {
    const value = new Date('2026-07-31T00:00:00.000Z');
    value.setMilliseconds(value.getMilliseconds() + tick);
    tick += 1;
    return value;
  };
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map(key => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function deepClone(value) {
  return structuredClone(value);
}

function assertSimulation(condition, message) {
  if (!condition) {
    throw new ReleaseDeliveryError(message);
  }
}
