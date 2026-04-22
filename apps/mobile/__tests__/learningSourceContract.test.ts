import { localLearningCardRecords } from '../src/learning/localCardRecords';
import {
  assertValidLearningCardRecord,
  normalizeLearningCardRecord,
} from '../src/learning/sourceContract';

test('all local learning card records satisfy the source contract', () => {
  expect(localLearningCardRecords.length).toBeGreaterThan(0);

  localLearningCardRecords.forEach(record => {
    expect(() => assertValidLearningCardRecord(record)).not.toThrow();
  });
});

test('card_id must inherit the knowledge_ref prefix', () => {
  const invalidRecord = {
    ...localLearningCardRecords[0],
    card_id: '112001',
  };

  expect(() => normalizeLearningCardRecord(invalidRecord)).toThrow(
    'card_id must inherit the knowledge_ref prefix',
  );
});

test('multiple_choice records must keep four options', () => {
  const multipleChoiceRecord = localLearningCardRecords.find(
    record => record.interaction_id === 'multiple_choice',
  );

  if (
    multipleChoiceRecord === undefined ||
    multipleChoiceRecord.interaction_id !== 'multiple_choice'
  ) {
    throw new Error(
      'Expected a multiple_choice record in localLearningCardRecords.',
    );
  }

  const invalidRecord = {
    ...multipleChoiceRecord,
    options: multipleChoiceRecord.options.slice(0, 3),
  };

  expect(() => normalizeLearningCardRecord(invalidRecord)).toThrow(
    'multiple_choice must keep four options',
  );
});

test('flip records must stay in light self-assess mode', () => {
  const flipRecord = localLearningCardRecords.find(
    record => record.interaction_id === 'flip',
  );

  if (flipRecord === undefined || flipRecord.interaction_id !== 'flip') {
    throw new Error('Expected a flip record in localLearningCardRecords.');
  }

  const invalidRecord = {
    ...flipRecord,
    auto_scoring: true as const,
  };

  expect(() => normalizeLearningCardRecord(invalidRecord)).toThrow(
    'flip cards must not claim auto_scoring',
  );
});

test('swipe records must stay dual-state judgments', () => {
  const swipeRecord = localLearningCardRecords.find(
    record => record.interaction_id === 'swipe',
  );

  if (swipeRecord === undefined || swipeRecord.interaction_id !== 'swipe') {
    throw new Error('Expected a swipe record in localLearningCardRecords.');
  }

  const invalidRecord = {
    ...swipeRecord,
    swipe_states: [
      ...swipeRecord.swipe_states,
      {
        id: 'uncertain',
        label: '不确定',
        description: '把双态判断拉成三态。',
      },
    ],
  };

  expect(() => normalizeLearningCardRecord(invalidRecord)).toThrow(
    'swipe must stay a dual-state judgment',
  );
});
