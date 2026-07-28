import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  IosSimulatorResolutionError,
  parseArguments,
  parseSimulatorSelector,
  resolveIosSimulator,
} from './resolve-ios-simulator.mjs';

const INVENTORY = {
  devices: {
    'com.apple.CoreSimulator.SimRuntime.iOS-26-4': [
      {
        isAvailable: true,
        name: 'iPhone 17',
        state: 'Shutdown',
        udid: 'IOS-26-4-SHUTDOWN',
      },
    ],
    'com.apple.CoreSimulator.SimRuntime.iOS-26-5': [
      {
        isAvailable: true,
        name: 'iPhone 17',
        state: 'Booted',
        udid: 'IOS-26-5-BOOTED',
      },
      {
        isAvailable: true,
        name: 'iPhone 17 Pro',
        state: 'Shutdown',
        udid: 'IOS-26-5-PRO',
      },
    ],
    'com.apple.CoreSimulator.SimRuntime.tvOS-26-5': [
      {
        isAvailable: true,
        name: 'Apple TV',
        state: 'Booted',
        udid: 'TVOS-BOOTED',
      },
    ],
  },
};
const HELPER_PATH = fileURLToPath(
  new URL('./resolve-ios-simulator.mjs', import.meta.url),
);
const WRAPPER_ENV = {
  HOME: process.env.HOME ?? '',
  PATH: process.env.PATH ?? '',
  SOFTBOOK_CET_REMOTE_BASE_URL: 'http://127.0.0.1:9',
};

function runWrapper(scriptName, environment) {
  return spawnSync(
    'bash',
    [fileURLToPath(new URL(scriptName, import.meta.url))],
    {
      encoding: 'utf8',
      env: { ...WRAPPER_ENV, ...environment },
    },
  );
}

test('an exact UDID is authoritative over a stale simulator selector', () => {
  assert.equal(
    resolveIosSimulator(INVENTORY, {
      device: 'IOS-26-5-PRO',
      simulator: 'Missing Device (99.0)',
    }).udid,
    'IOS-26-5-PRO',
  );
});

test('the sole booted iOS device is selected', () => {
  assert.deepEqual(
    resolveIosSimulator(INVENTORY, {
      device: 'booted',
      simulator: 'iPhone 17 (26.4)',
    }),
    {
      name: 'iPhone 17',
      runtime: 'com.apple.CoreSimulator.SimRuntime.iOS-26-5',
      runtime_version: '26.5',
      state: 'Booted',
      udid: 'IOS-26-5-BOOTED',
    },
  );
});

test('a versioned selector resolves a shutdown simulator when none is booted', () => {
  const inventory = structuredClone(INVENTORY);
  inventory.devices['com.apple.CoreSimulator.SimRuntime.iOS-26-5'][0].state =
    'Shutdown';

  assert.equal(
    resolveIosSimulator(inventory, {
      device: 'booted',
      simulator: 'iPhone 17 (26.4)',
    }).udid,
    'IOS-26-4-SHUTDOWN',
  );
});

test('an unversioned ambiguous selector fails closed', () => {
  const inventory = structuredClone(INVENTORY);
  inventory.devices['com.apple.CoreSimulator.SimRuntime.iOS-26-5'][0].state =
    'Shutdown';

  assert.throws(
    () =>
      resolveIosSimulator(inventory, {
        device: 'booted',
        simulator: 'iPhone 17',
      }),
    IosSimulatorResolutionError,
  );
});

test('multiple booted iOS devices require one matching selector', () => {
  const inventory = structuredClone(INVENTORY);
  inventory.devices['com.apple.CoreSimulator.SimRuntime.iOS-26-5'][1].state =
    'Booted';

  assert.equal(
    resolveIosSimulator(inventory, {
      device: 'booted',
      simulator: 'iPhone 17 Pro (26.5)',
    }).udid,
    'IOS-26-5-PRO',
  );
  assert.throws(
    () =>
      resolveIosSimulator(inventory, {
        device: 'booted',
        simulator: 'iPhone 17 Pro (26.4)',
      }),
    /matched 0 booted devices/,
  );
});

