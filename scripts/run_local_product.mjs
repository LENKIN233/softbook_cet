#!/usr/bin/env node

import {spawn, spawnSync} from 'node:child_process';
import {mkdtempSync, readFileSync, rmSync, writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

import {
  canonicalJsonBytes,
  createMobileReleaseRuntimeProfile,
  validateMobileReleaseRuntimeProfile,
} from './lib/mobile_release_runtime_profile.mjs';
import {parseStrictJson} from './lib/strict_json.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MOBILE_ROOT = join(ROOT, 'apps/mobile');
const DELIVERY_PROFILE = join(
  ROOT,
  'infra/cloudbase/receiver/cet4-closed-beta.delivery-profile.json',
);
const PUBLIC_KEYRING = join(
  ROOT,
  'infra/cloudbase/receiver/content-manifest-public-keyring.json',
);

export function parseArguments(argv) {
  const options = {check: false, device: null, target: null};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--check') {
      options.check = true;
      continue;
    }
    if (argument === '--target' || argument === '--device') {
      const value = argv[index + 1];
      if (!value || value.startsWith('--')) {
        throw new Error(`${argument} requires a value.`);
      }
      options[argument.slice(2)] = value;
      index += 1;
      continue;
    }
    if (argument === '--help' || argument === '-h') {
      return {help: true};
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  if (!['android', 'ios', 'web'].includes(options.target)) {
    throw new Error('--target must be android, ios, or web.');
  }
  return options;
}

export function createLocalProductProfile({commitSha, outputPath}) {
  const deliveryProfileBytes = readFileSync(DELIVERY_PROFILE);
  const publicKeyringBytes = readFileSync(PUBLIC_KEYRING);
  const profile = createMobileReleaseRuntimeProfile({
    commitSha,
    deliveryProfile: parseStrictJson(
      deliveryProfileBytes,
      'receiver delivery profile',
    ),
    deliveryProfileBytes,
    publicKeyring: parseStrictJson(
      publicKeyringBytes,
      'content manifest public keyring',
    ),
    publicKeyringBytes,
  });
  writeFileSync(outputPath, canonicalJsonBytes(profile), {mode: 0o600});
  return validateMobileReleaseRuntimeProfile(profile, {
    expectedCommit: commitSha,
  });
}

export function createLocalProductEnvironment(profile, runtimeProfilePath) {
  const publicKeys = Object.fromEntries(
    profile.content_manifest_public_keys.map(item => [
      item.key_id,
      item.public_key_hex,
    ]),
  );
  return {
    SOFTBOOK_CET_CONTENT_MANIFEST_PUBLIC_KEYS: JSON.stringify(publicKeys),
    SOFTBOOK_CET_LEARNING_TRACK: profile.learning_track,
    SOFTBOOK_CET_REMOTE_BASE_URL: profile.api_base_url,
    SOFTBOOK_MOBILE_RELEASE_RUNTIME_PROFILE: runtimeProfilePath,
    SOFTBOOK_WEB_RELEASE_RUNTIME_PROFILE: runtimeProfilePath,
  };
}

export function createTargetPlan({device, env, target}) {
  if (target === 'web') {
    return [
      {args: ['--prefix', 'apps/web', 'run', 'build'], command: 'npm', cwd: ROOT},
      {
        args: [
          '--prefix',
          'apps/web',
          'run',
          'preview',
          '--',
          '--host',
          '127.0.0.1',
          '--port',
          '4173',
          '--strictPort',
        ],
        command: 'npm',
        cwd: ROOT,
        persistent: true,
      },
    ];
  }
  const metro = {
    args: ['start', '--', '--port', '8081'],
    command: 'npm',
    cwd: MOBILE_ROOT,
    persistent: true,
  };
  if (target === 'android') {
    return [
      metro,
      {
        args: ['run', 'android', '--', '--no-packager'],
        command: 'npm',
        cwd: MOBILE_ROOT,
      },
    ];
  }
  if (!device) {
    throw new Error('--device is required for the iOS local product target.');
  }
  const childEnv = Object.fromEntries(
    Object.entries(env).map(([key, value]) => [`SIMCTL_CHILD_${key}`, value]),
  );
  return [
    metro,
    {
      args: ['run', 'ios', '--', '--udid', device, '--mode', 'Debug', '--no-packager'],
      command: 'npm',
      cwd: MOBILE_ROOT,
    },
    {
      allowFailure: true,
      args: ['simctl', 'terminate', device, 'com.softbook.cet'],
      command: 'xcrun',
      cwd: ROOT,
    },
    {
      args: ['simctl', 'launch', device, 'com.softbook.cet'],
      command: 'xcrun',
      cwd: ROOT,
      env: childEnv,
    },
  ];
}

async function executePlan(plan, environment) {
  const persistent = [];
  const stop = () => {
    for (const child of persistent) child.kill('SIGTERM');
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    for (const step of plan) {
      if (step.persistent) {
        const child = spawn(step.command, step.args, {
          cwd: step.cwd,
          env: {...process.env, ...environment, ...step.env},
          stdio: 'inherit',
        });
        persistent.push(child);
        await waitForPersistentStart(step, child);
        continue;
      }
      const result = spawnSync(step.command, step.args, {
        cwd: step.cwd,
        env: {...process.env, ...environment, ...step.env},
        stdio: 'inherit',
      });
      if (result.status !== 0 && !step.allowFailure) {
        throw new Error(`${step.command} exited with status ${result.status}.`);
      }
    }
    if (persistent.length > 0) {
      await new Promise((resolvePromise, reject) => {
        persistent[0].once('exit', code => {
          if (code === 0 || code === null) resolvePromise();
          else reject(new Error(`Persistent local product process exited with ${code}.`));
        });
      });
    }
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
    stop();
  }
}

async function waitForPersistentStart(step, child) {
  if (step.command === 'npm' && step.args.includes('preview')) {
    await waitForHttp('http://127.0.0.1:4173/');
    return;
  }
  if (step.command === 'npm' && step.args.includes('start')) {
    await waitForHttp('http://127.0.0.1:8081/status');
    return;
  }
  await new Promise((resolvePromise, reject) => {
    const timer = setTimeout(resolvePromise, 500);
    child.once('exit', code => {
      clearTimeout(timer);
      reject(new Error(`Persistent process exited before startup with ${code}.`));
    });
  });
}

async function waitForHttp(url) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise(resolvePromise => setTimeout(resolvePromise, 250));
  }
  throw new Error(`Local product process did not become ready at ${url}.`);
}

