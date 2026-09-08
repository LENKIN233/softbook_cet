import {join} from 'node:path';

// Cold driver installation and app cleanup must not spend the reading budget.
// Always prepare, including when a previous invocation used this device.
export function captureExperience({device, output, run}) {
  run('maestro', ['--device', device, 'test', '--test-output-dir', join(output, 'preparation'),
    'apps/mobile/e2e/experience/prepare.yaml'], 'preparation.log', 300000);
  run('maestro', ['--device', device, 'test', '--no-reinstall-driver',
    '--test-output-dir', join(output, 'capture'),
    'apps/mobile/e2e/experience/reading.yaml'], 'maestro.log', 240000);
}
