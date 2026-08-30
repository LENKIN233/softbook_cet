import {runWebStorageExclusive} from './webStorage';

export const WEB_ACCOUNT_DELETION_STORAGE_KEY =
  'softbook-cet/web-account-deletion/v1';
const LEGACY_REVISION_KEY =
  'softbook-cet/web-account-deletion-revision/v1';
const ENVELOPE_SCHEMA_VERSION = 'web-account-deletion-envelope.v2';
const LEGACY_STATE_SCHEMA_VERSION = 'web-account-deletion.v1';

export type WebAccountDeletionState = {
  phase: 'accepted' | 'local_cleanup' | 'registration_ready' | 'requesting';
  phoneNumber: string;
};

export type WebAccountCleanupAuthority = {
  phase: WebAccountDeletionState['phase'];
  phoneNumber: string;
  revision: number;
};

export type WebAccountResolvedCleanupAuthority = {
  phase: 'accepted' | 'local_cleanup' | 'registration_ready';
  phoneNumber: string;
  revision: number;
};

export type WebAccountDeletionRequestingAuthority = {
  phoneNumber: string;
  revision: number;
};

type WebAccountDeletionEnvelope = {
  revision: number;
  state: WebAccountDeletionState | null;
};

type BrowserStorage = Pick<Storage, 'getItem' | 'removeItem' | 'setItem'>;

export type WebAccountDeletionStateStore = {
  beginRequesting?: (
    phoneNumber: string,
    expectedNullRevision: number,
  ) => Promise<WebAccountDeletionRequestingAuthority>;
  ensureCleanupAuthority?: (
    phoneNumber: string,
    expectedRevision: number,
  ) => Promise<WebAccountCleanupAuthority>;
  clear: (authority: WebAccountResolvedCleanupAuthority) => Promise<void>;
  getRevision: () => Promise<number>;
  load: () => Promise<WebAccountDeletionState | null>;
  resolveRequesting?: (
    authority: WebAccountDeletionRequestingAuthority,
    phase: 'accepted' | 'registration_ready',
  ) => Promise<WebAccountCleanupAuthority>;
  runAtNullRevision?: <Result>(
    expectedRevision: number,
    operation: () => Promise<Result>,
  ) => Promise<Result>;
};

