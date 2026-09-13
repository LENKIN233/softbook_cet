import AsyncStorage from '@react-native-async-storage/async-storage';

import type {LearningEventOutboxStorage} from './learningEventOutbox';

const operationsByKey = new Map<string, Promise<void>>();

export function createReactNativeLearningEventOutboxStorage(): LearningEventOutboxStorage {
  return {
    getItem: key => AsyncStorage.getItem(key),
    removeItem: key => AsyncStorage.removeItem(key),
    setItem: (key, value) => AsyncStorage.setItem(key, value),
    runExclusive: <Result>(key: string, operation: () => Promise<Result>) => {
      const result = (operationsByKey.get(key) ?? Promise.resolve()).then(operation);
      const settled = result.then(() => undefined, () => undefined);
      operationsByKey.set(key, settled);
      settled.then(() => {
        if (operationsByKey.get(key) === settled) operationsByKey.delete(key);
      });
      return result;
    },
  };
}
