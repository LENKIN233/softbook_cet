import type {LearningCard, LearningTrack} from './model';
import {normalizeLearningCardRecords} from './sourceContract';
import {bundledCardLibrary, BUNDLED_CARD_SOURCE_ID} from './bundledCardLibrary';

export type LearningCardSource = {
  sourceId: string;
  sourceLabel: string;
  loadCards: (track: LearningTrack) => LearningCard[];
};
export const LOCAL_CARD_SOURCE_ID = BUNDLED_CARD_SOURCE_ID;
export const LOCAL_CARD_SOURCE_LABEL = '系统顺序学习';
export const localLearningCardSource: LearningCardSource = {
  sourceId: LOCAL_CARD_SOURCE_ID,
  sourceLabel: LOCAL_CARD_SOURCE_LABEL,
  loadCards: track => normalizeLearningCardRecords(bundledCardLibrary[track].cards)
    .sort((left, right) => left.card_id.localeCompare(right.card_id)),
};
