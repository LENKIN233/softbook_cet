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

export type AuthRuntimeConfig = {
  mode?: 'local' | 'remote';
  remote?: {
    apiKey?: string;
    baseUrl: string;
  };
};

export type MembershipRuntimeConfig = {
  mode?: 'local' | 'remote';
  remote?: {
    apiKey?: string;
    baseUrl: string;
  };
};

export type ProgressSyncRuntimeConfig = {
  mode?: 'local' | 'remote';
  remote?: {
    apiKey?: string;
    baseUrl: string;
  };
};

export type SoftbookAppRuntimeConfig = {
  auth?: AuthRuntimeConfig;
  learningSource?: LearningSourceRuntimeConfig;
  membership?: MembershipRuntimeConfig;
  progressSync?: ProgressSyncRuntimeConfig;
};

type RemoteRuntimeFeature = 'learningSource' | 'membership' | 'progressSync';

type SoftbookGlobalThis = typeof globalThis & {
  __SOFTBOOK_CET_RUNTIME_CONFIG__?: SoftbookAppRuntimeConfig;
};

function resolveRuntimeMode(
  mode: 'local' | 'remote' | undefined,
): 'local' | 'remote' {
  return mode ?? 'local';
}

export function assertRemoteRuntimeUsesRemoteAuth(
  runtimeConfig: SoftbookAppRuntimeConfig | undefined,
  feature: RemoteRuntimeFeature,
) {
  const authMode = resolveRuntimeMode(runtimeConfig?.auth?.mode);
  const featureMode = resolveRuntimeMode(runtimeConfig?.[feature]?.mode);

  if (featureMode !== 'remote' || authMode === 'remote') {
    return;
  }

  const labelByFeature: Record<RemoteRuntimeFeature, string> = {
    learningSource: 'Remote learning source mode',
    membership: 'Remote membership mode',
    progressSync: 'Remote progress sync mode',
  };

  throw new Error(
    `${labelByFeature[feature]} requires auth.mode to also be remote.`,
  );
}

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
    assertRemoteRuntimeUsesRemoteAuth(runtimeConfig, 'learningSource');

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
