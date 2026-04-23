import type { SoftbookAppRuntimeConfig } from '../learning/learningRuntimeConfig';

// This tracked default keeps local learning as the safe baseline for development.
export const SOFTBOOK_APP_RUNTIME_CONFIG: SoftbookAppRuntimeConfig = {
  auth: {
    mode: 'local',
  },
  learningSource: {
    mode: 'local',
  },
  membership: {
    mode: 'local',
  },
  progressSync: {
    mode: 'local',
  },
};
