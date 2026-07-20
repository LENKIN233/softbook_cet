import type { LearningTrack } from '../learning/model';
import type { SoftbookAppRuntimeConfig } from '../learning/learningRuntimeConfig';

export type SoftbookRemoteRuntimeFeature =
  | 'accountBootstrap'
  | 'learningSource'
  | 'membership'
  | 'progressSync'
  | 'spaceState'
  | 'learningState';

export type SoftbookRemoteRuntimeProfile = {
  apiKey?: string;
  baseUrl: string;
  featureModes?: Partial<
    Record<SoftbookRemoteRuntimeFeature, 'local' | 'remote'>
  >;
  learningTrack?: LearningTrack;
};

export type SoftbookAppRuntimeConfigResolverOptions = {
  defaultConfig?: SoftbookAppRuntimeConfig;
  env?: Record<string, string | undefined>;
  remoteProfile?: SoftbookRemoteRuntimeProfile;
};

type SoftbookRuntimeGlobalThis = typeof globalThis & {
  __SOFTBOOK_CET_REMOTE_RUNTIME_PROFILE__?: SoftbookRemoteRuntimeProfile;
  process?: {
    env?: Record<string, string | undefined>;
  };
};

// This tracked default keeps local learning as the safe baseline for development.
export const SOFTBOOK_APP_RUNTIME_CONFIG: SoftbookAppRuntimeConfig = {
  accountBootstrap: {
    mode: 'local',
  },
  auth: {
    mode: 'local',
  },
  learningTrack: 'cet4',
  learningSource: {
    mode: 'local',
  },
  membership: {
    mode: 'local',
  },
  progressSync: {
    mode: 'local',
  },
  spaceState: {
    mode: 'local',
  },
  learningState: {
    mode: 'local',
  },
};

export function resolveSoftbookAppRuntimeConfig(
  options: SoftbookAppRuntimeConfigResolverOptions = {},
): SoftbookAppRuntimeConfig {
  const remoteProfile =
    options.remoteProfile ??
    readInjectedRemoteRuntimeProfile() ??
    readRemoteRuntimeProfileFromEnv(options.env ?? readGlobalEnv());

  if (remoteProfile) {
    return createSoftbookRemoteRuntimeConfig(remoteProfile);
  }

  return options.defaultConfig ?? SOFTBOOK_APP_RUNTIME_CONFIG;
}

export function createSoftbookRemoteRuntimeConfig(
  profile: SoftbookRemoteRuntimeProfile,
): SoftbookAppRuntimeConfig {
  const baseUrl = normalizeRemoteBaseUrl(profile.baseUrl);
  const remote = {
    baseUrl,
    ...(profile.apiKey ? { apiKey: profile.apiKey } : {}),
  };
  const learningTrack = profile.learningTrack ?? 'cet4';
  const accountBootstrapMode = resolveFeatureMode(profile, 'accountBootstrap');
  const learningSourceMode = resolveFeatureMode(profile, 'learningSource');

  if (accountBootstrapMode === 'remote' && learningSourceMode === 'local') {
    throw new Error(
      'Remote account bootstrap requires learningSource to also be remote.',
    );
  }

  return {
    accountBootstrap:
      accountBootstrapMode === 'remote'
        ? {
            mode: 'remote',
            remote,
          }
        : {
            mode: 'local',
          },
    auth: {
      mode: 'remote',
      remote,
    },
    learningTrack,
    learningSource:
      learningSourceMode === 'remote'
        ? {
            mode: 'remote',
            remote,
            track: learningTrack,
          }
        : {
            mode: 'local',
            track: learningTrack,
          },
    membership:
      resolveFeatureMode(profile, 'membership') === 'remote'
        ? {
            mode: 'remote',
            remote,
          }
        : {
            mode: 'local',
          },
    progressSync:
      resolveFeatureMode(profile, 'progressSync') === 'remote'
        ? {
            mode: 'remote',
            remote,
          }
        : {
            mode: 'local',
          },
    spaceState:
      resolveFeatureMode(profile, 'spaceState') === 'remote'
        ? {
            mode: 'remote',
            remote,
          }
        : {
            mode: 'local',
          },
    learningState:
      resolveFeatureMode(profile, 'learningState') === 'remote'
        ? {
            mode: 'remote',
            remote,
          }
        : {
            mode: 'local',
          },
  };
}

export function readRemoteRuntimeProfileFromEnv(
  env: Record<string, string | undefined> | undefined,
): SoftbookRemoteRuntimeProfile | null {
  const baseUrl = env?.SOFTBOOK_CET_REMOTE_BASE_URL;

  if (baseUrl === undefined) {
    return null;
  }

  const localFeatures = parseRuntimeFeatureList(
    env?.SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES,
  );
  const learningTrack = parseLearningTrack(env?.SOFTBOOK_CET_LEARNING_TRACK);

  return {
    baseUrl,
    ...(env?.SOFTBOOK_CET_REMOTE_API_KEY
      ? { apiKey: env.SOFTBOOK_CET_REMOTE_API_KEY }
      : {}),
    ...(localFeatures.length > 0
      ? { featureModes: createLocalFeatureModes(localFeatures) }
      : {}),
    ...(learningTrack ? { learningTrack } : {}),
  };
}

function resolveFeatureMode(
  profile: SoftbookRemoteRuntimeProfile,
  feature: SoftbookRemoteRuntimeFeature,
) {
  return profile.featureModes?.[feature] ?? 'remote';
}

function normalizeRemoteBaseUrl(value: string) {
  const normalizedValue = value.trim().replace(/\/+$/, '');

  if (normalizedValue.length === 0) {
    throw new Error('Remote runtime profile requires baseUrl.');
  }

  return normalizedValue;
}

function readInjectedRemoteRuntimeProfile() {
  return (globalThis as SoftbookRuntimeGlobalThis)
    .__SOFTBOOK_CET_REMOTE_RUNTIME_PROFILE__;
}

function readGlobalEnv() {
  return (globalThis as SoftbookRuntimeGlobalThis).process?.env;
}

function parseLearningTrack(value: string | undefined): LearningTrack | null {
  if (value === undefined || value.trim().length === 0) {
    return null;
  }

  if (value === 'cet4' || value === 'cet6') {
    return value;
  }

  throw new Error('SOFTBOOK_CET_LEARNING_TRACK must be cet4 or cet6.');
}

function parseRuntimeFeatureList(
  value: string | undefined,
): SoftbookRemoteRuntimeFeature[] {
  if (value === undefined || value.trim().length === 0) {
    return [];
  }

  return value
    .split(',')
    .map(feature => feature.trim())
    .filter(feature => feature.length > 0)
    .map(feature => {
      if (isSoftbookRemoteRuntimeFeature(feature)) {
        return feature;
      }

      throw new Error(
        `Unknown SOFTBOOK_CET_LOCAL_RUNTIME_FEATURES value: ${feature}.`,
      );
    });
}

function createLocalFeatureModes(features: SoftbookRemoteRuntimeFeature[]) {
  const featureModes: SoftbookRemoteRuntimeProfile['featureModes'] = {};

  features.forEach(feature => {
    featureModes[feature] = 'local';
  });

  return featureModes;
}

function isSoftbookRemoteRuntimeFeature(
  value: string,
): value is SoftbookRemoteRuntimeFeature {
  return (
    value === 'accountBootstrap' ||
    value === 'learningSource' ||
    value === 'membership' ||
    value === 'progressSync' ||
    value === 'spaceState' ||
    value === 'learningState'
  );
}
