import type {LearningTrack} from './model';

const FIRST_PREDICTION_CARDS = ['000001', '000002', '000003', '000004', '000005'];

export type LearningSegmentProgress = {
  scope: string;
  track: LearningTrack;
  knownCardIds: string[];
  sessionCardIds: string[];
  summaryConsumed: boolean;
  summaryVisible: boolean;
};

function completedFirstSegment(track: LearningTrack, ids: readonly string[]) {
  return track === 'cet4' && FIRST_PREDICTION_CARDS.every(id => ids.includes(id));
}

export function initializeLearningSegment(
  previous: LearningSegmentProgress | null,
  scope: string,
  track: LearningTrack,
  baselineCardIds: readonly string[],
): LearningSegmentProgress {
  if (previous?.scope === scope && previous.track === track) {
    const knownCardIds = [...new Set([...previous.knownCardIds, ...baselineCardIds])];
    return {...previous, knownCardIds,
      summaryConsumed: previous.summaryConsumed ||
        (!previous.summaryVisible && completedFirstSegment(track, knownCardIds))};
  }
  return {scope, track, knownCardIds: [...new Set(baselineCardIds)], sessionCardIds: [],
    summaryConsumed: completedFirstSegment(track, baselineCardIds), summaryVisible: false};
}

// Call only for an accepted result from this session, never a flip or button click.
export function confirmLearningSegmentCard(
  previous: LearningSegmentProgress,
  cardId: string,
): LearningSegmentProgress {
  const knownCardIds = [...new Set([...previous.knownCardIds, cardId])];
  const showSummary = !previous.summaryConsumed &&
    completedFirstSegment(previous.track, knownCardIds);
  return {...previous, knownCardIds,
    sessionCardIds: [...new Set([...previous.sessionCardIds, cardId])],
    summaryConsumed: previous.summaryConsumed || showSummary,
    summaryVisible: previous.summaryVisible || showSummary};
}
