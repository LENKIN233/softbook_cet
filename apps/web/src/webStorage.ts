import type {AuthSession} from '../../mobile/src/auth/authSession';
import type {AuthSessionStore} from '../../mobile/src/persistence/authSessionStore';
import type {LearningEventOutboxStorage} from '../../mobile/src/sync/learningEventOutbox';
import type {MutationQueueStorage} from '../../mobile/src/sync/mutationQueue';

type BrowserStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

const WEB_STORAGE_LOCK_PREFIX = 'softbook-cet/storage-lock/v1/';
const WEB_ACCOUNT_DELETION_STORAGE_KEY =
  'softbook-cet/web-account-deletion/v1';
const inProcessStorageTails = new WeakMap<
  object,
  Map<string, Promise<void>>
>();

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
    isAccountWriteQuarantined: async () =>
      readAccountDeletionOwner(storage) !== null,
    removeItem: key => removeStorage(storage, key),
    runExclusive: (key, operation) =>
      runWebStorageExclusive(storage, key, operation),
    setItem: (key, value) => writeStorage(storage, key, value),
  };
}

export function createWebMutationQueueStorage(
  storage: BrowserStorage,
): MutationQueueStorage {
  return {
    getItem: key => readStorage(storage, key),
    isAccountWriteQuarantined: async () =>
      readAccountDeletionOwner(storage) !== null,
    runExclusive: (key, operation) =>
      runWebStorageExclusive(storage, key, operation),
    setItem: (key, value) => writeStorage(storage, key, value),
  };
}

export function runWebStorageExclusive<Result>(
  storage: BrowserStorage,
  key: string,
  operation: () => Promise<Result>,
): Promise<Result> {
  if (key.length === 0) {
    throw new Error('浏览器持久化事务缺少作用域。');
  }
  const lockName = `${WEB_STORAGE_LOCK_PREFIX}durable-account`;
  const lockManager = getWebLockManager();

  if (lockManager !== null) {
    return lockManager.request(lockName, operation);
  }

  if (isNativeBrowserStorage(storage)) {
    throw new Error(
      '当前浏览器不支持安全的多页面待同步记录，请升级浏览器后重试。',
    );
  }

  return runWithInProcessStorageLock(storage, lockName, operation);
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
    assertAccountWriteIsNotQuarantined(storage, key, value);
    storage.setItem(key, value);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith('删除结果确认期间') ||
        error.message.startsWith('删除状态异常'))
    ) {
      throw error;
    }
    throw new Error('浏览器暂时无法保存待同步学习记录。', {cause: error});
  }
}

function assertAccountWriteIsNotQuarantined(
  storage: BrowserStorage,
  key: string,
  value: string,
) {
  const deletionOwner = readAccountDeletionOwner(storage);
  if (deletionOwner === null) {
    return;
  }

  let candidate: unknown;
  try {
    candidate = JSON.parse(value);
  } catch {
    throw new Error('浏览器暂时无法保存待同步学习记录。');
  }

  if (
    key === '__softbook_learning_event_outbox_v2' &&
    candidateContainsLearningEvent(candidate, deletionOwner)
  ) {
    throw new Error('删除结果确认期间不能写入新的学习记录。');
  }
  if (
    key.startsWith('__softbook_mutation_queue') &&
    candidateContainsMutation(candidate, deletionOwner)
  ) {
    throw new Error('删除结果确认期间不能写入新的账户操作。');
  }
}

