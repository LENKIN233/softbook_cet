import {
  createFirstRunGuidanceStore,
  FIRST_RUN_GUIDANCE_KEY,
} from '../src/onboarding/firstRunGuidanceStore';

test('a reported write that did not persist cannot complete the initial subject choice', async () => {
  const storage = {
    getItem: async () => null,
    setItem: async () => {},
    removeItem: async () => {},
  };
  await expect(
    createFirstRunGuidanceStore(storage).selectTrack('cet6'),
  ).rejects.toThrow();
});

test('concurrent guide dismissal and subject switch retain both decisions across store instances', async () => {
  let saved: string | null = null;
  const storage = {
    getItem: async () => saved,
    setItem: async (_key: string, value: string) => {
      saved = value;
    },
    removeItem: async () => {
      saved = null;
    },
  };
  const first = createFirstRunGuidanceStore(storage);
  const second = createFirstRunGuidanceStore(storage);
  await first.selectTrack('cet4');
  await Promise.all([
    first.markLearningGuideSeen(),
    second.selectTrack('cet6'),
  ]);
  expect(await first.load()).toEqual({
    version: 1,
    selectedTrack: 'cet6',
    learningGuideSeen: true,
  });
});

test('unknown versions are preserved for recovery instead of treated as a fresh installation', async () => {
  const raw = JSON.stringify({
    version: 2,
    selectedTrack: 'cet6',
    learningGuideSeen: true,
  });
  const storage = {
    getItem: jest.fn(async () => raw),
    setItem: jest.fn(async () => {}),
    removeItem: jest.fn(async () => {}),
  };
  await expect(createFirstRunGuidanceStore(storage).load()).rejects.toThrow();
  expect(storage.getItem).toHaveBeenCalledWith(FIRST_RUN_GUIDANCE_KEY);
  expect(storage.setItem).not.toHaveBeenCalled();
});

test('a write followed by a verification read failure restores the exact prior preference', async () => {
  const original =
    '{ "version":1, "selectedTrack":"cet4", "learningGuideSeen":true }';
  let saved: string | null = original;
  let unreadable = false;
  const storage = {
    getItem: async () => {
      if (unreadable) {
        unreadable = false;
        throw new Error('read failed');
      }
      return saved;
    },
    setItem: async (_key: string, value: string) => {
      saved = value;
      if (value.includes('cet6')) unreadable = true;
    },
    removeItem: async () => {
      saved = null;
    },
  };
  await expect(
    createFirstRunGuidanceStore(storage).selectTrack('cet6'),
  ).rejects.toThrow('read failed');
  expect(saved).toBe(original);
});
