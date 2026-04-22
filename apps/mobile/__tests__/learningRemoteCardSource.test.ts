import { localLearningCardRecords } from '../src/learning/localCardRecords';
import {
  createSoftbookRemoteLearningCardSourceConfig,
  loadRemoteLearningCardSource,
  parseRemoteLearningCardSourcePayload,
  parseSoftbookRemoteLearningCardSourcePayload,
} from '../src/learning/remoteCardSource';

test('remote learning card source loads and normalizes a valid payload', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      source_id: 'remote-learning-cards',
      source_label: '远端卡源',
      track: 'cet4',
      cards: localLearningCardRecords,
    }),
  });

  const result = await loadRemoteLearningCardSource(
    'cet4',
    {
      endpoint: 'https://example.com/api/learning/cards',
      apiKey: 'test-key',
    },
    fetchMock,
  );

  expect(fetchMock).toHaveBeenCalledWith(
    'https://example.com/api/learning/cards?track=cet4',
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-api-key': 'test-key',
      },
    },
  );
  expect(result.sourceId).toBe('remote-learning-cards');
  expect(result.sourceLabel).toBe('远端卡源');
  expect(result.track).toBe('cet4');
  expect(result.cards).toHaveLength(localLearningCardRecords.length);
  expect(result.cards[0].card_id).toBe(localLearningCardRecords[0].card_id);
});

test('remote learning card source rejects HTTP failures', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: false,
    status: 503,
    json: async () => ({}),
  });

  await expect(
    loadRemoteLearningCardSource(
      'cet4',
      { endpoint: 'https://example.com/api/learning/cards' },
      fetchMock,
    ),
  ).rejects.toThrow(
    'Remote learning card source request failed with status 503.',
  );
});

test('remote learning card source rejects malformed payloads', () => {
  expect(() =>
    parseRemoteLearningCardSourcePayload(
      {
        source_id: 'remote-learning-cards',
        source_label: '远端卡源',
        track: 'cet4',
        cards: 'not-an-array',
      },
      'cet4',
    ),
  ).toThrow('Remote learning card source payload.cards must be an array.');
});

test('remote learning card source rejects track drift between request and payload', () => {
  expect(() =>
    parseRemoteLearningCardSourcePayload(
      {
        source_id: 'remote-learning-cards',
        source_label: '远端卡源',
        track: 'cet6',
        cards: localLearningCardRecords.map(record => ({
          ...record,
          track: 'cet6' as const,
        })),
      },
      'cet4',
    ),
  ).toThrow(
    'Remote learning card source payload.track must match requested track cet4.',
  );
});

test('softbook remote learning config maps runtime baseUrl and payload envelope', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      data: {
        source: {
          id: 'softbook-remote-source',
          label: '正式远端卡源',
        },
        track: 'cet4',
        card_records: localLearningCardRecords,
      },
    }),
  });

  const result = await loadRemoteLearningCardSource(
    'cet4',
    createSoftbookRemoteLearningCardSourceConfig({
      apiKey: 'runtime-key',
      baseUrl: 'https://api.softbook.example/',
    }),
    fetchMock,
  );

  expect(fetchMock).toHaveBeenCalledWith(
    'https://api.softbook.example/v1/learning/card-source?track=cet4',
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'x-softbook-client': 'mobile',
        'x-api-key': 'runtime-key',
      },
    },
  );
  expect(result.sourceId).toBe('softbook-remote-source');
  expect(result.sourceLabel).toBe('正式远端卡源');
  expect(result.cards).toHaveLength(localLearningCardRecords.length);
});

test('softbook remote learning payload parser rejects missing envelope data', () => {
  expect(() =>
    parseSoftbookRemoteLearningCardSourcePayload(
      {
        data: {
          source: {
            id: 'softbook-remote-source',
            label: '正式远端卡源',
          },
          track: 'cet4',
          card_records: 'not-an-array',
        },
      },
      'cet4',
    ),
  ).toThrow(
    'Remote learning bootstrap payload.data.card_records must be an array.',
  );
});
