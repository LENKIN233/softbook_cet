import {LearningTrack} from '../../src/learning/model';
import {localLearningCardSource} from './interactionSource';
import {createLearningSession, DEFAULT_LEARNING_SESSION_CARD_COUNT} from '../../src/learning/sessionCore';
export * from '../../src/learning/sessionCore';
export function createLocalLearningSession(track: LearningTrack, count = DEFAULT_LEARNING_SESSION_CARD_COUNT) { return createLearningSession(track, localLearningCardSource.sourceId, localLearningCardSource.sourceLabel, localLearningCardSource.loadCards(track), count); }
