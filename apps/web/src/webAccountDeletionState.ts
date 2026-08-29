export const WEB_ACCOUNT_DELETION_STORAGE_KEY =
  'softbook-cet/web-account-deletion/v1';

export type WebAccountDeletionState = {
  phase: 'accepted' | 'requesting';
  phoneNumber: string;
};

type BrowserStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

export type WebAccountDeletionStateStore = {
  clear: () => Promise<void>;
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
      return runExclusive(async () => {
        storage.removeItem(WEB_ACCOUNT_DELETION_STORAGE_KEY);
        if (storage.getItem(WEB_ACCOUNT_DELETION_STORAGE_KEY) !== null) {
          throw new Error('Web account deletion marker cleanup failed.');
        }
      });
    },

    load() {
      return runExclusive(async () => {
        const value = storage.getItem(WEB_ACCOUNT_DELETION_STORAGE_KEY);
        return value === null ? null : parseState(value);
      });
    },

    mark(phoneNumber, phase) {
      return runExclusive(async () => {
        assertPhoneNumber(phoneNumber);
        if (phase !== 'requesting' && phase !== 'accepted') {
          throw new Error('Web account deletion phase is invalid.');
        }
        const serialized = JSON.stringify({
          owner_phone_number: phoneNumber,
          phase,
          schema_version: SCHEMA_VERSION,
        });
        storage.setItem(WEB_ACCOUNT_DELETION_STORAGE_KEY, serialized);
        if (storage.getItem(WEB_ACCOUNT_DELETION_STORAGE_KEY) !== serialized) {
          throw new Error('Web account deletion marker verification failed.');
        }
      });
    },
  };
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
