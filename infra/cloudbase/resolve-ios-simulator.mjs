#!/usr/bin/env node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export class IosSimulatorResolutionError extends Error {}

export function parseSimulatorSelector(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new IosSimulatorResolutionError(
      'Simulator selector must not be blank.',
    );
  }

  const match = value.trim().match(/^(.*?)(?:\s+\((\d+(?:\.\d+)*)\))?$/);
  const name = match?.[1]?.trim();

  if (!name) {
    throw new IosSimulatorResolutionError(
      `Invalid simulator selector: ${value}`,
    );
  }

  return { name, version: match[2] ?? null };
}

export function resolveIosSimulator(
  inventory,
  { device = 'booted', simulator = 'iPhone 17' } = {},
) {
  const devices = flattenIosDevices(inventory);

  if (devices.length === 0) {
    throw new IosSimulatorResolutionError(
      'No available iOS Simulator devices are installed.',
    );
  }

  if (device !== 'booted') {
    const exact = devices.filter(candidate => candidate.udid === device);

    if (exact.length !== 1) {
      throw new IosSimulatorResolutionError(
        `SOFTBOOK_CET_IOS_DEVICE does not identify one available iOS Simulator: ${device}`,
      );
    }

    return exact[0];
  }

  const selector = parseSimulatorSelector(simulator);
  const booted = devices.filter(candidate => candidate.state === 'Booted');

  if (booted.length === 1) {
    return booted[0];
  }

  const scoped = booted.length > 1 ? booted : devices;
  const matches = scoped.filter(candidate =>
    matchesSelector(candidate, selector),
  );

  if (matches.length !== 1) {
    const scope = booted.length > 1 ? 'booted' : 'available';
    throw new IosSimulatorResolutionError(
      `Simulator selector ${simulator} matched ${matches.length} ${scope} devices; set SOFTBOOK_CET_IOS_DEVICE to an exact UDID.`,
    );
  }

  return matches[0];
}

export function parseArguments(argv) {
  const options = {
    device: 'booted',
    format: 'json',
    inventory: null,
    simulator: 'iPhone 17',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (
      !['--device', '--format', '--inventory', '--simulator'].includes(argument)
    ) {
      throw argumentError(`Unknown argument: ${argument}`);
    }

    const value = argv[index + 1];

    if (!value || value.startsWith('--')) {
      throw argumentError(`${argument} requires a value.`);
    }

    if (argument === '--device') {
      options.device = value;
    } else if (argument === '--format') {
      options.format = value;
    } else if (argument === '--inventory') {
      options.inventory = value;
    } else {
      options.simulator = value;
    }
    index += 1;
  }

  if (!['json', 'tsv'].includes(options.format)) {
    throw argumentError('--format must be json or tsv.');
  }

  return options;
}

function flattenIosDevices(inventory) {
  if (!inventory || typeof inventory !== 'object' || Array.isArray(inventory)) {
    throw new IosSimulatorResolutionError(
      'Simulator inventory must be an object.',
    );
  }

  if (
    !inventory.devices ||
    typeof inventory.devices !== 'object' ||
    Array.isArray(inventory.devices)
  ) {
    throw new IosSimulatorResolutionError(
      'Simulator inventory is missing the devices map.',
    );
  }

  const devices = [];

  for (const [runtime, candidates] of Object.entries(inventory.devices)) {
    const version = iosRuntimeVersion(runtime);

    if (!version || !Array.isArray(candidates)) {
      continue;
    }

    for (const candidate of candidates) {
      if (
        !candidate ||
        typeof candidate !== 'object' ||
        candidate.isAvailable === false ||
        candidate.availabilityError ||
        typeof candidate.name !== 'string' ||
        typeof candidate.state !== 'string' ||
        typeof candidate.udid !== 'string' ||
        candidate.udid.trim() === ''
      ) {
        continue;
      }

      devices.push({
        name: candidate.name,
        runtime,
        runtime_version: version,
        state: candidate.state,
        udid: candidate.udid,
      });
    }
  }

  return devices.sort((left, right) =>
    `${left.runtime}\0${left.name}\0${left.udid}`.localeCompare(
      `${right.runtime}\0${right.name}\0${right.udid}`,
    ),
  );
}

function iosRuntimeVersion(runtime) {
  const match = String(runtime).match(/\.SimRuntime\.iOS-(\d+(?:-\d+)*)$/);
  return match ? match[1].replaceAll('-', '.') : null;
}

function matchesSelector(candidate, selector) {
  return (
    candidate.name === selector.name &&
    (selector.version === null ||
      candidate.runtime_version === selector.version)
  );
}

function readInventory(path) {
  if (path) {
    return JSON.parse(readFileSync(resolve(path), 'utf8'));
  }

  const result = spawnSync(
    'xcrun',
    ['simctl', 'list', 'devices', 'available', '--json'],
    { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024, timeout: 30_000 },
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    const detail = String(result.stderr || result.stdout || '')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 500);
    throw new IosSimulatorResolutionError(
      `Unable to read iOS Simulator inventory${detail ? `: ${detail}` : '.'}`,
    );
  }

  return JSON.parse(result.stdout);
}

function argumentError(message) {
  const error = new IosSimulatorResolutionError(message);
  error.exitCode = 2;
  return error;
}

function formatTarget(target, format) {
  if (format === 'tsv') {
    return `${target.udid}\t${target.state}\t${target.name}\t${target.runtime_version}\n`;
  }

  return `${JSON.stringify(target, null, 2)}\n`;
}

function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    const target = resolveIosSimulator(
      readInventory(options.inventory),
      options,
    );
    process.stdout.write(formatTarget(target, options.format));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(error?.exitCode ?? 1);
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  main();
}
