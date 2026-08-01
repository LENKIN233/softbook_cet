import {LearningTrack} from './model';
import {localLearningCardSource} from './localCardSource';
import {
  createLearningSession,
  DEFAULT_LEARNING_SESSION_CARD_COUNT,
} from './sessionCore';

export * from './sessionCore';

export function createLocalLearningSession(
  track: LearningTrack,
  cardCount: number = DEFAULT_LEARNING_SESSION_CARD_COUNT,
) {
  return createLearningSession(
    track,
    localLearningCardSource.sourceId,
    localLearningCardSource.sourceLabel,
    localLearningCardSource.loadCards(track),
    cardCount,
  );
}
