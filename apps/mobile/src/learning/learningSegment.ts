import type {LearningTrack} from './model';

export const LEARNING_SEGMENT_SIZE = 5;

export type ConfirmedLearningSegmentCard = {
  completionId: string;
  cardId: string;
  library: string;
  group: string;
  box: string;
  boxRef: string;
};

export type LearningSegmentProgress = {
  scope: string;
  track: LearningTrack;
  segmentIndex: number;
  completedCards: ConfirmedLearningSegmentCard[];
  seenCompletionIds: string[];
  summaryVisible: boolean;
};

export function initializeLearningSegment(
  previous: LearningSegmentProgress | null,
  scope: string,
  track: LearningTrack,
  _baselineCardIds?: readonly string[],
): LearningSegmentProgress {
  if (previous?.scope === scope && previous.track === track) return previous;
  // This is login-scoped presentation, not a server cursor or persisted history.
  // Bootstrap history never contributes to the current five acknowledged tasks.
  return {scope, track, segmentIndex: 1, completedCards: [],
    seenCompletionIds: [], summaryVisible: false};
}

// Call only for an accepted result from this session, never a flip or button click.
export function confirmLearningSegmentCard(
  previous: LearningSegmentProgress,
  card: ConfirmedLearningSegmentCard,
): LearningSegmentProgress {
  if (!card.completionId.trim() || previous.summaryVisible ||
      previous.seenCompletionIds.includes(card.completionId)) return previous;
  const completedCards = [...previous.completedCards, {...card}];
  return {...previous, completedCards,
    seenCompletionIds: [...previous.seenCompletionIds, card.completionId],
    summaryVisible: completedCards.length === LEARNING_SEGMENT_SIZE};
}

// Call after leaving a completed presentation segment. This never selects a card
// or acknowledges a server-owned controlled-pilot continuation.
export function continueLearningSegment(previous: LearningSegmentProgress): LearningSegmentProgress {
  if (!previous.summaryVisible || previous.completedCards.length !== LEARNING_SEGMENT_SIZE) return previous;
  return {...previous, segmentIndex: previous.segmentIndex + 1,
    completedCards: [], summaryVisible: false};
}
