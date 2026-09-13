import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AccountDeletionCleanupStorage } from './accountDeletionCleanupStore';

export const ACCOUNT_DELETION_RECOVERY_STORAGE_KEY =
  'softbook-cet/account-deletion-recovery/v1';
const SCHEMA = 'account-deletion-recovery-state.v1';
export type AccountDeletionRecoveryPhase =
  | 'requesting'
  | 'accepted'
  | 'registration_ready';
export type AccountDeletionRecoveryState = {
  revision: number;
  state: { phase: AccountDeletionRecoveryPhase; phoneNumber: string } | null;
};
export type AccountDeletionRecoveryReceipt = AccountDeletionRecoveryState & {
  state: NonNullable<AccountDeletionRecoveryState['state']>;
};

// Native has one JS process, but remounts may create multiple store instances.
// The shared queue includes the complete phase-authorized cleanup operation.
const operationTails = new WeakMap<object, Promise<void>>();

export function createAccountDeletionRecoveryStore(
  storage: AccountDeletionCleanupStorage = AsyncStorage,
) {
  const exclusive = <Result>(
    operation: () => Promise<Result>,
  ): Promise<Result> => {
    const result = (operationTails.get(storage) ?? Promise.resolve()).then(
      operation,
    );
    operationTails.set(
      storage,
      result.then(
        () => undefined,
        () => undefined,
      ),
    );
    return result;
  };
  const read = async () => {
    const raw = await storage.getItem(ACCOUNT_DELETION_RECOVERY_STORAGE_KEY);
    return raw === null ? { revision: 0, state: null } : parseState(raw);
  };
  const write = async (next: AccountDeletionRecoveryState) => {
    const raw = JSON.stringify({
      schema_version: SCHEMA,
      revision: next.revision,
      state:
        next.state === null
          ? null
          : {
              phase: next.state.phase,
              owner_phone_number: next.state.phoneNumber,
            },
    });
    await storage.setItem(ACCOUNT_DELETION_RECOVERY_STORAGE_KEY, raw);
    if (
      (await storage.getItem(ACCOUNT_DELETION_RECOVERY_STORAGE_KEY)) !== raw
    ) {
      throw new Error('Account deletion recovery write verification failed.');
    }
    return next;
  };

  return {
    load: () => exclusive(read),
    runSessionCleanup(operation: () => Promise<void>, isActive: () => boolean) {
      return exclusive(async () => {
        if (!isActive()) return;
        const current = await read();
        if (!isActive()) return;
        if (current.state !== null) throw superseded();
        // Startup and deletion recovery use this same queue. A remounted App
        // cannot authenticate while an earlier session still owns native IO.
        await operation();
      });
    },
    begin(
      phoneNumber: string,
      emptyRevision: number,
      phase: 'requesting' | 'accepted' = 'requesting',
    ) {
      return exclusive(async (): Promise<AccountDeletionRecoveryReceipt> => {
        assertPhone(phoneNumber);
        const current = await read();
        const revision = nextRevision(emptyRevision);
        if (
          current.revision === revision &&
          current.state?.phase === phase &&
          current.state.phoneNumber === phoneNumber
        ) {
          return current as AccountDeletionRecoveryReceipt;
        }
        if (current.revision !== emptyRevision || current.state !== null)
          throw superseded();
        return (await write({
          revision,
          state: { phase, phoneNumber },
        })) as AccountDeletionRecoveryReceipt;
      });
    },
    transition(
      expected: AccountDeletionRecoveryReceipt,
      phase: 'accepted' | 'registration_ready',
    ) {
      return exclusive(async (): Promise<AccountDeletionRecoveryReceipt> => {
        const current = await read();
        if (
          current.revision === nextRevision(expected.revision) &&
          current.state?.phoneNumber === expected.state.phoneNumber &&
          current.state.phase === phase
        ) {
          return current as AccountDeletionRecoveryReceipt;
        }
        if (!sameRecoveryState(current, expected)) throw superseded();
        if (current.state?.phase === phase)
          return current as AccountDeletionRecoveryReceipt;
        if (current.state?.phase === 'registration_ready') throw superseded();
        return (await write({
          revision: nextRevision(current.revision),
          state: { phoneNumber: expected.state.phoneNumber, phase },
        })) as AccountDeletionRecoveryReceipt;
      });
    },
    runCleanup(
      expected: AccountDeletionRecoveryReceipt,
      operation: () => Promise<void>,
      isActive: () => boolean,
    ) {
      return exclusive(async () => {
        const current = await read();
        const finishesRegistration =
          expected.state.phase === 'registration_ready';
        if (!isActive()) throw superseded();
        if (
          finishesRegistration &&
          current.state === null &&
          current.revision === nextRevision(expected.revision)
        ) {
          return current;
        }
        if (
          !sameRecoveryState(current, expected) ||
          expected.state.phase === 'requesting'
        )
          throw superseded();
        await operation();
        if (!isActive()) throw superseded();
        return finishesRegistration
          ? write({ revision: nextRevision(current.revision), state: null })
          : current;
      });
    },
  };
}

export function sameRecoveryState(
  left: AccountDeletionRecoveryState,
  right: AccountDeletionRecoveryState,
) {
  return (
    left.revision === right.revision &&
    left.state?.phase === right.state?.phase &&
    left.state?.phoneNumber === right.state?.phoneNumber
  );
}
function nextRevision(value: number) {
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value >= Number.MAX_SAFE_INTEGER
  )
    throw superseded();
  return value + 1;
}
function superseded() {
  return new Error('Account deletion recovery authority changed.');
}
function assertPhone(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^1\d{10}$/.test(value))
    throw new Error('Account deletion recovery owner is invalid.');
}
function parseState(raw: string): AccountDeletionRecoveryState {
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw superseded();
  const record = value as Record<string, unknown>;
  if (
    Object.keys(record).sort().join(',') !== 'revision,schema_version,state' ||
    record.schema_version !== SCHEMA ||
    !Number.isSafeInteger(record.revision) ||
    (record.revision as number) < 0
  )
    throw superseded();
  if (record.state === null)
    return { revision: record.revision as number, state: null };
  if (typeof record.state !== 'object' || Array.isArray(record.state))
    throw superseded();
  const state = record.state as Record<string, unknown>;
  if (
    Object.keys(state).sort().join(',') !== 'owner_phone_number,phase' ||
    !['requesting', 'accepted', 'registration_ready'].includes(
      state.phase as string,
    )
  )
    throw superseded();
  assertPhone(state.owner_phone_number);
  return {
    revision: record.revision as number,
    state: {
      phase: state.phase as AccountDeletionRecoveryPhase,
      phoneNumber: state.owner_phone_number,
    },
  };
}
