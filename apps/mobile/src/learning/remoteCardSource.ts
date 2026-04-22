import { LearningCard, LearningTrack } from './model';
import {
  LearningCardRecord,
  normalizeLearningCardRecords,
} from './sourceContract';

export type LearningCardSourceResponse = {
  sourceId: string;
  sourceLabel: string;
  track: LearningTrack;
  cards: LearningCard[];
};

export type RemoteLearningCardSourcePayload = {
  source_id: string;
  source_label: string;
  track: LearningTrack;
  cards: LearningCardRecord[];
};

export type RemoteLearningCardSourceConfig = {
  endpoint: string;
  apiKey?: string;
};

export type FetchLikeResponse = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
};

export type FetchLike = (
  input: string,
  init?: {
    method?: string;
    headers?: Record<string, string>;
  },
) => Promise<FetchLikeResponse>;

export async function loadRemoteLearningCardSource(
  track: LearningTrack,
  config: RemoteLearningCardSourceConfig,
  fetchImpl: FetchLike,
): Promise<LearningCardSourceResponse> {
  const response = await fetchImpl(
    buildRemoteLearningCardSourceUrl(config.endpoint, track),
    {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(config.apiKey ? { 'x-api-key': config.apiKey } : {}),
      },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Remote learning card source request failed with status ${response.status}.`,
    );
  }

  const payload = await response.json();

  return parseRemoteLearningCardSourcePayload(payload, track);
}

export function parseRemoteLearningCardSourcePayload(
  payload: unknown,
  expectedTrack?: LearningTrack,
): LearningCardSourceResponse {
  if (!isObject(payload)) {
    throw new Error('Remote learning card source payload must be an object.');
  }

  const { source_id, source_label, track, cards } = payload;

  if (typeof source_id !== 'string' || source_id.trim().length === 0) {
    throw new Error(
      'Remote learning card source payload.source_id is required.',
    );
  }

  if (typeof source_label !== 'string' || source_label.trim().length === 0) {
    throw new Error(
      'Remote learning card source payload.source_label is required.',
    );
  }

  if (track !== 'cet4' && track !== 'cet6') {
    throw new Error(
      'Remote learning card source payload.track must be cet4 or cet6.',
    );
  }

  if (expectedTrack !== undefined && track !== expectedTrack) {
    throw new Error(
      `Remote learning card source payload.track must match requested track ${expectedTrack}.`,
    );
  }

  if (!Array.isArray(cards)) {
    throw new Error(
      'Remote learning card source payload.cards must be an array.',
    );
  }

  const normalizedCards = normalizeLearningCardRecords(
    cards as LearningCardRecord[],
  );

  if (!normalizedCards.every(card => card.track === track)) {
    throw new Error(
      'Remote learning card source cards must all match payload.track.',
    );
  }

  return {
    sourceId: source_id,
    sourceLabel: source_label,
    track,
    cards: normalizedCards,
  };
}

function buildRemoteLearningCardSourceUrl(
  endpoint: string,
  track: LearningTrack,
) {
  const separator = endpoint.includes('?') ? '&' : '?';

  return `${endpoint}${separator}track=${track}`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
