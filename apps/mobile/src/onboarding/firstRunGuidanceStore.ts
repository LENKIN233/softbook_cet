import AsyncStorage from '@react-native-async-storage/async-storage';
import type { LearningTrack } from '../learning/model';

export const FIRST_RUN_GUIDANCE_KEY = 'softbook-cet/first-run-guidance/v1';
export class InvalidFirstRunGuidanceError extends Error {}
export type FirstRunGuidanceRecord = {
  version: 1;
  selectedTrack: LearningTrack;
  learningGuideSeen: boolean;
};
type Storage = Pick<typeof AsyncStorage, 'getItem' | 'setItem' | 'removeItem'>;
const tails = new WeakMap<Storage, Promise<unknown>>();

export function createFirstRunGuidanceStore(storage: Storage = AsyncStorage) {
  const exclusive = <T>(work: () => Promise<T>): Promise<T> => {
    const result = (tails.get(storage) ?? Promise.resolve())
      .catch(() => undefined)
      .then(work);
    tails.set(storage, result);
    return result;
  };
  const read = async (): Promise<FirstRunGuidanceRecord | null> => {
    const raw = await storage.getItem(FIRST_RUN_GUIDANCE_KEY);
    if (raw === null) return null;
    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      throw new InvalidFirstRunGuidanceError('Invalid first-run preferences.');
    }
    if (typeof value !== 'object' || value === null || Array.isArray(value))
      throw new InvalidFirstRunGuidanceError('Invalid first-run preferences.');
    const record = value as Partial<FirstRunGuidanceRecord>;
    if (
      record.version !== 1 ||
      !['cet4', 'cet6'].includes(record.selectedTrack ?? '') ||
      typeof record.learningGuideSeen !== 'boolean'
    )
      throw new InvalidFirstRunGuidanceError('Invalid first-run preferences.');
    return record as FirstRunGuidanceRecord;
  };
  const write = async (record: FirstRunGuidanceRecord) => {
    const previousRaw = await storage.getItem(FIRST_RUN_GUIDANCE_KEY);
    const raw = JSON.stringify(record);
    try {
      await storage.setItem(FIRST_RUN_GUIDANCE_KEY, raw);
      if ((await storage.getItem(FIRST_RUN_GUIDANCE_KEY)) !== raw)
        throw new Error('First-run preferences were not saved.');
      return record;
    } catch (error) {
      // The write may have reached disk before verification failed. Restore
      // exactly the prior preference; account and learning data are untouched.
      try {
        if (previousRaw === null)
          await storage.removeItem(FIRST_RUN_GUIDANCE_KEY);
        else await storage.setItem(FIRST_RUN_GUIDANCE_KEY, previousRaw);
        if ((await storage.getItem(FIRST_RUN_GUIDANCE_KEY)) !== previousRaw)
          throw new Error('Preference rollback was not verified.');
      } catch {
        /* The original failure keeps the modal or settings recovery visible. */
      }
      throw error;
    }
  };
  return {
    load: () => exclusive(read),
    selectTrack: (selectedTrack: LearningTrack) =>
      exclusive(async () => {
        let previous: FirstRunGuidanceRecord | null;
        try {
          previous = await read();
        } catch (error) {
          if (!(error instanceof InvalidFirstRunGuidanceError)) throw error;
          previous = null;
        }
        return write({
          version: 1,
          selectedTrack,
          learningGuideSeen: previous?.learningGuideSeen ?? false,
        });
      }),
    markLearningGuideSeen: () =>
      exclusive(async () => {
        const previous = await read();
        if (previous === null)
          throw new Error('Choose a subject before learning.');
        return write({ ...previous, learningGuideSeen: true });
      }),
  };
}