export function createWebAccountDeletionStateStore(
  storage: BrowserStorage,
): WebAccountDeletionStateStore {
  readInitialRevision(storage);
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
    beginRequesting(phoneNumber, expectedNullRevision) {
      return runExclusive(() =>
        runWebStorageExclusive(
          storage,
          WEB_ACCOUNT_DELETION_STORAGE_KEY,
          async () => {
            assertPhoneNumber(phoneNumber);
            if (
              !Number.isSafeInteger(expectedNullRevision) ||
              expectedNullRevision < 0
            ) {
              throw new Error(
                'Web account deletion null revision is invalid.',
              );
            }
            const envelope = readEnvelope(storage);
            if (
              envelope.state !== null ||
              envelope.revision !== expectedNullRevision
            ) {
              throw new Error(
                'Web account deletion null authority changed.',
              );
            }
            const nextEnvelope = {
              revision: incrementRevision(envelope.revision),
              state: {phase: 'requesting' as const, phoneNumber},
            };
            persistEnvelope(storage, nextEnvelope);
            return {
              phoneNumber,
              revision: nextEnvelope.revision,
            };
          },
        ),
      );
    },

    ensureCleanupAuthority(phoneNumber, expectedRevision) {
      return runExclusive(() =>
        runWebStorageExclusive(
          storage,
          WEB_ACCOUNT_DELETION_STORAGE_KEY,
          async () => {
            assertPhoneNumber(phoneNumber);
            const envelope = readEnvelope(storage);
            if (envelope.state !== null) {
              if (envelope.state.phoneNumber !== phoneNumber) {
                throw new Error(
                  'Web account cleanup authority belongs to another owner.',
                );
              }
              return {
                phase: envelope.state.phase,
                phoneNumber: envelope.state.phoneNumber,
                revision: envelope.revision,
              };
            }
            if (
              envelope.revision !== expectedRevision
            ) {
              throw new Error(
                'Web account write epoch changed in another tab.',
              );
            }
            const nextEnvelope = {
              revision: incrementRevision(envelope.revision),
              state: {phase: 'local_cleanup' as const, phoneNumber},
            };
            persistEnvelope(storage, nextEnvelope);
            return {
              phase: nextEnvelope.state.phase,
              phoneNumber,
              revision: nextEnvelope.revision,
            };
          },
        ),
      );
    },

    clear(authority) {
      return runExclusive(() =>
        runWebStorageExclusive(
          storage,
          WEB_ACCOUNT_DELETION_STORAGE_KEY,
          async () => {
            const envelope = readEnvelope(storage);
            assertPhoneNumber(authority.phoneNumber);
            if (
              !Number.isSafeInteger(authority.revision) ||
              authority.revision < 0 ||
              (authority.phase !== 'accepted' &&
                authority.phase !== 'local_cleanup' &&
                authority.phase !== 'registration_ready')
            ) {
              throw new Error(
                'Web account deletion cleanup authority is invalid.',
              );
            }
            if (
              envelope.revision !== authority.revision ||
              envelope.state?.phoneNumber !== authority.phoneNumber ||
              envelope.state.phase !== authority.phase
            ) {
              throw new Error(
                'Web account deletion cleanup authority changed.',
              );
            }
            const nextEnvelope = {
              revision: incrementRevision(envelope.revision),
              state: null,
            };
            persistEnvelope(storage, nextEnvelope);
          },
        ),
      );
    },

    getRevision() {
      return runExclusive(() =>
        runWebStorageExclusive(
          storage,
          WEB_ACCOUNT_DELETION_STORAGE_KEY,
          async () => readEnvelope(storage).revision,
        ),
      );
    },

    load() {
      return runExclusive(() =>
        runWebStorageExclusive(
          storage,
          WEB_ACCOUNT_DELETION_STORAGE_KEY,
          async () => {
            const envelope = readEnvelope(storage);
            return envelope.state;
          },
        ),
      );
    },

    resolveRequesting(authority, phase) {
      return runExclusive(() =>
        runWebStorageExclusive(
          storage,
          WEB_ACCOUNT_DELETION_STORAGE_KEY,
          async () => {
            assertPhoneNumber(authority.phoneNumber);
            if (!Number.isSafeInteger(authority.revision) || authority.revision < 0) {
              throw new Error(
                'Web account deletion requesting revision is invalid.',
              );
            }
            if (phase !== 'accepted' && phase !== 'registration_ready') {
              throw new Error(
                'Web account deletion requesting resolution is invalid.',
              );
            }
            const envelope = readEnvelope(storage);
            if (
              envelope.revision !== authority.revision ||
              envelope.state?.phase !== 'requesting' ||
              envelope.state.phoneNumber !== authority.phoneNumber
            ) {
              throw new Error(
                'Web account deletion requesting authority changed.',
              );
            }
            const nextEnvelope = {
              revision: incrementRevision(envelope.revision),
              state: {phase, phoneNumber: authority.phoneNumber},
            };
            persistEnvelope(storage, nextEnvelope);
            return {
              phase: nextEnvelope.state.phase,
              phoneNumber: nextEnvelope.state.phoneNumber,
              revision: nextEnvelope.revision,
            };
          },
        ),
      );
    },

    runAtNullRevision(expectedRevision, operation) {
      return runExclusive(() =>
        runWebStorageExclusive(
          storage,
          WEB_ACCOUNT_DELETION_STORAGE_KEY,
          async () => {
            const before = readEnvelope(storage);
            if (
              before.state !== null ||
              before.revision !== expectedRevision
            ) {
              throw new Error(
                'Web account write epoch changed in another tab.',
              );
            }
            const result = await operation();
            const after = readEnvelope(storage);
            if (
              after.state !== null ||
              after.revision !== expectedRevision
            ) {
              throw new Error(
                'Web account write epoch changed during authority commit.',
              );
            }
            return result;
          },
        ),
      );
    },
  };
}

function readInitialRevision(storage: BrowserStorage): number {
  const value = storage.getItem(WEB_ACCOUNT_DELETION_STORAGE_KEY);
  const legacyRevision = readLegacyRevision(storage);
  if (value === null) {
    return legacyRevision.value;
  }
  const parsed = parseJson(value);
  if (isEnvelopeCandidate(parsed)) {
    return parseEnvelope(parsed).revision;
  }
  parseLegacyState(parsed);
  return incrementRevision(legacyRevision.value);
}

function readEnvelope(storage: BrowserStorage): WebAccountDeletionEnvelope {
  const value = storage.getItem(WEB_ACCOUNT_DELETION_STORAGE_KEY);
  const legacyRevision = readLegacyRevision(storage);
  if (value === null) {
    const envelope = {revision: legacyRevision.value, state: null};
    if (legacyRevision.present) {
      persistEnvelope(storage, envelope);
    }
    return envelope;
  }

  const parsed = parseJson(value);
  if (isEnvelopeCandidate(parsed)) {
    const envelope = parseEnvelope(parsed);
    clearLegacyRevision(storage);
    return envelope;
  }

  const legacyState = parseLegacyState(parsed);
  const envelope = {
    revision: incrementRevision(legacyRevision.value),
    state: legacyState,
  };
  persistEnvelope(storage, envelope);
  return envelope;
}

