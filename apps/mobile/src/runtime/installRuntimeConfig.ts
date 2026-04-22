import type { SoftbookAppRuntimeConfig } from '../learning/learningRuntimeConfig';

type SoftbookGlobalThis = typeof globalThis & {
  __SOFTBOOK_CET_RUNTIME_CONFIG__?: SoftbookAppRuntimeConfig;
};

export function installSoftbookAppRuntimeConfig(
  runtimeConfig: SoftbookAppRuntimeConfig,
): SoftbookAppRuntimeConfig {
  (globalThis as SoftbookGlobalThis).__SOFTBOOK_CET_RUNTIME_CONFIG__ =
    runtimeConfig;

  return runtimeConfig;
}
