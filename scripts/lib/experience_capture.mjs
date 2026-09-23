import {join} from 'node:path';

// Use one bounded session. A second Maestro process can strand the hosted iOS
// XCTest driver after preparation even when the first process reached the card.
export function captureExperience({device, output, run, wrongOptionIndex = 1}) {
  run('maestro', ['--device', device, 'test', '-e', `WRONG_OPTION_INDEX=${wrongOptionIndex}`,
    '--test-output-dir', join(output, 'capture'),
    'apps/mobile/e2e/experience/reading.yaml'], 'maestro.log', 660000);
}
