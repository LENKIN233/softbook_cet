import {createHash} from 'node:crypto';

export const CARD_SOURCE_COLLECTION = 'softbook_card_sources';
export const CARD_SOURCE_VERSION_COLLECTION = 'softbook_card_source_versions';

export function createCardSourceVersionDocumentId(track, contentVersion) {
  return createHash('sha256')
    .update(`card-source-version\0${track}\0${contentVersion}`)
    .digest('hex');
}

export function createQueryCurrentCardSourceCommand(track) {
  return JSON.stringify([
    {
      TableName: CARD_SOURCE_COLLECTION,
      CommandType: 'QUERY',
      Command: JSON.stringify({
        find: CARD_SOURCE_COLLECTION,
        filter: {_id: track},
        limit: 1,
      }),
    },
  ]);
}

export function parseQueryCurrentCardSourceResult(output, track) {
  const jsonStart = output.indexOf('{');

  if (jsonStart === -1) {
    throw new Error(`tcb query for ${track} did not return JSON.`);
  }

  const payload = JSON.parse(output.slice(jsonStart));
  const results = payload?.data?.results?.[0];

  if (!Array.isArray(results)) {
    throw new Error(`tcb query for ${track} returned an invalid result.`);
  }

  if (results.length > 1) {
    throw new Error(
      `tcb query for ${track} returned multiple current sources.`,
    );
  }

  if (results.length === 0) {
    return null;
  }

  const document = results[0];

  if (
    typeof document !== 'object' ||
    document === null ||
    Array.isArray(document) ||
    document._id !== track
  ) {
    throw new Error(`tcb query for ${track} returned an invalid document.`);
  }

  return document;
}

export function createCardSourceImportCommand({
  cardSource,
  previousCardSource = null,
  updatedAt,
}) {
  const commands = [];

  if (
    previousCardSource &&
    previousCardSource.content_version !== cardSource.content_version
  ) {
    commands.push(
      createVersionUpsert(previousCardSource, updatedAt, 'retained'),
    );
  }

  commands.push(createCurrentSourceUpsert(cardSource, updatedAt));
  commands.push(createVersionUpsert(cardSource, updatedAt, 'active'));

  return JSON.stringify(commands);
}

function createCurrentSourceUpsert(cardSource, updatedAt) {
  return {
    TableName: CARD_SOURCE_COLLECTION,
    CommandType: 'UPDATE',
    Command: JSON.stringify({
      update: CARD_SOURCE_COLLECTION,
      updates: [
        {
          q: {_id: cardSource.track},
          u: {
            $set: createSourceFields(cardSource, updatedAt),
          },
          upsert: true,
        },
      ],
    }),
  };
}

function createVersionUpsert(cardSource, updatedAt, retentionStatus) {
  const documentId = createCardSourceVersionDocumentId(
    cardSource.track,
    cardSource.content_version,
  );

  return {
    TableName: CARD_SOURCE_VERSION_COLLECTION,
    CommandType: 'UPDATE',
    Command: JSON.stringify({
      update: CARD_SOURCE_VERSION_COLLECTION,
      updates: [
        {
          q: {_id: documentId},
          u: {
            $set: {
              ...createSourceFields(cardSource, updatedAt),
              retained_until: null,
              retention_status: retentionStatus,
            },
          },
          upsert: true,
        },
      ],
    }),
  };
}

function createSourceFields(cardSource, updatedAt) {
  return {
    card_records: cardSource.card_records,
    content_version: cardSource.content_version,
    imported_via: 'infra/cloudbase/import-card-source.mjs',
    release: cardSource.release,
    source: cardSource.source,
    track: cardSource.track,
    updated_at: updatedAt,
  };
}
