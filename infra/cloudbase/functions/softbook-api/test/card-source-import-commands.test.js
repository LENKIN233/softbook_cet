const assert = require('node:assert/strict');
const test = require('node:test');

test('card-source import archives the replaced version and registers the new active version', async () => {
  const {
    CARD_SOURCE_COLLECTION,
    CARD_SOURCE_VERSION_COLLECTION,
    createCardSourceImportCommand,
    createCardSourceVersionDocumentId,
  } = await import('../../../card-source-import-commands.mjs');
  const previous = source('cet4', `sha256:${'1'.repeat(64)}`);
  const current = source('cet4', `sha256:${'2'.repeat(64)}`);
  const updatedAt = '2026-07-21T08:00:00.000Z';
  const commands = JSON.parse(
    createCardSourceImportCommand({
      cardSource: current,
      previousCardSource: previous,
      updatedAt,
    }),
  );

  assert.deepEqual(
    commands.map(command => command.TableName),
    [
      CARD_SOURCE_VERSION_COLLECTION,
      CARD_SOURCE_COLLECTION,
      CARD_SOURCE_VERSION_COLLECTION,
    ],
  );
  const archived = JSON.parse(commands[0].Command).updates[0];
  const active = JSON.parse(commands[2].Command).updates[0];
  assert.equal(
    archived.q._id,
    createCardSourceVersionDocumentId('cet4', previous.content_version),
  );
  assert.equal(archived.u.$set.retention_status, 'retained');
  assert.equal(archived.u.$set.retained_until, null);
  assert.equal(
    active.q._id,
    createCardSourceVersionDocumentId('cet4', current.content_version),
  );
  assert.equal(active.u.$set.retention_status, 'active');
  assert.equal(active.u.$set.updated_at, updatedAt);
});

test('card-source import does not create a retained duplicate for the current version', async () => {
  const {createCardSourceImportCommand} = await import(
    '../../../card-source-import-commands.mjs'
  );
  const current = source('cet6', `sha256:${'3'.repeat(64)}`);
  const commands = JSON.parse(
    createCardSourceImportCommand({
      cardSource: current,
      previousCardSource: current,
      updatedAt: '2026-07-21T08:00:00.000Z',
    }),
  );

  assert.equal(commands.length, 2);
  assert.equal(
    JSON.parse(commands[1].Command).updates[0].u.$set.retention_status,
    'active',
  );
});

test('card-source current-version query parsing is strict and supports an empty collection', async () => {
  const {
    createQueryCurrentCardSourceCommand,
    parseQueryCurrentCardSourceResult,
  } = await import('../../../card-source-import-commands.mjs');
  const command = JSON.parse(createQueryCurrentCardSourceCommand('cet4'))[0];
  assert.equal(command.CommandType, 'QUERY');
  assert.deepEqual(JSON.parse(command.Command).filter, {_id: 'cet4'});
  assert.equal(
    parseQueryCurrentCardSourceResult(
      'CloudBase CLI\n{"data":{"results":[[]]}}',
      'cet4',
    ),
    null,
  );
  assert.deepEqual(
    parseQueryCurrentCardSourceResult(
      '{"data":{"results":[[{"_id":"cet4","track":"cet4"}]]}}',
      'cet4',
    ),
    {_id: 'cet4', track: 'cet4'},
  );
  assert.throws(
    () => parseQueryCurrentCardSourceResult('{"data":{}}', 'cet4'),
    /invalid result/,
  );
  assert.throws(
    () =>
      parseQueryCurrentCardSourceResult(
        '{"data":{"results":[[{"_id":"cet6","track":"cet6"}]]}}',
        'cet4',
      ),
    /invalid document/,
  );
});

function source(track, contentVersion) {
  return {
    card_records: [{card_id: `${track}-card`}],
    content_version: contentVersion,
    release: null,
    source: {id: `${track}-source`, label: `${track} source`},
    track,
  };
}
