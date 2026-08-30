import type {AuthSession} from '../../mobile/src/auth/authSession';
import type {AuthSessionStore} from '../../mobile/src/persistence/authSessionStore';
import type {LearningEventOutboxStorage} from '../../mobile/src/sync/learningEventOutbox';
import type {MutationQueueStorage} from '../../mobile/src/sync/mutationQueue';

type BrowserStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

const WEB_STORAGE_LOCK_PREFIX = 'softbook-cet/storage-lock/v1/';
const WEB_ACCOUNT_DELETION_STORAGE_KEY =
  'softbook-cet/web-account-deletion/v1';
const WEB_ACCOUNT_DELETION_LEGACY_REVISION_KEY =
  'softbook-cet/web-account-deletion-revision/v1';
const inProcessStorageTails = new WeakMap<
  object,
  Map<string, Promise<void>>
>();

type WebAccountDeletionStorageState = {
  ownerPhoneNumber: string;
  phase: 'accepted' | 'registration_ready' | 'requesting';
};

type WebAccountDeletionStorageEnvelope = {
  revision: number;
  state: WebAccountDeletionStorageState | null;
};

export type WebAccountWriteFence = {
  bindSessionRevision: (revision: number | null) => void;
  isWriteQuarantined: () => boolean;
  runDeletionCleanup: <Result>(
    scope: {ownerPhoneNumber: string; revision: number},
    operation: () => Promise<Result>,
  ) => Promise<Result>;
  verifyWrite: (key: string, value: string) => void;
};

export function createWebAccountWriteFence(
  storage: BrowserStorage,
): WebAccountWriteFence {
  let sessionRevision: number | null = null;
  let deletionCleanupScope: {
    ownerPhoneNumber: string;
    revision: number;
  } | null = null;

  return {
    bindSessionRevision(revision) {
      if (
        revision !== null &&
        (!Number.isSafeInteger(revision) || revision < 0)
      ) {
        throw new Error('Web account write revision is invalid.');
      }
      sessionRevision = revision;
    },

    isWriteQuarantined() {
      const envelope = readAccountDeletionEnvelope(storage);
      return (
        envelope.state !== null ||
        sessionRevision === null ||
        sessionRevision !== envelope.revision
      );
    },

    async runDeletionCleanup(scope, operation) {
      assertPhoneNumber(scope.ownerPhoneNumber);
      if (!Number.isSafeInteger(scope.revision) || scope.revision < 0) {
        throw new Error('Web account deletion cleanup revision is invalid.');
      }
      if (deletionCleanupScope !== null) {
        throw new Error('Web account deletion cleanup is already active.');
      }
      const envelope = readAccountDeletionEnvelope(storage);
      if (
        envelope.revision !== scope.revision ||
        envelope.state === null ||
        envelope.state.ownerPhoneNumber !== scope.ownerPhoneNumber ||
        (envelope.state.phase !== 'accepted' &&
          envelope.state.phase !== 'registration_ready')
      ) {
        throw new Error('Web account deletion cleanup authority is stale.');
      }

      deletionCleanupScope = {...scope};
      try {
        return await operation();
      } finally {
        deletionCleanupScope = null;
      }
    },

    verifyWrite(key, value) {
      const envelope = readAccountDeletionEnvelope(storage);
      if (envelope.state === null) {
        if (
          sessionRevision === null ||
          sessionRevision !== envelope.revision
        ) {
          throw new Error(
            '账户隔离版本已变化，浏览器已停止过期页面写入。',
          );
        }
        return;
      }

      const cleanupAuthorized =
        deletionCleanupScope !== null &&
        deletionCleanupScope.revision === envelope.revision &&
        deletionCleanupScope.ownerPhoneNumber ===
          envelope.state.ownerPhoneNumber;
      if (
        cleanupAuthorized &&
        !candidateContainsAccountData(
          key,
          value,
          envelope.state.ownerPhoneNumber,
        )
      ) {
        return;
      }

      if (key === '__softbook_learning_event_outbox_v2') {
        throw new Error('删除结果确认期间不能写入新的学习记录。');
      }
      if (key.startsWith('__softbook_mutation_queue')) {
        throw new Error('删除结果确认期间不能写入新的账户操作。');
      }
      throw new Error('删除结果确认期间不能写入新的账户记录。');
    },
  };
}

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
  accountWriteFence: WebAccountWriteFence,
): LearningEventOutboxStorage {
  return {
    getItem: key => readStorage(storage, key),
    isAccountWriteQuarantined: async () =>
      accountWriteFence.isWriteQuarantined(),
    removeItem: key => removeStorage(storage, key),
    runExclusive: (key, operation) =>
      runWebStorageExclusive(storage, key, operation),
    setItem: (key, value) =>
      writeStorage(storage, accountWriteFence, key, value),
  };
}

