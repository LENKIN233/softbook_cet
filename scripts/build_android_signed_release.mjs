#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import {createHash, randomBytes} from 'node:crypto';
import {
  chmodSync,
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveRemoteArchiveRequest } from './validate_agent_run_evidence.mjs';
import {parseStrictJson} from './lib/strict_json.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STATE_SCHEMA = 'android-signed-release-state.v1';
export const REPORT_SCHEMA = 'android-signed-release.v1';
const OPERATION_SCHEMA = 'android-signed-release-operation.v1';
const SHA256_RE = /^[0-9a-f]{64}$/;
const COMMIT_RE = /^[0-9a-f]{40}$/;
const SIGNING_ENV_NAMES = Object.freeze([
  'SOFTBOOK_ANDROID_RELEASE_STORE_FILE',
  'SOFTBOOK_ANDROID_RELEASE_STORE_PASSWORD',
  'SOFTBOOK_ANDROID_RELEASE_KEY_ALIAS',
  'SOFTBOOK_ANDROID_RELEASE_KEY_PASSWORD',
]);

export async function buildSignedAndroidRelease({
  apply = false,
  clock = () => new Date(),
  env = process.env,
  repository = readRepositoryState(),
  repositoryRoot = ROOT,
  runner = createProcessRunner(),
  statePath,
} = {}) {
  const absoluteStatePath = requireStatePath(statePath, repositoryRoot);
  if (existsSync(absoluteStatePath)) {
    throw new Error(
      'Android signed-release state already exists; finalize or discard it first.',
    );
  }
  const signing = inspectSigningEnvironment(env);
  const targetId = requireTargetId(env.SOFTBOOK_ANDROID_RELEASE_TARGET_ID);
  const apksigner = findApkSigner(env);
  const identity = readAndroidIdentity(
    resolve(repositoryRoot, 'apps/mobile/android/app/build.gradle'),
  );

  if (!apply) {
    return {
      schema_version: OPERATION_SCHEMA,
      action: 'build',
      status: 'dry_run',
      target_id: targetId,
      repository_ready: repositoryIsExactMain(repository),
      signing_configuration_complete: signing.complete,
      apksigner_available: Boolean(apksigner),
      application_id: identity.application_id,
      version_code: identity.version_code,
      version_name: identity.version_name,
      state_path: relativeToRepository(absoluteStatePath, repositoryRoot),
    };
  }

  assertExactMain(repository);
  if (!signing.complete)
    throw new Error(
      'Signed Android release requires all receiver signing values.',
    );
  if (!apksigner) throw new Error('Android SDK apksigner is unavailable.');

  runner.run(
    resolve(repositoryRoot, 'apps/mobile/android/gradlew'),
    [
      ':app:verifyReleaseSigningBoundary',
      ':app:assembleRelease',
      '-PsoftbookRequireSignedRelease=true',
      '--no-daemon',
    ],
    { cwd: resolve(repositoryRoot, 'apps/mobile/android'), env },
  );

  const artifactPath = resolve(
    repositoryRoot,
    'apps/mobile/android/app/build/outputs/apk/release/app-release.apk',
  );
  const artifact = inspectRegularArtifact(artifactPath);
  const signerVersion = requireToolVersion(
    runner.run(apksigner, ['version'], { cwd: repositoryRoot, env }).stdout,
  );
  const verification = parseApkSignerOutput(
    runner.run(
      apksigner,
      ['verify', '--verbose', '--print-certs', '--Werr', artifactPath],
      { cwd: repositoryRoot, env },
    ).stdout,
  );
  const builtAt = asDate(clock());
  const state = {
    schema_version: STATE_SCHEMA,
    status: 'built_and_verified',
    target_id: targetId,
    repository_commit: repository.head,
    application_id: identity.application_id,
    version_code: identity.version_code,
    version_name: identity.version_name,
    artifact_path: artifactPath,
    artifact_filename: basename(artifactPath),
    artifact_sha256: artifact.sha256,
    artifact_size_bytes: artifact.size_bytes,
    certificate_sha256: verification.certificate_sha256,
    signature_schemes: verification.signature_schemes,
    apksigner_version: signerVersion,
    built_at: builtAt.toISOString(),
  };
  writePrivateJson(absoluteStatePath, state);
  return publicStateSummary(state, absoluteStatePath, repositoryRoot);
}