function persistEnvelope(
  storage: BrowserStorage,
  envelope: WebAccountDeletionEnvelope,
) {
  const serialized = JSON.stringify({
    revision: envelope.revision,
    schema_version: ENVELOPE_SCHEMA_VERSION,
    state:
      envelope.state === null
        ? null
        : {
            owner_phone_number: envelope.state.phoneNumber,
            phase: envelope.state.phase,
          },
  });
  storage.setItem(WEB_ACCOUNT_DELETION_STORAGE_KEY, serialized);
  if (storage.getItem(WEB_ACCOUNT_DELETION_STORAGE_KEY) !== serialized) {
    throw new Error('Web account deletion envelope verification failed.');
  }
  clearLegacyRevision(storage);
}

function parseEnvelope(
  candidate: Record<string, unknown>,
): WebAccountDeletionEnvelope {
  assertExactKeys(candidate, ['revision', 'schema_version', 'state']);
  if (
    candidate.schema_version !== ENVELOPE_SCHEMA_VERSION ||
    !Number.isSafeInteger(candidate.revision) ||
    (candidate.revision as number) < 0
  ) {
    throw new Error('Web account deletion envelope is invalid.');
  }
  if (candidate.state === null) {
    return {revision: candidate.revision as number, state: null};
  }
  if (
    typeof candidate.state !== 'object' ||
    Array.isArray(candidate.state)
  ) {
    throw new Error('Web account deletion envelope is invalid.');
  }
  const state = candidate.state as Record<string, unknown>;
  assertExactKeys(state, ['owner_phone_number', 'phase']);
  assertPhoneNumber(state.owner_phone_number);
  assertPhase(state.phase);
  return {
    revision: candidate.revision as number,
    state: {phase: state.phase, phoneNumber: state.owner_phone_number},
  };
}

function parseLegacyState(candidate: unknown): WebAccountDeletionState {
  if (
    typeof candidate !== 'object' ||
    candidate === null ||
    Array.isArray(candidate)
  ) {
    throw new Error('Web account deletion legacy marker is invalid.');
  }
  const record = candidate as Record<string, unknown>;
  assertExactKeys(record, [
    'owner_phone_number',
    'phase',
    'schema_version',
  ]);
  if (record.schema_version !== LEGACY_STATE_SCHEMA_VERSION) {
    throw new Error('Web account deletion legacy marker is invalid.');
  }
  assertPhoneNumber(record.owner_phone_number);
  if (record.phase !== 'accepted' && record.phase !== 'requesting') {
    throw new Error('Web account deletion legacy marker is invalid.');
  }
  return {phase: record.phase, phoneNumber: record.owner_phone_number};
}

function readLegacyRevision(storage: BrowserStorage) {
  const value = storage.getItem(LEGACY_REVISION_KEY);
  if (value === null) {
    return {present: false, value: 0};
  }
  if (!/^\d+$/.test(value)) {
    throw new Error('Web account deletion legacy revision is invalid.');
  }
  const revision = Number(value);
  if (!Number.isSafeInteger(revision) || revision < 0) {
    throw new Error('Web account deletion legacy revision is invalid.');
  }
  return {present: true, value: revision};
}

function clearLegacyRevision(storage: BrowserStorage) {
  if (storage.getItem(LEGACY_REVISION_KEY) === null) {
    return;
  }
  storage.removeItem(LEGACY_REVISION_KEY);
  if (storage.getItem(LEGACY_REVISION_KEY) !== null) {
    throw new Error('Web account deletion legacy revision cleanup failed.');
  }
}

function incrementRevision(revision: number) {
  if (revision >= Number.MAX_SAFE_INTEGER) {
    throw new Error('Web account deletion marker revision is exhausted.');
  }
  return revision + 1;
}

function assertExactKeys(record: Record<string, unknown>, keys: string[]) {
  if (Object.keys(record).sort().join(',') !== [...keys].sort().join(',')) {
    throw new Error('Web account deletion fields are invalid.');
  }
}

function isEnvelopeCandidate(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    (value as Record<string, unknown>).schema_version ===
      ENVELOPE_SCHEMA_VERSION
  );
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error('Web account deletion marker is invalid.');
  }
}

function assertPhase(
  value: unknown,
): asserts value is WebAccountDeletionState['phase'] {
  if (
    value !== 'accepted' &&
    value !== 'local_cleanup' &&
    value !== 'registration_ready' &&
    value !== 'requesting'
  ) {
    throw new Error('Web account deletion phase is invalid.');
  }
}

function assertPhoneNumber(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^1\d{10}$/.test(value)) {
    throw new Error('Web account deletion phone number is invalid.');
  }
}
