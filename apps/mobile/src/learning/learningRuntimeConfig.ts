import type {
  LearningRepositoryMode,
  LearningSessionRepositoryConfig,
} from './learningRepository';
import { createSoftbookRemoteLearningCardSourceConfig } from './remoteCardSource';

export type LearningRemoteRuntimeConfig = {
  apiKey?: string;
  baseUrl: string;
};

export type LearningSourceRuntimeConfig = {
  mode?: LearningRepositoryMode;
  remote?: LearningRemoteRuntimeConfig;
};

export type SoftbookAppRuntimeConfig = {
  learningSource?: LearningSourceRuntimeConfig;
};

type SoftbookGlobalThis = typeof globalThis & {
  __SOFTBOOK_CET_RUNTIME_CONFIG__?: SoftbookAppRuntimeConfig;
};

export function readSoftbookAppRuntimeConfig():
  | SoftbookAppRuntimeConfig
  | undefined {
  return (globalThis as SoftbookGlobalThis).__SOFTBOOK_CET_RUNTIME_CONFIG__;
}

export function resolveLearningSessionRepositoryConfig(
  runtimeConfig: SoftbookAppRuntimeConfig | undefined =
    readSoftbookAppRuntimeConfig(),
): LearningSessionRepositoryConfig {
  const learningSource = runtimeConfig?.learningSource;
  const mode = learningSource?.mode ?? 'local';

  if (mode === 'remote') {
    if (!learningSource?.remote?.baseUrl) {
      throw new Error(
        'Remote learning source mode requires learningSource.remote.baseUrl.',
      );
    }

    return {
      mode: 'remote',
      remoteConfig: createSoftbookRemoteLearningCardSourceConfig(
        learningSource.remote,
      ),
    };
  }

  return {
    mode: 'local',
  };
}
