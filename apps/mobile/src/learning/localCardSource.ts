import { LearningCard, LearningTrack } from './model';
import { localLearningCardRecords } from './localCardRecords';
import { normalizeLearningCardRecords } from './sourceContract';

export type LearningCardSource = {
  sourceId: string;
  sourceLabel: string;
  loadCards: (track: LearningTrack) => LearningCard[];
};

export const LOCAL_CARD_SOURCE_ID = 'local-structured-card-source';
export const LOCAL_CARD_SOURCE_LABEL = '本地结构化卡源';

export const localLearningCardSource: LearningCardSource = {
  sourceId: LOCAL_CARD_SOURCE_ID,
  sourceLabel: LOCAL_CARD_SOURCE_LABEL,
  loadCards: track =>
    normalizeLearningCardRecords(
      localLearningCardRecords.filter(card => card.track === track),
    ).sort((left, right) => left.card_id.localeCompare(right.card_id)),
};
