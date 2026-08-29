import type {AuthSession} from '../../mobile/src/auth/authSession';
import type {AuthSessionStore} from '../../mobile/src/persistence/authSessionStore';
import type {LearningEventOutboxStorage} from '../../mobile/src/sync/learningEventOutbox';
import type {MutationQueueStorage} from '../../mobile/src/sync/mutationQueue';

type BrowserStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

export function createMemoryOnlyAuthSessionStore(): AuthSessionStore {
  let currentSession: AuthSession | null = null;

  return {
    async clear() {
      currentSession = null;
    },
    async clearExactly() {
      currentSession = null;
      if (currentSession !== null) {
        throw new Error('Web auth session cleanup verification failed.');
      }
    },
    async load() {
      return currentSession === null ? null : cloneSession(currentSession);
    },
    async save(session) {
      currentSession = cloneSession(session);
    },
  };
}

export function createWebLearningEventStorage(
  storage: BrowserStorage,
): LearningEventOutboxStorage {
  return {
    getItem: key => readStorage(storage, key),
    removeItem: key => removeStorage(storage, key),
    setItem: (key, value) => writeStorage(storage, key, value),
  };
}

export function createWebMutationQueueStorage(
  storage: BrowserStorage,
): MutationQueueStorage {
  return {
    getItem: key => readStorage(storage, key),
    setItem: (key, value) => writeStorage(storage, key, value),
  };
}

function cloneSession(session: AuthSession): AuthSession {
  return {...session};
}

async function readStorage(storage: BrowserStorage, key: string) {
  try {
    return storage.getItem(key);
  } catch (error) {
    throw new Error('浏览器暂时无法读取待同步学习记录。', {cause: error});
  }
}

async function removeStorage(storage: BrowserStorage, key: string) {
  try {
    storage.removeItem(key);
  } catch (error) {
    throw new Error('浏览器暂时无法更新待同步学习记录。', {cause: error});
  }
}

async function writeStorage(
  storage: BrowserStorage,
  key: string,
  value: string,
) {
  try {
    storage.setItem(key, value);
  } catch (error) {
    throw new Error('浏览器暂时无法保存待同步学习记录。', {cause: error});
  }
}
