import type {LearningTrack} from '../../mobile/src/learning/model';

export const FIRST_RUN_GUIDANCE_KEY = 'softbook-cet/first-run-guidance/v1';

export type FirstRunGuidanceRecord = {
  version: 1;
  selectedTrack: LearningTrack;
  learningGuideSeen: boolean;
};

export class FirstRunGuidanceRecordError extends Error {}

export function readFirstRunGuidance(): FirstRunGuidanceRecord | null {
  const raw = window.localStorage.getItem(FIRST_RUN_GUIDANCE_KEY);
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) throw new FirstRunGuidanceRecordError('Invalid saved selection.');
    const record = value as Record<string, unknown>;
    if (record.version !== 1 ||
        (record.selectedTrack !== 'cet4' && record.selectedTrack !== 'cet6') ||
        typeof record.learningGuideSeen !== 'boolean') throw new FirstRunGuidanceRecordError('Invalid saved selection.');
    return {version: 1, selectedTrack: record.selectedTrack, learningGuideSeen: record.learningGuideSeen};
  } catch {
    throw new FirstRunGuidanceRecordError('Invalid saved selection.');
  }
}

export function writeFirstRunGuidance(record: FirstRunGuidanceRecord): void {
  const previous = window.localStorage.getItem(FIRST_RUN_GUIDANCE_KEY);
  const raw = JSON.stringify(record);
  try {
    window.localStorage.setItem(FIRST_RUN_GUIDANCE_KEY, raw);
    if (window.localStorage.getItem(FIRST_RUN_GUIDANCE_KEY) !== raw) throw new Error('First-run preference was not retained.');
  } catch (error) {
    try {
      if (previous === null) window.localStorage.removeItem(FIRST_RUN_GUIDANCE_KEY);
      else window.localStorage.setItem(FIRST_RUN_GUIDANCE_KEY, previous);
    } catch { /* Keep the failure visible when browser storage remains unavailable. */ }
    throw error;
  }
}
