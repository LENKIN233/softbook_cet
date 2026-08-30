import {runWebStorageExclusive} from './webStorage';

export const WEB_ACCOUNT_DELETION_STORAGE_KEY =
  'softbook-cet/web-account-deletion/v1';
const WEB_ACCOUNT_DELETION_REVISION_KEY =
  'softbook-cet/web-account-deletion-revision/v1';

export type WebAccountDeletionState = {
  phase: 'accepted' | 'requesting';
  phoneNumber: string;
};

type BrowserStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

export type WebAccountDeletionStateStore = {
  clear: () => Promise<void>;
  getRevision: () => Promise<number>;
  load: () => Promise<WebAccountDeletionState | null>;
  mark: (
    phoneNumber: string,
    phase: WebAccountDeletionState['phase'],
  ) => Promise<void>;
};

const SCHEMA_VERSION = 'web-account-deletion.v1';

export function createWebAccountDeletionStateStore(
  storage: BrowserStorage,
): WebAccountDeletionStateStore {
  let observedRevision = readRevision(storage);
  let operationTail: Promise<void> = Promise.resolve();
  const runExclusive = <Result>(operation: () => Promise<Result>) => {
    const result = operationTail.then(operation);
    operationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  };

  return {
    clear() {
      return runExclusive(() =>
        runWebStorageExclusive(
          storage,
          WEB_ACCOUNT_DELETION_STORAGE_KEY,
          async () => {
            const revision = readRevision(storage);
            assertObservedRevision(observedRevision, revision);
            const currentValue = storage.getItem(
              WEB_ACCOUNT_DELETION_STORAGE_KEY,
            );
            if (
              currentValue === null ||
              parseState(currentValue).phase !== 'accepted'
            ) {
              throw new Error(
                'Web account deletion marker cleanup requires accepted state.',
              );
            }
            const nextRevision = incrementRevision(revision);
            writeRevision(storage, nextRevision);
            observedRevision = nextRevision;
            storage.removeItem(WEB_ACCOUNT_DELETION_STORAGE_KEY);
            if (storage.getItem(WEB_ACCOUNT_DELETION_STORAGE_KEY) !== null) {
              throw new Error('Web account deletion marker cleanup failed.');
            }
          },
        ),
      );
    },

    getRevision() {
      return runExclusive(() =>
        runWebStorageExclusive(
          storage,
          WEB_ACCOUNT_DELETION_STORAGE_KEY,
          async () => readRevision(storage),
        ),
      );
    },

    load() {
      return runExclusive(() =>
        runWebStorageExclusive(
          storage,
          WEB_ACCOUNT_DELETION_STORAGE_KEY,
          async () => {
            const revision = readRevision(storage);
            const value = storage.getItem(WEB_ACCOUNT_DELETION_STORAGE_KEY);
            const state = value === null ? null : parseState(value);
            observedRevision = revision;
            return state;
          },
        ),
      );
    },

    mark(phoneNumber, phase) {
      return runExclusive(() =>
        runWebStorageExclusive(
          storage,
          WEB_ACCOUNT_DELETION_STORAGE_KEY,
          async () => {
            assertPhoneNumber(phoneNumber);
            if (phase !== 'requesting' && phase !== 'accepted') {
              throw new Error('Web account deletion phase is invalid.');
            }
            const revision = readRevision(storage);
            assertObservedRevision(observedRevision, revision);
            const currentValue = storage.getItem(
              WEB_ACCOUNT_DELETION_STORAGE_KEY,
            );
            const currentState =
              currentValue === null ? null : parseState(currentValue);
            if (
              currentState !== null &&
              currentState.phoneNumber !== phoneNumber
            ) {
              throw new Error('Web account deletion marker owner changed.');
            }
            if (
              currentState?.phase === 'accepted' &&
              phase === 'requesting'
            ) {
              throw new Error('Web account deletion marker cannot regress.');
            }
            const serialized = JSON.stringify({
              owner_phone_number: phoneNumber,
              phase,
              schema_version: SCHEMA_VERSION,
            });
            storage.setItem(WEB_ACCOUNT_DELETION_STORAGE_KEY, serialized);
            if (
              storage.getItem(WEB_ACCOUNT_DELETION_STORAGE_KEY) !== serialized
            ) {
              throw new Error('Web account deletion marker verification failed.');
            }
            const nextRevision = incrementRevision(revision);
            writeRevision(storage, nextRevision);
            observedRevision = nextRevision;
          },
        ),
      );
    },
  };
}

function readRevision(storage: BrowserStorage): number {
  const value = storage.getItem(WEB_ACCOUNT_DELETION_REVISION_KEY);
  if (value === null) {
    return 0;
  }
  if (!/^\d+$/.test(value)) {
    throw new Error('Web account deletion marker revision is invalid.');
  }
  const revision = Number(value);
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new Error('Web account deletion marker revision is invalid.');
  }
  return revision;
}

function writeRevision(storage: BrowserStorage, revision: number) {
  const serialized = String(revision);
  storage.setItem(WEB_ACCOUNT_DELETION_REVISION_KEY, serialized);
  if (storage.getItem(WEB_ACCOUNT_DELETION_REVISION_KEY) !== serialized) {
    throw new Error('Web account deletion marker revision verification failed.');
  }
}

function incrementRevision(revision: number) {
  if (revision >= Number.MAX_SAFE_INTEGER) {
    throw new Error('Web account deletion marker revision is exhausted.');
  }
  return revision + 1;
}

function assertObservedRevision(observed: number, current: number) {
  if (observed !== current) {
    throw new Error('Web account deletion marker changed in another tab.');
  }
}

function parseState(value: string): WebAccountDeletionState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('Web account deletion marker is invalid.');
  }
  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed) ||
    Object.keys(parsed).sort().join(',') !==
      'owner_phone_number,phase,schema_version'
  ) {
    throw new Error('Web account deletion marker is invalid.');
  }
  const record = parsed as Record<string, unknown>;
  if (record.schema_version !== SCHEMA_VERSION) {
    throw new Error('Web account deletion marker is invalid.');
  }
  assertPhoneNumber(record.owner_phone_number);
  if (record.phase !== 'requesting' && record.phase !== 'accepted') {
    throw new Error('Web account deletion marker is invalid.');
  }
  return {
    phase: record.phase,
    phoneNumber: record.owner_phone_number,
  };
}

function assertPhoneNumber(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^1\d{10}$/.test(value)) {
    throw new Error('Web account deletion phone number is invalid.');
  }
}
