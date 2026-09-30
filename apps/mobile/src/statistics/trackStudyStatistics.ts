import type {LearningTrack} from '../learning/model';

export type TrackStudyStatistics = {
  dayKey: string;
  track: LearningTrack;
  completedCardCount: number;
  completedAttemptCount: number;
  reviewAttemptCount: number;
  cumulativeLearnedCardCount: number;
};
