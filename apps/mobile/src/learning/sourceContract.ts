import {
  EliminationItem,
  LearningAnalysis,
  LearningAudioResource,
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
  audio?: LearningAudioResource;
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
  const interactionFields: Record<LearningInteractionId, string[]> = {
    flip: ['back_text'],
    multiple_choice: ['answer_key', 'auto_scoring', 'options'],
    lock: ['answer_key', 'auto_scoring', 'lock_slots'],
    elimination: ['answer_key', 'auto_scoring', 'elimination_items'],
    swipe: ['answer_key', 'auto_scoring', 'swipe_states'],
  };
  assertAllowedObjectKeys(
    record,
    [
      'analysis',
      'audio',
      'card_id',
      'front',
      'hint_layer',
      'interaction_id',
      'knowledge_ref',
      'space_metadata',
      'track',
      ...(interactionFields[record.interaction_id] ?? []),
      ...(record.interaction_id === 'flip' ? ['auto_scoring'] : []),
    ],
    `${prefix} card has unsupported fields.`,
  );
  assertExactObjectKeys(
    record.front,
    ['context', 'eyebrow', 'prompt', 'support'],
    `${prefix} front has unsupported or missing fields.`,
  );
  assertExactObjectKeys(
    record.analysis,
    ['exam_tip', 'summary', 'title'],
    `${prefix} analysis has unsupported or missing fields.`,
  );
  assertExactObjectKeys(
    record.space_metadata,
    ['box', 'box_ref', 'group', 'library'],
    `${prefix} space_metadata has unsupported or missing fields.`,
  );

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
    assertExactObjectKeys(
      record.hint_layer,
      ['content', 'label', 'reveal_gesture'],
      `${prefix} hint_layer has unsupported or missing fields.`,
    );
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

  if (record.audio !== undefined) {
    assertValidLearningAudioResource(record.audio, prefix);
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
      record.options.forEach(option =>
        assertExactObjectKeys(
          option,
          ['id', 'label', 'text'],
          `${prefix} option has unsupported or missing fields.`,
        ),
      );
      assertExactObjectKeys(
        record.answer_key,
        ['correct_option'],
        `${prefix} answer_key has unsupported or missing fields.`,
      );

      if (!optionIds.has(record.answer_key.correct_option)) {
        throw new Error(
          `${prefix} answer_key.correct_option must exist in options.`,
        );
      }

      return;
    }
    case 'lock': {
      record.lock_slots.forEach(slot =>
        assertExactObjectKeys(
          slot,
          ['id', 'label', 'options'],
          `${prefix} lock slot has unsupported or missing fields.`,
        ),
      );
      assertExactObjectKeys(
        record.answer_key,
        ['lock_pattern'],
        `${prefix} answer_key has unsupported or missing fields.`,
      );
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
      record.elimination_items.forEach(item =>
        assertExactObjectKeys(
          item,
          ['id', 'text'],
          `${prefix} elimination item has unsupported or missing fields.`,
        ),
      );
      assertExactObjectKeys(
        record.answer_key,
        ['correct_items'],
        `${prefix} answer_key has unsupported or missing fields.`,
      );
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
      record.swipe_states.forEach(state =>
        assertExactObjectKeys(
          state,
          ['description', 'id', 'label'],
          `${prefix} swipe state has unsupported or missing fields.`,
        ),
      );
      assertExactObjectKeys(
        record.answer_key,
        ['correct_state'],
        `${prefix} answer_key has unsupported or missing fields.`,
      );
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

function assertAllowedObjectKeys(
  value: object,
  allowedKeys: readonly string[],
  message: string,
) {
  const allowed = new Set(allowedKeys);
  if (Object.keys(value).some(key => !allowed.has(key))) {
    throw new Error(message);
  }
}

function assertExactObjectKeys(
  value: object,
  expectedKeys: readonly string[],
  message: string,
) {
  if (
    JSON.stringify(Object.keys(value).sort()) !==
    JSON.stringify([...expectedKeys].sort())
  ) {
    throw new Error(message);
  }
}

function assertValidLearningAudioResource(
  audio: LearningAudioResource,
  prefix: string,
) {
  if (typeof audio !== 'object' || audio === null || Array.isArray(audio)) {
    throw new Error(`${prefix} audio must be an object.`);
  }

  const expectedKeys =
    audio.transcript === undefined
      ? ['asset_id', 'duration_ms', 'sha256']
      : ['asset_id', 'duration_ms', 'sha256', 'transcript'];

  if (
    JSON.stringify(Object.keys(audio).sort()) !==
    JSON.stringify(expectedKeys.sort())
  ) {
    throw new Error(`${prefix} audio has unsupported or missing fields.`);
  }

  if (!/^[a-z0-9][a-z0-9._-]{2,127}$/.test(audio.asset_id)) {
    throw new Error(`${prefix} audio.asset_id is invalid.`);
  }

  if (!/^sha256:[a-f0-9]{64}$/.test(audio.sha256)) {
    throw new Error(`${prefix} audio.sha256 must be a SHA-256 identifier.`);
  }

  if (!Number.isSafeInteger(audio.duration_ms) || audio.duration_ms <= 0) {
    throw new Error(`${prefix} audio.duration_ms must be a positive integer.`);
  }

  if (audio.transcript !== undefined) {
    assertNonEmptyString(
      audio.transcript,
      `${prefix} audio.transcript must be non-empty when present.`,
    );
  }
}

function assertNonEmptyString(value: string, message: string) {
  if (value.trim().length === 0) {
    throw new Error(message);
  }
}
