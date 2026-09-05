#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GATES = Object.freeze([
  'mobile',
  'native',
  'design',
  'web',
  'backend',
  'dependency',
  'evidence',
]);
const FORCE_ALL_FILES = new Set([
  '.github/workflows/pr-gates.yml',
  'scripts/classify_pr_gate_scope.mjs',
  'scripts/test_classify_pr_gate_scope.mjs',
]);
const MOBILE_SUPPORT_FILES = new Set([
  'scripts/run_experience_acceptance.mjs',
  'scripts/run_ios_experience_ci.sh',
  'scripts/test_ios_experience_ci.mjs',
  'scripts/experience_ocr.swift',
  'scripts/build_android_signed_release.mjs',
  'scripts/build_mobile_release_runtime_profile.mjs',
  'scripts/inspect_mobile_release_runtime_artifact.mjs',
  'scripts/lib/mobile_release_runtime_profile.mjs',
  'scripts/normalize_minimatch_brace_expansion.mjs',
  'scripts/normalize_react_native_podspecs.mjs',
  'scripts/test_normalize_react_native_podspecs.mjs',
  'scripts/test_build_android_signed_release.mjs',
  'scripts/test_mobile_release_runtime_profile.mjs',
  'scripts/stage_mobile_release_runtime_profile.mjs',
  'scripts/verify_minimatch_brace_expansion.mjs',
]);
const SHARED_PRODUCT_CONTRACT_FILES = new Set([
  'spec/account-sync-contract.json',
  'spec/runtime-boundaries.json',
  'spec/membership.json',
  'spec/interactions.json',
  'spec/card-system.json',
  'spec/box-catalog.json',
  'spec/machine-acceptance.json',
  'spec/release-operational-policy.json',
]);
const DESIGN_SCAN_FILES = new Set([
  'scripts/check_design_metadata_leaks.mjs',
  'scripts/test_check_design_metadata_leaks.mjs',
]);
const WEB_SHARED_MOBILE_FILES = new Set([
  'apps/mobile/package.json',
  'apps/mobile/package-lock.json',
  'apps/mobile/tsconfig.json',
]);
const BACKEND_SHARED_FILES = new Set([
  'spec/box-catalog.json',
  'scripts/build_card_make_runtime_payload.mjs',
  'scripts/build_controlled_pilot_bundle.mjs',
  'scripts/build_formal_release_bundle.mjs',
  'scripts/run_audio_bundle_candidate_mobile_acceptance.mjs',
  'scripts/run_controlled_pilot_mobile_acceptance.mjs',
  'scripts/test_build_formal_release_bundle.mjs',
  'scripts/test_build_card_make_runtime_payload.mjs',
]);
const DEPENDENCY_POLICY_FILES = new Set([
  'scripts/normalize_minimatch_brace_expansion.mjs',
  'scripts/normalize_react_native_podspecs.mjs',
  'scripts/test_normalize_react_native_podspecs.mjs',
  'scripts/test_validate_dependency_security.mjs',
  'scripts/validate_dependency_security.mjs',
  'scripts/verify_minimatch_brace_expansion.mjs',
]);
const EVIDENCE_POLICY_FILES = new Set([
  'docs/archive/pre-cutover-evidence-index.json',
  'scripts/build_pre_cutover_evidence_index.mjs',
  'scripts/test_validate_agent_run_evidence.mjs',
  'scripts/validate_agent_run_evidence.mjs',
]);

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : null;
}

function normalizeFiles(files) {
  return [...new Set(files.map(file => String(file).trim().replace(/^\.\//, '')).filter(Boolean))]
    .sort();
}

function isDependencyManifest(file) {
  return /^(apps\/(?:mobile|web)|infra\/cloudbase\/functions\/softbook-api)\/(?:package|npm-shrinkwrap)(?:-lock)?\.json$/.test(file)
    || /^(?:apps\/mobile\/)?(?:Gemfile|Gemfile\.lock)$/.test(file)
    || /^apps\/mobile\/ios\/Podfile(?:\.lock)?$/.test(file);
}

export function classifyChangedPaths(files, {forceAll = false} = {}) {
  const changedFiles = normalizeFiles(files);
  const all = forceAll || changedFiles.some(file => FORCE_ALL_FILES.has(file));
  const result = Object.fromEntries(GATES.map(gate => [gate, all]));

  if (!all) {
    for (const file of changedFiles) {
      if (SHARED_PRODUCT_CONTRACT_FILES.has(file)) {
        result.mobile = true;
        result.web = true;
        result.backend = true;
      }
      if (file.startsWith('apps/mobile/') || MOBILE_SUPPORT_FILES.has(file)) {
        result.mobile = true;
        result.native = true;
      }
      if (file.startsWith('docs/design/') || DESIGN_SCAN_FILES.has(file)) {
        result.mobile = true;
        result.design = true;
      }
      if (
        file.startsWith('apps/mobile/src/')
        || file.startsWith('apps/web/src/')
        || (
          file.startsWith('apps/mobile/')
          && /\.(?:jsx|tsx|png|jpe?g|webp|svg)$/.test(file)
        )
        || (
          file.startsWith('apps/web/')
          && /\.(?:jsx|tsx|png|jpe?g|webp|svg)$/.test(file)
        )
        || file === 'scripts/validate_pr_design_gate.py'
        || file === 'scripts/harness_validator/sections/pr_design_gate_regressions.py'
      ) {
        result.design = true;
      }
      if (
        file.startsWith('apps/web/')
        || file.startsWith('apps/mobile/src/')
        || WEB_SHARED_MOBILE_FILES.has(file)
      ) {
        result.web = true;
      }
      if (file.startsWith('infra/cloudbase/') || BACKEND_SHARED_FILES.has(file)) {
        result.backend = true;
      }
      if (
        file.startsWith('security/')
        || file === '.github/dependabot.yml'
        || isDependencyManifest(file)
        || DEPENDENCY_POLICY_FILES.has(file)
      ) {
        result.dependency = true;
      }
      if (file.startsWith('docs/agent-runs/') || EVIDENCE_POLICY_FILES.has(file)) {
        result.evidence = true;
      }
    }
  }

  return {
    ...result,
    all,
    changed_files: changedFiles,
  };
}

function appendGitHubOutput(outputPath, result) {
  const lines = [...GATES, 'all'].map(key => `${key}=${result[key] ? 'true' : 'false'}`);
  fs.appendFileSync(outputPath, `${lines.join('\n')}\n`, 'utf8');
}

function main() {
  const filesPath = option('--files');
  const outputPath = option('--github-output');
  const forceAll = process.argv.includes('--all');
  if (filesPath && forceAll) {
    throw new Error('--files and --all are mutually exclusive');
  }
  if (!filesPath && !forceAll) {
    throw new Error('one of --files or --all is required');
  }

  const files = filesPath
    ? fs.readFileSync(path.resolve(ROOT, filesPath), 'utf8').split(/\r?\n/)
    : [];
  const result = classifyChangedPaths(files, {forceAll});
  if (outputPath) appendGitHubOutput(outputPath, result);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`PR gate scope classification failed: ${error.message}\n`);
    process.exit(1);
  }
}