export async function finalizeSignedAndroidRelease({
  apply = false,
  archiveUrl,
  clock = () => new Date(),
  env = process.env,
  fetchImpl = fetch,
  reportPath,
  repository = readRepositoryState(),
  repositoryRoot = ROOT,
  statePath,
  token = process.env.GITHUB_TOKEN,
} = {}) {
  const absoluteStatePath = requireStatePath(statePath, repositoryRoot);
  const absoluteReportPath = requireReportPath(reportPath, repositoryRoot);
  const state = readPrivateState(absoluteStatePath, repositoryRoot);
  const verifier = requireHumanVerifier(env.SOFTBOOK_ANDROID_RELEASE_VERIFIER);
  const remote = await inspectGitHubReleaseAsset({
    archiveUrl,
    fetchImpl,
    token,
  });

  if (
    remote.sha256 !== state.artifact_sha256 ||
    remote.size_bytes !== state.artifact_size_bytes
  ) {
    throw new Error(
      'GitHub Release asset does not match the locally verified signed APK.',
    );
  }
  const currentArtifact = inspectRegularArtifact(state.artifact_path);
  if (
    currentArtifact.sha256 !== state.artifact_sha256 ||
    currentArtifact.size_bytes !== state.artifact_size_bytes
  ) {
    throw new Error('Local signed APK changed after verification.');
  }

  const now = asDate(clock());
  if (!apply) {
    return {
      ...publicStateSummary(state, absoluteStatePath, repositoryRoot),
      action: 'finalize',
      status: 'ready_to_finalize',
      archive_url: archiveUrl,
      report_path: relativeToRepository(absoluteReportPath, repositoryRoot),
      verified_by: verifier,
      remote_digest_matches: true,
    };
  }

  assertExactMain(repository);
  if (repository.head !== state.repository_commit) {
    throw new Error(
      'Android signed-release finalization must use the build commit.',
    );
  }
  if (existsSync(absoluteReportPath)) {
    throw new Error(
      'Android signed-release report already exists and will not be overwritten.',
    );
  }
  const report = {
    schema_version: REPORT_SCHEMA,
    status: 'passed',
    platform: 'android',
    target_id: state.target_id,
    repository_commit: state.repository_commit,
    application_id: state.application_id,
    version_code: state.version_code,
    version_name: state.version_name,
    artifact: {
      filename: state.artifact_filename,
      sha256: state.artifact_sha256,
      size_bytes: state.artifact_size_bytes,
      archive_url: archiveUrl,
    },
    signing: {
      certificate_sha256: state.certificate_sha256,
      signature_schemes: state.signature_schemes,
      verifier: 'android-sdk-apksigner',
      verifier_version: state.apksigner_version,
    },
    built_at: state.built_at,
    archived_verified_at: now.toISOString(),
    verified_by: verifier,
    private_state_removed: true,
    generated_at: now.toISOString(),
  };
  const errors = validateAndroidSignedReleaseReport(report);
  if (errors.length > 0) {
    throw new Error(
      `Android signed-release report is invalid: ${errors.join('; ')}`,
    );
  }
  publishReportAfterPrivateStateRemoval(
    absoluteReportPath,
    absoluteStatePath,
    report,
  );
  return report;
}

