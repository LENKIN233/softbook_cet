import {confirmLearningSegmentCard, initializeLearningSegment} from '../src/learning/learningSegment';

test('five repeated reviews cannot replace five distinct introductory cards', () => {
  let progress = initializeLearningSegment(null, 'account:cet4', 'cet4', []);
  for (let i = 0; i < 5; i += 1) progress = confirmLearningSegmentCard(progress, '000001');
  expect(progress.summaryVisible).toBe(false);
  expect(progress.sessionCardIds).toEqual(['000001']);
  for (const id of ['000002', '000003', '000004', '000005']) progress = confirmLearningSegmentCard(progress, id);
  expect(progress.summaryVisible).toBe(true);
  progress = confirmLearningSegmentCard({...progress, summaryVisible: false}, '000005');
  expect(progress.summaryVisible).toBe(false);
});

test('returning users do not receive a retroactive summary and CET6 has no invented segment', () => {
  const complete = ['000001', '000002', '000003', '000004', '000005'];
  let progress = initializeLearningSegment(null, 'account:cet4', 'cet4', complete);
  expect(confirmLearningSegmentCard(progress, '000001').summaryVisible).toBe(false);
  progress = initializeLearningSegment(progress, 'account:cet6', 'cet6', []);
  for (const id of complete) progress = confirmLearningSegmentCard(progress, id);
  expect(progress.summaryVisible).toBe(false);
});

test('finishing a partially completed segment counts only this session and baseline refresh preserves summary', () => {
  let progress = initializeLearningSegment(null, 'a', 'cet4', ['000001', '000002', '000003', '000004']);
  progress = confirmLearningSegmentCard(progress, '000005');
  expect(progress.sessionCardIds).toEqual(['000005']);
  expect(initializeLearningSegment(progress, 'a', 'cet4', progress.knownCardIds).summaryVisible).toBe(true);
  expect(initializeLearningSegment(progress, 'b', 'cet4', progress.knownCardIds).summaryVisible).toBe(false);
});
