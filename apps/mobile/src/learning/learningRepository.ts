import type {ContentManifestSignatureVerifier} from '../audio/contentManifestRepository';
import type {InstalledClientIdentityProvider} from '../runtime/clientVersion';
import type {SoftbookClientKind} from '../runtime/remoteClient';
import { LearningSession, LearningTrack } from './model';
import type {
  FetchLike,
  RemoteLearningCardSourceConfig,
} from './remoteCardSource';
import type {RemoteLearningSessionConfig} from './remoteLearningSession';
import {createRemoteLearningSessionRepository} from './remoteLearningRepository';
import {
  DEFAULT_LEARNING_SESSION_CARD_COUNT,
  createLearningSession,
} from './session';
import { LearningCardSource, localLearningCardSource } from './localCardSource';

export type LearningRepositoryMode = 'local' | 'remote';

export type LearningSessionRepositoryContext = {
  authToken?: string;
  phoneNumber: string;
};

export type LearningSessionRepository = {
  continueRound: (
    context: LearningSessionRepositoryContext,
    session: LearningSession,
  ) => Promise<void>;
  loadSession: (
    context: LearningSessionRepositoryContext,
    track: LearningTrack,
  ) => Promise<LearningSession>;
};

export type RemoteLearningContentManifestConfig =
  | {
      mode: 'disabled';
    }
  | {
      mode: 'remote';
      apiKey?: string;
      baseUrl: string;
      clientKind?: SoftbookClientKind;
      installedClientIdentityProvider: InstalledClientIdentityProvider;
      now?: () => Date;
      verifySignature: ContentManifestSignatureVerifier;
    };

export type LearningSessionRepositoryConfig = {
  cardCount?: number;
  fetchImpl?: FetchLike;
  localSource?: LearningCardSource;
  mode: LearningRepositoryMode;
  contentManifestConfig?: RemoteLearningContentManifestConfig;
  remoteConfig?: RemoteLearningCardSourceConfig;
  remoteSessionConfig?: RemoteLearningSessionConfig;
};

export function createLearningSessionRepository(
  config: LearningSessionRepositoryConfig,
): LearningSessionRepository {
  if (config.mode === 'remote') {
    return createRemoteLearningSessionRepository(config);
  }

  const cardCount = config.cardCount ?? DEFAULT_LEARNING_SESSION_CARD_COUNT;
  const localSource = config.localSource ?? localLearningCardSource;
  const createLocalSession = (track: LearningTrack) =>
    assertNonEmptySession(
      createLearningSession(
        track,
        localSource.sourceId,
        localSource.sourceLabel,
        localSource.loadCards(track),
        cardCount,
      ),
    );

  return {
    continueRound: async () => {
      throw new Error('Learning session has no remote round to continue.');
    },
    loadSession: async (context, track) => {
      return createLocalSession(track);
    },
  };
}

function assertNonEmptySession(session: LearningSession) {
  if (session.cards.length === 0) {
    throw new Error('Learning session repository returned an empty session.');
  }

  return session;
}
