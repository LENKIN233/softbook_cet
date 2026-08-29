import AsyncStorage from '@react-native-async-storage/async-storage';

export const ACCOUNT_DELETION_CLEANUP_STORAGE_KEY =
  'softbook-cet/account-deletion-cleanup/v1';

const SCHEMA_VERSION = 'account-deletion-local-cleanup.v1' as const;

export type PendingAccountDeletionCleanup = {
  phoneNumber: string;
};

export type AccountDeletionCleanupStorage = {
  getItem: (key: string) => Promise<string | null>;
  removeItem: (key: string) => Promise<void>;
  setItem: (key: string, value: string) => Promise<void>;
};

export type AccountDeletionCleanupStore = {
  clear: () => Promise<void>;
  load: () => Promise<PendingAccountDeletionCleanup | null>;
  markPending: (phoneNumber: string) => Promise<void>;
};

export function createAccountDeletionCleanupStore(
  storage: AccountDeletionCleanupStorage = AsyncStorage,
): AccountDeletionCleanupStore {
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
        await storage.removeItem(ACCOUNT_DELETION_CLEANUP_STORAGE_KEY);

        if (
          (await storage.getItem(ACCOUNT_DELETION_CLEANUP_STORAGE_KEY)) !== null
        ) {
          throw new Error(
            'Account deletion cleanup marker removal verification failed.',
          );
        }
      });
    },

    load() {
      return runExclusive(async () => {
        const value = await storage.getItem(
          ACCOUNT_DELETION_CLEANUP_STORAGE_KEY,
        );
        return value === null ? null : parsePendingCleanup(value);
      });
    },

    markPending(phoneNumber) {
      return runExclusive(async () => {
        assertPhoneNumber(phoneNumber);
        const serialized = JSON.stringify({
          owner_phone_number: phoneNumber,
          schema_version: SCHEMA_VERSION,
        });
        await storage.setItem(
          ACCOUNT_DELETION_CLEANUP_STORAGE_KEY,
          serialized,
        );
        const persisted = await storage.getItem(
          ACCOUNT_DELETION_CLEANUP_STORAGE_KEY,
        );

        if (persisted !== serialized) {
          throw new Error(
            'Account deletion cleanup marker verification failed.',
          );
        }
      });
    },
  };
}

function parsePendingCleanup(value: string): PendingAccountDeletionCleanup {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error('Account deletion cleanup marker is invalid.');
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    Array.isArray(parsed) ||
    Object.keys(parsed).sort().join(',') !==
      'owner_phone_number,schema_version' ||
    (parsed as {schema_version?: unknown}).schema_version !== SCHEMA_VERSION
  ) {
    throw new Error('Account deletion cleanup marker is invalid.');
  }

  const phoneNumber = (parsed as {owner_phone_number?: unknown})
    .owner_phone_number;
  assertPhoneNumber(phoneNumber);
  return {phoneNumber};
}

function assertPhoneNumber(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^1\d{10}$/.test(value)) {
    throw new Error('Account deletion cleanup phone number is invalid.');
  }
}