export async function verifySignedAndroidReleaseReport({
  fetchImpl = fetch,
  reportPath,
  repositoryRoot = ROOT,
  token = process.env.GITHUB_TOKEN,
} = {}) {
  const absoluteReportPath = requireReportPath(reportPath, repositoryRoot);
  const report = parseStrictJson(
    readFileSync(absoluteReportPath),
    'Android signed-release report',
  );
  const errors = validateAndroidSignedReleaseReport(report);
  if (errors.length > 0)
    throw new Error(
      `Android signed-release report is invalid: ${errors.join('; ')}`,
    );
  const remote = await inspectGitHubReleaseAsset({
    archiveUrl: report.artifact.archive_url,
    fetchImpl,
    token,
  });
  if (
    remote.sha256 !== report.artifact.sha256 ||
    remote.size_bytes !== report.artifact.size_bytes
  ) {
    throw new Error('Remote signed APK no longer matches the report.');
  }
  return {
    schema_version: OPERATION_SCHEMA,
    action: 'verify',
    status: 'passed',
    target_id: report.target_id,
    repository_commit: report.repository_commit,
    artifact_sha256: report.artifact.sha256,
    remote_digest_matches: true,
  };
}

export function discardSignedAndroidRelease({
  apply = false,
  repositoryRoot = ROOT,
  statePath,
} = {}) {
  const absoluteStatePath = requireStatePath(statePath, repositoryRoot);
  const state = readPrivateState(absoluteStatePath, repositoryRoot);
  const summary = publicStateSummary(state, absoluteStatePath, repositoryRoot);
  if (apply) rmSync(absoluteStatePath);
  return {
    ...summary,
    action: 'discard',
    status: apply ? 'discarded' : 'dry_run',
  };
}

export function inspectSigningEnvironment(env = process.env) {
  const configured = SIGNING_ENV_NAMES.filter(
    name => typeof env[name] === 'string' && env[name].length > 0,
  );
  if (configured.length > 0 && configured.length !== SIGNING_ENV_NAMES.length) {
    throw new Error('Android release signing is partially configured.');
  }
  if (configured.length === 0) return { complete: false, configured_names: [] };
  const storePath = resolve(env.SOFTBOOK_ANDROID_RELEASE_STORE_FILE);
  const stats = lstatSync(storePath);
  if (!stats.isFile())
    throw new Error('Android release keystore must be a regular file.');
  for (const name of [
    'SOFTBOOK_ANDROID_RELEASE_STORE_PASSWORD',
    'SOFTBOOK_ANDROID_RELEASE_KEY_PASSWORD',
  ]) {
    if (env[name].length < 12)
      throw new Error(`${name} must contain at least 12 characters.`);
  }
  if (!/^[A-Za-z0-9._-]{1,128}$/.test(env.SOFTBOOK_ANDROID_RELEASE_KEY_ALIAS)) {
    throw new Error('SOFTBOOK_ANDROID_RELEASE_KEY_ALIAS is invalid.');
  }
  return { complete: true, configured_names: [...SIGNING_ENV_NAMES] };
}

export function parseApkSignerOutput(output) {
  const text = String(output || '');
  const certificateMatches = [
    ...text.matchAll(
      /Signer #\d+ certificate SHA-256 digest:\s*([0-9a-fA-F]{64})/g,
    ),
  ];
  const certificates = [
    ...new Set(certificateMatches.map(match => match[1].toLowerCase())),
  ];
  if (
    certificateMatches.length !== 1 ||
    certificates.length !== 1 ||
    !isEvidenceSha(certificates[0])
  ) {
    throw new Error(
      'apksigner must report exactly one signing certificate SHA-256.',
    );
  }
  const signatureSchemes = {
    v1: parseScheme(text, /Verified using v1 scheme[^:]*:\s*(true|false)/i),
    v2: parseScheme(text, /Verified using v2 scheme[^:]*:\s*(true|false)/i),
    v3: parseScheme(
      text,
      /Verified using v3 scheme(?!\.1)[^:]*:\s*(true|false)/i,
    ),
    v3_1: parseOptionalScheme(
      text,
      /Verified using v3\.1 scheme[^:]*:\s*(true|false)/i,
    ),
    v4: parseOptionalScheme(
      text,
      /Verified using v4 scheme[^:]*:\s*(true|false)/i,
    ),
  };
  if (
    signatureSchemes.v2 !== true &&
    signatureSchemes.v3 !== true &&
    signatureSchemes.v3_1 !== true
  ) {
    throw new Error('Signed APK must use APK Signature Scheme v2 or newer.');
  }
  return {
    certificate_sha256: certificates[0],
    signature_schemes: signatureSchemes,
  };
}

