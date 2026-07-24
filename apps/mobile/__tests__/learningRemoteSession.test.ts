import {
  createSoftbookRemoteLearningSessionConfig,
  loadRemoteLearningSession,
  parseRemoteLearningSessionPayload,
} from '../src/learning/remoteLearningSession';

const CONTENT_VERSION = `sha256:${'a'.repeat(64)}`;
const SELECTION_ID = 'sel_1234567890abcdef';

function createPayload() {
  return {
    data: {
      schema_version: 'learning-session.v1',
      generated_at: '2026-07-24T08:00:00.000Z',
      track: 'cet4',
      content_version: CONTENT_VERSION,
      source_id: 'remote-learning-cards',
      membership_stage: 'trial',
      algorithm: {
        id: 'FSRS-6',
        library: 'ts-fsrs',
        library_version: '5.4.1',
        policy_version: 'softbook-fsrs.v1',
      },
      access: {
        mode: 'full',
        accessible_card_count: 5,
        total_card_count: 5,
      },
      selection: {
        selection_id: SELECTION_ID,
        card_id: '100101',
        phase: 'learning',
        reason: 'catalog_new',
        due_at: null,
      },
      next_due_at: null,
    },
  };
}

test('loads and strictly maps a supported learning-session response', async () => {
  const fetchMock = jest.fn().mockResolvedValue({
    json: async () => createPayload(),
    ok: true,
    status: 200,
  });

  const result = await loadRemoteLearningSession(
    {
      authToken: 'current-token',
      phoneNumber: '13800138000',
    },
    'cet4',
    createSoftbookRemoteLearningSessionConfig({
      apiKey: 'runtime-key',
      baseUrl: 'https://api.softbook.example/',
    }),
    fetchMock,
  );

  expect(result).toMatchObject({
    contentVersion: CONTENT_VERSION,
    selection: {
      cardId: '100101',
      phase: 'learning',
      reason: 'catalog_new',
      selectionId: SELECTION_ID,
    },
    sourceId: 'remote-learning-cards',
    track: 'cet4',
  });
  expect(fetchMock).toHaveBeenCalledWith(
    'https://api.softbook.example/v2/learning/session?track=cet4',
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: 'Bearer current-token',
        'x-api-key': 'runtime-key',
        'x-softbook-client': 'mobile',
      },
    },
  );
});

test('accepts a canonical empty selection with the next due time', () => {
  const payload = createPayload();
  payload.data.selection = null as never;
  payload.data.next_due_at = '2026-07-25T08:00:00.000Z' as never;

  expect(parseRemoteLearningSessionPayload(payload, 'cet4')).toMatchObject({
    nextDueAt: '2026-07-25T08:00:00.000Z',
    selection: null,
  });
});

test.each([
  {
    label: 'undocumented response field',
    mutate: (payload: ReturnType<typeof createPayload>) => {
      (payload.data as Record<string, unknown>).debug = true;
    },
  },
  {
    label: 'track drift',
    mutate: (payload: ReturnType<typeof createPayload>) => {
      payload.data.track = 'cet6';
    },
  },
  {
    label: 'unsupported scheduler version',
    mutate: (payload: ReturnType<typeof createPayload>) => {
      payload.data.algorithm.library_version = '6.0.0';
    },
  },
  {
    label: 'invalid free boundary',
    mutate: (payload: ReturnType<typeof createPayload>) => {
      payload.data.access.mode = 'free_subset';
      payload.data.access.accessible_card_count = 4;
    },
  },
  {
    label: 'free membership with full access',
    mutate: (payload: ReturnType<typeof createPayload>) => {
      payload.data.membership_stage = 'free';
    },
  },
  {
    label: 'trial membership with free-subset access',
    mutate: (payload: ReturnType<typeof createPayload>) => {
      payload.data.access.mode = 'free_subset';
      payload.data.access.accessible_card_count = 3;
    },
  },
  {
    label: 'unactivated trial state',
    mutate: (payload: ReturnType<typeof createPayload>) => {
      payload.data.membership_stage = 'trial_available';
    },
  },
  {
    label: 'invalid selection identifier',
    mutate: (payload: ReturnType<typeof createPayload>) => {
      payload.data.selection.selection_id = 'sel_short';
    },
  },
  {
    label: 'phase and reason conflict',
    mutate: (payload: ReturnType<typeof createPayload>) => {
      payload.data.selection.phase = 'review';
    },
  },
  {
    label: 'selection and next due conflict',
    mutate: (payload: ReturnType<typeof createPayload>) => {
      payload.data.next_due_at = '2026-07-25T08:00:00.000Z' as never;
    },
  },
])('rejects $label', ({ mutate }) => {
  const payload = createPayload();
  mutate(payload);

  expect(() => parseRemoteLearningSessionPayload(payload, 'cet4')).toThrow();
});

test('requires authentication and preserves HTTP authorization failures', async () => {
  const config = createSoftbookRemoteLearningSessionConfig({
    baseUrl: 'https://api.softbook.example',
  });

  await expect(
    loadRemoteLearningSession(
      { phoneNumber: '13800138000' },
      'cet4',
      config,
      jest.fn(),
    ),
  ).rejects.toMatchObject({ status: 401 });

  await expect(
    loadRemoteLearningSession(
      {
        authToken: 'expired-token',
        phoneNumber: '13800138000',
      },
      'cet4',
      config,
      jest.fn().mockResolvedValue({
        json: async () => ({}),
        ok: false,
        status: 401,
      }),
    ),
  ).rejects.toMatchObject({ status: 401 });
});
