import AsyncStorage from '@react-native-async-storage/async-storage';

import type {LearningEventOutboxStorage} from './learningEventOutbox';

export function createReactNativeLearningEventOutboxStorage(): LearningEventOutboxStorage {
  return {
    getItem: key => AsyncStorage.getItem(key),
    removeItem: key => AsyncStorage.removeItem(key),
    setItem: (key, value) => AsyncStorage.setItem(key, value),
  };
}