export function validateAndroidSignedReleaseReport(report) {
  const errors = [];
  requireExactKeys(
    report,
    [
      'schema_version',
      'status',
      'platform',
      'target_id',
      'repository_commit',
      'application_id',
      'version_code',
      'version_name',
      'artifact',
      'signing',
      'built_at',
      'archived_verified_at',
      'verified_by',
      'private_state_removed',
      'generated_at',
    ],
    'report',
    errors,
  );
  if (report?.schema_version !== REPORT_SCHEMA)
    errors.push('schema_version is invalid');
  if (report?.status !== 'passed') errors.push('status must be passed');
  if (report?.platform !== 'android') errors.push('platform must be android');
  if (!isTargetId(report?.target_id)) errors.push('target_id is invalid');
  if (!COMMIT_RE.test(String(report?.repository_commit || '')))
    errors.push('repository_commit is invalid');
  if (report?.application_id !== 'com.softbook.cet')
    errors.push('application_id is invalid');
  if (!Number.isInteger(report?.version_code) || report.version_code <= 0)
    errors.push('version_code is invalid');
  if (
    typeof report?.version_name !== 'string' ||
    !/^\d+\.\d+(?:\.\d+)?$/.test(report.version_name)
  ) {
    errors.push('version_name is invalid');
  }
  validateArtifact(report?.artifact, errors);
  validateSigning(report?.signing, errors);
  const builtAt = Date.parse(report?.built_at);
  const archivedAt = Date.parse(report?.archived_verified_at);
  const generatedAt = Date.parse(report?.generated_at);
  if (![builtAt, archivedAt, generatedAt].every(Number.isFinite)) {
    errors.push('report timestamps are invalid');
  } else {
    if (archivedAt < builtAt)
      errors.push('archive verification predates the build');
    if (generatedAt !== archivedAt)
      errors.push('generated_at must equal archived_verified_at');
  }
  if (!isHumanVerifier(report?.verified_by))
    errors.push('verified_by must identify a human');
  if (report?.private_state_removed !== true)
    errors.push('private_state_removed must be true');
  return errors;
}

function validateArtifact(artifact, errors) {
  requireExactKeys(
    artifact,
    ['filename', 'sha256', 'size_bytes', 'archive_url'],
    'artifact',
    errors,
  );
  if (artifact?.filename !== 'app-release.apk')
    errors.push('artifact filename is invalid');
  if (!isEvidenceSha(artifact?.sha256))
    errors.push('artifact sha256 is invalid');
  if (!Number.isInteger(artifact?.size_bytes) || artifact.size_bytes <= 0)
    errors.push('artifact size is invalid');
  if (!isGitHubReleaseAssetUrl(artifact?.archive_url))
    errors.push('artifact archive_url is invalid');
}

function validateSigning(signing, errors) {
  requireExactKeys(
    signing,
    ['certificate_sha256', 'signature_schemes', 'verifier', 'verifier_version'],
    'signing',
    errors,
  );
  if (!isEvidenceSha(signing?.certificate_sha256))
    errors.push('signing certificate sha256 is invalid');
  if (signing?.verifier !== 'android-sdk-apksigner')
    errors.push('signing verifier is invalid');
  if (
    typeof signing?.verifier_version !== 'string' ||
    !/^[0-9][A-Za-z0-9._-]{0,31}$/.test(signing.verifier_version)
  ) {
    errors.push('signing verifier_version is invalid');
  }
  requireExactKeys(
    signing?.signature_schemes,
    ['v1', 'v2', 'v3', 'v3_1', 'v4'],
    'signature_schemes',
    errors,
  );
  for (const name of ['v1', 'v2', 'v3', 'v3_1', 'v4']) {
    if (typeof signing?.signature_schemes?.[name] !== 'boolean')
      errors.push(`signature scheme ${name} is invalid`);
  }
  if (
    signing?.signature_schemes?.v2 !== true &&
    signing?.signature_schemes?.v3 !== true &&
    signing?.signature_schemes?.v3_1 !== true
  ) {
    errors.push('APK Signature Scheme v2 or newer is required');
  }
}

