import {bundledContentVersion} from './bundledCardLibrary';
import {LearningTrack} from './model';
import {localLearningCardSource} from './localCardSource';
import {
  createLearningSession,
} from './sessionCore';

export * from './sessionCore';

export function createLocalLearningSession(
  track: LearningTrack,
  cardCount?: number,
) {
  const cards = localLearningCardSource.loadCards(track);
  const session = createLearningSession(
    track,
    localLearningCardSource.sourceId,
    localLearningCardSource.sourceLabel,
    cards,
    cardCount ?? cards.length,
    bundledContentVersion(track),
  );
  session.cards = cards.slice(0, cardCount ?? cards.length);
  return session;
}
