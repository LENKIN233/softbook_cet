import type { LearningTrack } from '../learning/model';
import type { SoftbookAppRuntimeConfig } from '../learning/learningRuntimeConfig';

export type SoftbookRemoteRuntimeFeature =
  | 'learningSource'
  | 'membership'
  | 'progressSync'
  | 'spaceState'
  | 'learningState';

export type SoftbookRemoteRuntimeProfile = {
  apiKey?: string;
  baseUrl: string;
  featureModes?: Partial<Record<SoftbookRemoteRuntimeFeature, 'local' | 'remote'>>;
  learningTrack?: LearningTrack;
  releaseChannel?: 'development' | 'production';
};

export type SoftbookAppRuntimeConfigResolverOptions = {
  defaultConfig?: SoftbookAppRuntimeConfig;
  env?: Record<string, string | undefined>;
  releaseChannel?: 'development' | 'production';
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
  releaseChannel: 'development',
};

export function resolveSoftbookAppRuntimeConfig(
  options: SoftbookAppRuntimeConfigResolverOptions = {},
): SoftbookAppRuntimeConfig {
  const releaseChannel = options.releaseChannel ?? 'development';
  const remoteProfile =
    options.remoteProfile ??
    readInjectedRemoteRuntimeProfile() ??
    readRemoteRuntimeProfileFromEnv(options.env ?? readGlobalEnv());

  if (remoteProfile) {
    return createSoftbookRemoteRuntimeConfig({
      ...remoteProfile,
      releaseChannel: remoteProfile.releaseChannel ?? releaseChannel,
    });
  }

  const defaultConfig = options.defaultConfig ?? SOFTBOOK_APP_RUNTIME_CONFIG;
  if (releaseChannel === 'production') {
    throw new Error(
      'Production release requires an injected remote runtime profile.',
    );
  }

  return defaultConfig;
}

export function createSoftbookRemoteRuntimeConfig(
  profile: SoftbookRemoteRuntimeProfile,
): SoftbookAppRuntimeConfig {
  const baseUrl = normalizeRemoteBaseUrl(profile.baseUrl);
  const releaseChannel = profile.releaseChannel ?? 'development';
  assertRemoteProfileAllowedForRelease(profile, baseUrl, releaseChannel);
  const remote = {
    baseUrl,
    ...(profile.apiKey ? {apiKey: profile.apiKey} : {}),
  };
  const learningTrack = profile.learningTrack ?? 'cet4';

  return {
    auth: {
      mode: 'remote',
      remote,
    },
    learningTrack,
    learningSource:
      resolveFeatureMode(profile, 'learningSource') === 'remote'
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
    releaseChannel,
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
  const releaseChannel = parseReleaseChannel(
    env?.SOFTBOOK_CET_RELEASE_CHANNEL,
  );

  return {
    baseUrl,
    ...(env?.SOFTBOOK_CET_REMOTE_API_KEY
      ? {apiKey: env.SOFTBOOK_CET_REMOTE_API_KEY}
      : {}),
    ...(localFeatures.length > 0
      ? {featureModes: createLocalFeatureModes(localFeatures)}
      : {}),
    ...(learningTrack ? {learningTrack} : {}),
    ...(releaseChannel ? {releaseChannel} : {}),
  };
}

function assertRemoteProfileAllowedForRelease(
  profile: SoftbookRemoteRuntimeProfile,
  baseUrl: string,
  releaseChannel: 'development' | 'production',
) {
  if (releaseChannel !== 'production') {
    return;
  }

  if (!baseUrl.startsWith('https://')) {
    throw new Error('Production remote runtime baseUrl must use HTTPS.');
  }

  const localFeatures = Object.entries(profile.featureModes ?? {})
    .filter(([, mode]) => mode === 'local')
    .map(([feature]) => feature);
  if (localFeatures.length > 0) {
    throw new Error(
      `Production remote runtime cannot enable local features: ${localFeatures.join(', ')}.`,
    );
  }
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

function parseReleaseChannel(
  value: string | undefined,
): 'development' | 'production' | null {
  if (value === undefined || value.trim().length === 0) {
    return null;
  }
  if (value === 'development' || value === 'production') {
    return value;
  }
  throw new Error(
    'SOFTBOOK_CET_RELEASE_CHANNEL must be development or production.',
  );
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
    value === 'learningSource' ||
    value === 'membership' ||
    value === 'progressSync' ||
    value === 'spaceState' ||
    value === 'learningState'
  );
}