async function inspectGitHubReleaseAsset({ archiveUrl, fetchImpl, token }) {
  if (!isGitHubReleaseAssetUrl(archiveUrl)) {
    throw new Error('Signed APK archive must be a GitHub Release asset URL.');
  }
  const request = await resolveRemoteArchiveRequest(
    { url: archiveUrl },
    { fetchImpl, token },
  );
  if (request.assetMetadata?.source !== 'github_release_asset_digest') {
    throw new Error(
      'GitHub Release asset must expose an authenticated SHA-256 digest.',
    );
  }
  return {
    sha256: request.assetMetadata.sha256,
    size_bytes: request.assetMetadata.sizeBytes,
  };
}

function readPrivateState(path, repositoryRoot) {
  const stats = lstatSync(path);
  if (!stats.isFile() || (stats.mode & 0o077) !== 0) {
    throw new Error(
      'Android signed-release state must be a mode-0600 regular file.',
    );
  }
  const state = parseStrictJson(
    readFileSync(path),
    'Android signed-release private state',
  );
  const errors = [];
  requireExactKeys(
    state,
    [
      'schema_version',
      'status',
      'target_id',
      'repository_commit',
      'application_id',
      'version_code',
      'version_name',
      'artifact_path',
      'artifact_filename',
      'artifact_sha256',
      'artifact_size_bytes',
      'certificate_sha256',
      'signature_schemes',
      'apksigner_version',
      'built_at',
    ],
    'state',
    errors,
  );
  if (
    state?.schema_version !== STATE_SCHEMA ||
    state?.status !== 'built_and_verified'
  )
    errors.push('state schema or status is invalid');
  if (!COMMIT_RE.test(String(state?.repository_commit || '')))
    errors.push('state commit is invalid');
  if (!isTargetId(state?.target_id)) errors.push('state target is invalid');
  if (state?.application_id !== 'com.softbook.cet')
    errors.push('state application_id is invalid');
  if (!Number.isInteger(state?.version_code) || state.version_code <= 0)
    errors.push('state version_code is invalid');
  if (
    typeof state?.version_name !== 'string' ||
    !/^\d+\.\d+(?:\.\d+)?$/.test(state.version_name)
  )
    errors.push('state version_name is invalid');
  const expectedArtifactPath = resolve(
    repositoryRoot,
    'apps/mobile/android/app/build/outputs/apk/release/app-release.apk',
  );
  if (state?.artifact_path !== expectedArtifactPath)
    errors.push('state artifact_path is invalid');
  if (state?.artifact_filename !== 'app-release.apk')
    errors.push('state artifact_filename is invalid');
  if (
    !isEvidenceSha(state?.artifact_sha256) ||
    !isEvidenceSha(state?.certificate_sha256)
  )
    errors.push('state hashes are invalid');
  if (
    !Number.isInteger(state?.artifact_size_bytes) ||
    state.artifact_size_bytes <= 0
  )
    errors.push('state artifact size is invalid');
  if (!Number.isFinite(Date.parse(state?.built_at)))
    errors.push('state built_at is invalid');
  validateSigning(
    {
      certificate_sha256: state?.certificate_sha256,
      signature_schemes: state?.signature_schemes,
      verifier: 'android-sdk-apksigner',
      verifier_version: state?.apksigner_version,
    },
    errors,
  );
  if (errors.length > 0)
    throw new Error(
      `Android signed-release state is invalid: ${errors.join('; ')}`,
    );
  return state;
}

function inspectRegularArtifact(path) {
  const stats = lstatSync(path);
  if (!stats.isFile() || stats.size <= 0)
    throw new Error('Signed Android APK must be a non-empty regular file.');
  return {
    sha256: createHash('sha256').update(readFileSync(path)).digest('hex'),
    size_bytes: stats.size,
  };
}

