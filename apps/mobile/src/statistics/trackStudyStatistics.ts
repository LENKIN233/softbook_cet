import type {LearningTrack} from '../learning/model';

export type TrackStudyStatistics = {
  answerBreakdown?: {correct: number; incorrect: number; confident: number; review: number; hints: number; peeks: number};
  dayKey: string;
  track: LearningTrack;
  completedCardCount: number;
  completedAttemptCount: number;
  reviewAttemptCount: number;
  cumulativeLearnedCardCount: number;
};
