import React, { useState } from 'react';
import type { FirstRunGuidance } from '../../src/onboarding/FirstRunGuidance';
import {
  createFirstRunGuidanceStore,
  type FirstRunGuidanceRecord,
} from '../../src/onboarding/firstRunGuidanceStore';
import {
  readSoftbookAppRuntimeConfig,
  resolveLearningTrack,
} from '../../src/learning/learningRuntimeConfig';

// Auth, sync and learning regressions begin after the separately tested first-run
// flow. Keep real preference writes in the settings track-switch path.
export function CompletedFirstRunGuidance({
  children,
}: {
  children: (guidance: FirstRunGuidance) => React.ReactNode;
}) {
  const [record, setRecord] = useState<FirstRunGuidanceRecord>({
    version: 1,
    selectedTrack: resolveLearningTrack(readSoftbookAppRuntimeConfig()),
    learningGuideSeen: true,
  });
  const store = createFirstRunGuidanceStore();
  return (
    <>
      {children({
        record,
        selectTrack: async track => {
          setRecord(await store.selectTrack(track));
        },
        markLearningGuideSeen: async () => {
          setRecord(await store.markLearningGuideSeen());
        },
      })}
    </>
  );
}