function readAndroidIdentity(gradlePath) {
  const text = readFileSync(gradlePath, 'utf8');
  const applicationId = text.match(/\bapplicationId\s+["']([^"']+)["']/)?.[1];
  const versionCode = Number(text.match(/\bversionCode\s+(\d+)/)?.[1]);
  const versionName = text.match(/\bversionName\s+["']([^"']+)["']/)?.[1];
  if (
    applicationId !== 'com.softbook.cet' ||
    !Number.isInteger(versionCode) ||
    versionCode <= 0 ||
    !/^\d+\.\d+(?:\.\d+)?$/.test(String(versionName || ''))
  ) {
    throw new Error('Android application identity is invalid.');
  }
  return {
    application_id: applicationId,
    version_code: versionCode,
    version_name: versionName,
  };
}

function findApkSigner(env) {
  if (env.SOFTBOOK_ANDROID_APKSIGNER) {
    const explicit = resolve(env.SOFTBOOK_ANDROID_APKSIGNER);
    return existsSync(explicit) && lstatSync(explicit).isFile()
      ? explicit
      : null;
  }
  const sdkRoot = env.ANDROID_HOME || env.ANDROID_SDK_ROOT;
  if (!sdkRoot) return null;
  const buildTools = resolve(sdkRoot, 'build-tools');
  if (!existsSync(buildTools)) return null;
  const executable =
    process.platform === 'win32' ? 'apksigner.bat' : 'apksigner';
  const versions = readdirSync(buildTools).sort(compareVersionsDescending);
  for (const version of versions) {
    const candidate = join(buildTools, version, executable);
    if (existsSync(candidate) && lstatSync(candidate).isFile())
      return candidate;
  }
  return null;
}

function compareVersionsDescending(left, right) {
  return right.localeCompare(left, undefined, {
    numeric: true,
    sensitivity: 'base',
  });
}

function parseScheme(text, pattern) {
  const match = text.match(pattern);
  if (!match)
    throw new Error(
      'apksigner output is missing a required signature scheme result.',
    );
  return match[1].toLowerCase() === 'true';
}

function parseOptionalScheme(text, pattern) {
  const match = text.match(pattern);
  return match ? match[1].toLowerCase() === 'true' : false;
}

function requireToolVersion(value) {
  const version = String(value || '').trim();
  if (!/^[0-9][A-Za-z0-9._-]{0,31}$/.test(version))
    throw new Error('apksigner version is invalid.');
  return version;
}

function createProcessRunner() {
  return {
    run(command, args, { cwd, env }) {
      const result = spawnSync(command, args, {
        cwd,
        env,
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024,
        timeout: 30 * 60_000,
      });
      if (result.error || result.status !== 0) {
        throw new Error(
          `${basename(command)} failed; sensitive command output was withheld.`,
        );
      }
      return { stdout: result.stdout || '', stderr: result.stderr || '' };
    },
  };
}

function readRepositoryState(repositoryRoot = ROOT) {
  const runGit = args => {
    const result = spawnSync('git', args, {
      cwd: repositoryRoot,
      encoding: 'utf8',
      timeout: 30_000,
    });
    if (result.error || result.status !== 0)
      throw result.error ?? new Error(`git ${args[0]} failed.`);
    return result.stdout.trim();
  };
  return {
    branch: runGit(['branch', '--show-current']),
    dirty: runGit(['status', '--porcelain']) !== '',
    head: runGit(['rev-parse', 'HEAD']),
    originMain: runGit(['rev-parse', 'origin/main']),
  };
}

function repositoryIsExactMain(repository) {
  return (
    repository?.branch === 'main' &&
    repository.dirty === false &&
    COMMIT_RE.test(String(repository.head || '')) &&
    repository.head === repository.originMain
  );
}

function assertExactMain(repository) {
  if (!repositoryIsExactMain(repository))
    throw new Error(
      'Signed Android release apply requires clean main exactly matching origin/main.',
    );
}

