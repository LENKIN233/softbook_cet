jest.unmock('../src/learning/localCardSource');

import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {bundledCardLibrary} from '../src/learning/bundledCardLibrary';
import {createLocalLearningSession} from '../src/learning/session';
import {createLearningSessionRepository} from '../src/learning/learningRepository';
import {createLearningCardState, evaluateLearningCard} from '../src/learning/sessionCore';
import {bundledAudioSelection} from '../src/audio/bundledAudio';
import {LearningAudioController} from '../src/audio/learningAudioController';

test.each([['cet4', 1180, 108, 301], ['cet6', 1234, 110, 328]] as const)(
  '%s exposes every real card and completes all five interactions with exact local audio bytes', async (track, count, boxes, audioCount) => {
    const session = createLocalLearningSession(track);
    const fromRepository = await createLearningSessionRepository({mode: 'local'}).loadSession({phoneNumber: '13800138000'}, track);
    expect(fromRepository.cards).toEqual(session.cards);
    expect(session.cards).toHaveLength(count);
    expect(new Set(session.cards.map(card => card.knowledge_ref)).size).toBe(boxes);
    expect(new Set(session.cards.map(card => card.card_id)).size).toBe(count);
    expect(session.cards.map(card => card.card_id)).toEqual(session.cards.map(card => card.card_id).sort());
    expect(session.cards.every(card => card.track === track && card.card_id.startsWith(track === 'cet4' ? '0' : '1'))).toBe(true);
    const outcomes = new Set<string>();
    for (const card of session.cards) {
      const state = createLearningCardState(card);
      switch (card.interaction_id) {
        case 'flip': state.isFlipped = true; state.flipConfidence = 'confident'; break;
        case 'multiple_choice': state.selectedOptionId = card.answer_key.correct_option; break;
        case 'lock': state.lockSelections = Object.fromEntries(card.lock_slots.map((slot, index) => [slot.id, card.answer_key.lock_pattern[index]])); break;
        case 'elimination': state.eliminatedItemIds = card.answer_key.correct_items; break;
        case 'swipe': state.swipeSelection = card.answer_key.correct_state; break;
      }
      expect(evaluateLearningCard(card, state)?.outcome).toBe(card.interaction_id === 'flip' ? 'confident' : 'correct');
      outcomes.add(card.interaction_id);
      if (card.audio) expect(bundledAudioSelection(card, 'attempt')?.download).toBeNull();
    }
    expect(outcomes.size).toBe(5);
    expect(bundledCardLibrary[track].assets).toHaveLength(audioCount);
    for (const asset of bundledCardLibrary[track].assets) {
      const bytes = readFileSync(path.join(__dirname, '../assets/card-audio', asset.asset_path.slice(6)));
      expect(bytes.length).toBe(asset.size_bytes);
      expect(`sha256:${createHash('sha256').update(bytes).digest('hex')}`).toBe(asset.sha256);
    }
  },
);

test('bundled playback works offline, never uses remote authorization, and rejects content mismatch', async () => {
  const card = createLocalLearningSession('cet4').cards.find(item => item.audio)!;
  const selection = bundledAudioSelection(card, 'attempt')!;
  const cache = {resolve: jest.fn()};
  const engine = {prepare: jest.fn(async () => {}), play: jest.fn(async () => {}), pause: jest.fn(async () => {}), stop: jest.fn(async () => {}), subscribe: () => () => {}};
  const controller = new LearningAudioController({cache, engine, isOnline: () => false,
    resolveBundledAsset: async () => ({path: '/verified/audio.mp3', uri: 'file:///verified/audio.mp3'})});
  controller.select(selection);
  await controller.press();
  expect(controller.getState().status).toBe('playing');
  expect(engine.play).toHaveBeenCalledTimes(1);
  expect(cache.resolve).not.toHaveBeenCalled();
  expect(() => bundledAudioSelection({...card, audio: {...card.audio!, sha256: `sha256:${'0'.repeat(64)}`}}, 'attempt')).toThrow();
  controller.dispose();
});
