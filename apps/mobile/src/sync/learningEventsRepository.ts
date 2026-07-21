import type {
  LearningCardResultOutcome,
  LearningInteractionId,
  LearningTrack,
} from '../learning/model';
import {RemoteHttpError} from '../runtime/remoteHttpError';

export const LEARNING_EVENTS_SCHEMA_VERSION = 'learning-events.v2' as const;
export const LEARNING_EVENTS_ACK_SCHEMA_VERSION =
  'learning-events-ack.v2' as const;
export const MAX_LEARNING_EVENT_BATCH_SIZE = 9;

export type LearningAnswerGrade = 'passed' | 'review_needed';
export type LearningEventPhase = 'learning' | 'review';

export type LearningEventV2 = {
  event_id: string;
  card_id: string;
  interaction_id: LearningInteractionId;
  phase: LearningEventPhase;
  outcome: LearningCardResultOutcome;
  answer_grade: LearningAnswerGrade;
  used_hint: boolean;
  used_peek: boolean;
  client_occurred_at: string;
  content_version: string;
  device_cursor: {
    device_id: string;
    sequence: number;
  };
};

export type LearningEventAcknowledgement = {
  acknowledgedAt: string;
  results: Array<{
    eventId: string;
    serverSequence: number;
    status: 'accepted' | 'duplicate';
  }>;
  track: LearningTrack;
};

export type LearningEventsContext = {
  authToken?: string;
  phoneNumber: string;
};

export type LearningEventsRemoteConfig = {
  endpoint: string;
  headers?: Record<string, string>;
};

type FetchLikeResponse = {
  json: () => Promise<unknown>;
  ok: boolean;
  status: number;
};

export type LearningEventsFetchLike = (
  input: string,
  init?: {
    body?: string;
    headers?: Record<string, string>;
    method?: string;
  },
) => Promise<FetchLikeResponse>;

export type LearningEventsRepository = {
  submitEvents: (
    context: LearningEventsContext,
    track: LearningTrack,
    events: LearningEventV2[],
  ) => Promise<LearningEventAcknowledgement>;
};

export type LearningEventsRepositoryConfig = {
  fetchImpl?: LearningEventsFetchLike;
  mode: 'local' | 'remote';
  remoteConfig?: LearningEventsRemoteConfig;
};

export function createLearningEventsRepository(
  config: LearningEventsRepositoryConfig,
): LearningEventsRepository {
  return {
    async submitEvents(context, track, events) {
      if (config.mode !== 'remote') {
        throw new Error(
          'Local learning runtime does not submit remote events.',
        );
      }

      if (!config.remoteConfig) {
        throw new Error('Remote learning events require remoteConfig.');
      }

      if (
        events.length === 0 ||
        events.length > MAX_LEARNING_EVENT_BATCH_SIZE
      ) {
        throw new Error(
          `Learning event batches must contain between 1 and ${MAX_LEARNING_EVENT_BATCH_SIZE} events.`,
        );
      }

      if (!context.authToken) {
        throw new RemoteHttpError(
          'Remote learning events sync requires authToken.',
          401,
        );
      }

      const fetchImpl = config.fetchImpl ?? (fetch as LearningEventsFetchLike);
      const response = await fetchImpl(config.remoteConfig.endpoint, {
        body: JSON.stringify({
          schema_version: LEARNING_EVENTS_SCHEMA_VERSION,
          track,
          events,
        }),
        headers: {
          ...config.remoteConfig.headers,
          'content-type': 'application/json',
          Authorization: `Bearer ${context.authToken}`,
        },
        method: 'POST',
      });

      if (!response.ok) {
        throw new RemoteHttpError(
          `Remote learning events sync failed with ${response.status}.`,
          response.status,
        );
      }

      return parseLearningEventsAcknowledgement(
        await response.json(),
        track,
        events,
      );
    },
  };
}

export function parseLearningEventsAcknowledgement(
  payload: unknown,
  expectedTrack: LearningTrack,
  expectedEvents: readonly LearningEventV2[],
): LearningEventAcknowledgement {
  const envelope = requireExactObject(payload, ['data'], 'response');
  const data = requireExactObject(
    envelope.data,
    ['schema_version', 'acknowledged_at', 'track', 'results'],
    'response.data',
  );

  if (data.schema_version !== LEARNING_EVENTS_ACK_SCHEMA_VERSION) {
    throw new Error(
      `Learning events acknowledgement schema must be ${LEARNING_EVENTS_ACK_SCHEMA_VERSION}.`,
    );
  }

  if (data.track !== expectedTrack) {
    throw new Error('Learning events acknowledgement track does not match.');
  }

  if (
    typeof data.acknowledged_at !== 'string' ||
    !isRfc3339Instant(data.acknowledged_at)
  ) {
    throw new Error(
      'Learning events acknowledgement time must be an RFC3339 instant.',
    );
  }

  if (!Array.isArray(data.results)) {
    throw new Error(
      'Learning events acknowledgement results must be an array.',
    );
  }

  if (data.results.length !== expectedEvents.length) {
    throw new Error(
      'Learning events acknowledgement must contain one result per event.',
    );
  }

  const seenServerSequences = new Set<number>();
  const results = data.results.map((value, index) => {
    const result = requireExactObject(
      value,
      ['event_id', 'status', 'server_sequence'],
      `response.data.results[${index}]`,
    );
    const expectedEventId = expectedEvents[index].event_id;

    if (result.event_id !== expectedEventId) {
      throw new Error(
        'Learning events acknowledgement must preserve event order and identity.',
      );
    }

    if (result.status !== 'accepted' && result.status !== 'duplicate') {
      throw new Error(
        'Learning events acknowledgement status must be accepted or duplicate.',
      );
    }
    const status: 'accepted' | 'duplicate' = result.status;

    if (
      !Number.isSafeInteger(result.server_sequence) ||
      (result.server_sequence as number) <= 0 ||
      seenServerSequences.has(result.server_sequence as number)
    ) {
      throw new Error(
        'Learning events acknowledgement server sequence must be positive and unique.',
      );
    }
    seenServerSequences.add(result.server_sequence as number);

    return {
      eventId: expectedEventId,
      serverSequence: result.server_sequence as number,
      status,
    };
  });

  return {
    acknowledgedAt: data.acknowledged_at,
    results,
    track: expectedTrack,
  };
}

function requireExactObject(
  value: unknown,
  expectedFields: readonly string[],
  label: string,
): Record<string, unknown> {
  if (!isObject(value)) {
    throw new Error(`${label} must be an object.`);
  }

  const actualFields = Object.keys(value);

  if (
    actualFields.length !== expectedFields.length ||
    expectedFields.some(field => !actualFields.includes(field))
  ) {
    throw new Error(`${label} must contain only its documented fields.`);
  }

  return value;
}

function isRfc3339Instant(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) && Number.isFinite(Date.parse(value))
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