function requireStatePath(path, repositoryRoot) {
  return requirePathBelow(
    path,
    resolve(repositoryRoot, 'docs/agent-runs/artifacts'),
    repositoryRoot,
    'Android signed-release state',
  );
}

function requireReportPath(path, repositoryRoot) {
  return requirePathBelow(
    path,
    resolve(repositoryRoot, 'docs/release/evidence'),
    repositoryRoot,
    'Android signed-release report',
  );
}

function requirePathBelow(path, root, repositoryRoot, label) {
  if (typeof path !== 'string' || path.trim() === '')
    throw new Error(`${label} path is required.`);
  const absolute = resolve(repositoryRoot, path);
  if (
    absolute === root ||
    !absolute.startsWith(`${root}${sep}`) ||
    !absolute.endsWith('.json')
  ) {
    throw new Error(`${label} must be a JSON file below ${root}.`);
  }
  assertNoSymbolicLinkComponents(absolute, repositoryRoot, label);
  return absolute;
}

function assertNoSymbolicLinkComponents(path, repositoryRoot, label) {
  const resolvedRepositoryRoot = resolve(repositoryRoot);
  const relativePath = path.slice(`${resolvedRepositoryRoot}${sep}`.length);
  let cursor = resolvedRepositoryRoot;
  for (const segment of relativePath.split(sep)) {
    cursor = join(cursor, segment);
    if (!existsSync(cursor)) break;
    const stats = lstatSync(cursor);
    if (stats.isSymbolicLink()) {
      throw new Error(`${label} path must not contain symbolic links.`);
    }
    if (cursor !== path && !stats.isDirectory()) {
      throw new Error(`${label} parent path must contain only directories.`);
    }
  }
}

function publicStateSummary(state, statePath, repositoryRoot) {
  return {
    schema_version: OPERATION_SCHEMA,
    action: 'build',
    status: state.status,
    target_id: state.target_id,
    repository_commit: state.repository_commit,
    application_id: state.application_id,
    version_code: state.version_code,
    version_name: state.version_name,
    artifact_filename: state.artifact_filename,
    artifact_sha256: state.artifact_sha256,
    artifact_size_bytes: state.artifact_size_bytes,
    certificate_sha256: state.certificate_sha256,
    state_path: relativeToRepository(statePath, repositoryRoot),
  };
}

function relativeToRepository(path, repositoryRoot) {
  const prefix = `${resolve(repositoryRoot)}${sep}`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

function writePrivateJson(path, value) {
  writeAtomicJson(path, value, 0o600);
}

function writeAtomicJson(path, value, mode) {
  const temporary = `${path}.tmp-${process.pid}-${randomBytes(8).toString('hex')}`;
  mkdirSync(dirname(path), { recursive: true });
  try {
    writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode,
    });
    chmodSync(temporary, mode);
    linkSync(temporary, path);
  } finally {
    rmSync(temporary, {force: true});
  }
}

