import {
  EliminationItem,
  LearningAnalysis,
  LearningCard,
  LearningFront,
  LearningHintLayer,
  LearningInteractionId,
  LearningOption,
  LearningTrack,
  LockSlot,
  SpaceMetadata,
  SwipeState,
} from './model';

type LearningCardRecordBase = {
  card_id: string;
  track: LearningTrack;
  knowledge_ref: string;
  interaction_id: LearningInteractionId;
  front: LearningFront;
  analysis: LearningAnalysis;
  hint_layer?: LearningHintLayer;
  auto_scoring?: boolean;
  space_metadata: SpaceMetadata;
};

export type FlipCardRecord = LearningCardRecordBase & {
  interaction_id: 'flip';
  back_text: string;
};

export type MultipleChoiceCardRecord = LearningCardRecordBase & {
  interaction_id: 'multiple_choice';
  options: LearningOption[];
  auto_scoring: true;
  answer_key: {
    correct_option: string;
  };
};

export type LockCardRecord = LearningCardRecordBase & {
  interaction_id: 'lock';
  lock_slots: LockSlot[];
  auto_scoring: true;
  answer_key: {
    lock_pattern: string[];
  };
};

export type EliminationCardRecord = LearningCardRecordBase & {
  interaction_id: 'elimination';
  elimination_items: EliminationItem[];
  auto_scoring: true;
  answer_key: {
    correct_items: string[];
  };
};

export type SwipeCardRecord = LearningCardRecordBase & {
  interaction_id: 'swipe';
  swipe_states: SwipeState[];
  auto_scoring: true;
  answer_key: {
    correct_state: string;
  };
};

export type LearningCardRecord =
  | FlipCardRecord
  | MultipleChoiceCardRecord
  | LockCardRecord
  | EliminationCardRecord
  | SwipeCardRecord;

export function normalizeLearningCardRecord(
  record: LearningCardRecord,
): LearningCard {
  assertValidLearningCardRecord(record);
  return record;
}

export function normalizeLearningCardRecords(
  records: readonly LearningCardRecord[],
) {
  return records.map(record => normalizeLearningCardRecord(record));
}

export function assertValidLearningCardRecord(record: LearningCardRecord) {
  const prefix = `Invalid learning card record ${record.card_id}:`;

  if (!/^\d{6}$/.test(record.card_id)) {
    throw new Error(`${prefix} card_id must use TLGBNN digits.`);
  }

  if (!/^\d{4}$/.test(record.knowledge_ref)) {
    throw new Error(`${prefix} knowledge_ref must use TLGB digits.`);
  }

  if (!record.card_id.startsWith(record.knowledge_ref)) {
    throw new Error(`${prefix} card_id must inherit the knowledge_ref prefix.`);
  }

  if (record.space_metadata.box_ref !== record.knowledge_ref) {
    throw new Error(
      `${prefix} space_metadata.box_ref must match knowledge_ref ownership.`,
    );
  }

  assertNonEmptyString(
    record.front.eyebrow,
    `${prefix} front.eyebrow is required.`,
  );
  assertNonEmptyString(
    record.front.prompt,
    `${prefix} front.prompt is required.`,
  );
  assertNonEmptyString(
    record.front.support,
    `${prefix} front.support is required.`,
  );
  assertNonEmptyString(
    record.front.context,
    `${prefix} front.context is required.`,
  );
  assertNonEmptyString(
    record.analysis.title,
    `${prefix} analysis.title is required.`,
  );
  assertNonEmptyString(
    record.analysis.summary,
    `${prefix} analysis.summary is required.`,
  );
  assertNonEmptyString(
    record.analysis.exam_tip,
    `${prefix} analysis.exam_tip is required.`,
  );
  assertNonEmptyString(
    record.space_metadata.library,
    `${prefix} space_metadata.library is required.`,
  );
  assertNonEmptyString(
    record.space_metadata.group,
    `${prefix} space_metadata.group is required.`,
  );
  assertNonEmptyString(
    record.space_metadata.box,
    `${prefix} space_metadata.box is required.`,
  );

  if (record.hint_layer) {
    assertNonEmptyString(
      record.hint_layer.content,
      `${prefix} hint_layer.content is required when hint_layer exists.`,
    );

    if (record.hint_layer.reveal_gesture !== '下滑') {
      throw new Error(
        `${prefix} hint_layer.reveal_gesture must stay attached as 下滑.`,
      );
    }
  }

  switch (record.interaction_id) {
    case 'flip':
      assertNonEmptyString(
        record.back_text,
        `${prefix} back_text is required.`,
      );

      if (record.auto_scoring === true) {
        throw new Error(`${prefix} flip cards must not claim auto_scoring.`);
      }

      return;
    case 'multiple_choice': {
      if (record.options.length !== 4) {
        throw new Error(`${prefix} multiple_choice must keep four options.`);
      }

      const optionIds = new Set(record.options.map(option => option.id));

      if (!optionIds.has(record.answer_key.correct_option)) {
        throw new Error(
          `${prefix} answer_key.correct_option must exist in options.`,
        );
      }

      return;
    }
    case 'lock': {
      if (record.lock_slots.length === 0) {
        throw new Error(`${prefix} lock must contain at least one slot.`);
      }

      if (record.answer_key.lock_pattern.length !== record.lock_slots.length) {
        throw new Error(
          `${prefix} answer_key.lock_pattern must align with lock_slots.`,
        );
      }

      record.lock_slots.forEach((slot, index) => {
        if (!slot.options.includes(record.answer_key.lock_pattern[index])) {
          throw new Error(
            `${prefix} lock_pattern must select values from each slot.`,
          );
        }
      });

      return;
    }
    case 'elimination': {
      const itemIds = new Set(record.elimination_items.map(item => item.id));

      if (record.answer_key.correct_items.length === 0) {
        throw new Error(`${prefix} elimination must define removable items.`);
      }

      if (
        !record.answer_key.correct_items.every(itemId => itemIds.has(itemId))
      ) {
        throw new Error(
          `${prefix} answer_key.correct_items must exist in elimination_items.`,
        );
      }

      return;
    }
    case 'swipe': {
      if (record.swipe_states.length !== 2) {
        throw new Error(`${prefix} swipe must stay a dual-state judgment.`);
      }

      if (
        !record.swipe_states.some(
          state => state.id === record.answer_key.correct_state,
        )
      ) {
        throw new Error(
          `${prefix} answer_key.correct_state must exist in swipe_states.`,
        );
      }

      return;
    }
    default: {
      const exhaustiveCheck: never = record;
      return exhaustiveCheck;
    }
  }
}

function assertNonEmptyString(value: string, message: string) {
  if (value.trim().length === 0) {
    throw new Error(message);
  }
}