function repositoryCommit() {
  const status = spawnSync(
    'git',
    ['status', '--porcelain', '--untracked-files=no'],
    {cwd: ROOT, encoding: 'utf8'},
  );
  if (status.status !== 0 || status.stdout.trim() !== '') {
    throw new Error(
      'Complete local product requires a clean tracked worktree so the runtime profile matches the executed commit.',
    );
  }
  const result = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  if (result.status !== 0 || !/^[0-9a-f]{40}\n?$/.test(result.stdout)) {
    throw new Error('Unable to resolve the exact repository commit.');
  }
  return result.stdout.trim();
}

function printUsage() {
  process.stdout.write(
    'Usage: node scripts/run_local_product.mjs --target <web|android|ios> [--device <simulator-udid>] [--check]\n',
  );
}

async function main() {
  let directory;
  try {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
      printUsage();
      return;
    }
    directory = mkdtempSync(join(tmpdir(), 'softbook-local-product-'));
    const runtimeProfilePath = join(directory, 'mobile-runtime-profile.json');
    const profile = createLocalProductProfile({
      commitSha: repositoryCommit(),
      outputPath: runtimeProfilePath,
    });
    const environment = createLocalProductEnvironment(
      profile,
      runtimeProfilePath,
    );
    const plan = createTargetPlan({
      device: options.device,
      env: environment,
      target: options.target,
    });
    if (options.check) {
      process.stdout.write(
        `${JSON.stringify({
          schema_version: 'local-product-plan.v1',
          target: options.target,
          profile_id: profile.profile_id,
          environment_id: profile.environment_id,
          content_key_ids: profile.content_manifest_public_keys.map(
            item => item.key_id,
          ),
          card_source: 'receiver_formal_content',
          purchase_mode: 'operator_entitlement_only',
          commands: plan.map(step => `${step.command} ${step.args.join(' ')}`),
        }, null, 2)}\n`,
      );
      return;
    }
    await executePlan(plan, environment);
  } finally {
    if (directory) rmSync(directory, {force: true, recursive: true});
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    process.stderr.write(`[local-product] ${error.message}\n`);
    process.exitCode = 1;
  });
}
