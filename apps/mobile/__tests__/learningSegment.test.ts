import {confirmLearningSegmentCard, continueLearningSegment, initializeLearningSegment,
  type ConfirmedLearningSegmentCard} from '../src/learning/learningSegment';

const card = (completion: number, cardId = '014203'): ConfirmedLearningSegmentCard => ({
  completionId: `accepted-${completion}`, cardId, library: '仔细阅读',
  group: '上下文词义', box: completion % 2 ? '构词法' : '定位词抓取', boxRef: `box-${completion % 2}`,
});

for (const track of ['cet4', 'cet6'] as const) {
  test(`${track}: every five accepted tasks pauses, then forms another finite segment`, () => {
    let state = initializeLearningSegment(null, `login:${track}`, track, ['000001','000002','000003','000004','000005']);
    expect(state.completedCards).toEqual([]);
    for (let i = 1; i <= 15; i += 1) {
      state = confirmLearningSegmentCard(state, card(i));
      expect(state.completedCards).toHaveLength((i - 1) % 5 + 1);
      expect(state.summaryVisible).toBe(i % 5 === 0);
      if (i % 5 === 0) {
        expect(state.segmentIndex).toBe(i / 5);
        expect(confirmLearningSegmentCard(state, card(i + 100))).toBe(state);
        state = continueLearningSegment(state);
        expect(state.completedCards).toEqual([]);
        expect(state.summaryVisible).toBe(false);
        expect(state.segmentIndex).toBe(i / 5 + 1);
      }
    }
    expect(state.seenCompletionIds).toHaveLength(15);
  });
}

test('duplicate acknowledgements never count again before or after continuation', () => {
  let state = initializeLearningSegment(null, 'login:cet4', 'cet4');
  state = confirmLearningSegmentCard(state, card(1));
  expect(confirmLearningSegmentCard(state, card(1))).toBe(state);
  for (let i = 2; i <= 5; i += 1) state = confirmLearningSegmentCard(state, card(i));
  state = continueLearningSegment(state);
  expect(confirmLearningSegmentCard(state, card(1))).toBe(state);
  expect(state.completedCards).toHaveLength(0);
  state = confirmLearningSegmentCard(state, card(6));
  expect(state.completedCards).toHaveLength(1);
});

test('ordinary pauses and bootstrap refresh preserve the partial or completed segment', () => {
  let state = initializeLearningSegment(null, 'login:cet4', 'cet4');
  state = confirmLearningSegmentCard(state, card(1));
  expect(continueLearningSegment(state)).toBe(state);
  expect(initializeLearningSegment(state, 'login:cet4', 'cet4', ['historic','new-history'])).toBe(state);
  for (let i = 2; i <= 5; i += 1) state = confirmLearningSegmentCard(state, card(i));
  expect(initializeLearningSegment(state, 'login:cet4', 'cet4', ['historic'])).toBe(state);
});

test('new login or track scope opens a separate presentation segment without using history', () => {
  let state = initializeLearningSegment(null, 'login:cet4', 'cet4');
  state = confirmLearningSegmentCard(state, card(1));
  for (const [scope, track] of [['login:cet6', 'cet6'], ['new-login:cet4', 'cet4']] as const) {
    const fresh = initializeLearningSegment(state, scope, track, ['000001','000002','000003','000004','000005']);
    expect(fresh.completedCards).toEqual([]);
    expect(fresh.seenCompletionIds).toEqual([]);
    expect(fresh.segmentIndex).toBe(1);
  }
});

test('summary metadata is the acknowledged card snapshot, not a hardcoded topic', () => {
  let state = initializeLearningSegment(null, 'login:cet6', 'cet6');
  const actual = card(1, '171011');
  state = confirmLearningSegmentCard(state, actual);
  actual.box = 'a later changed catalog label';
  expect(state.completedCards[0]).toEqual({...card(1, '171011'), box: '构词法'});
  expect(confirmLearningSegmentCard(state, {...card(2), completionId: ''})).toBe(state);
});