test('missing and unavailable explicit devices fail closed', () => {
  assert.throws(
    () => resolveIosSimulator(INVENTORY, { device: 'MISSING' }),
    /does not identify one available/,
  );

  const inventory = structuredClone(INVENTORY);
  inventory.devices[
    'com.apple.CoreSimulator.SimRuntime.iOS-26-5'
  ][0].isAvailable = false;
  assert.throws(
    () => resolveIosSimulator(inventory, { device: 'IOS-26-5-BOOTED' }),
    /does not identify one available/,
  );
});

test('selector and argument parsing reject malformed input', () => {
  assert.deepEqual(parseSimulatorSelector('iPhone 17 (26.5)'), {
    name: 'iPhone 17',
    version: '26.5',
  });
  assert.throws(() => parseSimulatorSelector(' '), /must not be blank/);
  assert.throws(() => parseArguments(['--unknown']), /Unknown argument/);
  assert.throws(() => parseArguments(['--format', 'xml']), /json or tsv/);
});

test('the CLI emits TSV and uses exit code 2 for invalid arguments', () => {
  const directory = mkdtempSync(join(tmpdir(), 'softbook-ios-target-'));
  const inventoryPath = join(directory, 'inventory.json');

  try {
    writeFileSync(inventoryPath, JSON.stringify(INVENTORY), 'utf8');
    const success = spawnSync(
      process.execPath,
      [
        HELPER_PATH,
        '--inventory',
        inventoryPath,
        '--device',
        'IOS-26-5-PRO',
        '--format',
        'tsv',
      ],
      { encoding: 'utf8' },
    );
    const invalid = spawnSync(process.execPath, [HELPER_PATH, '--unknown'], {
      encoding: 'utf8',
    });

    assert.equal(success.status, 0, success.stderr);
    assert.equal(
      success.stdout,
      'IOS-26-5-PRO\tShutdown\tiPhone 17 Pro\t26.5\n',
    );
    assert.equal(invalid.status, 2);
    assert.match(invalid.stderr, /Unknown argument/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test('the iOS runtime wrappers have valid Bash syntax', () => {
  for (const scriptName of [
    'smoke-ios-runtime.sh',
    'smoke-ios-maestro-runtime.sh',
  ]) {
    const scriptPath = fileURLToPath(new URL(scriptName, import.meta.url));
    const result = spawnSync('bash', ['-n', scriptPath], { encoding: 'utf8' });

    assert.equal(result.status, 0, `${scriptName}: ${result.stderr}`);
  }
});

test('invalid launch configuration exits before device or remote commands', () => {
  const invalidLaunch = runWrapper('smoke-ios-runtime.sh', {
    SOFTBOOK_CET_IOS_LAUNCH: 'yes',
  });
  const blankBundle = runWrapper('smoke-ios-runtime.sh', {
    SOFTBOOK_CET_IOS_BUNDLE_ID: ' ',
    SOFTBOOK_CET_IOS_LAUNCH: '1',
    SOFTBOOK_CET_MANUAL_TEST_PHONE: '19123456789',
  });

  assert.equal(invalidLaunch.status, 1);
  assert.match(invalidLaunch.stderr, /IOS_LAUNCH must be 0 or 1/);
  assert.equal(blankBundle.status, 1);
  assert.match(blankBundle.stderr, /IOS_BUNDLE_ID must not be blank/);
  assert.doesNotMatch(invalidLaunch.stdout, /remote smoke|iOS target/);
  assert.doesNotMatch(blankBundle.stdout, /remote smoke|iOS target/);
});

test('a missing Maestro flow exits before target resolution or remote smoke', () => {
  const result = runWrapper('smoke-ios-maestro-runtime.sh', {
    JAVA_HOME: '/missing-java',
    SOFTBOOK_CET_IOS_MAESTRO_FLOW: '/missing-flow.yaml',
    SOFTBOOK_CET_MANUAL_TEST_PHONE: '19123456789',
  });

  assert.equal(result.status, 1);
  assert.match(result.stderr, /MAESTRO_FLOW must identify an existing file/);
  assert.doesNotMatch(result.stdout, /Maestro target|remote smoke/);
});

test('the launch script resolves and builds before any remote write smoke', () => {
  const script = readFileSync(
    new URL('./smoke-ios-runtime.sh', import.meta.url),
    'utf8',
  );
  const resolveIndex = script.indexOf('\n  resolve_ios_launch_target\n');
  const runtimeTestIndex = script.indexOf('npm test -- --runInBand');
  const buildIndex = script.indexOf('npm run ios -- --udid');
  const installedAppIndex = script.indexOf('xcrun simctl get_app_container');
  const smokeIndex = script.indexOf(
    'node "${ROOT_DIR}/infra/cloudbase/smoke-softbook-api.mjs"',
  );
  const launchIndex = script.indexOf(
    'xcrun simctl launch --terminate-running-process',
  );

  assert.ok(resolveIndex >= 0);
  assert.ok(runtimeTestIndex > resolveIndex);
  assert.ok(buildIndex > runtimeTestIndex);
  assert.ok(installedAppIndex > buildIndex);
  assert.ok(smokeIndex > installedAppIndex);
  assert.ok(launchIndex > smokeIndex);
  assert.doesNotMatch(script, /npm run ios -- --simulator/);
  assert.match(script, /npm run ios -- --udid .* --verbose/);
  assert.match(script, /cleanup "\$\{exit_code\}"/);
});

test('manual acceptance inputs fail before the remote write smoke', () => {
  const script = readFileSync(
    new URL('./smoke-ios-runtime.sh', import.meta.url),
    'utf8',
  );
  const prepareIndex = script.indexOf('\n  prepare_ios_acceptance_inputs\n');
  const resolveIndex = script.indexOf('\n  resolve_ios_launch_target\n');
  const smokeIndex = script.indexOf(
    'node "${ROOT_DIR}/infra/cloudbase/smoke-softbook-api.mjs"',
  );

  assert.ok(prepareIndex >= 0);
  assert.ok(resolveIndex > prepareIndex);
  assert.ok(smokeIndex > resolveIndex);
  assert.match(script, /SOFTBOOK_CET_IOS_LAUNCH must be 0 or 1/);
  assert.match(script, /SOFTBOOK_CET_IOS_BUNDLE_ID must not be blank/);
});

test('the Maestro wrapper pins every device operation to the resolved UDID', () => {
  const script = readFileSync(
    new URL('./smoke-ios-maestro-runtime.sh', import.meta.url),
    'utf8',
  );
  const resolveIndex = script.indexOf('\nresolve_ios_target\n');
  const uninstallIndex = script.indexOf(
    'xcrun simctl uninstall "${RESOLVED_IOS_DEVICE}"',
  );
  const launchIndex = script.indexOf(
    'SOFTBOOK_CET_IOS_DEVICE="${RESOLVED_IOS_DEVICE}"',
  );
  const maestroIndex = script.indexOf('--udid "${RESOLVED_IOS_DEVICE}"');
  const flowPreflightIndex = script.indexOf('if [[ ! -f "${MAESTRO_FLOW}" ]]');
  const targetIndex = script.indexOf('\nresolve_ios_target\n');

  assert.ok(resolveIndex >= 0);
  assert.ok(flowPreflightIndex >= 0);
  assert.ok(targetIndex > flowPreflightIndex);
  assert.ok(uninstallIndex > resolveIndex);
  assert.ok(launchIndex > uninstallIndex);
  assert.ok(maestroIndex > launchIndex);
  assert.doesNotMatch(script, /simctl uninstall "\$\{IOS_DEVICE\}"/);
  assert.match(script, /JAVA_HOME must identify a Java runtime for Maestro/);
  assert.match(script, /maestro must be installed and available on PATH/);
});
