import type {RemoteAuthSession} from '../../mobile/src/auth/authSession';
import {MutationQueueManager} from '../../mobile/src/sync/mutationQueue';
import {
  createMemoryOnlyAuthSessionStore,
  createWebLearningEventStorage,
  createWebMutationQueueStorage,
} from './webStorage';

describe('Web persistence boundary', () => {
  it('keeps access and refresh credentials in memory only', async () => {
    const store = createMemoryOnlyAuthSessionStore();
    const session: RemoteAuthSession = {
      accessToken: 'access-secret',
      accessTokenExpiresAt: '2026-08-29T12:00:00.000Z',
      mode: 'remote',
      phoneNumber: '13800138000',
      refreshExpiresAt: '2026-09-29T12:00:00.000Z',
      refreshToken: 'refresh-secret',
      sessionId: 'session-1',
      tokenType: 'Bearer',
    };

    localStorage.clear();
    await store.save(session);
    expect(await store.load()).toEqual(session);
    expect(JSON.stringify(localStorage)).not.toContain('access-secret');
    expect(JSON.stringify(localStorage)).not.toContain('refresh-secret');

    await store.clearExactly();
    expect(await store.load()).toBeNull();
  });

  it('injects browser persistence into event and mutation cores', async () => {
    localStorage.clear();
    const eventStorage = createWebLearningEventStorage(localStorage);
    const mutationStorage = createWebMutationQueueStorage(localStorage);

    await eventStorage.setItem('event-key', '{"event_id":"evt_1"}');
    await mutationStorage.setItem('mutation-key', '{"type":"space"}');

    expect(await eventStorage.getItem('event-key')).toBe(
      '{"event_id":"evt_1"}',
    );
    expect(await mutationStorage.getItem('mutation-key')).toBe(
      '{"type":"space"}',
    );
    await eventStorage.removeItem('event-key');
    expect(await eventStorage.getItem('event-key')).toBeNull();
  });

  it('strips replay credentials before a Space mutation reaches localStorage', async () => {
    localStorage.clear();
    const queue = new MutationQueueManager({
      storage: createWebMutationQueueStorage(localStorage),
    });

    await queue.enqueue('apply_space_action', {
      action: {
        actionId: 'space_web_12345678',
        cardId: '000001',
        clientOccurredAt: '2026-08-29T12:00:00.000Z',
        dimension: 'favorite',
        value: true,
      },
      contentVersion: `sha256:${'12'.repeat(32)}`,
      context: {authToken: 'must-not-persist', phoneNumber: '13800138000'},
      track: 'cet4',
    });

    expect(Object.values(localStorage).join('')).not.toContain(
      'must-not-persist',
    );
    expect(Object.values(localStorage).join('')).toContain('13800138000');
  });
});
