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
};

export function createSoftbookRemoteRuntimeConfig(
  profile: SoftbookRemoteRuntimeProfile,
): SoftbookAppRuntimeConfig {
  const baseUrl = normalizeRemoteBaseUrl(profile.baseUrl);
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
