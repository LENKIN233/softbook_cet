import { createAccountDeletionRecoveryStore } from '../account/accountDeletionRecoveryStore';
import {
  createAccountDeletionCleanupStore,
  createAccountLogoutCleanupStore,
} from '../account/accountDeletionCleanupStore';
import { createAuthSessionStore } from '../persistence/authSessionStore';
import { createUserStateStore } from '../persistence/userStateStore';
import type { LearningTrack } from '../learning/model';
import { LearningEventOutbox } from '../sync/learningEventOutbox';
import { createReactNativeLearningEventOutboxStorage } from '../sync/learningEventOutboxStorage.native';
import { MutationQueueManager } from '../sync/mutationQueue';
import { createReactNativeMutationQueueStorage } from '../sync/mutationQueueStorage.native';
import { getChinaDayKey } from '../shared/chinaDay';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class FirstTrackSelectionBlockedError extends Error {}

// A pre-onboarding account can retain unsent records from another subject.
// Read through the existing parsers without sanitization writes or legacy-key
// cleanup; normal account recovery remains responsible for replay and cleanup.
export async function guardFirstTrackSelection(
  nextTrack: LearningTrack,
  previousDefault: LearningTrack,
) {
  if ((await createAccountDeletionRecoveryStore().load()).state !== null)
    return;
  if ((await createAccountLogoutCleanupStore().load()) !== null) return;
  if ((await createAccountDeletionCleanupStore().load()) !== null) return;
  const session = await createAuthSessionStore(undefined, undefined, {
    failOnReadError: true,
  }).load();
  if (session?.mode !== 'remote') return;
  const outbox = new LearningEventOutbox({
    strictRead: true,
    legacyKey: null,
    storage: {
      ...createReactNativeLearningEventOutboxStorage(),
      isAccountWriteQuarantined: async () => true,
    },
  });
  const queue = new MutationQueueManager({
    strictRead: true,
    storage: {
      ...createReactNativeMutationQueueStorage(),
      isAccountWriteQuarantined: async () => true,
    },
  });
  let stateReadFailed = false;
  const readonlyState = createUserStateStore({
    getItem: async key => {
      try {
        return await AsyncStorage.getItem(key);
      } catch (error) {
        stateReadFailed = true;
        throw error;
      }
    },
    // UserStateStore normally makes a recovery backup when parsing fails.
    // Leave that operation to ordinary account recovery after the choice.
    setItem: async () => {
      stateReadFailed = true;
      throw new Error('First selection cannot write account state.');
    },
    removeItem: async () => {
      throw new Error('First selection cannot clear account state.');
    },
  });
  const [state, learning, mutations] = await Promise.all([
    readonlyState.load(session.phoneNumber),
    outbox.getAll(),
    queue.getAll(),
  ]);
  if (stateReadFailed)
    throw new Error('Previous account subject could not be read.');
  const accountLearning = learning.filter(
    entry => entry.accountPhoneNumber === session.phoneNumber,
  );
  const accountMutations = mutations.filter(
    entry => entry.payload.context.phoneNumber === session.phoneNumber,
  );
  const pendingSpace = accountMutations.filter(
    entry => entry.type === 'apply_space_action',
  );
  const previousTrack =
    state.learningCursor?.track ??
    accountLearning[0]?.track ??
    pendingSpace[0]?.payload.track ??
    previousDefault;
  const hasPendingWrites =
    accountLearning.length > 0 ||
    pendingSpace.length > 0 ||
    accountMutations.some(
      entry =>
        entry.type === 'check_in_daily_progress' &&
        entry.payload.dayKey === getChinaDayKey(),
    );
  if (nextTrack !== previousTrack && hasPendingWrites)
    throw new FirstTrackSelectionBlockedError(
      `还有${previousTrack === 'cet4' ? '四级' : '六级'}记录等待同步。请先选择${
        previousTrack === 'cet4' ? '英语四级' : '英语六级'
      }，联网同步后再到“我的”切换。`,
    );
}
