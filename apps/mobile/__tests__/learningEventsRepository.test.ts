import {
  createLearningEventsRepository,
  parseLearningEventsAcknowledgement,
  type LearningEventV2,
  type LearningEventsFetchLike,
} from '../src/sync/learningEventsRepository';

const CONTENT_VERSION = `sha256:${'a'.repeat(64)}`;

function createEvent(
  eventId = 'event_install_test_1',
  sequence = 1,
): LearningEventV2 {
  return {
    event_id: eventId,
    selection_id: 'sel_1234567890abcdef',
    card_id: '100101',
    interaction_id: 'flip',
    phase: 'learning',
    outcome: 'confident',
    answer_grade: 'passed',
    used_hint: false,
    used_peek: true,
    client_occurred_at: '2026-07-21T08:00:00.000Z',
    content_version: CONTENT_VERSION,
    device_cursor: {
      device_id: 'install_test_device',
      sequence,
    },
  };
}

function createAck(events: LearningEventV2[]) {
  return {
    data: {
      schema_version: 'learning-events-ack.v2',
      acknowledged_at: '2026-07-21T08:00:01.000Z',
      track: 'cet4',
      results: events.map((event, index) => ({
        event_id: event.event_id,
        status: index === 0 ? 'accepted' : 'duplicate',
        server_sequence: index + 1,
      })),
    },
  };
}

describe('learningEventsRepository', () => {
  it('posts the strict v2 payload without account identity or credentials', async () => {
    const events = [createEvent()];
    const fetchImpl = jest.fn<
      ReturnType<LearningEventsFetchLike>,
      Parameters<LearningEventsFetchLike>
    >(async () => ({
      json: async () => createAck(events),
      ok: true,
      status: 200,
    }));
    const repository = createLearningEventsRepository({
      fetchImpl,
      mode: 'remote',
      remoteConfig: {
        endpoint: 'https://api.softbook.example/v2/learning/events',
        headers: {
          Authorization: 'Bearer injected-token',
          'content-type': 'text/plain',
          'x-softbook-client': 'mobile',
        },
      },
    });

    await expect(
      repository.submitEvents(
        { authToken: 'current-token', phoneNumber: '13800138000' },
        'cet4',
        events,
      ),
    ).resolves.toMatchObject({
      results: [{ eventId: events[0].event_id, status: 'accepted' }],
      track: 'cet4',
    });

    const [, init] = fetchImpl.mock.calls[0];
    const body = JSON.parse(String(init?.body));

    expect(body).toEqual({
      schema_version: 'learning-events.v2',
      track: 'cet4',
      events,
    });
    expect(JSON.stringify(body)).not.toMatch(
      /phone|auth_token|access_token|refresh_token|current-token/,
    );
    expect(init?.headers).toMatchObject({
      Authorization: 'Bearer current-token',
      'content-type': 'application/json',
      'x-softbook-client': 'mobile',
    });
  });

  it('requires an access token and preserves authorization status', async () => {
    const repository = createLearningEventsRepository({
      fetchImpl: jest.fn() as never,
      mode: 'remote',
      remoteConfig: {
        endpoint: 'https://api.softbook.example/v2/learning/events',
      },
    });

    await expect(
      repository.submitEvents({ phoneNumber: '13800138000' }, 'cet4', [
        createEvent(),
      ]),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('rejects non-success HTTP responses without parsing an acknowledgement', async () => {
    const repository = createLearningEventsRepository({
      fetchImpl: jest.fn(async () => ({
        json: async () => {
          throw new Error('must not parse');
        },
        ok: false,
        status: 409,
      })),
      mode: 'remote',
      remoteConfig: {
        endpoint: 'https://api.softbook.example/v2/learning/events',
      },
    });

    await expect(
      repository.submitEvents(
        { authToken: 'token', phoneNumber: '13800138000' },
        'cet4',
        [createEvent()],
      ),
    ).rejects.toMatchObject({ status: 409 });
  });

  it.each([
    {
      label: 'missing result',
      mutate: (payload: ReturnType<typeof createAck>) => {
        payload.data.results = [];
      },
    },
    {
      label: 'reordered identity',
      mutate: (payload: ReturnType<typeof createAck>) => {
        payload.data.results[0].event_id = 'event_install_other_1';
      },
    },
    {
      label: 'unknown status',
      mutate: (payload: ReturnType<typeof createAck>) => {
        payload.data.results[0].status = 'ignored';
      },
    },
    {
      label: 'non-positive server sequence',
      mutate: (payload: ReturnType<typeof createAck>) => {
        payload.data.results[0].server_sequence = 0;
      },
    },
    {
      label: 'duplicate server sequence',
      mutate: (payload: ReturnType<typeof createAck>) => {
        payload.data.results[1].server_sequence = 1;
      },
      events: [createEvent(), createEvent('event_install_test_2', 2)],
    },
  ])(
    'rejects ambiguous acknowledgement: $label',
    ({ mutate, events = [createEvent()] }) => {
      const payload = createAck(events);
      mutate(payload);

      expect(() =>
        parseLearningEventsAcknowledgement(payload, 'cet4', events),
      ).toThrow();
    },
  );

  it('rejects undocumented acknowledgement fields', () => {
    const events = [createEvent()];
    const payload = createAck(events) as ReturnType<typeof createAck> & {
      debug?: boolean;
    };
    payload.debug = true;

    expect(() =>
      parseLearningEventsAcknowledgement(payload, 'cet4', events),
    ).toThrow('must contain only its documented fields');
  });
});
