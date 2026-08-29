#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import {createHash, randomBytes} from 'node:crypto';
import {
  chmodSync,
  existsSync,
  linkSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import {tmpdir} from 'node:os';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

import {inspectMobileReleaseRuntimeArtifact} from './inspect_mobile_release_runtime_artifact.mjs';
import { resolveRemoteArchiveRequest } from './validate_agent_run_evidence.mjs';
import {
  canonicalJsonBytes,
  sha256,
  validateMobileReleaseRuntimeProfile,
} from './lib/mobile_release_runtime_profile.mjs';
import {parseStrictJson} from './lib/strict_json.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const STATE_SCHEMA = 'android-signed-release-state.v1';
export const REPORT_SCHEMA = 'android-signed-release.v1';
const OPERATION_SCHEMA = 'android-signed-release-operation.v1';
const SHA256_RE = /^[0-9a-f]{64}$/;
const PREFIXED_SHA256_RE = /^sha256:[0-9a-f]{64}$/;
const COMMIT_RE = /^[0-9a-f]{40}$/;
const RUNTIME_PROFILE_ID_RE = /^[a-z0-9][a-z0-9._-]{2,127}$/;
const MAX_SIGNED_APK_BYTES = 512 * 1024 * 1024;
const FORBIDDEN_ENVIRONMENT_PATTERN =
  /(^|[-_.:])(local|mock|simulation|simulator|personal|development|dev|fixture)([-_.:]|$)/i;
const STRICT_THREE_PART_VERSION_RE =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
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
  runtimeProfilePath = env.SOFTBOOK_MOBILE_RELEASE_RUNTIME_PROFILE,
  statePath,
} = {}) {
  const absoluteStatePath = requireStatePath(statePath, repositoryRoot);
  if (existsSync(absoluteStatePath)) {
    throw new Error(
      'Android signed-release state already exists; finalize or discard it first.',
    );
  }
  const signing = inspectSigningEnvironment(env);
  assertReceiverKeystoreBoundary(env, repositoryRoot);
  const targetId = requireTargetId(env.SOFTBOOK_ANDROID_RELEASE_TARGET_ID);
  const apksigner = findApkSigner(env);
  const identity = readAndroidIdentity(
    resolve(repositoryRoot, 'apps/mobile/android/app/build.gradle'),
  );
  const runtimeProfile = readReceiverMobileRuntimeProfile({
    expectedCommit: repository.head,
    path: runtimeProfilePath,
    repositoryRoot,
  });

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
      mobile_runtime_profile: runtimeProfile.binding,
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
      `-PsoftbookReleaseRuntimeProfile=${runtimeProfile.path}`,
      '--no-daemon',
    ],
    { cwd: resolve(repositoryRoot, 'apps/mobile/android'), env },
  );

  const artifactPath = resolve(
    repositoryRoot,
    'apps/mobile/android/app/build/outputs/apk/release/app-release.apk',
  );
  const artifact = inspectRegularArtifact(artifactPath);
  const runtimeProfileInspection = inspectMobileReleaseRuntimeArtifact({
    artifactPath,
    expectedProfilePath: runtimeProfile.path,
    format: 'apk',
  });
  assertRuntimeProfileInspection(
    runtimeProfile.binding,
    runtimeProfileInspection,
  );
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
    mobile_runtime_profile: runtimeProfile.binding,
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
  runtimeProfilePath = env.SOFTBOOK_MOBILE_RELEASE_RUNTIME_PROFILE,
  statePath,
  token = process.env.GITHUB_TOKEN,
} = {}) {
  const absoluteStatePath = requireStatePath(statePath, repositoryRoot);
  const absoluteReportPath = requireReportPath(reportPath, repositoryRoot);
  const state = readPrivateState(absoluteStatePath, repositoryRoot);
  const runtimeProfile = readReceiverMobileRuntimeProfile({
    expectedCommit: state.repository_commit,
    path: runtimeProfilePath,
    repositoryRoot,
  });
  assertMobileRuntimeProfileBinding(
    state.mobile_runtime_profile,
    runtimeProfile.binding,
    'Current receiver runtime profile does not match the signed build state.',
  );
  const verifier = requireMachinePrincipal(env.SOFTBOOK_ANDROID_RELEASE_VERIFIER);
  const verificationRunId = requireMachineRunId(
    env.SOFTBOOK_ANDROID_RELEASE_VERIFIER_RUN_ID,
  );
  const remote = await downloadAndInspectGitHubReleaseAsset({
    archiveUrl,
    fetchImpl,
    runtimeProfilePath: runtimeProfile.path,
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
  const localRuntimeProfileInspection = inspectMobileReleaseRuntimeArtifact({
    artifactPath: state.artifact_path,
    expectedProfilePath: runtimeProfile.path,
    format: 'apk',
  });
  assertRuntimeProfileInspection(
    state.mobile_runtime_profile,
    localRuntimeProfileInspection,
  );
  assertRuntimeProfileInspection(
    state.mobile_runtime_profile,
    remote.runtime_profile_inspection,
  );

  const now = asDate(clock());
  if (!apply) {
    return {
      ...publicStateSummary(state, absoluteStatePath, repositoryRoot),
      action: 'finalize',
      status: 'ready_to_finalize',
      archive_url: archiveUrl,
      report_path: relativeToRepository(absoluteReportPath, repositoryRoot),
      verified_by: verifier,
      verification_run_id: verificationRunId,
      remote_digest_matches: true,
      remote_runtime_profile_matches: true,
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
    mobile_runtime_profile: state.mobile_runtime_profile,
    built_at: state.built_at,
    archived_verified_at: now.toISOString(),
    verified_by: verifier,
    verification_run_id: verificationRunId,
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
  runtimeProfilePath = process.env.SOFTBOOK_MOBILE_RELEASE_RUNTIME_PROFILE,
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
  const runtimeProfile = readReceiverMobileRuntimeProfile({
    expectedCommit: report.repository_commit,
    path: runtimeProfilePath,
    repositoryRoot,
  });
  assertMobileRuntimeProfileBinding(
    report.mobile_runtime_profile,
    runtimeProfile.binding,
    'Current receiver runtime profile does not match the signed-release report.',
  );
  const remote = await downloadAndInspectGitHubReleaseAsset({
    archiveUrl: report.artifact.archive_url,
    fetchImpl,
    runtimeProfilePath: runtimeProfile.path,
    token,
  });
  if (
    remote.sha256 !== report.artifact.sha256 ||
    remote.size_bytes !== report.artifact.size_bytes
  ) {
    throw new Error('Remote signed APK no longer matches the report.');
  }
  assertRuntimeProfileInspection(
    report.mobile_runtime_profile,
    remote.runtime_profile_inspection,
  );
  return {
    schema_version: OPERATION_SCHEMA,
    action: 'verify',
    status: 'passed',
    target_id: report.target_id,
    repository_commit: report.repository_commit,
    artifact_sha256: report.artifact.sha256,
    mobile_runtime_profile: report.mobile_runtime_profile,
    remote_digest_matches: true,
    remote_runtime_profile_matches: true,
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
  if (process.platform !== 'win32' && (stats.mode & 0o077) !== 0) {
    throw new Error(
      'Android release keystore must not be readable or writable by group or other users.',
    );
  }
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

function assertReceiverKeystoreBoundary(env, repositoryRoot) {
  const value = env.SOFTBOOK_ANDROID_RELEASE_STORE_FILE;
  if (typeof value !== 'string' || value.length === 0) return;
  const storePath = resolve(value);
  const root = resolve(repositoryRoot);
  if (storePath === root || storePath.startsWith(`${root}${sep}`)) {
    throw new Error(
      'Android release keystore must be stored outside the repository.',
    );
  }
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
      'mobile_runtime_profile',
      'built_at',
      'archived_verified_at',
      'verified_by',
      'verification_run_id',
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
    !STRICT_THREE_PART_VERSION_RE.test(report.version_name)
  ) {
    errors.push('version_name is invalid');
  }
  validateArtifact(report?.artifact, errors);
  validateSigning(report?.signing, errors);
  validateMobileRuntimeProfileBinding(report?.mobile_runtime_profile, errors);
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
  if (!isMachinePrincipal(report?.verified_by))
    errors.push('verified_by must identify a model, agent, service, or oidc machine principal');
  if (!isMachineRunId(report?.verification_run_id))
    errors.push('verification_run_id must identify the machine verification run');
  if (report?.private_state_removed !== true)
    errors.push('private_state_removed must be true');
  return errors;
}

function validateMobileRuntimeProfileBinding(binding, errors) {
  requireExactKeys(
    binding,
    [
      'profile_sha256',
      'delivery_profile_sha256',
      'public_keyring_sha256',
      'profile_id',
      'environment_id',
      'signing_key_id',
      'key_ids',
    ],
    'mobile_runtime_profile',
    errors,
  );
  for (const field of [
    'profile_sha256',
    'delivery_profile_sha256',
    'public_keyring_sha256',
  ]) {
    if (!isPrefixedEvidenceSha(binding?.[field])) {
      errors.push(`mobile_runtime_profile ${field} is invalid`);
    }
  }
  for (const field of ['profile_id', 'environment_id', 'signing_key_id']) {
    if (!RUNTIME_PROFILE_ID_RE.test(String(binding?.[field] || ''))) {
      errors.push(`mobile_runtime_profile ${field} is invalid`);
    }
  }
  if (
    typeof binding?.environment_id === 'string' &&
    FORBIDDEN_ENVIRONMENT_PATTERN.test(binding.environment_id)
  ) {
    errors.push('mobile_runtime_profile environment_id is not receiver-grade');
  }
  if (
    !Array.isArray(binding?.key_ids) ||
    binding.key_ids.length < 1 ||
    binding.key_ids.length > 8 ||
    binding.key_ids.some(
      keyId => !RUNTIME_PROFILE_ID_RE.test(String(keyId || '')),
    ) ||
    new Set(binding.key_ids).size !== binding.key_ids.length ||
    JSON.stringify(binding.key_ids) !==
      JSON.stringify([...binding.key_ids].sort())
  ) {
    errors.push('mobile_runtime_profile key_ids are invalid');
  }
  if (
    Array.isArray(binding?.key_ids) &&
    binding.key_ids.filter(keyId => keyId === binding.signing_key_id).length !==
      1
  ) {
    errors.push(
      'mobile_runtime_profile signing_key_id must identify exactly one key_id',
    );
  }
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

async function resolveGitHubReleaseAsset({ archiveUrl, fetchImpl, token }) {
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
  if (request.assetMetadata.sizeBytes > MAX_SIGNED_APK_BYTES) {
    throw new Error('Signed APK exceeds the maximum supported byte size.');
  }
  return {
    request,
    sha256: request.assetMetadata.sha256,
    size_bytes: request.assetMetadata.sizeBytes,
  };
}

async function downloadAndInspectGitHubReleaseAsset({
  archiveUrl,
  fetchImpl,
  runtimeProfilePath,
  token,
}) {
  const resolvedAsset = await resolveGitHubReleaseAsset({
    archiveUrl,
    fetchImpl,
    token,
  });
  const response = await fetchImpl(resolvedAsset.request.url, {
    headers: resolvedAsset.request.headers,
    redirect: 'follow',
    signal: AbortSignal.timeout(150_000),
  });
  if (!response?.ok) {
    throw new Error(
      `Signed APK download failed with HTTP ${String(response?.status ?? 'unknown')}.`,
    );
  }
  if (typeof response.arrayBuffer !== 'function') {
    throw new Error('Signed APK download response is not readable.');
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  const actual = {
    sha256: createHash('sha256').update(bytes).digest('hex'),
    size_bytes: bytes.length,
  };
  if (
    actual.sha256 !== resolvedAsset.sha256 ||
    actual.size_bytes !== resolvedAsset.size_bytes
  ) {
    throw new Error(
      'Downloaded GitHub Release APK does not match its authenticated digest and size.',
    );
  }

  const temporaryDirectory = mkdtempSync(
    join(tmpdir(), 'softbook-android-release-verify-'),
  );
  const temporaryArtifact = join(temporaryDirectory, 'app-release.apk');
  try {
    writeFileSync(temporaryArtifact, bytes, {flag: 'wx', mode: 0o600});
    const runtimeProfileInspection = inspectMobileReleaseRuntimeArtifact({
      artifactPath: temporaryArtifact,
      expectedProfilePath: runtimeProfilePath,
      format: 'apk',
    });
    return {
      ...actual,
      runtime_profile_inspection: runtimeProfileInspection,
    };
  } finally {
    rmSync(temporaryDirectory, {force: true, recursive: true});
  }
}

function readReceiverMobileRuntimeProfile({
  expectedCommit,
  path,
  repositoryRoot,
}) {
  if (typeof path !== 'string' || path.trim() === '') {
    throw new Error(
      'Signed Android release requires SOFTBOOK_MOBILE_RELEASE_RUNTIME_PROFILE or --runtime-profile.',
    );
  }
  const absolutePath = resolve(repositoryRoot, path);
  const stats = lstatSync(absolutePath, {throwIfNoEntry: false});
  if (
    !stats?.isFile() ||
    stats.isSymbolicLink() ||
    stats.size < 1 ||
    stats.size > 64 * 1024
  ) {
    throw new Error(
      'Signed Android release runtime profile must be a bounded regular file.',
    );
  }
  const bytes = readFileSync(absolutePath);
  const profile = validateMobileReleaseRuntimeProfile(
    parseStrictJson(bytes, 'signed Android release runtime profile'),
    {expectedCommit},
  );
  if (profile.configuration_class !== 'receiver_release') {
    throw new Error(
      'Signed Android release requires a receiver_release runtime profile.',
    );
  }
  if (!bytes.equals(canonicalJsonBytes(profile))) {
    throw new Error(
      'Signed Android release runtime profile bytes must be canonical.',
    );
  }
  return {
    binding: {
      profile_sha256: sha256(bytes),
      delivery_profile_sha256: profile.delivery_profile_sha256,
      public_keyring_sha256: profile.public_keyring_sha256,
      profile_id: profile.profile_id,
      environment_id: profile.environment_id,
      signing_key_id: profile.signing_key_id,
      key_ids: profile.content_manifest_public_keys.map(item => item.key_id),
    },
    path: absolutePath,
    profile,
  };
}

function assertMobileRuntimeProfileBinding(actual, expected, message) {
  if (!mobileRuntimeProfileBindingsEqual(actual, expected)) {
    throw new Error(message);
  }
}

function mobileRuntimeProfileBindingsEqual(left, right) {
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') {
    return false;
  }
  for (const field of [
    'profile_sha256',
    'delivery_profile_sha256',
    'public_keyring_sha256',
    'profile_id',
    'environment_id',
    'signing_key_id',
  ]) {
    if (left[field] !== right[field]) return false;
  }
  return (
    Array.isArray(left.key_ids) &&
    Array.isArray(right.key_ids) &&
    left.key_ids.length === right.key_ids.length &&
    left.key_ids.every((keyId, index) => keyId === right.key_ids[index])
  );
}

function assertRuntimeProfileInspection(binding, inspection) {
  const inspectedBinding = {
    profile_sha256: inspection?.profile_sha256,
    profile_id: inspection?.profile_id,
    environment_id: inspection?.environment_id,
    signing_key_id: inspection?.signing_key_id,
    key_ids: inspection?.key_ids,
  };
  const expectedBinding = {
    profile_sha256: binding?.profile_sha256,
    profile_id: binding?.profile_id,
    environment_id: binding?.environment_id,
    signing_key_id: binding?.signing_key_id,
    key_ids: binding?.key_ids,
  };
  if (JSON.stringify(inspectedBinding) !== JSON.stringify(expectedBinding)) {
    throw new Error(
      'Embedded APK runtime profile does not match the signed-release binding.',
    );
  }
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
      'mobile_runtime_profile',
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
    !STRICT_THREE_PART_VERSION_RE.test(state.version_name)
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
  validateMobileRuntimeProfileBinding(state?.mobile_runtime_profile, errors);
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
    !STRICT_THREE_PART_VERSION_RE.test(String(versionName || ''))
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
    mobile_runtime_profile: state.mobile_runtime_profile,
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

function requireMachinePrincipal(value) {
  if (!isMachinePrincipal(value))
    throw new Error(
      'SOFTBOOK_ANDROID_RELEASE_VERIFIER must identify a model, agent, service, or oidc machine principal.',
    );
  return value;
}

function isMachinePrincipal(value) {
  return (
    typeof value === 'string' &&
    /^(?:model|agent|service|oidc):[A-Za-z0-9][A-Za-z0-9._@-]{2,127}$/.test(value)
  );
}

function requireMachineRunId(value) {
  if (!isMachineRunId(value)) {
    throw new Error(
      'SOFTBOOK_ANDROID_RELEASE_VERIFIER_RUN_ID must identify the machine verification run.',
    );
  }
  return value;
}

function isMachineRunId(value) {
  return (
    typeof value === 'string' &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(value)
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

function isPrefixedEvidenceSha(value) {
  return (
    PREFIXED_SHA256_RE.test(String(value || '')) &&
    !/^sha256:([0-9a-f])\1{63}$/.test(value)
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
    runtimeProfilePath: null,
    statePath: null,
  };
  for (let index = 0; index < rest.length; index += 1) {
    const argument = rest[index];
    if (argument === '--apply') {
      options.apply = true;
      continue;
    }
    if (
      [
        '--archive-url',
        '--format',
        '--report',
        '--runtime-profile',
        '--state',
      ].includes(argument)
    ) {
      const value = rest[index + 1];
      if (!value || value.startsWith('--'))
        throw new Error(`${argument} requires a value.`);
      index += 1;
      if (argument === '--archive-url') options.archiveUrl = value;
      if (argument === '--format') options.format = value;
      if (argument === '--report') options.reportPath = value;
      if (argument === '--runtime-profile') options.runtimeProfilePath = value;
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
  if (command === 'discard' && options.runtimeProfilePath)
    throw new Error('--runtime-profile is not valid for discard.');
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
        runtimeProfilePath: options.runtimeProfilePath ?? undefined,
        statePath: options.statePath,
      });
    } else if (options.command === 'finalize') {
      result = await finalizeSignedAndroidRelease({
        apply: options.apply,
        archiveUrl: options.archiveUrl,
        reportPath: options.reportPath,
        runtimeProfilePath: options.runtimeProfilePath ?? undefined,
        statePath: options.statePath,
      });
    } else if (options.command === 'verify') {
      result = await verifySignedAndroidReleaseReport({
        reportPath: options.reportPath,
        runtimeProfilePath: options.runtimeProfilePath ?? undefined,
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
