import type { SoftbookAppRuntimeConfig } from '../learning/learningRuntimeConfig';

// This tracked default keeps local learning as the safe baseline for development.
export const SOFTBOOK_APP_RUNTIME_CONFIG: SoftbookAppRuntimeConfig = {
  learningSource: {
    mode: 'local',
  },
};
