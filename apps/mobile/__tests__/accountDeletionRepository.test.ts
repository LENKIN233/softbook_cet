import {
  createAccountDeletionRepository,
  parseAccountDeletionResponse,
} from '../src/account/accountDeletionRepository';

const ENDPOINT = 'https://api.softbook.example/v2/account/deletion';
const CONTEXT = {
  accessToken: 'captured-access-token',
  tokenType: 'Bearer' as const,
};
const REQUEST = {
  data: {
    deletion_request: {
      id: 'delete_abcdefghijklmnopqrstuvwx',
      requested_at: '2026-08-29T08:00:00.000Z',
      status: 'queued',
    },
  },
};

test('strictly parses queued and processing account deletion requests', () => {
  expect(parseAccountDeletionResponse(REQUEST)).toEqual({
    id: 'delete_abcdefghijklmnopqrstuvwx',
    requestedAt: '2026-08-29T08:00:00.000Z',
    status: 'queued',
  });
  expect(
    parseAccountDeletionResponse({
      data: {
        deletion_request: {
          ...REQUEST.data.deletion_request,
          status: 'processing',
        },
      },
    }),
  ).toMatchObject({status: 'processing'});
});

test.each([
  {
    data: {
      deletion_request: {
        ...REQUEST.data.deletion_request,
        completed: true,
      },
    },
  },
  {
    data: {
      deletion_request: {
        ...REQUEST.data.deletion_request,
        requested_at: '2026-08-29 08:00:00',
      },
    },
  },
  {
    data: {
      deletion_request: {
        ...REQUEST.data.deletion_request,
        status: 'completed',
      },
    },
  },
  {...REQUEST, trace_id: 'not-allowed'},
])('rejects malformed or expanded deletion response %#', payload => {
  expect(() => parseAccountDeletionResponse(payload)).toThrow();
});

test('coalesces a concurrent press into one account mutation', async () => {
  let resolveResponse:
    | ((value: {
        json: () => Promise<typeof REQUEST>;
        ok: boolean;
        status: number;
      }) => void)
    | undefined;
  const fetchImpl = jest.fn(
    () =>
      new Promise<{
        json: () => Promise<typeof REQUEST>;
        ok: boolean;
        status: number;
      }>(resolve => {
        resolveResponse = resolve;
      }),
  );
  const repository = createAccountDeletionRepository({
    endpoint: ENDPOINT,
    fetchImpl,
  });

  const first = repository.requestDeletion(CONTEXT);
  const duplicate = repository.requestDeletion(CONTEXT);
  resolveResponse?.({json: async () => REQUEST, ok: true, status: 202});

  await expect(Promise.all([first, duplicate])).resolves.toEqual([
    expect.objectContaining({status: 'queued'}),
    expect.objectContaining({status: 'queued'}),
  ]);
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

test('does not coalesce deletion across captured session credentials', async () => {
  const fetchImpl = jest.fn(
    () => new Promise<never>(() => undefined),
  );
  const repository = createAccountDeletionRepository({
    endpoint: ENDPOINT,
    fetchImpl,
    requestTimeoutMs: 25,
  });
  const origin = repository.requestDeletion(CONTEXT);

  await expect(
    repository.requestDeletion({
      accessToken: 'replacement-access-token',
      tokenType: 'Bearer',
    }),
  ).rejects.toThrow('another session');
  await expect(origin).rejects.toMatchObject({reason: 'timeout'});
  expect(fetchImpl).toHaveBeenCalledTimes(1);
});

test('lost response can retry the same idempotent endpoint and only accepts exact 202', async () => {
  const fetchImpl = jest
    .fn()
    .mockRejectedValueOnce(new Error('connection lost after send'))
    .mockResolvedValueOnce({
      json: async () => REQUEST,
      ok: true,
      status: 202,
    });
  const repository = createAccountDeletionRepository({
    endpoint: ENDPOINT,
    fetchImpl,
    headers: {'x-softbook-client': 'mobile'},
  });

  await expect(repository.requestDeletion(CONTEXT)).rejects.toThrow(
    'connection lost after send',
  );
  await expect(repository.requestDeletion(CONTEXT)).resolves.toMatchObject({
    id: REQUEST.data.deletion_request.id,
  });
  expect(fetchImpl).toHaveBeenCalledTimes(2);
  expect(fetchImpl).toHaveBeenNthCalledWith(1, ENDPOINT, {
    body: '{}',
    headers: {
      Accept: 'application/json',
      Authorization: 'Bearer captured-access-token',
      'content-type': 'application/json',
      'x-softbook-client': 'mobile',
    },
    method: 'POST',
    signal: expect.anything(),
  });
  expect(fetchImpl).toHaveBeenNthCalledWith(
    2,
    ENDPOINT,
    expect.objectContaining({body: '{}', method: 'POST'}),
  );

  const wrongStatusRepository = createAccountDeletionRepository({
    endpoint: ENDPOINT,
    fetchImpl: jest.fn(async () => ({
      json: async () => REQUEST,
      ok: true,
      status: 200,
    })),
  });
  await expect(
    wrongStatusRepository.requestDeletion(CONTEXT),
  ).rejects.toMatchObject({status: 200});
});

test('bounds response parsing so a stalled 202 becomes recoverable unknown', async () => {
  const repository = createAccountDeletionRepository({
    endpoint: ENDPOINT,
    fetchImpl: jest.fn(async () => ({
      json: () => new Promise<never>(() => undefined),
      ok: true,
      status: 202,
    })),
    requestTimeoutMs: 5,
  });

  await expect(repository.requestDeletion(CONTEXT)).rejects.toMatchObject({
    reason: 'timeout',
    retryable: true,
  });
});
