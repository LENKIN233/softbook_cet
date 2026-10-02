import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Keychain from 'react-native-keychain';
import {
  guardFirstTrackSelection,
  FirstTrackSelectionBlockedError,
} from '../src/onboarding/firstTrackSelectionGuard';
import { createAuthSessionStore } from '../src/persistence/authSessionStore';
import {
  createUserStateStore,
  USER_STATE_STORAGE_KEY,
} from '../src/persistence/userStateStore';
import { createAccountLogoutCleanupStore } from '../src/account/accountDeletionCleanupStore';
import {
  LearningEventOutbox,
  LEARNING_EVENT_OUTBOX_STORAGE_KEY,
} from '../src/sync/learningEventOutbox';
import { createReactNativeLearningEventOutboxStorage } from '../src/sync/learningEventOutboxStorage.native';
import { MutationQueueManager } from '../src/sync/mutationQueue';
import { createReactNativeMutationQueueStorage } from '../src/sync/mutationQueueStorage.native';
import { createSpaceAction } from '../src/space/spaceStateRepository';

const phoneNumber = '13800138000';
const contentVersion = `sha256:${'a'.repeat(64)}`;
async function account() {
  await createAuthSessionStore().save({
    mode: 'remote',
    phoneNumber,
    accessToken: 'retained-auth-token',
    accessTokenExpiresAt: '2099-01-01T00:00:00.000Z',
    refreshToken: 'retained-refresh-token',
    refreshExpiresAt: '2099-01-01T00:00:00.000Z',
    sessionId: 'retained-session',
    tokenType: 'Bearer',
  });
  await createUserStateStore().save(phoneNumber, {
    checkedInDayKey: null,
    learningCursor: { cardId: '002001', sourceId: 'source', track: 'cet4' },
    spaceCardStateById: {},
  });
}

test.each(['learning', 'space'] as const)(
  'first selection preserves pending %s records and can resume their current subject',
  async pending => {
    await account();
    if (pending === 'learning') {
      const outbox = new LearningEventOutbox({
        storage: createReactNativeLearningEventOutboxStorage(),
      });
      await outbox.enqueueCompletion({
        accountPhoneNumber: phoneNumber,
        contentVersion,
        phase: 'learning',
        selectionId: 'sel_first_selection_pending_0001',
        track: 'cet4',
        result: {
          cardId: '002001',
          completedAt: new Date().toISOString(),
          interactionId: 'flip',
          isFavorited: false,
          outcome: 'confident',
          usedHint: false,
          usedPeek: false,
        },
      });
    } else {
      const queue = new MutationQueueManager({
        storage: createReactNativeMutationQueueStorage(),
      });
      await queue.enqueue('apply_space_action', {
        action: createSpaceAction({
          cardId: '002001',
          dimension: 'favorite',
          value: true,
        }),
        contentVersion,
        context: { phoneNumber, authToken: 'retained-auth-token' },
        track: 'cet4',
      });
    }
    const keys = [
      USER_STATE_STORAGE_KEY,
      LEARNING_EVENT_OUTBOX_STORAGE_KEY,
      '__softbook_mutation_queue',
    ];
    const before = await Promise.all(
      keys.map(key => AsyncStorage.getItem(key)),
    );
    await expect(
      guardFirstTrackSelection('cet6', 'cet4'),
    ).rejects.toBeInstanceOf(FirstTrackSelectionBlockedError);
    expect(
      await Promise.all(keys.map(key => AsyncStorage.getItem(key))),
    ).toEqual(before);
    await expect(
      guardFirstTrackSelection('cet4', 'cet4'),
    ).resolves.toBeUndefined();
    expect(
      await Promise.all(keys.map(key => AsyncStorage.getItem(key))),
    ).toEqual(before);
  },
);

test('pending logout authority is respected before inspecting credentials or account data', async () => {
  await account();
  await createAccountLogoutCleanupStore().markPending(phoneNumber);
  const readCount = jest.mocked(Keychain.getGenericPassword).mock.calls.length;
  await guardFirstTrackSelection('cet6', 'cet4');
  expect(jest.mocked(Keychain.getGenericPassword).mock.calls).toHaveLength(
    readCount,
  );
});

test('a failed account preference read blocks selection instead of guessing the previous subject', async () => {
  await account();
  const original = jest.mocked(AsyncStorage.getItem).getMockImplementation()!;
  jest.mocked(AsyncStorage.getItem).mockImplementation(async key => {
    if (key === USER_STATE_STORAGE_KEY) throw new Error('read blocked');
    return original(key);
  });
  try {
    await expect(guardFirstTrackSelection('cet6', 'cet4')).rejects.toThrow();
  } finally {
    jest.mocked(AsyncStorage.getItem).mockImplementation(original);
  }
});

test('a failed secure-session read cannot be treated as a fresh installation', async () => {
  await account();
  const getter = jest.mocked(Keychain.getGenericPassword);
  const original = getter.getMockImplementation()!;
  getter.mockRejectedValueOnce(new Error('locked'));
  try {
    await expect(guardFirstTrackSelection('cet6', 'cet4')).rejects.toThrow();
  } finally {
    getter.mockImplementation(original);
  }
});

test.each([
  USER_STATE_STORAGE_KEY,
  LEARNING_EVENT_OUTBOX_STORAGE_KEY,
  '__softbook_mutation_queue',
])(
  'nonempty unreadable %s blocks first selection and preserves raw bytes',
  async key => {
    await account();
    await AsyncStorage.setItem(key, '{unreadable');
    await expect(guardFirstTrackSelection('cet6', 'cet4')).rejects.toThrow();
    expect(await AsyncStorage.getItem(key)).toBe('{unreadable');
  },
);

test('strict first selection does not revoke or clear an undecodable saved credential', async () => {
  await Keychain.setGenericPassword(phoneNumber, '{unreadable', {
    service: 'com.softbook.cet.auth-session.v2',
  });
  const before = await Keychain.getGenericPassword({
    service: 'com.softbook.cet.auth-session.v2',
  });
  await expect(guardFirstTrackSelection('cet6', 'cet4')).rejects.toThrow();
  expect(
    await Keychain.getGenericPassword({
      service: 'com.softbook.cet.auth-session.v2',
    }),
  ).toEqual(before);
  expect(
    await AsyncStorage.getItem('softbook-cet/auth-session/revoked.v1'),
  ).toBeNull();
});

test('a valid legacy expansion cannot hide a damaged current-account write during first selection', async () => {
  await account();
  const timestamp = '2026-04-27T10:00:00.000Z';
  const raw = JSON.stringify([
    {
      id: 'legacy-space-snapshot',
      type: 'sync_space_state',
      timestamp,
      retryCount: 0,
      payload: {
        context: { phoneNumber: '13800138001' },
        snapshot: {
          dayKey: '2026-04-27',
          states: [
            {
              cardId: 'card-1',
              isFavorited: true,
              isSleeping: false,
              lastModifiedAt: timestamp,
            },
          ],
        },
      },
    },
    {
      id: 'damaged-current-checkin',
      type: 'check_in_daily_progress',
      timestamp,
      retryCount: 0,
      payload: { context: { phoneNumber }, dayKey: 'unreadable' },
    },
  ]);
  await AsyncStorage.setItem('__softbook_mutation_queue', raw);
  await expect(guardFirstTrackSelection('cet6', 'cet4')).rejects.toThrow();
  expect(await AsyncStorage.getItem('__softbook_mutation_queue')).toBe(raw);
});
