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

test('client card parser rejects prompt and harness fields instead of carrying them', () => {
  const source = localLearningCardRecords[0];
  const promptInjected = {
    ...source,
    front: {...source.front, system_prompt: 'sentinel-prompt'},
  } as unknown as typeof source;
  const harnessInjected = {
    ...source,
    harness: {run_id: 'sentinel-run'},
  } as unknown as typeof source;

  expect(() => normalizeLearningCardRecord(promptInjected)).toThrow(
    'front has unsupported or missing fields',
  );
  expect(() => normalizeLearningCardRecord(harnessInjected)).toThrow(
    'card has unsupported fields',
  );
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

test('audio metadata is URL-free and integrity-bound', () => {
  const source = localLearningCardRecords[0];
  const withAudio = {
    ...source,
    audio: {
      asset_id: 'cet4.002001.prompt',
      duration_ms: 2100,
      sha256: `sha256:${'a'.repeat(64)}`,
      transcript: 'A short listening transcript.',
    },
  };

  expect(() => normalizeLearningCardRecord(withAudio)).not.toThrow();
  expect(() =>
    normalizeLearningCardRecord({
      ...withAudio,
      audio: {
        ...withAudio.audio,
        sha256: 'not-a-hash',
      },
    }),
  ).toThrow('audio.sha256 must be a SHA-256 identifier');
  expect(() =>
    normalizeLearningCardRecord({
      ...withAudio,
      audio: {
        ...withAudio.audio,
        duration_ms: 0,
      },
    }),
  ).toThrow('audio.duration_ms must be a positive integer');
  expect(() =>
    normalizeLearningCardRecord({
      ...withAudio,
      audio: {
        ...withAudio.audio,
        transcript: '',
      },
    }),
  ).toThrow('audio.transcript must be non-empty when present');
  expect(() =>
    normalizeLearningCardRecord({
      ...withAudio,
      audio: {
        ...withAudio.audio,
        download_url: 'https://example.com/audio.mp3',
      } as unknown as typeof withAudio.audio,
    }),
  ).toThrow('audio has unsupported or missing fields');
});