function publishReportAfterPrivateStateRemoval(reportPath, statePath, report) {
  const temporary = `${reportPath}.tmp-${process.pid}-${randomBytes(8).toString('hex')}`;
  mkdirSync(dirname(reportPath), { recursive: true });
  try {
    writeFileSync(temporary, `${JSON.stringify(report, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o644,
    });
    chmodSync(temporary, 0o644);
    rmSync(statePath);
    linkSync(temporary, reportPath);
  } finally {
    rmSync(temporary, {force: true});
  }
}

function requireTargetId(value) {
  if (!isTargetId(value))
    throw new Error(
      'SOFTBOOK_ANDROID_RELEASE_TARGET_ID must be a stable receiver target ID.',
    );
  return value;
}

function isTargetId(value) {
  return typeof value === 'string' && /^[a-z0-9][a-z0-9._-]{2,63}$/.test(value);
}

function requireHumanVerifier(value) {
  if (!isHumanVerifier(value))
    throw new Error(
      'SOFTBOOK_ANDROID_RELEASE_VERIFIER must identify a human and not an agent.',
    );
  return value;
}

function isHumanVerifier(value) {
  return (
    typeof value === 'string' &&
    /^(?:github|team|external):[A-Za-z0-9][A-Za-z0-9._@-]{2,63}$/.test(value) &&
    !/(?:agent|bot|codex|automation|ci)/i.test(value)
  );
}

function isGitHubReleaseAssetUrl(value) {
  return (
    typeof value === 'string' &&
    /^https:\/\/github\.com\/[^/]+\/[^/]+\/releases\/download\/[^/]+\/[^/?#]+$/.test(
      value,
    )
  );
}

function isEvidenceSha(value) {
  return (
    SHA256_RE.test(String(value || '')) && !/^([0-9a-f])\1{63}$/.test(value)
  );
}

function asDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime()))
    throw new Error('Android signed-release clock is invalid.');
  return date;
}

function requireExactKeys(value, expected, label, errors) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${label} must be an object`);
    return;
  }
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (
    actual.length !== wanted.length ||
    actual.some((key, index) => key !== wanted[index])
  )
    errors.push(`${label} keys are not exact`);
}

export function parseArguments(argv) {
  const [command, ...rest] = argv;
  if (!['build', 'finalize', 'verify', 'discard'].includes(command))
    throw new Error('Command must be build, finalize, verify, or discard.');
  const options = {
    apply: false,
    archiveUrl: null,
    command,
    format: 'text',
    reportPath: null,
    statePath: null,
  };
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === '--apply') {
      options.apply = true;
      continue;
    }
    if (
      ['--archive-url', '--format', '--report', '--state'].includes(argument)
    ) {
      const value = rest[index + 1];
      if (!value || value.startsWith('--'))
        throw new Error(`${argument} requires a value.`);
      index += 1;
      if (argument === '--archive-url') options.archiveUrl = value;
      if (argument === '--format') options.format = value;
      if (argument === '--report') options.reportPath = value;
      if (argument === '--state') options.statePath = value;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}`);
  }
  if (['build', 'finalize', 'discard'].includes(command) && !options.statePath)
    throw new Error(`${command} requires --state.`);
  if (['finalize', 'verify'].includes(command) && !options.reportPath)
    throw new Error(`${command} requires --report.`);
  if (command === 'finalize' && !options.archiveUrl)
    throw new Error('finalize requires --archive-url.');
  if (command !== 'finalize' && options.archiveUrl)
    throw new Error('--archive-url is valid only for finalize.');
  if (command === 'verify' && options.apply)
    throw new Error('verify is read-only and rejects --apply.');
  if (!['json', 'text'].includes(options.format))
    throw new Error('--format must be text or json.');
  return options;
}

function sanitizeText(value) {
  return String(value)
    .replace(
      /(SOFTBOOK_ANDROID_RELEASE_(?:STORE_PASSWORD|KEY_PASSWORD))\s*[=:]\s*\S+/gi,
      '$1=<redacted>',
    )
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  try {
    const options = parseArguments(process.argv.slice(2));
    let result;
    if (options.command === 'build') {
      result = await buildSignedAndroidRelease({
        apply: options.apply,
        statePath: options.statePath,
      });
    } else if (options.command === 'finalize') {
      result = await finalizeSignedAndroidRelease({
        apply: options.apply,
        archiveUrl: options.archiveUrl,
        reportPath: options.reportPath,
        statePath: options.statePath,
      });
    } else if (options.command === 'verify') {
      result = await verifySignedAndroidReleaseReport({
        reportPath: options.reportPath,
      });
    } else {
      result = discardSignedAndroidRelease({
        apply: options.apply,
        statePath: options.statePath,
      });
    }
    if (options.format === 'json') console.log(JSON.stringify(result));
    else
      console.log(
        `[${result.status}] target=${result.target_id}; commit=${
          result.repository_commit ?? 'n/a'
        }`,
      );
  } catch (error) {
    console.error(`[android-signed-release] ${sanitizeText(error.message)}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
