import AsyncStorage from '@react-native-async-storage/async-storage';

import type {MutationQueueStorage} from './mutationQueue';

export function createReactNativeMutationQueueStorage(): MutationQueueStorage {
  return {
    getItem: key => AsyncStorage.getItem(key),
    setItem: (key, value) => AsyncStorage.setItem(key, value),
  };
}
