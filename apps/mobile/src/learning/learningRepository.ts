import {
  assertContentManifestMatchesCards,
  loadRemoteContentManifest,
  type ContentManifestSignatureVerifier,
  type VerifiedContentManifest,
} from '../audio/contentManifestRepository';
import { LearningSession, LearningTrack } from './model';
import {
  FetchLike,
  RemoteLearningCardSourceConfig,
  loadRemoteLearningCardSource,
} from './remoteCardSource';
import {
  RemoteLearningSessionConfig,
  continueRemoteLearningRound,
  loadRemoteLearningSession,
} from './remoteLearningSession';
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
    continueRound: async (context, session) => {
      if (
        config.mode !== 'remote' ||
        !config.remoteSessionConfig ||
        !session.roundCompletion
      ) {
        throw new Error('Learning session has no remote round to continue.');
      }
      await continueRemoteLearningRound(
        context,
        session.track,
        session.roundCompletion,
        config.remoteSessionConfig,
        config.fetchImpl ?? fetch,
      );
    },
    loadSession: async (context, track) => {
      if (config.mode === 'remote') {
        if (
          !config.remoteConfig ||
          !config.remoteSessionConfig ||
          !config.contentManifestConfig
        ) {
          throw new Error(
            'Remote learning repository requires card-source, session, and content-manifest configs.',
          );
        }
        const fetchImpl = config.fetchImpl ?? fetch;
        const source = await loadRemoteLearningCardSource(
          context,
          track,
          config.remoteConfig,
          fetchImpl,
        );
        const scheduled = await loadRemoteLearningSession(
          context,
          track,
          config.remoteSessionConfig,
          fetchImpl,
        );
        assertRoundCompletionMatchesSource(source.cards, scheduled);

        if (
          source.track !== scheduled.track ||
          source.sourceId !== scheduled.sourceId ||
          source.contentVersion === null ||
          source.contentVersion !== scheduled.contentVersion ||
          source.cards.length !== scheduled.access.totalCardCount
        ) {
          throw new Error(
            'Remote learning session does not match canonical card-source content.',
          );
        }

        const contentManifest = await loadContentManifestForSession({
          cards: source.cards,
          config: config.contentManifestConfig,
          contentVersion: scheduled.contentVersion,
          context,
          fetchImpl,
          scheduled,
          track,
        });

        const selectedCardIndex =
          scheduled.selection === null
            ? -1
            : source.cards.findIndex(
                card => card.card_id === scheduled.selection?.cardId,
              );

        if (
          scheduled.selection !== null &&
          (selectedCardIndex < 0 ||
            selectedCardIndex >= scheduled.access.accessibleCardCount)
        ) {
          throw new Error(
            'Remote learning selection is outside canonical accessible content.',
          );
        }

        return {
          cards: selectedCardIndex < 0 ? [] : [source.cards[selectedCardIndex]],
          catalogCards: source.cards,
          contentManifest,
          contentVersion: scheduled.contentVersion,
          membershipStage: scheduled.membershipStage,
          nextDueAt: scheduled.nextDueAt,
          roundCompletion: scheduled.roundCompletion,
          schedulingMode: 'server',
          serverSelection: scheduled.selection,
          sourceId: source.sourceId,
          sourceLabel: source.sourceLabel,
          track: source.track,
        };
      }

      return createLocalSession(track);
    },
  };
}

function assertRoundCompletionMatchesSource(
  cards: LearningSession['catalogCards'],
  scheduled: Awaited<ReturnType<typeof loadRemoteLearningSession>>,
) {
  const completion = scheduled.roundCompletion;
  if (completion === null) return;
  const byId = new Map(cards.map(card => [card.card_id, card]));
  const accessibleIds = new Set(
    cards
      .slice(0, scheduled.access.accessibleCardCount)
      .map(card => card.card_id),
  );
  if (
    !byId.has(completion.spaceCardId) ||
    completion.reviewCardIds.some(cardId => !accessibleIds.has(cardId))
  ) {
    throw new Error(
      'Remote learning round references cards outside canonical accessible content.',
    );
  }
  const sourceOrder = cards
    .filter(card => completion.reviewCardIds.includes(card.card_id))
    .map(card => card.card_id);
  if (
    sourceOrder.length !== completion.reviewCardIds.length ||
    sourceOrder.some(
      (cardId, index) => cardId !== completion.reviewCardIds[index],
    )
  ) {
    throw new Error(
      'Remote learning round review cards are not in canonical source order.',
    );
  }
}

async function loadContentManifestForSession(options: {
  cards: LearningSession['catalogCards'];
  config: RemoteLearningContentManifestConfig;
  contentVersion: string;
  context: LearningSessionRepositoryContext;
  fetchImpl: FetchLike;
  scheduled: Awaited<ReturnType<typeof loadRemoteLearningSession>>;
  track: LearningTrack;
}): Promise<VerifiedContentManifest | null> {
  if (options.config.mode === 'disabled') {
    return null;
  }

  if (!options.context.authToken) {
    throw new Error('Remote content manifest requires authToken.');
  }

  const manifest = await loadRemoteContentManifest({
    apiKey: options.config.apiKey,
    authToken: options.context.authToken,
    baseUrl: options.config.baseUrl,
    contentVersion: options.contentVersion,
    fetchImpl: options.fetchImpl,
    track: options.track,
    verifySignature: options.config.verifySignature,
  });
  assertContentManifestMatchesCards(manifest, options.cards);

  const expectedMode = options.scheduled.access.mode;
  if (
    manifest.access.mode !== expectedMode ||
    manifest.access.accessible_card_count !==
      options.scheduled.access.accessibleCardCount ||
    manifest.access.total_card_count !== options.scheduled.access.totalCardCount
  ) {
    throw new Error(
      'Content manifest access does not match the canonical learning session.',
    );
  }

  return manifest;
}

function assertNonEmptySession(session: LearningSession) {
  if (session.cards.length === 0) {
    throw new Error('Learning session repository returned an empty session.');
  }

  return session;
}