export function createWebMutationQueueStorage(
  storage: BrowserStorage,
  accountWriteFence: WebAccountWriteFence,
): MutationQueueStorage {
  return {
    getItem: key => readStorage(storage, key),
    isAccountWriteQuarantined: async () =>
      accountWriteFence.isWriteQuarantined(),
    runExclusive: (key, operation) =>
      runWebStorageExclusive(storage, key, operation),
    setItem: (key, value) =>
      writeStorage(storage, accountWriteFence, key, value),
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
  accountWriteFence: WebAccountWriteFence,
  key: string,
  value: string,
) {
  try {
    accountWriteFence.verifyWrite(key, value);
    storage.setItem(key, value);
  } catch (error) {
    if (
      error instanceof Error &&
      (error.message.startsWith('删除结果确认期间') ||
        error.message.startsWith('删除状态异常') ||
        error.message.startsWith('账户隔离版本'))
    ) {
      throw error;
    }
    throw new Error('浏览器暂时无法保存待同步学习记录。', {cause: error});
  }
}

function candidateContainsAccountData(
  key: string,
  value: string,
  phoneNumber: string,
) {
  let candidate: unknown;
  try {
    candidate = JSON.parse(value);
  } catch {
    return true;
  }

  if (key === '__softbook_learning_event_outbox_v2') {
    return candidateContainsLearningEvent(candidate, phoneNumber);
  }
  if (key.startsWith('__softbook_mutation_queue')) {
    return candidateContainsMutation(candidate, phoneNumber);
  }
  return true;
}

function readAccountDeletionEnvelope(
  storage: BrowserStorage,
): WebAccountDeletionStorageEnvelope {
  const value = storage.getItem(WEB_ACCOUNT_DELETION_STORAGE_KEY);
  if (value === null) {
    return {
      revision: readLegacyDeletionRevision(storage),
      state: null,
    };
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
        return {revision: record.revision as number, state: null};
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
      return {
        revision: record.revision as number,
        state: {
          ownerPhoneNumber: state.owner_phone_number,
          phase: state.phase,
        },
      };
    }
    if (
      Object.keys(record).sort().join(',') !==
        'owner_phone_number,phase,schema_version' ||
      record.schema_version !== 'web-account-deletion.v1' ||
      (record.phase !== 'requesting' && record.phase !== 'accepted') ||
      typeof record.owner_phone_number !== 'string' ||
      !/^1\d{10}$/.test(record.owner_phone_number)
    ) {
      throw new Error('invalid deletion marker');
    }
    return {
      revision: incrementDeletionRevision(readLegacyDeletionRevision(storage)),
      state: {
        ownerPhoneNumber: record.owner_phone_number,
        phase: record.phase,
      },
    };
  } catch (error) {
    throw new Error('删除状态异常，浏览器已停止账户写入。', {cause: error});
  }
}

function readLegacyDeletionRevision(storage: BrowserStorage): number {
  const value = storage.getItem(WEB_ACCOUNT_DELETION_LEGACY_REVISION_KEY);
  if (value === null) {
    return 0;
  }
  if (!/^\d+$/.test(value)) {
    throw new Error('删除状态异常，浏览器已停止账户写入。');
  }
  const revision = Number(value);
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new Error('删除状态异常，浏览器已停止账户写入。');
  }
  return revision;
}

function incrementDeletionRevision(revision: number) {
  if (revision >= Number.MAX_SAFE_INTEGER) {
    throw new Error('删除状态异常，浏览器已停止账户写入。');
  }
  return revision + 1;
}

function assertPhoneNumber(value: string) {
  if (!/^1\d{10}$/.test(value)) {
    throw new Error('Web account deletion cleanup phone is invalid.');
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
