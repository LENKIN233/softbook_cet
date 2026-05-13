import { LearningCard, LearningTrack } from './model';
import { localLearningCardRecords } from './localCardRecords';
import {
  normalizeLearningCardRecords,
  type LearningCardRecord,
} from './sourceContract';

export type LearningCardSource = {
  sourceId: string;
  sourceLabel: string;
  loadCards: (track: LearningTrack) => LearningCard[];
};

export const LOCAL_CARD_SOURCE_ID = 'local-structured-card-source';
export const LOCAL_CARD_SOURCE_LABEL = '系统顺序学习';

const CET6_DERIVED_RECORD_START = 51;

const derivedCet6LearningCardRecords = createDerivedCet6LearningCardRecords(
  localLearningCardRecords,
);

export const localLearningCardSource: LearningCardSource = {
  sourceId: LOCAL_CARD_SOURCE_ID,
  sourceLabel: LOCAL_CARD_SOURCE_LABEL,
  loadCards: track =>
    normalizeLearningCardRecords(
      resolveLocalLearningCardRecords(track),
    ).sort((left, right) => left.card_id.localeCompare(right.card_id)),
};

function resolveLocalLearningCardRecords(track: LearningTrack) {
  const explicitTrackRecords = localLearningCardRecords.filter(
    card => card.track === track,
  );

  if (explicitTrackRecords.length > 0) {
    return explicitTrackRecords;
  }

  if (track === 'cet6') {
    return derivedCet6LearningCardRecords;
  }

  return explicitTrackRecords;
}

function createDerivedCet6LearningCardRecords(
  baseRecords: readonly LearningCardRecord[],
): LearningCardRecord[] {
  const sequenceByKnowledgeRef = new Map<string, number>();

  return baseRecords.map(record => {
    const nextSequence =
      (sequenceByKnowledgeRef.get(record.knowledge_ref) ??
        CET6_DERIVED_RECORD_START - 1) + 1;
    sequenceByKnowledgeRef.set(record.knowledge_ref, nextSequence);

    return {
      ...record,
      card_id: `${record.knowledge_ref}${String(nextSequence).padStart(2, '0')}`,
      track: 'cet6',
    };
  });
}
