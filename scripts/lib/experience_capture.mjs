import {join} from 'node:path';

// Cold driver installation, app cleanup and development login must not spend the reading budget.
// Always prepare, including when a previous invocation used this device.
export function captureExperience({device, output, run, wrongOptionIndex = 1}) {
  run('maestro', ['--device', device, 'test', '--test-output-dir', join(output, 'preparation'),
    'apps/mobile/e2e/experience/prepare.yaml'], 'preparation.log', 420000);
  run('maestro', ['--device', device, 'test', '--no-reinstall-driver', '-e', `WRONG_OPTION_INDEX=${wrongOptionIndex}`,
    '--test-output-dir', join(output, 'capture'),
    'apps/mobile/e2e/experience/reading.yaml'], 'maestro.log', 240000);
}
