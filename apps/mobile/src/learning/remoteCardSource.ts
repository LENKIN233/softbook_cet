import { LearningCard, LearningTrack } from './model';
import {
  LearningCardRecord,
  normalizeLearningCardRecords,
} from './sourceContract';
import { RemoteHttpError } from '../runtime/remoteHttpError';

export type LearningCardSourceResponse = {
  contentVersion: string | null;
  sourceId: string;
  sourceLabel: string;
  track: LearningTrack;
  cards: LearningCard[];
};

export type RemoteLearningCardSourceContext = {
  authToken?: string;
  phoneNumber: string;
};

export type RemoteLearningCardSourcePayload = {
  source_id: string;
  source_label: string;
  track: LearningTrack;
  cards: LearningCardRecord[];
};

export type SoftbookRemoteLearningCardSourcePayload = {
  data: {
    source: {
      id: string;
      label: string;
    };
    track: LearningTrack;
    card_records: LearningCardRecord[];
    content_version: string;
  };
};

export type RemoteLearningCardSourcePayloadParser = (
  payload: unknown,
  expectedTrack?: LearningTrack,
) => LearningCardSourceResponse;

export type RemoteLearningCardSourceConfig = {
  endpoint: string;
  apiKey?: string;
  apiKeyHeader?: string;
  headers?: Record<string, string>;
  parsePayload?: RemoteLearningCardSourcePayloadParser;
  trackQueryParam?: string;
};

export type SoftbookRemoteLearningCardSourceRuntimeConfig = {
  apiKey?: string;
  baseUrl: string;
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

const CONTENT_VERSION_PATTERN = /^sha256:[0-9a-f]{64}$/;

export async function loadRemoteLearningCardSource(
  context: RemoteLearningCardSourceContext,
  track: LearningTrack,
  config: RemoteLearningCardSourceConfig,
  fetchImpl: FetchLike,
): Promise<LearningCardSourceResponse> {
  const apiKeyHeader = config.apiKeyHeader ?? 'x-api-key';
  const response = await fetchImpl(
    buildRemoteLearningCardSourceUrl(
      config.endpoint,
      track,
      config.trackQueryParam,
    ),
    {
      method: 'GET',
      headers: buildRemoteLearningCardSourceHeaders(
        context,
        config,
        apiKeyHeader,
      ),
    },
  );

  if (!response.ok) {
    throw new RemoteHttpError(
      `Remote learning card source request failed with status ${response.status}.`,
      response.status,
    );
  }

  const payload = await response.json();
  const parsePayload =
    config.parsePayload ?? parseRemoteLearningCardSourcePayload;

  return parsePayload(payload, track);
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
    contentVersion: null,
    sourceId: source_id,
    sourceLabel: source_label,
    track,
    cards: normalizedCards,
  };
}

export function parseSoftbookRemoteLearningCardSourcePayload(
  payload: unknown,
  expectedTrack?: LearningTrack,
): LearningCardSourceResponse {
  if (!isObject(payload)) {
    throw new Error('Remote learning card-source payload must be an object.');
  }

  if (!isObject(payload.data)) {
    throw new Error(
      'Remote learning card-source payload.data must be an object.',
    );
  }

  const { source, track, card_records, content_version } = payload.data;

  if (!isObject(source)) {
    throw new Error(
      'Remote learning card-source payload.data.source must be an object.',
    );
  }

  if (typeof source.id !== 'string' || source.id.trim().length === 0) {
    throw new Error(
      'Remote learning card-source payload.data.source.id is required.',
    );
  }

  if (typeof source.label !== 'string' || source.label.trim().length === 0) {
    throw new Error(
      'Remote learning card-source payload.data.source.label is required.',
    );
  }

  if (track !== 'cet4' && track !== 'cet6') {
    throw new Error(
      'Remote learning card-source payload.data.track must be cet4 or cet6.',
    );
  }

  if (expectedTrack !== undefined && track !== expectedTrack) {
    throw new Error(
      `Remote learning card-source payload.data.track must match requested track ${expectedTrack}.`,
    );
  }

  if (!Array.isArray(card_records)) {
    throw new Error(
      'Remote learning card-source payload.data.card_records must be an array.',
    );
  }

  if (
    typeof content_version !== 'string' ||
    !CONTENT_VERSION_PATTERN.test(content_version)
  ) {
    throw new Error(
      'Remote learning card-source payload.data.content_version must be a SHA-256 identifier.',
    );
  }

  const normalizedCards = normalizeLearningCardRecords(
    card_records as LearningCardRecord[],
  );

  if (!normalizedCards.every(card => card.track === track)) {
    throw new Error(
      'Remote learning bootstrap cards must all match payload.data.track.',
    );
  }

  return {
    contentVersion: content_version,
    sourceId: source.id,
    sourceLabel: source.label,
    track,
    cards: normalizedCards,
  };
}

export function createSoftbookRemoteLearningCardSourceConfig(
  config: SoftbookRemoteLearningCardSourceRuntimeConfig,
): RemoteLearningCardSourceConfig {
  return {
    endpoint: `${trimTrailingSlash(config.baseUrl)}/v1/learning/card-source`,
    apiKey: config.apiKey,
    headers: {
      'x-softbook-client': 'mobile',
    },
    parsePayload: parseSoftbookRemoteLearningCardSourcePayload,
    trackQueryParam: 'track',
  };
}

function buildRemoteLearningCardSourceUrl(
  endpoint: string,
  track: LearningTrack,
  trackQueryParam: string = 'track',
) {
  const separator = endpoint.includes('?') ? '&' : '?';

  return `${endpoint}${separator}${trackQueryParam}=${track}`;
}

function buildRemoteLearningCardSourceHeaders(
  context: RemoteLearningCardSourceContext,
  config: RemoteLearningCardSourceConfig,
  apiKeyHeader: string,
) {
  if (!context.authToken) {
    throw new RemoteHttpError(
      'Remote learning card source requires authToken.',
      401,
    );
  }

  return {
    Accept: 'application/json',
    Authorization: `Bearer ${context.authToken}`,
    ...config.headers,
    ...(config.apiKey ? { [apiKeyHeader]: config.apiKey } : {}),
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function trimTrailingSlash(value: string) {
  return value.endsWith('/') ? value.slice(0, -1) : value;
}