function readAccountDeletionOwner(storage: BrowserStorage): string | null {
  const value = storage.getItem(WEB_ACCOUNT_DELETION_STORAGE_KEY);
  if (value === null) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(value);
    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      throw new Error('invalid deletion marker');
    }
    const record = parsed as Record<string, unknown>;
    if (record.schema_version === 'web-account-deletion-envelope.v2') {
      if (
        Object.keys(record).sort().join(',') !==
          'revision,schema_version,state' ||
        !Number.isSafeInteger(record.revision) ||
        (record.revision as number) < 0
      ) {
        throw new Error('invalid deletion envelope');
      }
      if (record.state === null) {
        return null;
      }
      if (
        typeof record.state !== 'object' ||
        record.state === null ||
        Array.isArray(record.state)
      ) {
        throw new Error('invalid deletion envelope');
      }
      const state = record.state as Record<string, unknown>;
      if (
        Object.keys(state).sort().join(',') !==
          'owner_phone_number,phase' ||
        (state.phase !== 'requesting' &&
          state.phase !== 'accepted' &&
          state.phase !== 'registration_ready') ||
        typeof state.owner_phone_number !== 'string' ||
        !/^1\d{10}$/.test(state.owner_phone_number)
      ) {
        throw new Error('invalid deletion envelope');
      }
      return state.owner_phone_number;
    }
    if (
      (record.phase !== 'requesting' && record.phase !== 'accepted') ||
      typeof record.owner_phone_number !== 'string' ||
      !/^1\d{10}$/.test(record.owner_phone_number)
    ) {
      throw new Error('invalid deletion marker');
    }
    return record.owner_phone_number;
  } catch (error) {
    throw new Error('删除状态异常，浏览器已停止账户写入。', {cause: error});
  }
}

function candidateContainsLearningEvent(
  candidate: unknown,
  phoneNumber: string,
) {
  if (
    typeof candidate !== 'object' ||
    candidate === null ||
    Array.isArray(candidate)
  ) {
    return true;
  }
  const entries = (candidate as Record<string, unknown>).entries;
  return (
    !Array.isArray(entries) ||
    entries.some(
      entry =>
        typeof entry === 'object' &&
        entry !== null &&
        !Array.isArray(entry) &&
        (entry as Record<string, unknown>).accountPhoneNumber === phoneNumber,
    )
  );
}

function candidateContainsMutation(candidate: unknown, phoneNumber: string) {
  if (!Array.isArray(candidate)) {
    return true;
  }
  return candidate.some(value => {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      return true;
    }
    const record = value as Record<string, unknown>;
    const possibleEntry =
      typeof record.entry === 'object' &&
      record.entry !== null &&
      !Array.isArray(record.entry)
        ? (record.entry as Record<string, unknown>)
        : record;
    const payload = possibleEntry.payload;
    if (
      typeof payload !== 'object' ||
      payload === null ||
      Array.isArray(payload)
    ) {
      return true;
    }
    const context = (payload as Record<string, unknown>).context;
    if (
      typeof context !== 'object' ||
      context === null ||
      Array.isArray(context)
    ) {
      return true;
    }
    return (
      (context as Record<string, unknown>).phoneNumber === phoneNumber
    );
  });
}

type WebLockManager = {
  request: <Result>(
    name: string,
    callback: () => Promise<Result>,
  ) => Promise<Result>;
};

function getWebLockManager(): WebLockManager | null {
  const navigatorWithLocks = globalThis.navigator as
    | (Navigator & {locks?: WebLockManager})
    | undefined;
  return navigatorWithLocks?.locks ?? null;
}

function isNativeBrowserStorage(storage: BrowserStorage): boolean {
  return typeof Storage !== 'undefined' && storage instanceof Storage;
}

function runWithInProcessStorageLock<Result>(
  storage: BrowserStorage,
  key: string,
  operation: () => Promise<Result>,
): Promise<Result> {
  let tails = inProcessStorageTails.get(storage);
  if (tails === undefined) {
    tails = new Map();
    inProcessStorageTails.set(storage, tails);
  }

  const previous = tails.get(key) ?? Promise.resolve();
  const result = previous.then(operation);
  const nextTail = result.then(
    () => undefined,
    () => undefined,
  );
  tails.set(key, nextTail);
  void nextTail.finally(() => {
    if (tails?.get(key) === nextTail) {
      tails.delete(key);
    }
  });
  return result;
}
