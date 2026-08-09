#!/usr/bin/env node

import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

import {parseStrictJson} from './lib/strict_json.mjs';

export const REGISTRY_PATH =
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/registry-set.v1.json';
const PLANNED_MANIFEST_ROOT =
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/execution-manifests';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SHA256_RE = /^[0-9a-f]{64}$/;
const SHA1_RE = /^[0-9a-f]{40}$/;

const EXPECTED_ACTIVATION = Object.freeze({
  decision_path: 'docs/design/decisions/mobile-ux-checkpoint-layering-decision-v1.md',
  decision_sha256: '2c0ab641f1ebc465db963af5b18db8ea8fa9a4eb3fceb196a340c3474c8054dd',
  batch0_subject_digest: '92507e6f4f8fe523c83ab21ddae42dc119c4ed172393705d3d671c431673755b',
  approval_instance_digest: '583b7c571292b4f4fcdddf0982da34245471d047a8c5d42cb86c7520ee5224a7',
  approval_head: 'ac7e124f0385cf100b74a6b24e44ad3b3dad1ec8',
  pull_request: 484,
  workflow_run_id: 31322774545,
  deployment_id: 5820417644,
  environment_id: 18348068326,
  decision_owner: 'github:LENKIN233#113219944',
  deployment_success_at: '2026-08-09T16:04:58Z',
});

const SOURCE_PATHS = Object.freeze([
  'docs/design/decisions/mobile-ux-checkpoint-layering-decision-v1.md',
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/checkpoint-contract.md',
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/grayscale-ux-state-contract.md',
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/state-evidence-ledger.md',
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/platform-architecture.md',
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/pc-web-v5-state-mapping.md',
  'docs/design/decisions/pc-web-core-surface-decision-v1.md',
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/grayscale-proofs/ios-phone.html',
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/grayscale-proofs/android-phone.html',
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/grayscale-proofs/ipados-tablet.html',
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/grayscale-proofs/android-tablet.html',
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/access-profile-proofs/access-standard.html',
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/access-profile-proofs/access-managed.html',
  'apps/mobile/ios/SoftbookCET.xcodeproj/project.pbxproj',
  'apps/mobile/android/app/build.gradle',
  'apps/web/package.json',
  'infra/cloudbase/functions/softbook-api/package.json',
  'spec/requirement-memory.json',
  'spec/authority-map.json',
  'spec/product-core.json',
  'spec/platform-contract.json',
  'spec/account-sync-contract.json',
  'spec/action-surface.json',
  'spec/card-system.json',
  'spec/interactions.json',
  'spec/knowledge-map.json',
  'spec/space-operations.json',
  'spec/box-catalog.json',
  'spec/membership.json',
  'spec/runtime-boundaries.json',
  'spec/visual-language.json',
  'infra/cloudbase/auth-v2-runtime-contract.md',
  'infra/cloudbase/bootstrap-v2-runtime-contract.md',
  'infra/cloudbase/learning-events-v2-runtime-contract.md',
  'infra/cloudbase/learning-session-v1-runtime-contract.md',
  'infra/cloudbase/space-actions-v2-runtime-contract.md',
  'infra/cloudbase/content-manifest-v1-runtime-contract.md',
  'infra/cloudbase/beta-entitlement-v1-runtime-contract.md',
  'docs/release/external-account-readiness.v1.json',
  'spec/release-operational-policy.json',
  'spec/repo-delivery-contract.json',
  'spec/agent-harness.json',
  'spec/evals.json',
]);

const CHILDREN = Object.freeze([
  Object.freeze({
    checkpoint: 'CP-BA',
    path: 'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/cp-ba.registry.v1.json',
    schema: 'mobile-ux-batch1-cp-ba-registry.v1',
    sha256: 'ac4c4f33b63938ac8d92bf75e8b99866c9f12d662ffc3509cd3826765bf8cb84',
  }),
  Object.freeze({
    checkpoint: 'CP-CS',
    path: 'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/cp-cs.registry.v1.json',
    schema: 'mobile-ux-batch1-cp-cs-registry.v1',
    sha256: 'dcbc64c5ddeb23408c546819dd65c50d629931633fb859787c3605b2aa77add2',
  }),
  Object.freeze({
    checkpoint: 'CP-WEB',
    path: 'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/cp-web.registry.v1.json',
    schema: 'mobile-ux-batch1-cp-web-registry.v1',
    sha256: 'cba6f75f9c7574a58c9ee2f744991ec2154385c6ca328b46be6522e652e09696',
  }),
]);

const ROLE_IDS = Object.freeze([
  'role-cp-ba-evidence-owner',
  'role-cp-ba-independent-browser-reviewer',
  'role-cp-cs-aggregation-owner',
  'role-cp-cs-independent-aggregation-verifier',
  'role-cp-web-evidence-owner',
  'role-cp-web-independent-behavior-reviewer',
  'role-cp-web-independent-accessibility-reviewer',
]);

const ROLE_EXPECTATIONS = Object.freeze({
  'role-cp-ba-evidence-owner': ['CP-BA', 'explicit_role_confirmation_missing'],
  'role-cp-ba-independent-browser-reviewer': ['CP-BA', 'independent_human_confirmation_missing'],
  'role-cp-cs-aggregation-owner': ['CP-CS', 'explicit_role_confirmation_missing'],
  'role-cp-cs-independent-aggregation-verifier': ['CP-CS', 'independent_human_confirmation_missing'],
  'role-cp-web-evidence-owner': ['CP-WEB', 'explicit_role_confirmation_missing'],
  'role-cp-web-independent-behavior-reviewer': ['CP-WEB', 'independent_human_confirmation_missing'],
  'role-cp-web-independent-accessibility-reviewer': ['CP-WEB', 'independent_human_confirmation_missing'],
});

const TARGET_IDS = Object.freeze([
  'ba-ios-phone-browser',
  'ba-android-phone-browser',
  'ba-ipados-browser',
  'ba-android-tablet-browser',
  'ba-formal-access-shared-browser',
  'ba-managed-access-shared-browser',
  'cs-ios-phone-client',
  'cs-android-phone-client',
  'cs-ipados-client',
  'cs-android-tablet-client',
  'cs-receiver-service-harness',
  'web-desktop-primary',
  'web-desktop-secondary',
]);

const CP_BA_PLATFORM_TARGET_IDS = Object.freeze(TARGET_IDS.slice(0, 4));
const CP_BA_TARGET_IDS = Object.freeze(TARGET_IDS.slice(0, 6));

const ENVIRONMENT_IDS = Object.freeze([
  'env-local-browser-readonly',
  'env-receiver-staging',
  'env-sms-provider-sandbox',
  'env-ios-store-sandbox',
  'env-android-store-sandbox',
  'env-web-payment-sandbox',
  'env-receiver-managed-access-staging',
  'env-private-content-staging',
]);

const ACCOUNT_IDS = Object.freeze([
  'account-runtime-primary',
  'account-runtime-secondary',
  'account-sms-provider',
  'account-ios-store',
  'account-android-store',
  'account-web-payment',
  'account-receiver-managed-access',
  'account-private-content',
]);

const BUILD_IDS = Object.freeze([
  'build-cp-ba-browser-documents',
  'build-cp-cs-ios',
  'build-cp-cs-android',
  'build-cp-cs-service-harness',
  'build-cp-web-production-like',
]);

const CONTENT_IDS = Object.freeze([
  'content-release-subject',
  'private-audio-manifest-subject',
  'formal-entitlement-configuration-subject',
  'managed-entitlement-configuration-subject',
  'private-content-entitlement-configuration-subject',
]);

const WINDOW_IDS = Object.freeze(['window-cp-ba', 'window-cp-cs', 'window-cp-web']);

const COMPATIBILITY_KEY_IDS = Object.freeze([
  'compatibility-cp-ba-platform-browser',
  'compatibility-cp-ba-shared-formal',
  'compatibility-cp-ba-shared-managed',
  'compatibility-cp-cs-aggregate',
  'compatibility-cp-web-aggregate',
]);

const TARGET_EXPECTATIONS = Object.freeze({
  'ba-ios-phone-browser': Object.freeze({
    checkpoint: 'CP-BA',
    targetClass: 'platform_framed_browser_document',
    composition: 'ios_phone',
    document: 'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/grayscale-proofs/ios-phone.html',
    candidateReason: 'browser_system_identity_missing',
  }),
  'ba-android-phone-browser': Object.freeze({
    checkpoint: 'CP-BA',
    targetClass: 'platform_framed_browser_document',
    composition: 'android_phone',
    document: 'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/grayscale-proofs/android-phone.html',
    candidateReason: 'browser_system_identity_missing',
  }),
  'ba-ipados-browser': Object.freeze({
    checkpoint: 'CP-BA',
    targetClass: 'platform_framed_browser_document',
    composition: 'ipados_tablet',
    document: 'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/grayscale-proofs/ipados-tablet.html',
    candidateReason: 'browser_system_identity_missing',
  }),
  'ba-android-tablet-browser': Object.freeze({
    checkpoint: 'CP-BA',
    targetClass: 'platform_framed_browser_document',
    composition: 'android_tablet',
    document: 'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/grayscale-proofs/android-tablet.html',
    candidateReason: 'browser_system_identity_missing',
  }),
  'ba-formal-access-shared-browser': Object.freeze({
    checkpoint: 'CP-BA',
    targetClass: 'shared_access_profile_browser_document',
    composition: 'shared_formal_access_profile',
    document: 'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/access-profile-proofs/access-standard.html',
    candidateReason: 'browser_system_identity_missing',
  }),
  'ba-managed-access-shared-browser': Object.freeze({
    checkpoint: 'CP-BA',
    targetClass: 'shared_access_profile_browser_document',
    composition: 'shared_managed_access_profile',
    document: 'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/access-profile-proofs/access-managed.html',
    candidateReason: 'browser_system_identity_missing',
  }),
  'cs-ios-phone-client': Object.freeze({
    checkpoint: 'CP-CS',
    targetClass: 'real_client_system',
    composition: 'ios_phone',
    document: 'apps/mobile/ios/SoftbookCET.xcodeproj/project.pbxproj',
    candidateReason: 'physical_device_and_build_identity_missing',
  }),
  'cs-android-phone-client': Object.freeze({
    checkpoint: 'CP-CS',
    targetClass: 'real_client_system',
    composition: 'android_phone',
    document: 'apps/mobile/android/app/build.gradle',
    candidateReason: 'physical_device_and_build_identity_missing',
  }),
  'cs-ipados-client': Object.freeze({
    checkpoint: 'CP-CS',
    targetClass: 'real_client_system',
    composition: 'ipados_tablet',
    document: 'apps/mobile/ios/SoftbookCET.xcodeproj/project.pbxproj',
    candidateReason: 'physical_device_and_build_identity_missing',
  }),
  'cs-android-tablet-client': Object.freeze({
    checkpoint: 'CP-CS',
    targetClass: 'real_client_system',
    composition: 'android_tablet',
    document: 'apps/mobile/android/app/build.gradle',
    candidateReason: 'physical_device_and_build_identity_missing',
  }),
  'cs-receiver-service-harness': Object.freeze({
    checkpoint: 'CP-CS',
    targetClass: 'receiver_owned_canonical_service_harness',
    composition: 'canonical_service_non_ui',
    document: 'infra/cloudbase/functions/softbook-api/package.json',
    candidateReason: 'receiver_service_harness_identity_missing',
  }),
  'web-desktop-primary': Object.freeze({
    checkpoint: 'CP-WEB',
    targetClass: 'desktop_web_browser',
    composition: 'pc_web_focused_workbench',
    document: 'apps/web/package.json',
    candidateReason: 'browser_system_identity_missing',
  }),
  'web-desktop-secondary': Object.freeze({
    checkpoint: 'CP-WEB',
    targetClass: 'desktop_web_browser',
    composition: 'pc_web_focused_workbench',
    document: 'apps/web/package.json',
    candidateReason: 'browser_system_identity_missing',
  }),
});

const ENVIRONMENT_EXPECTATIONS = Object.freeze({
  'env-local-browser-readonly': ['local_read_only_browser', 'architecture_only', 'browser_environment_identity_missing'],
  'env-receiver-staging': ['receiver_owned_staging', 'shared_account_runtime', 'receiver_owned_deployment_missing'],
  'env-sms-provider-sandbox': ['provider_sandbox', 'authentication', 'provider_sandbox_missing'],
  'env-ios-store-sandbox': ['provider_sandbox', 'formal_commerce_ios', 'provider_sandbox_missing'],
  'env-android-store-sandbox': ['provider_sandbox', 'formal_commerce_android', 'provider_sandbox_missing'],
  'env-web-payment-sandbox': ['provider_sandbox', 'formal_commerce_web', 'provider_sandbox_missing'],
  'env-receiver-managed-access-staging': ['receiver_owned_staging', 'receiver_managed', 'receiver_owned_managed_access_environment_missing'],
  'env-private-content-staging': ['receiver_owned_staging', 'private_content_audio', 'private_content_deployment_missing'],
});

const ACCOUNT_EXPECTATIONS = Object.freeze({
  'account-runtime-primary': ['shared_account_runtime', 'receiver_account'],
  'account-runtime-secondary': ['shared_account_runtime', 'receiver_account'],
  'account-sms-provider': ['authentication', 'sms_provider'],
  'account-ios-store': ['formal_commerce_ios', 'ios_store'],
  'account-android-store': ['formal_commerce_android', 'android_store'],
  'account-web-payment': ['formal_commerce_web', 'web_payment_provider'],
  'account-receiver-managed-access': ['receiver_managed', 'receiver_operator_account'],
  'account-private-content': ['private_content_audio', 'receiver_content_account'],
});

const ACCOUNT_REASON_EXPECTATIONS = Object.freeze({
  'account-runtime-primary': 'non_secret_test_account_reference_missing',
  'account-runtime-secondary': 'non_secret_test_account_reference_missing',
  'account-sms-provider': 'provider_account_reference_missing',
  'account-ios-store': 'provider_account_reference_missing',
  'account-android-store': 'provider_account_reference_missing',
  'account-web-payment': 'provider_account_reference_missing',
  'account-receiver-managed-access': 'receiver_operator_account_reference_missing',
  'account-private-content': 'receiver_content_account_reference_missing',
});

const BUILD_EXPECTATIONS = Object.freeze({
  'build-cp-ba-browser-documents': ['CP-BA', 'browser_documents'],
  'build-cp-cs-ios': ['CP-CS', 'ios'],
  'build-cp-cs-android': ['CP-CS', 'android'],
  'build-cp-cs-service-harness': ['CP-CS', 'receiver_service_harness'],
  'build-cp-web-production-like': ['CP-WEB', 'pc_web'],
});

const BUILD_REASON_EXPECTATIONS = Object.freeze({
  'build-cp-ba-browser-documents': 'future_manifest_decision_commit_missing',
  'build-cp-cs-ios': 'artifact_signing_and_distribution_identity_missing',
  'build-cp-cs-android': 'artifact_signing_and_distribution_identity_missing',
  'build-cp-cs-service-harness': 'receiver_service_harness_build_missing',
  'build-cp-web-production-like': 'deployable_build_digest_missing',
});

const CONTENT_EXPECTATIONS = Object.freeze({
  'content-release-subject': 'shared_account_runtime',
  'private-audio-manifest-subject': 'private_content_audio',
  'formal-entitlement-configuration-subject': 'formal_account_access',
  'managed-entitlement-configuration-subject': 'receiver_managed',
  'private-content-entitlement-configuration-subject': 'private_content_audio',
});

const CONTENT_REASON_EXPECTATIONS = Object.freeze({
  'content-release-subject': 'approved_content_release_identity_missing',
  'private-audio-manifest-subject': 'signed_private_audio_manifest_missing',
  'formal-entitlement-configuration-subject': 'formal_entitlement_configuration_missing',
  'managed-entitlement-configuration-subject': 'receiver_entitlement_configuration_missing',
  'private-content-entitlement-configuration-subject':
    'private_content_entitlement_configuration_missing',
});

const WINDOW_EXPECTATIONS = Object.freeze({
  'window-cp-ba': 'CP-BA',
  'window-cp-cs': 'CP-CS',
  'window-cp-web': 'CP-WEB',
});

const WINDOW_REASON_EXPECTATIONS = Object.freeze({
  'window-cp-ba': 'operator_and_verifier_schedule_missing',
  'window-cp-cs': 'environment_and_account_schedule_missing',
  'window-cp-web': 'build_deployment_and_reviewer_schedule_missing',
});

const COMPATIBILITY_KEY_EXPECTATIONS = Object.freeze({
  'compatibility-cp-ba-platform-browser': 'CP-BA',
  'compatibility-cp-ba-shared-formal': 'CP-BA',
  'compatibility-cp-ba-shared-managed': 'CP-BA',
  'compatibility-cp-cs-aggregate': 'CP-CS',
  'compatibility-cp-web-aggregate': 'CP-WEB',
});

const CP_BA_SCENARIOS = Object.freeze([
  'ba-platform-browser-architecture',
  'ba-formal-access-shared-browser',
  'ba-managed-access-shared-browser',
]);

const CP_BA_STRESS = Object.freeze([
  'phone-width-320',
  'phone-width-360',
  'phone-width-390-or-393',
  'phone-width-430',
  'phone-landscape',
  'tablet-portrait',
  'tablet-landscape',
  'tablet-split-window',
  'keyboard-or-ime-constrained',
  'text-default',
  'text-large-accessibility',
  'text-200-percent-equivalent',
  'focus-keyboard',
  'motion-reduced',
  'contrast-high',
  'input-labelled-alternative',
]);

const CP_BA_SHARED_STRESS = Object.freeze([
  'phone-width-320',
  'phone-width-430',
  'phone-landscape',
  'tablet-portrait',
  'tablet-landscape',
  'tablet-split-window',
  'text-200-percent-equivalent',
  'focus-keyboard',
  'motion-reduced',
  'contrast-high',
  'input-labelled-alternative',
]);

const CP_BA_SCENARIO_EXPECTATIONS = Object.freeze({
  'ba-platform-browser-architecture': Object.freeze({
    evidence: 'platform_browser_presentation_only',
    scope: 'p0_browser_architecture_state_set',
    disposition: 'browser_only_out_of_lane_blockers_retained',
    targets: CP_BA_PLATFORM_TARGET_IDS,
    stress: CP_BA_STRESS,
    combinations: 'all_13_source_combinations_partition_pending',
    compatibility: 'compatibility-cp-ba-platform-browser',
    manifests: ['manifest-ba-ios-phone-v1', 'manifest-ba-android-phone-v1', 'manifest-ba-ipados-v1', 'manifest-ba-android-tablet-v1'],
  }),
  'ba-formal-access-shared-browser': Object.freeze({
    evidence: 'shared_access_profile_browser_presentation_only',
    scope: 'formal_commerce_access_states_shared_only',
    disposition: 'shared_browser_only_platform_cells_blocked',
    targets: ['ba-formal-access-shared-browser'],
    stress: CP_BA_SHARED_STRESS,
    combinations: 'formal_access_applicable_subset_partition_pending',
    compatibility: 'compatibility-cp-ba-shared-formal',
    manifests: ['manifest-ba-formal-access-v1'],
  }),
  'ba-managed-access-shared-browser': Object.freeze({
    evidence: 'shared_access_profile_browser_presentation_only',
    scope: 'receiver_managed_access_states_shared_only',
    disposition: 'shared_browser_only_platform_cells_blocked',
    targets: ['ba-managed-access-shared-browser'],
    stress: CP_BA_SHARED_STRESS,
    combinations: 'managed_access_applicable_subset_partition_pending',
    compatibility: 'compatibility-cp-ba-shared-managed',
    manifests: ['manifest-ba-managed-access-v1'],
  }),
});

const CP_CS_SCENARIOS = Object.freeze([
  'cs-auth-sms-session',
  'cs-bootstrap-entitlement-origin',
  'cs-learning-session-selection',
  'cs-learning-completion-events',
  'cs-daily-checkin',
  'cs-space-actions',
  'cs-formal-commerce-ios',
  'cs-formal-commerce-android',
  'cs-formal-commerce-web',
  'cs-receiver-managed-access',
  'cs-private-content-audio',
  'cs-cross-device-reconciliation',
]);

const CP_CS_EXPECTATIONS = Object.freeze({
  'cs-auth-sms-session': Object.freeze({domain: 'authentication', access: 'pre_authentication', provider: 'sms_provider', targets: ['cs-receiver-service-harness'], environment: 'env-sms-provider-sandbox', accounts: ['account-runtime-primary', 'account-sms-provider'], builds: ['build-cp-cs-service-harness'], contents: [], selectors: ['SHELL-*', 'AUTH-*', 'COV-01', 'COV-12']}),
  'cs-bootstrap-entitlement-origin': Object.freeze({domain: 'bootstrap_entitlement_origin', access: 'formal_account_access', provider: 'receiver_runtime', targets: ['cs-receiver-service-harness'], environment: 'env-receiver-staging', accounts: ['account-runtime-primary'], builds: ['build-cp-cs-service-harness'], contents: ['content-release-subject', 'formal-entitlement-configuration-subject'], selectors: ['SHELL-*', 'LEARN-03', 'LEARN-04', 'LEARN-05', 'MEM-*', 'COV-01', 'COV-06']}),
  'cs-learning-session-selection': Object.freeze({domain: 'learning_session_selection', access: 'formal_account_access', provider: 'receiver_runtime', targets: ['cs-receiver-service-harness'], environment: 'env-receiver-staging', accounts: ['account-runtime-primary'], builds: ['build-cp-cs-service-harness'], contents: ['content-release-subject', 'formal-entitlement-configuration-subject'], selectors: ['LEARN-01', 'LEARN-02', 'LEARN-03', 'LEARN-05', 'LEARN-06', 'LEARN-14', 'COV-03']}),
  'cs-learning-completion-events': Object.freeze({domain: 'learning_completion_events', access: 'formal_account_access', provider: 'receiver_runtime', targets: ['cs-receiver-service-harness'], environment: 'env-receiver-staging', accounts: ['account-runtime-primary'], builds: ['build-cp-cs-service-harness'], contents: ['content-release-subject'], selectors: ['LEARN-07', 'LEARN-08', 'LEARN-09', 'LEARN-10', 'LEARN-11', 'LEARN-12', 'FLIP-*', 'CHOICE-*', 'LOCK-*', 'ELIM-*', 'SWIPE-*', 'COV-02', 'COV-03']}),
  'cs-daily-checkin': Object.freeze({domain: 'daily_checkin', access: 'formal_account_access', provider: 'receiver_runtime', targets: ['cs-receiver-service-harness'], environment: 'env-receiver-staging', accounts: ['account-runtime-primary'], builds: ['build-cp-cs-service-harness'], contents: [], selectors: ['CHECKIN-*', 'COV-02']}),
  'cs-space-actions': Object.freeze({domain: 'space_actions', access: 'formal_account_access', provider: 'receiver_runtime', targets: ['cs-receiver-service-harness'], environment: 'env-receiver-staging', accounts: ['account-runtime-primary'], builds: ['build-cp-cs-service-harness'], contents: ['content-release-subject'], selectors: ['SPACE-*', 'TOOL-05', 'TOOL-06', 'TOOL-07', 'TOOL-08', 'TOOL-09', 'TOOL-10', 'TOOL-11', 'COV-02', 'COV-10']}),
  'cs-formal-commerce-ios': Object.freeze({domain: 'formal_commerce', access: 'formal_commerce_ios', provider: 'ios_store', targets: ['cs-ios-phone-client'], environment: 'env-ios-store-sandbox', accounts: ['account-runtime-primary', 'account-ios-store'], builds: ['build-cp-cs-ios'], contents: ['formal-entitlement-configuration-subject'], selectors: ['PAY-*', 'BUY-*', 'RESTORE-*', 'COV-06', 'COV-07', 'COV-08', 'COV-09']}),
  'cs-formal-commerce-android': Object.freeze({domain: 'formal_commerce', access: 'formal_commerce_android', provider: 'android_store', targets: ['cs-android-phone-client'], environment: 'env-android-store-sandbox', accounts: ['account-runtime-primary', 'account-android-store'], builds: ['build-cp-cs-android'], contents: ['formal-entitlement-configuration-subject'], selectors: ['PAY-*', 'BUY-*', 'RESTORE-*', 'COV-06', 'COV-07', 'COV-08', 'COV-09']}),
  'cs-formal-commerce-web': Object.freeze({domain: 'formal_commerce', access: 'formal_commerce_web', provider: 'web_payment_provider', targets: ['web-desktop-primary'], environment: 'env-web-payment-sandbox', accounts: ['account-runtime-primary', 'account-web-payment'], builds: ['build-cp-web-production-like'], contents: ['formal-entitlement-configuration-subject'], selectors: ['PAY-*', 'BUY-*', 'RESTORE-*', 'COV-06', 'COV-07', 'COV-08', 'COV-09']}),
  'cs-receiver-managed-access': Object.freeze({domain: 'receiver_managed_access', access: 'receiver_managed', provider: 'receiver_operator', targets: ['cs-receiver-service-harness'], environment: 'env-receiver-managed-access-staging', accounts: ['account-runtime-primary', 'account-receiver-managed-access'], builds: ['build-cp-cs-service-harness'], contents: ['managed-entitlement-configuration-subject'], selectors: ['MEM-*', 'BETA-*', 'COV-06', 'COV-09', 'COV-12']}),
  'cs-private-content-audio': Object.freeze({domain: 'private_content_audio', access: 'entitled_private_content', provider: 'receiver_private_content', targets: ['cs-receiver-service-harness'], environment: 'env-private-content-staging', accounts: ['account-runtime-primary', 'account-private-content'], builds: ['build-cp-cs-service-harness'], contents: ['content-release-subject', 'private-audio-manifest-subject', 'private-content-entitlement-configuration-subject'], selectors: ['AUDIO-*', 'COV-11']}),
  'cs-cross-device-reconciliation': Object.freeze({domain: 'cross_device_reconciliation', access: 'formal_account_access', provider: 'receiver_runtime', targets: ['cs-ios-phone-client', 'cs-android-phone-client', 'web-desktop-primary'], environment: 'env-receiver-staging', accounts: ['account-runtime-primary', 'account-runtime-secondary'], builds: ['build-cp-cs-ios', 'build-cp-cs-android', 'build-cp-web-production-like'], contents: ['content-release-subject', 'formal-entitlement-configuration-subject'], selectors: ['SHELL-*', 'LEARN-12', 'SPACE-16', 'MEM-06', 'COV-01', 'COV-02', 'COV-08']}),
});

const CP_WEB_MATRIX = Object.freeze([
  'PW-VIEWPORT-01',
  'PW-VIEWPORT-02',
  'PW-ZOOM-01',
  'PW-KEYBOARD-01',
  'PW-MOUSE-01',
  'PW-FOCUS-01',
  'PW-MOTION-01',
  'PW-SCREENREADER-01',
  'PW-SERVICE-01',
  'PW-COMMERCE-01',
  'PW-BETA-01',
  'PW-AUDIO-01',
]);

const CP_WEB_EXPECTATIONS = Object.freeze({
  'PW-VIEWPORT-01': Object.freeze({target: 'web-desktop-primary', environment: 'env-local-browser-readonly', reviewer: 'role-cp-web-independent-behavior-reviewer', accounts: ['account-runtime-primary'], contents: ['content-release-subject'], manifest: 'manifest-web-viewport-01-v1'}),
  'PW-VIEWPORT-02': Object.freeze({target: 'web-desktop-primary', environment: 'env-local-browser-readonly', reviewer: 'role-cp-web-independent-behavior-reviewer', accounts: ['account-runtime-primary'], contents: ['content-release-subject'], manifest: 'manifest-web-viewport-02-v1'}),
  'PW-ZOOM-01': Object.freeze({target: 'web-desktop-primary', environment: 'env-local-browser-readonly', reviewer: 'role-cp-web-independent-accessibility-reviewer', accounts: ['account-runtime-primary'], contents: ['content-release-subject'], manifest: 'manifest-web-zoom-01-v1'}),
  'PW-KEYBOARD-01': Object.freeze({target: 'web-desktop-primary', environment: 'env-local-browser-readonly', reviewer: 'role-cp-web-independent-accessibility-reviewer', accounts: ['account-runtime-primary'], contents: ['content-release-subject'], manifest: 'manifest-web-keyboard-01-v1'}),
  'PW-MOUSE-01': Object.freeze({target: 'web-desktop-primary', environment: 'env-local-browser-readonly', reviewer: 'role-cp-web-independent-behavior-reviewer', accounts: ['account-runtime-primary'], contents: ['content-release-subject'], manifest: 'manifest-web-mouse-01-v1'}),
  'PW-FOCUS-01': Object.freeze({target: 'web-desktop-primary', environment: 'env-local-browser-readonly', reviewer: 'role-cp-web-independent-accessibility-reviewer', accounts: ['account-runtime-primary'], contents: ['content-release-subject'], manifest: 'manifest-web-focus-01-v1'}),
  'PW-MOTION-01': Object.freeze({target: 'web-desktop-primary', environment: 'env-local-browser-readonly', reviewer: 'role-cp-web-independent-accessibility-reviewer', accounts: ['account-runtime-primary'], contents: ['content-release-subject'], manifest: 'manifest-web-motion-01-v1'}),
  'PW-SCREENREADER-01': Object.freeze({target: 'web-desktop-secondary', environment: 'env-local-browser-readonly', reviewer: 'role-cp-web-independent-accessibility-reviewer', accounts: ['account-runtime-primary'], contents: ['content-release-subject'], manifest: 'manifest-web-screenreader-01-v1'}),
  'PW-SERVICE-01': Object.freeze({target: 'web-desktop-primary', environment: 'env-receiver-staging', reviewer: 'role-cp-web-independent-behavior-reviewer', accounts: ['account-runtime-primary'], contents: ['content-release-subject', 'formal-entitlement-configuration-subject'], manifest: 'manifest-web-service-01-v1'}),
  'PW-COMMERCE-01': Object.freeze({target: 'web-desktop-primary', environment: 'env-web-payment-sandbox', reviewer: 'role-cp-web-independent-behavior-reviewer', accounts: ['account-runtime-primary', 'account-web-payment'], contents: ['formal-entitlement-configuration-subject'], manifest: 'manifest-web-commerce-01-v1'}),
  'PW-BETA-01': Object.freeze({target: 'web-desktop-primary', environment: 'env-receiver-managed-access-staging', reviewer: 'role-cp-web-independent-behavior-reviewer', accounts: ['account-runtime-primary', 'account-receiver-managed-access'], contents: ['managed-entitlement-configuration-subject'], manifest: 'manifest-web-beta-01-v1'}),
  'PW-AUDIO-01': Object.freeze({target: 'web-desktop-primary', environment: 'env-private-content-staging', reviewer: 'role-cp-web-independent-accessibility-reviewer', accounts: ['account-runtime-primary', 'account-private-content'], contents: ['content-release-subject', 'private-audio-manifest-subject', 'private-content-entitlement-configuration-subject'], manifest: 'manifest-web-audio-01-v1'}),
});

const ALLOWED_REVIEWER_ROLES = new Set([
  'role-cp-web-independent-behavior-reviewer',
  'role-cp-web-independent-accessibility-reviewer',
]);

const EXPECTED_SEMANTIC_SCOPE = Object.freeze({
  scope_id: 'all_173_ledger_obligations',
  semantic_state_count: 160,
  forced_combination_count: 13,
  contract_id_title_owner_digest: '323c9f6eb4fbaf30296bde988f1a029c7c223c7a98326e5c90baef871d06746a',
  contract_semantic_digest: 'f753ca396ee2870a35d9a4fa2696a0b070ff2a60c2a414b6ba1be7777abbb0f4',
  ledger_semantic_digest: '19d168a05e67c5b22502360dd55f7bd688633869f7b4389f9d78688779bcd1ca',
  pc_web_mapping_identity_digest: 'b356f3d56115c443b2d89496733378b1c44886d16d69ec6a7623038ec9ea479b',
});

const EXPECTED_SOURCE_BINDINGS_DIGEST =
  '40f6bcfc1754fa6dde45f7212b30835bee7d0bb8296ccf18b7efca71db625f75';

const COMPLETE_STATE_SEMANTIC_OWNERS = Object.freeze([
  'spec/product-core.json',
  'spec/platform-contract.json',
  'spec/account-sync-contract.json',
  'spec/action-surface.json',
  'spec/card-system.json',
  'spec/interactions.json',
  'spec/knowledge-map.json',
  'spec/space-operations.json',
  'spec/box-catalog.json',
  'spec/membership.json',
  'spec/visual-language.json',
]);

const CP_BA_SEMANTIC_OWNERS = COMPLETE_STATE_SEMANTIC_OWNERS;
const CP_CS_SEMANTIC_OWNERS = COMPLETE_STATE_SEMANTIC_OWNERS;

const CP_CS_RUNTIME_REFS = Object.freeze([
  'spec/runtime-boundaries.json',
  'infra/cloudbase/auth-v2-runtime-contract.md',
  'infra/cloudbase/bootstrap-v2-runtime-contract.md',
  'infra/cloudbase/learning-events-v2-runtime-contract.md',
  'infra/cloudbase/learning-session-v1-runtime-contract.md',
  'infra/cloudbase/space-actions-v2-runtime-contract.md',
  'infra/cloudbase/content-manifest-v1-runtime-contract.md',
  'infra/cloudbase/beta-entitlement-v1-runtime-contract.md',
]);

const CP_WEB_SEMANTIC_OWNERS = COMPLETE_STATE_SEMANTIC_OWNERS;

const CP_WEB_ACCEPTED_DESIGN_AUTHORITY_REFS = Object.freeze([
  'docs/design/decisions/pc-web-core-surface-decision-v1.md',
]);

const CP_WEB_FAIL_CLOSED_MAPPING_REFS = Object.freeze([
  'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/pc-web-v5-state-mapping.md',
]);

const UNRESOLVED_REASON_CODES = new Set([
  'approved_content_release_identity_missing',
  'artifact_signing_and_distribution_identity_missing',
  'browser_environment_identity_missing',
  'browser_system_identity_missing',
  'build_deployment_and_reviewer_schedule_missing',
  'deployable_build_digest_missing',
  'deployment_identity_missing',
  'environment_and_account_schedule_missing',
  'exact_compatibility_key_missing',
  'exact_intended_origin_partition_missing',
  'exact_membership_stage_partition_missing',
  'exact_state_to_lane_partition_missing',
  'explicit_role_confirmation_missing',
  'formal_entitlement_configuration_missing',
  'future_manifest_decision_commit_missing',
  'independent_human_confirmation_missing',
  'non_secret_test_account_reference_missing',
  'operator_and_verifier_schedule_missing',
  'physical_device_and_build_identity_missing',
  'private_content_entitlement_configuration_missing',
  'private_content_deployment_missing',
  'provider_account_owner_missing',
  'provider_account_reference_missing',
  'provider_sandbox_missing',
  'receiver_account_owner_missing',
  'receiver_content_account_reference_missing',
  'receiver_content_owner_missing',
  'receiver_entitlement_configuration_missing',
  'receiver_operator_account_reference_missing',
  'receiver_operator_owner_missing',
  'receiver_owned_deployment_missing',
  'receiver_owned_managed_access_environment_missing',
  'receiver_service_harness_build_missing',
  'receiver_service_harness_identity_missing',
  'sensitive_classifier_drift_requires_new_exact_head_approval',
  'signed_private_audio_manifest_missing',
]);

const SENSITIVE_VALUE_PATTERNS = Object.freeze([
  /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
  /(?:^|\D)1[3-9]\d{9}(?:$|\D)/,
  /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i,
  /(?:\/Users\/|\/home\/|[A-Za-z]:\\Users\\)/,
  /\b(?:password|passwd|credential|secret|token|bearer|api[_-]?key|serial(?:_number)?|hardware[_-]?uuid)\b/i,
]);

const PLANNED_MANIFEST_REGISTRY_DIGESTS = Object.freeze({
  'CP-BA': '24b8baec9d27e8e186931315b0285aa11bb3efb76911cc8a8671bc129d1eb270',
  'CP-CS': '82a08d8e1be33459fc3616a5e6be443d88e2d490304d5e5c96cac2c3c5f9742e',
  'CP-WEB': '056494e173776741695a518fba73cc12ad4bdf8dfad5a2f5e457053f90f0dea5',
});

const FORBIDDEN_KEYS = new Set([
  'approved',
  'ready',
  'status',
  'result',
  'observed_result',
  'raw_evidence',
  'evidence',
  'verified_by',
  'executed_at',
  'execution_started_at',
  'execution_completed_at',
  'checkpoint_status',
  'launch_cohort',
  'launch_release_candidate',
  'provisioning_authorized',
  'execution_authorized',
  'collection_authorized',
  'evidence_collection_authorized',
  'aggregation_authorized',
  'promotion_authorized',
  'visual_exploration_authorized',
  'implementation_authorized',
  'native_acceptance_authorized',
  'release_authorized',
  'gate_eligible',
  'evidence_eligible',
  'real_device',
  'command',
  'credentials',
  'credential',
  'secret',
  'token',
]);

const FORBIDDEN_VALUES = new Set([
  'approved',
  'accepted',
  'ready',
  'passed',
  'technically_passed',
  'partial_verified',
  'launch-release-candidate.v1',
  'tbd',
  'n/a',
  'na',
  'none',
  'placeholder',
]);

const ACCEPTED_CONSUMER = 'registry-review';

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function assertRecord(value, label) {
  if (!isRecord(value)) throw new Error(`${label} must be an object`);
}

function assertExactKeys(value, expected, label) {
  assertRecord(value, label);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`${label} keys must be exactly ${wanted.join(', ')}; received ${actual.join(', ')}`);
  }
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label} must equal ${JSON.stringify(expected)}; received ${JSON.stringify(actual)}`);
  }
}

function assertNonEmptyString(value, label) {
  if (typeof value !== 'string' || value.trim() !== value || !value) {
    throw new Error(`${label} must be a non-empty trimmed string`);
  }
}

function assertStringArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must be a non-empty array`);
  const seen = new Set();
  for (const [index, item] of value.entries()) {
    assertNonEmptyString(item, `${label}[${index}]`);
    if (seen.has(item)) throw new Error(`${label} contains duplicate ${item}`);
    seen.add(item);
  }
}

function assertExactIds(items, key, expected, label) {
  if (!Array.isArray(items)) throw new Error(`${label} must be an array`);
  const actual = items.map(item => item?.[key]);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} ${key} order/content mismatch: ${JSON.stringify(actual)}`);
  }
}

function assertExactArray(actual, expected, label) {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${label} must equal ${JSON.stringify(expected)}; received ${JSON.stringify(actual)}`);
  }
}

function resolveContained(root, relativePath, label) {
  assertNonEmptyString(relativePath, label);
  if (relativePath.includes('\\') || path.posix.isAbsolute(relativePath)) {
    throw new Error(`${label} must be a normalized repository-relative path`);
  }
  const normalized = path.posix.normalize(relativePath);
  if (normalized !== relativePath || normalized.startsWith('../') || normalized === '..') {
    throw new Error(`${label} must not contain traversal or normalization aliases`);
  }
  const rootPath = path.resolve(root);
  const absolutePath = path.resolve(rootPath, relativePath);
  if (!absolutePath.startsWith(`${rootPath}${path.sep}`)) {
    throw new Error(`${label} escapes repository root`);
  }
  let current = rootPath;
  const segments = path.relative(rootPath, absolutePath).split(path.sep);
  for (const [index, segment] of segments.entries()) {
    current = path.join(current, segment);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (error?.code === 'ENOENT') break;
      throw error;
    }
    if (stat.isSymbolicLink()) {
      throw new Error(`${label} must not traverse a symlink: ${relativePath}`);
    }
    if (index < segments.length - 1 && !stat.isDirectory()) {
      throw new Error(`${label} has a non-directory ancestor: ${relativePath}`);
    }
  }
  return absolutePath;
}

function readRegularFile(root, relativePath, label) {
  const absolutePath = resolveContained(root, relativePath, label);
  let stat;
  try {
    stat = fs.lstatSync(absolutePath);
  } catch {
    throw new Error(`${label} is missing: ${relativePath}`);
  }
  if (!stat.isFile() || stat.isSymbolicLink()) {
    throw new Error(`${label} must be a regular non-symlink file: ${relativePath}`);
  }
  return fs.readFileSync(absolutePath);
}

function assertCommittedAtHead(root, relativePath, label) {
  const tree = spawnSync('git', ['ls-tree', '-z', 'HEAD', '--', relativePath], {
    cwd: root,
    encoding: null,
  });
  const entries =
    tree.status === 0
      ? Buffer.from(tree.stdout)
          .toString('utf8')
          .split('\0')
          .filter(Boolean)
      : [];
  if (entries.length !== 1) {
    throw new Error(`${label} must be committed at HEAD: ${relativePath}`);
  }
  const treeMatch = entries[0].match(/^(100644|100755) blob [0-9a-f]{40}\t/);
  if (!treeMatch) {
    throw new Error(`${label} must use a regular-file Git mode at HEAD: ${relativePath}`);
  }
  const committed = spawnSync('git', ['show', `HEAD:${relativePath}`], {
    cwd: root,
    encoding: null,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (committed.status !== 0) {
    throw new Error(`${label} must be committed at HEAD: ${relativePath}`);
  }
  const working = readRegularFile(root, relativePath, label);
  if (!Buffer.from(committed.stdout).equals(working)) {
    throw new Error(`${label} working bytes must match HEAD: ${relativePath}`);
  }
}

function assertAbsentAtHead(root, relativePath, label) {
  const tree = spawnSync('git', ['ls-tree', '-z', 'HEAD', '--', relativePath], {
    cwd: root,
    encoding: null,
  });
  if (tree.status !== 0) {
    throw new Error(`${label} could not verify HEAD absence: ${relativePath}`);
  }
  const entries = Buffer.from(tree.stdout)
    .toString('utf8')
    .split('\0')
    .filter(Boolean);
  if (entries.length !== 0) {
    throw new Error(`${label} must not be committed at HEAD before a protected manifest decision`);
  }
}

function assertPlannedManifestSubtreeEmpty(root, {requireTracked = false} = {}) {
  const absoluteRoot = resolveContained(root, PLANNED_MANIFEST_ROOT, 'planned manifest root');
  let stat;
  try {
    stat = fs.lstatSync(absoluteRoot);
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  if (stat) {
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new Error('planned manifest root must be an absent or empty non-symlink directory');
    }
    if (fs.readdirSync(absoluteRoot).length !== 0) {
      throw new Error('planned manifest subtree must contain no files or directories before a protected decision');
    }
  }
  if (!requireTracked) return;
  const tree = spawnSync('git', ['ls-tree', '-r', '-z', 'HEAD', '--', PLANNED_MANIFEST_ROOT], {
    cwd: root,
    encoding: null,
  });
  if (tree.status !== 0) {
    throw new Error('planned manifest subtree could not verify HEAD absence');
  }
  if (Buffer.from(tree.stdout).length !== 0) {
    throw new Error('planned manifest subtree must contain no committed HEAD entries before a protected decision');
  }
}

function assertRepositoryHead(root) {
  const topLevel = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (topLevel.status !== 0) throw new Error('tracked mode requires a Git working tree');
  if (fs.realpathSync(topLevel.stdout.trim()) !== fs.realpathSync(root)) {
    throw new Error('tracked mode repository root must equal the validator root');
  }
  const head = spawnSync('git', ['rev-parse', '--verify', 'HEAD^{commit}'], {
    cwd: root,
    encoding: 'utf8',
  });
  if (head.status !== 0 || !SHA1_RE.test(head.stdout.trim())) {
    throw new Error('tracked mode requires a committed HEAD');
  }
  const origin = spawnSync('git', ['remote', 'get-url', 'origin'], {
    cwd: root,
    encoding: 'utf8',
  });
  const acceptedOrigins = new Set([
    'git@github.com:LENKIN233/softbook_cet.git',
    'https://github.com/LENKIN233/softbook_cet',
    'https://github.com/LENKIN233/softbook_cet.git',
  ]);
  if (origin.status !== 0 || !acceptedOrigins.has(origin.stdout.trim())) {
    throw new Error('tracked mode requires the LENKIN233/softbook_cet origin');
  }
  const ancestry = spawnSync(
    'git',
    ['merge-base', '--is-ancestor', EXPECTED_ACTIVATION.approval_head, head.stdout.trim()],
    {cwd: root, encoding: 'utf8'},
  );
  if (ancestry.status !== 0) {
    throw new Error('Batch 0 preparation-basis head must be reachable from HEAD');
  }
}

function assertUnresolved(value, label, {requirementId = true} = {}) {
  const keys = requirementId ? ['kind', 'requirement_id', 'reason_code'] : ['kind', 'reason_code'];
  assertExactKeys(value, keys, label);
  assertEqual(value.kind, 'unresolved', `${label}.kind`);
  if (requirementId) assertNonEmptyString(value.requirement_id, `${label}.requirement_id`);
  assertNonEmptyString(value.reason_code, `${label}.reason_code`);
  if (!UNRESOLVED_REASON_CODES.has(value.reason_code)) {
    throw new Error(`${label}.reason_code is not allowlisted`);
  }
}

function assertUnresolvedExact(value, {requirementId, reasonCode}, label) {
  assertUnresolved(value, label, {requirementId: requirementId !== undefined});
  if (requirementId !== undefined) {
    assertEqual(value.requirement_id, requirementId, `${label}.requirement_id`);
  }
  assertEqual(value.reason_code, reasonCode, `${label}.reason_code`);
}

function scanForbidden(value, label = 'registry') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForbidden(item, `${label}[${index}]`));
    return;
  }
  if (!isRecord(value)) {
    if (typeof value === 'string' && FORBIDDEN_VALUES.has(value.toLowerCase())) {
      throw new Error(`${label} contains forbidden preparation-stage value ${value}`);
    }
    if (
      typeof value === 'string' &&
      SENSITIVE_VALUE_PATTERNS.some(pattern => pattern.test(value))
    ) {
      throw new Error(`${label} contains a forbidden personal or credential-like value`);
    }
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
      throw new Error(`${label} contains forbidden preparation-stage field ${key}`);
    }
    scanForbidden(child, `${label}.${key}`);
  }
}

function validateHeader(value, expectedSchema, expectedRegistryId, checkpointId, label) {
  assertEqual(value.schema_version, expectedSchema, `${label}.schema_version`);
  assertEqual(value.registry_id, expectedRegistryId, `${label}.registry_id`);
  assertEqual(value.classification, 'implementation_hypothesis', `${label}.classification`);
  assertEqual(value.subject_class, 'registry_preparation', `${label}.subject_class`);
  if (checkpointId) assertEqual(value.checkpoint_id, checkpointId, `${label}.checkpoint_id`);
}

function validateSourceUniverseBinding(value, requirementId, label) {
  assertExactKeys(
    value,
    ['scope_ref', 'binding_kind', 'per_obligation_lane_partition'],
    label,
  );
  assertEqual(value.scope_ref, 'all_173_ledger_obligations', `${label}.scope_ref`);
  assertEqual(value.binding_kind, 'source_universe_only', `${label}.binding_kind`);
  assertUnresolved(
    value.per_obligation_lane_partition,
    `${label}.per_obligation_lane_partition`,
  );
  assertEqual(
    value.per_obligation_lane_partition.requirement_id,
    requirementId,
    `${label}.per_obligation_lane_partition.requirement_id`,
  );
  assertEqual(
    value.per_obligation_lane_partition.reason_code,
    'exact_state_to_lane_partition_missing',
    `${label}.per_obligation_lane_partition.reason_code`,
  );
}

function validatePlannedManifestRegistry(
  root,
  items,
  checkpointId,
  expectedIds,
  allowedScenarioIds,
  aggregateScenarioId,
  label,
  {requireTracked = false} = {},
) {
  assertExactIds(items, 'manifest_id', expectedIds, label);
  const prefix =
    `docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/batch-1/execution-manifests/${checkpointId.toLowerCase()}/`;
  const paths = new Set();
  for (const [index, item] of items.entries()) {
    const itemLabel = `${label}[${index}]`;
    assertExactKeys(
      item,
      ['manifest_id', 'manifest_role', 'scenario_id', 'planned_path', 'semantic_validator_id'],
      itemLabel,
    );
    if (!['scenario_cohort', 'checkpoint_aggregation'].includes(item.manifest_role)) {
      throw new Error(`${itemLabel}.manifest_role is invalid`);
    }
    if (
      item.manifest_role === 'scenario_cohort' &&
      !allowedScenarioIds.includes(item.scenario_id)
    ) {
      throw new Error(`${itemLabel}.scenario_id is not registered for ${checkpointId}`);
    }
    if (
      item.manifest_role === 'checkpoint_aggregation' &&
      item.scenario_id !== aggregateScenarioId
    ) {
      throw new Error(`${itemLabel}.scenario_id must equal ${aggregateScenarioId}`);
    }
    assertNonEmptyString(item.scenario_id, `${itemLabel}.scenario_id`);
    assertNonEmptyString(item.semantic_validator_id, `${itemLabel}.semantic_validator_id`);
    if (!item.semantic_validator_id.startsWith('future-')) {
      throw new Error(`${itemLabel}.semantic_validator_id must remain an explicitly future validator`);
    }
    const absolutePath = resolveContained(root, item.planned_path, `${itemLabel}.planned_path`);
    if (!item.planned_path.startsWith(prefix)) {
      throw new Error(`${itemLabel}.planned_path must stay inside ${prefix}`);
    }
    if (paths.has(item.planned_path)) {
      throw new Error(`${itemLabel}.planned_path must be unique`);
    }
    paths.add(item.planned_path);
    if (fs.existsSync(absolutePath)) {
      throw new Error(`${itemLabel}.planned_path must not exist before a protected manifest decision`);
    }
    if (requireTracked) {
      assertAbsentAtHead(root, item.planned_path, `${itemLabel}.planned_path`);
    }
  }
  const digest = sha256(Buffer.from(JSON.stringify(items)));
  assertEqual(
    digest,
    PLANNED_MANIFEST_REGISTRY_DIGESTS[checkpointId],
    `${label} exact semantic digest`,
  );
}

function validateCpBa(root, value, {requireTracked = false} = {}) {
  const label = 'CP-BA registry';
  assertExactKeys(
    value,
    [
      'schema_version',
      'registry_id',
      'classification',
      'subject_class',
      'checkpoint_id',
      'source_universe_binding',
      'semantic_owner_anchors',
      'evidence_owner_assignment',
      'independent_verifier_assignment',
      'target_ids',
      'scenario_registry',
      'planned_manifest_registry',
    ],
    label,
  );
  validateHeader(value, 'mobile-ux-batch1-cp-ba-registry.v1', 'mobile-ux-architecture-v5-batch1-cp-ba', 'CP-BA', label);
  validateSourceUniverseBinding(
    value.source_universe_binding,
    'cp-ba-exact-state-to-lane-partition',
    `${label}.source_universe_binding`,
  );
  assertExactArray(value.semantic_owner_anchors, CP_BA_SEMANTIC_OWNERS, `${label}.semantic_owner_anchors`);
  assertUnresolvedExact(
    value.evidence_owner_assignment,
    {requirementId: 'role-cp-ba-evidence-owner', reasonCode: 'explicit_role_confirmation_missing'},
    `${label}.evidence_owner_assignment`,
  );
  assertUnresolvedExact(
    value.independent_verifier_assignment,
    {requirementId: 'role-cp-ba-independent-browser-reviewer', reasonCode: 'independent_human_confirmation_missing'},
    `${label}.independent_verifier_assignment`,
  );
  assertExactArray(value.target_ids, CP_BA_TARGET_IDS, `${label}.target_ids`);
  assertExactIds(value.scenario_registry, 'scenario_id', CP_BA_SCENARIOS, `${label}.scenario_registry`);
  for (const [index, scenario] of value.scenario_registry.entries()) {
    const scenarioLabel = `${label}.scenario_registry[${index}]`;
    const expected = CP_BA_SCENARIO_EXPECTATIONS[scenario.scenario_id];
    assertExactKeys(
      scenario,
      [
        'scenario_id',
        'evidence_class',
        'state_scope',
        'lane_disposition',
        'target_ids',
        'stress_matrix_ids',
        'forced_combination_scope',
        'environment_requirement_id',
        'build_requirement_id',
        'execution_window_requirement_id',
        'compatibility_key_requirement_id',
        'planned_manifest_ids',
      ],
      scenarioLabel,
    );
    assertEqual(scenario.evidence_class, expected.evidence, `${scenarioLabel}.evidence_class`);
    assertEqual(scenario.state_scope, expected.scope, `${scenarioLabel}.state_scope`);
    assertEqual(scenario.lane_disposition, expected.disposition, `${scenarioLabel}.lane_disposition`);
    assertExactArray(scenario.target_ids, expected.targets, `${scenarioLabel}.target_ids`);
    assertExactArray(scenario.stress_matrix_ids, expected.stress, `${scenarioLabel}.stress_matrix_ids`);
    assertEqual(
      scenario.forced_combination_scope,
      expected.combinations,
      `${scenarioLabel}.forced_combination_scope`,
    );
    assertEqual(
      scenario.environment_requirement_id,
      'env-local-browser-readonly',
      `${scenarioLabel}.environment_requirement_id`,
    );
    assertEqual(
      scenario.build_requirement_id,
      'build-cp-ba-browser-documents',
      `${scenarioLabel}.build_requirement_id`,
    );
    assertEqual(
      scenario.execution_window_requirement_id,
      'window-cp-ba',
      `${scenarioLabel}.execution_window_requirement_id`,
    );
    assertEqual(
      scenario.compatibility_key_requirement_id,
      expected.compatibility,
      `${scenarioLabel}.compatibility_key_requirement_id`,
    );
    assertExactArray(scenario.planned_manifest_ids, expected.manifests, `${scenarioLabel}.planned_manifest_ids`);
  }
  validatePlannedManifestRegistry(
    root,
    value.planned_manifest_registry,
    'CP-BA',
    [
      'manifest-ba-ios-phone-v1',
      'manifest-ba-android-phone-v1',
      'manifest-ba-ipados-v1',
      'manifest-ba-android-tablet-v1',
      'manifest-ba-formal-access-v1',
      'manifest-ba-managed-access-v1',
      'manifest-cp-ba-aggregate-v1',
    ],
    CP_BA_SCENARIOS,
    'cp-ba-aggregate',
    `${label}.planned_manifest_registry`,
    {requireTracked},
  );
}

function validateCpCs(root, value, {requireTracked = false} = {}) {
  const label = 'CP-CS registry';
  assertExactKeys(
    value,
    [
      'schema_version',
      'registry_id',
      'classification',
      'subject_class',
      'checkpoint_id',
      'source_universe_binding',
      'semantic_owner_anchors',
      'implementation_runtime_boundary_refs',
      'aggregation_owner_assignment',
      'independent_aggregation_verifier_assignment',
      'scenario_registry',
      'planned_manifest_registry',
    ],
    label,
  );
  validateHeader(value, 'mobile-ux-batch1-cp-cs-registry.v1', 'mobile-ux-architecture-v5-batch1-cp-cs', 'CP-CS', label);
  validateSourceUniverseBinding(
    value.source_universe_binding,
    'cp-cs-exact-state-to-scenario-partition',
    `${label}.source_universe_binding`,
  );
  assertExactArray(value.semantic_owner_anchors, CP_CS_SEMANTIC_OWNERS, `${label}.semantic_owner_anchors`);
  assertExactArray(
    value.implementation_runtime_boundary_refs,
    CP_CS_RUNTIME_REFS,
    `${label}.implementation_runtime_boundary_refs`,
  );
  assertUnresolvedExact(
    value.aggregation_owner_assignment,
    {requirementId: 'role-cp-cs-aggregation-owner', reasonCode: 'explicit_role_confirmation_missing'},
    `${label}.aggregation_owner_assignment`,
  );
  assertUnresolvedExact(
    value.independent_aggregation_verifier_assignment,
    {requirementId: 'role-cp-cs-independent-aggregation-verifier', reasonCode: 'independent_human_confirmation_missing'},
    `${label}.independent_aggregation_verifier_assignment`,
  );
  assertExactIds(value.scenario_registry, 'scenario_id', CP_CS_SCENARIOS, `${label}.scenario_registry`);
  const manifestIds = [];
  for (const [index, scenario] of value.scenario_registry.entries()) {
    const scenarioLabel = `${label}.scenario_registry[${index}]`;
    const expected = CP_CS_EXPECTATIONS[scenario.scenario_id];
    assertExactKeys(
      scenario,
      [
        'scenario_id',
        'scenario_domain',
        'access_profile',
        'membership_stage_requirement',
        'intended_origin_requirement',
        'provider_lane',
        'target_requirement_ids',
        'environment_requirement_id',
        'account_requirement_ids',
        'build_requirement_ids',
        'content_requirement_ids',
        'execution_window_requirement_id',
        'compatibility_key_requirement_id',
        'state_selectors',
        'operator_assignment',
        'verifier_assignment',
        'planned_manifest_id',
      ],
      scenarioLabel,
    );
    assertEqual(scenario.scenario_domain, expected.domain, `${scenarioLabel}.scenario_domain`);
    assertEqual(scenario.access_profile, expected.access, `${scenarioLabel}.access_profile`);
    assertUnresolvedExact(
      scenario.membership_stage_requirement,
      {
        requirementId: `membership-stage-${scenario.scenario_id}`,
        reasonCode: 'exact_membership_stage_partition_missing',
      },
      `${scenarioLabel}.membership_stage_requirement`,
    );
    assertUnresolvedExact(
      scenario.intended_origin_requirement,
      {
        requirementId: `intended-origin-${scenario.scenario_id}`,
        reasonCode: 'exact_intended_origin_partition_missing',
      },
      `${scenarioLabel}.intended_origin_requirement`,
    );
    assertEqual(scenario.provider_lane, expected.provider, `${scenarioLabel}.provider_lane`);
    assertExactArray(scenario.target_requirement_ids, expected.targets, `${scenarioLabel}.target_requirement_ids`);
    assertEqual(
      scenario.environment_requirement_id,
      expected.environment,
      `${scenarioLabel}.environment_requirement_id`,
    );
    assertExactArray(scenario.account_requirement_ids, expected.accounts, `${scenarioLabel}.account_requirement_ids`);
    assertExactArray(scenario.build_requirement_ids, expected.builds, `${scenarioLabel}.build_requirement_ids`);
    assertExactArray(scenario.content_requirement_ids, expected.contents, `${scenarioLabel}.content_requirement_ids`);
    assertEqual(
      scenario.execution_window_requirement_id,
      'window-cp-cs',
      `${scenarioLabel}.execution_window_requirement_id`,
    );
    assertEqual(
      scenario.compatibility_key_requirement_id,
      'compatibility-cp-cs-aggregate',
      `${scenarioLabel}.compatibility_key_requirement_id`,
    );
    assertExactArray(scenario.state_selectors, expected.selectors, `${scenarioLabel}.state_selectors`);
    for (const selector of scenario.state_selectors) {
      if (!/^(?:[A-Z][A-Z0-9]*-\*|[A-Z][A-Z0-9]*-\d{2})$/.test(selector)) {
        throw new Error(`${scenarioLabel} contains invalid state selector ${selector}`);
      }
    }
    const operatorReason =
      scenario.scenario_id === 'cs-receiver-managed-access'
        ? 'receiver_operator_owner_missing'
        : scenario.scenario_id === 'cs-private-content-audio'
          ? 'receiver_content_owner_missing'
          : scenario.scenario_id === 'cs-auth-sms-session' ||
              scenario.scenario_id.startsWith('cs-formal-commerce-')
            ? 'provider_account_owner_missing'
            : 'receiver_account_owner_missing';
    assertUnresolvedExact(
      scenario.operator_assignment,
      {requirementId: `operator-${scenario.scenario_id}`, reasonCode: operatorReason},
      `${scenarioLabel}.operator_assignment`,
    );
    assertUnresolvedExact(
      scenario.verifier_assignment,
      {
        requirementId: `verifier-${scenario.scenario_id}`,
        reasonCode: 'independent_human_confirmation_missing',
      },
      `${scenarioLabel}.verifier_assignment`,
    );
    assertEqual(
      scenario.planned_manifest_id,
      `manifest-${scenario.scenario_id}-v1`,
      `${scenarioLabel}.planned_manifest_id`,
    );
    manifestIds.push(scenario.planned_manifest_id);
  }

  const formalProfiles = new Set([
    value.scenario_registry.find(item => item.scenario_id === 'cs-formal-commerce-ios')?.access_profile,
    value.scenario_registry.find(item => item.scenario_id === 'cs-formal-commerce-android')?.access_profile,
    value.scenario_registry.find(item => item.scenario_id === 'cs-formal-commerce-web')?.access_profile,
  ]);
  if (!formalProfiles.has('formal_commerce_ios') || !formalProfiles.has('formal_commerce_android') || !formalProfiles.has('formal_commerce_web')) {
    throw new Error('CP-CS formal commerce profiles must remain three isolated platform lanes');
  }
  const managed = value.scenario_registry.find(item => item.scenario_id === 'cs-receiver-managed-access');
  if (managed?.access_profile !== 'receiver_managed' || managed?.provider_lane !== 'receiver_operator') {
    throw new Error('CP-CS receiver-managed access must remain isolated from formal commerce');
  }
  validatePlannedManifestRegistry(
    root,
    value.planned_manifest_registry,
    'CP-CS',
    [...manifestIds, 'manifest-cp-cs-aggregate-v1'],
    CP_CS_SCENARIOS,
    'cp-cs-aggregate',
    `${label}.planned_manifest_registry`,
    {requireTracked},
  );
}

function validateCpWeb(root, value, {requireTracked = false} = {}) {
  const label = 'CP-WEB registry';
  assertExactKeys(
    value,
    [
      'schema_version',
      'registry_id',
      'classification',
      'subject_class',
      'checkpoint_id',
      'source_universe_binding',
      'semantic_owner_anchors',
      'accepted_design_authority_refs',
      'fail_closed_mapping_refs',
      'evidence_owner_assignment',
      'independent_behavior_reviewer_assignment',
      'independent_accessibility_reviewer_assignment',
      'build_reference',
      'deployment_reference',
      'matrix_registry',
      'planned_manifest_registry',
    ],
    label,
  );
  validateHeader(value, 'mobile-ux-batch1-cp-web-registry.v1', 'mobile-ux-architecture-v5-batch1-cp-web', 'CP-WEB', label);
  validateSourceUniverseBinding(
    value.source_universe_binding,
    'cp-web-exact-state-to-matrix-partition',
    `${label}.source_universe_binding`,
  );
  assertExactArray(value.semantic_owner_anchors, CP_WEB_SEMANTIC_OWNERS, `${label}.semantic_owner_anchors`);
  assertExactArray(
    value.accepted_design_authority_refs,
    CP_WEB_ACCEPTED_DESIGN_AUTHORITY_REFS,
    `${label}.accepted_design_authority_refs`,
  );
  assertExactArray(
    value.fail_closed_mapping_refs,
    CP_WEB_FAIL_CLOSED_MAPPING_REFS,
    `${label}.fail_closed_mapping_refs`,
  );
  assertUnresolvedExact(
    value.evidence_owner_assignment,
    {requirementId: 'role-cp-web-evidence-owner', reasonCode: 'explicit_role_confirmation_missing'},
    `${label}.evidence_owner_assignment`,
  );
  assertUnresolvedExact(
    value.independent_behavior_reviewer_assignment,
    {requirementId: 'role-cp-web-independent-behavior-reviewer', reasonCode: 'independent_human_confirmation_missing'},
    `${label}.independent_behavior_reviewer_assignment`,
  );
  assertUnresolvedExact(
    value.independent_accessibility_reviewer_assignment,
    {requirementId: 'role-cp-web-independent-accessibility-reviewer', reasonCode: 'independent_human_confirmation_missing'},
    `${label}.independent_accessibility_reviewer_assignment`,
  );
  assertUnresolvedExact(
    value.build_reference,
    {requirementId: 'build-cp-web-production-like', reasonCode: 'deployable_build_digest_missing'},
    `${label}.build_reference`,
  );
  assertUnresolvedExact(
    value.deployment_reference,
    {requirementId: 'deployment-cp-web-production-like', reasonCode: 'deployment_identity_missing'},
    `${label}.deployment_reference`,
  );
  assertExactIds(value.matrix_registry, 'matrix_id', CP_WEB_MATRIX, `${label}.matrix_registry`);
  const manifestIds = [];
  for (const [index, row] of value.matrix_registry.entries()) {
    const rowLabel = `${label}.matrix_registry[${index}]`;
    const expected = CP_WEB_EXPECTATIONS[row.matrix_id];
    assertExactKeys(
      row,
      [
        'matrix_id',
        'target_requirement_id',
        'environment_requirement_id',
        'reviewer_role_id',
        'account_requirement_ids',
        'build_requirement_id',
        'content_requirement_ids',
        'execution_window_requirement_id',
        'compatibility_key_requirement_id',
        'planned_manifest_id',
      ],
      rowLabel,
    );
    assertEqual(row.target_requirement_id, expected.target, `${rowLabel}.target_requirement_id`);
    assertEqual(row.environment_requirement_id, expected.environment, `${rowLabel}.environment_requirement_id`);
    assertEqual(row.reviewer_role_id, expected.reviewer, `${rowLabel}.reviewer_role_id`);
    if (!ALLOWED_REVIEWER_ROLES.has(row.reviewer_role_id)) throw new Error(`${rowLabel}.reviewer_role_id is invalid`);
    assertExactArray(row.account_requirement_ids, expected.accounts, `${rowLabel}.account_requirement_ids`);
    assertEqual(row.build_requirement_id, 'build-cp-web-production-like', `${rowLabel}.build_requirement_id`);
    assertExactArray(row.content_requirement_ids, expected.contents, `${rowLabel}.content_requirement_ids`);
    assertEqual(row.execution_window_requirement_id, 'window-cp-web', `${rowLabel}.execution_window_requirement_id`);
    assertEqual(
      row.compatibility_key_requirement_id,
      'compatibility-cp-web-aggregate',
      `${rowLabel}.compatibility_key_requirement_id`,
    );
    assertEqual(row.planned_manifest_id, expected.manifest, `${rowLabel}.planned_manifest_id`);
    manifestIds.push(row.planned_manifest_id);
  }
  validatePlannedManifestRegistry(
    root,
    value.planned_manifest_registry,
    'CP-WEB',
    [...manifestIds, 'manifest-cp-web-aggregate-v1'],
    CP_WEB_MATRIX,
    'cp-web-aggregate',
    `${label}.planned_manifest_registry`,
    {requireTracked},
  );
}

function deriveLedgerCounts(markdown) {
  const lines = markdown.split('\n');
  const headerIndex = lines.findIndex(line =>
    line.startsWith('| State | Contract transcript | iOS phone browser |'),
  );
  if (headerIndex < 0) throw new Error('Batch 1 source ledger table header is missing');
  const ids = [];
  for (let index = headerIndex + 2; lines[index]?.startsWith('|'); index += 1) {
    const stateCell = lines[index].split('|')[1]?.trim() ?? '';
    const match = stateCell.match(/^`([A-Z][A-Z0-9-]*-\d{2})\s+/);
    if (!match) throw new Error(`Batch 1 source ledger has an invalid state row at line ${index + 1}`);
    ids.push(match[1]);
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error('Batch 1 source ledger contains duplicate state IDs');
  }
  return {
    total: ids.length,
    forced: ids.filter(id => id.startsWith('COV-')).length,
    semantic: ids.filter(id => !id.startsWith('COV-')).length,
  };
}

function validateBundle(root, value, {requireTracked}) {
  const label = 'Batch 1 registry set';
  assertExactKeys(
    value,
    [
      'schema_version',
      'registry_id',
      'classification',
      'subject_class',
      'phase',
      'repository',
      'preparation_basis_activation',
      'current_authority_requirement',
      'source_bindings',
      'semantic_scope',
      'required_roles',
      'target_requirements',
      'environment_requirements',
      'provider_account_requirements',
      'build_requirements',
      'content_subject_requirements',
      'execution_window_requirements',
      'compatibility_key_requirements',
      'checkpoint_registry_bindings',
    ],
    label,
  );
  validateHeader(value, 'mobile-ux-batch1-registry-set.v1', 'mobile-ux-architecture-v5-batch1', null, label);
  assertEqual(value.phase, 'batch_0b_preparation_only', `${label}.phase`);
  assertEqual(value.repository, 'LENKIN233/softbook_cet', `${label}.repository`);

  assertExactKeys(
    value.preparation_basis_activation,
    Object.keys(EXPECTED_ACTIVATION),
    `${label}.preparation_basis_activation`,
  );
  for (const [key, expected] of Object.entries(EXPECTED_ACTIVATION)) {
    assertEqual(
      value.preparation_basis_activation[key],
      expected,
      `${label}.preparation_basis_activation.${key}`,
    );
  }
  if (!SHA1_RE.test(value.preparation_basis_activation.approval_head)) {
    throw new Error(`${label}.preparation_basis_activation.approval_head must be a full lowercase Git SHA-1`);
  }
  assertUnresolvedExact(
    value.current_authority_requirement,
    {
      requirementId: 'current-exact-head-protected-preparation-decision',
      reasonCode: 'sensitive_classifier_drift_requires_new_exact_head_approval',
    },
    `${label}.current_authority_requirement`,
  );

  assertExactIds(value.source_bindings, 'path', SOURCE_PATHS, `${label}.source_bindings`);
  assertEqual(
    sha256(Buffer.from(JSON.stringify(value.source_bindings))),
    EXPECTED_SOURCE_BINDINGS_DIGEST,
    `${label}.source_bindings exact digest`,
  );
  const sourceBytes = new Map();
  for (const [index, binding] of value.source_bindings.entries()) {
    const bindingLabel = `${label}.source_bindings[${index}]`;
    assertExactKeys(binding, ['path', 'sha256'], bindingLabel);
    if (!SHA256_RE.test(binding.sha256)) throw new Error(`${bindingLabel}.sha256 must be lowercase SHA-256`);
    const bytes = readRegularFile(root, binding.path, `${bindingLabel}.path`);
    const digest = sha256(bytes);
    if (digest !== binding.sha256) {
      throw new Error(`${binding.path} SHA-256 drift: expected ${binding.sha256}, received ${digest}`);
    }
    sourceBytes.set(binding.path, bytes);
    if (requireTracked) assertCommittedAtHead(root, binding.path, bindingLabel);
  }

  assertExactKeys(
    value.semantic_scope,
    [
      'scope_id',
      'semantic_state_count',
      'forced_combination_count',
      'contract_id_title_owner_digest',
      'contract_semantic_digest',
      'ledger_semantic_digest',
      'pc_web_mapping_identity_digest',
    ],
    `${label}.semantic_scope`,
  );
  for (const [key, expected] of Object.entries(EXPECTED_SEMANTIC_SCOPE)) {
    assertEqual(value.semantic_scope[key], expected, `${label}.semantic_scope.${key}`);
  }
  const ledgerCounts = deriveLedgerCounts(
    sourceBytes.get(
      'docs/design/ux-architecture/2026-08-09-mobile-ux-architecture-v5/state-evidence-ledger.md',
    ).toString('utf8'),
  );
  assertEqual(ledgerCounts.total, 173, `${label} derived ledger obligation count`);
  assertEqual(ledgerCounts.semantic, 160, `${label} derived semantic state count`);
  assertEqual(ledgerCounts.forced, 13, `${label} derived forced combination count`);

  assertExactIds(value.required_roles, 'role_id', ROLE_IDS, `${label}.required_roles`);
  for (const [index, role] of value.required_roles.entries()) {
    const roleLabel = `${label}.required_roles[${index}]`;
    assertExactKeys(role, ['role_id', 'checkpoint_id', 'assignment'], roleLabel);
    const expected = ROLE_EXPECTATIONS[role.role_id];
    assertEqual(role.checkpoint_id, expected[0], `${roleLabel}.checkpoint_id`);
    assertUnresolvedExact(
      role.assignment,
      {requirementId: undefined, reasonCode: expected[1]},
      `${roleLabel}.assignment`,
    );
  }

  assertExactIds(value.target_requirements, 'target_id', TARGET_IDS, `${label}.target_requirements`);
  const sourcePaths = new Set(value.source_bindings.map(item => item.path));
  for (const [index, target] of value.target_requirements.entries()) {
    const targetLabel = `${label}.target_requirements[${index}]`;
    const expected = TARGET_EXPECTATIONS[target.target_id];
    assertExactKeys(
      target,
      ['target_id', 'checkpoint_id', 'target_class', 'platform_composition', 'document_path', 'candidate_system'],
      targetLabel,
    );
    assertEqual(target.checkpoint_id, expected.checkpoint, `${targetLabel}.checkpoint_id`);
    assertEqual(target.target_class, expected.targetClass, `${targetLabel}.target_class`);
    assertEqual(target.platform_composition, expected.composition, `${targetLabel}.platform_composition`);
    assertEqual(target.document_path, expected.document, `${targetLabel}.document_path`);
    if (!sourcePaths.has(target.document_path)) {
      throw new Error(`${targetLabel}.document_path must be SHA-256 bound as a source`);
    }
    readRegularFile(root, target.document_path, `${targetLabel}.document_path`);
    if (requireTracked) assertCommittedAtHead(root, target.document_path, `${targetLabel}.document_path`);
    assertUnresolvedExact(
      target.candidate_system,
      {requirementId: undefined, reasonCode: expected.candidateReason},
      `${targetLabel}.candidate_system`,
    );
  }

  assertExactIds(value.environment_requirements, 'environment_id', ENVIRONMENT_IDS, `${label}.environment_requirements`);
  for (const [index, environment] of value.environment_requirements.entries()) {
    const envLabel = `${label}.environment_requirements[${index}]`;
    const expected = ENVIRONMENT_EXPECTATIONS[environment.environment_id];
    assertExactKeys(environment, ['environment_id', 'environment_class', 'profile', 'candidate'], envLabel);
    assertEqual(environment.environment_class, expected[0], `${envLabel}.environment_class`);
    assertEqual(environment.profile, expected[1], `${envLabel}.profile`);
    assertUnresolvedExact(
      environment.candidate,
      {requirementId: undefined, reasonCode: expected[2]},
      `${envLabel}.candidate`,
    );
  }

  assertExactIds(
    value.provider_account_requirements,
    'account_requirement_id',
    ACCOUNT_IDS,
    `${label}.provider_account_requirements`,
  );
  for (const [index, account] of value.provider_account_requirements.entries()) {
    const accountLabel = `${label}.provider_account_requirements[${index}]`;
    const expected = ACCOUNT_EXPECTATIONS[account.account_requirement_id];
    assertExactKeys(account, ['account_requirement_id', 'profile', 'provider_class', 'candidate'], accountLabel);
    assertEqual(account.profile, expected[0], `${accountLabel}.profile`);
    assertEqual(account.provider_class, expected[1], `${accountLabel}.provider_class`);
    assertUnresolvedExact(
      account.candidate,
      {requirementId: undefined, reasonCode: ACCOUNT_REASON_EXPECTATIONS[account.account_requirement_id]},
      `${accountLabel}.candidate`,
    );
  }

  assertExactIds(value.build_requirements, 'build_requirement_id', BUILD_IDS, `${label}.build_requirements`);
  for (const [index, build] of value.build_requirements.entries()) {
    const buildLabel = `${label}.build_requirements[${index}]`;
    const expected = BUILD_EXPECTATIONS[build.build_requirement_id];
    assertExactKeys(build, ['build_requirement_id', 'checkpoint_id', 'platform', 'candidate'], buildLabel);
    assertEqual(build.checkpoint_id, expected[0], `${buildLabel}.checkpoint_id`);
    assertEqual(build.platform, expected[1], `${buildLabel}.platform`);
    assertUnresolvedExact(
      build.candidate,
      {requirementId: undefined, reasonCode: BUILD_REASON_EXPECTATIONS[build.build_requirement_id]},
      `${buildLabel}.candidate`,
    );
  }

  assertExactIds(
    value.content_subject_requirements,
    'content_requirement_id',
    CONTENT_IDS,
    `${label}.content_subject_requirements`,
  );
  for (const [index, content] of value.content_subject_requirements.entries()) {
    const contentLabel = `${label}.content_subject_requirements[${index}]`;
    assertExactKeys(content, ['content_requirement_id', 'profile', 'candidate'], contentLabel);
    assertEqual(content.profile, CONTENT_EXPECTATIONS[content.content_requirement_id], `${contentLabel}.profile`);
    assertUnresolvedExact(
      content.candidate,
      {requirementId: undefined, reasonCode: CONTENT_REASON_EXPECTATIONS[content.content_requirement_id]},
      `${contentLabel}.candidate`,
    );
  }

  assertExactIds(
    value.execution_window_requirements,
    'window_requirement_id',
    WINDOW_IDS,
    `${label}.execution_window_requirements`,
  );
  for (const [index, window] of value.execution_window_requirements.entries()) {
    const windowLabel = `${label}.execution_window_requirements[${index}]`;
    assertExactKeys(window, ['window_requirement_id', 'checkpoint_id', 'clock_basis', 'window_plan'], windowLabel);
    assertEqual(window.checkpoint_id, WINDOW_EXPECTATIONS[window.window_requirement_id], `${windowLabel}.checkpoint_id`);
    assertEqual(window.clock_basis, 'UTC', `${windowLabel}.clock_basis`);
    assertUnresolvedExact(
      window.window_plan,
      {requirementId: undefined, reasonCode: WINDOW_REASON_EXPECTATIONS[window.window_requirement_id]},
      `${windowLabel}.window_plan`,
    );
  }

  assertExactIds(
    value.compatibility_key_requirements,
    'compatibility_key_requirement_id',
    COMPATIBILITY_KEY_IDS,
    `${label}.compatibility_key_requirements`,
  );
  for (const [index, compatibility] of value.compatibility_key_requirements.entries()) {
    const compatibilityLabel = `${label}.compatibility_key_requirements[${index}]`;
    assertExactKeys(
      compatibility,
      ['compatibility_key_requirement_id', 'checkpoint_id', 'candidate'],
      compatibilityLabel,
    );
    assertEqual(
      compatibility.checkpoint_id,
      COMPATIBILITY_KEY_EXPECTATIONS[compatibility.compatibility_key_requirement_id],
      `${compatibilityLabel}.checkpoint_id`,
    );
    assertUnresolvedExact(
      compatibility.candidate,
      {requirementId: undefined, reasonCode: 'exact_compatibility_key_missing'},
      `${compatibilityLabel}.candidate`,
    );
  }

  assertExactIds(
    value.checkpoint_registry_bindings,
    'checkpoint_id',
    CHILDREN.map(item => item.checkpoint),
    `${label}.checkpoint_registry_bindings`,
  );
  return value.checkpoint_registry_bindings.map((binding, index) => {
    const bindingLabel = `${label}.checkpoint_registry_bindings[${index}]`;
    const expected = CHILDREN[index];
    assertExactKeys(binding, ['checkpoint_id', 'path', 'sha256'], bindingLabel);
    assertEqual(binding.path, expected.path, `${bindingLabel}.path`);
    if (!SHA256_RE.test(binding.sha256)) throw new Error(`${bindingLabel}.sha256 must be lowercase SHA-256`);
    const bytes = readRegularFile(root, binding.path, `${bindingLabel}.path`);
    const digest = sha256(bytes);
    if (digest !== binding.sha256) {
      throw new Error(`${binding.path} SHA-256 drift: expected ${binding.sha256}, received ${digest}`);
    }
    if (requireTracked) assertCommittedAtHead(root, binding.path, bindingLabel);
    const child = parseStrictJson(bytes, binding.path);
    return {bytes, child, digest, expected};
  });
}

function collectUnresolved(value, items = []) {
  if (Array.isArray(value)) {
    value.forEach(item => collectUnresolved(item, items));
  } else if (isRecord(value)) {
    if (value.kind === 'unresolved') {
      items.push(value.requirement_id ?? value.reason_code);
    }
    Object.values(value).forEach(child => collectUnresolved(child, items));
  }
  return items;
}

export function validateBatch1Registry({
  root = ROOT,
  requireTracked = false,
  consumer = ACCEPTED_CONSUMER,
} = {}) {
  if (consumer !== ACCEPTED_CONSUMER) {
    throw new Error(
      `registry_preparation cannot be consumed by ${consumer}; only ${ACCEPTED_CONSUMER} is permitted`,
    );
  }
  if (requireTracked) assertRepositoryHead(root);
  const registryBytes = readRegularFile(root, REGISTRY_PATH, 'Batch 1 registry set');
  if (requireTracked) assertCommittedAtHead(root, REGISTRY_PATH, 'Batch 1 registry set');
  const registry = parseStrictJson(registryBytes, REGISTRY_PATH);
  scanForbidden(registry);
  const children = validateBundle(root, registry, {requireTracked});
  for (const {child, digest, expected} of children) {
    scanForbidden(child, expected.path);
    if (expected.checkpoint === 'CP-BA') validateCpBa(root, child, {requireTracked});
    else if (expected.checkpoint === 'CP-CS') validateCpCs(root, child, {requireTracked});
    else validateCpWeb(root, child, {requireTracked});
    assertEqual(digest, expected.sha256, `${expected.path} exact reviewed SHA-256`);
  }

  const plannedPaths = children.flatMap(({child}) =>
    child.planned_manifest_registry.map(item => item.planned_path),
  );
  if (new Set(plannedPaths).size !== plannedPaths.length) {
    throw new Error('planned manifest paths must be globally unique across checkpoints');
  }
  assertPlannedManifestSubtreeEmpty(root, {requireTracked});

  const unresolved = [...new Set(collectUnresolved(registry))].sort();
  for (const {child} of children) collectUnresolved(child, unresolved);
  const uniqueUnresolved = [...new Set(unresolved)].sort();
  if (uniqueUnresolved.length === 0) {
    throw new Error('preparation schema unexpectedly contains no unresolved inputs');
  }

  const subjectDigest = sha256(
    Buffer.concat([
      Buffer.from(`${REGISTRY_PATH}\0`),
      registryBytes,
      ...children.flatMap(({bytes, expected}) => [Buffer.from(`${expected.path}\0`), bytes]),
    ]),
  );

  return {
    schema_version: 'mobile-ux-batch1-registry-validation.v1',
    artifact_valid: true,
    subject_class: 'registry_preparation',
    registry_set_digest: subjectDigest,
    registry_set_sha256: sha256(registryBytes),
    child_registries: children.map(({digest, expected}) => ({
      checkpoint_id: expected.checkpoint,
      path: expected.path,
      sha256: digest,
    })),
    semantic_obligation_count: 173,
    pc_web_matrix_count: 12,
    cp_cs_scenario_count: 12,
    unresolved_input_count: uniqueUnresolved.length,
    unresolved_inputs: uniqueUnresolved,
    current_authority_state: 'requires_new_exact_head_protected_preparation_decision',
    next_stage_readiness: 'blocked_unresolved_inputs',
    freeze_readiness: 'ineligible_preparation_schema',
    manifest_freeze_eligible: false,
    schema_transition_required: true,
    decision_status: 'not_evaluated',
    gate_effect: 'none',
    gate_eligible: false,
    evidence_eligible: false,
    provisioning_authorized: false,
    execution_authorized: false,
    collection_authorized: false,
    aggregation_authorized: false,
    promotion_authorized: false,
    visual_exploration_authorized: false,
    implementation_authorized: false,
    native_acceptance_authorized: false,
    release_authorized: false,
    allowed_next_action: 'obtain_exact_head_preparation_approval_then_create_separate_freeze_candidate_schema',
  };
}

function parseArgs(argv) {
  const options = {
    root: ROOT,
    requireTracked: false,
    consumer: ACCEPTED_CONSUMER,
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const take = () => {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value`);
      return value;
    };
    if (argument === '--root') options.root = path.resolve(take());
    else if (argument === '--require-tracked') options.requireTracked = true;
    else if (argument === '--consumer') options.consumer = take();
    else if (argument === '--json') options.json = true;
    else throw new Error(`unknown argument: ${argument}`);
  }
  return options;
}

function main() {
  try {
    const options = parseArgs(process.argv.slice(2));
    const result = validateBatch1Registry(options);
    if (options.json) console.log(JSON.stringify(result, null, 2));
    else {
      console.log(
        `MOBILE UX BATCH1 REGISTRY OK: subject=${result.registry_set_digest} authority=${result.current_authority_state}`,
      );
      console.log(
        'NON-CLAIM: structural preparation does not authorize provisioning, execution, evidence collection, aggregation, promotion, visual exploration, implementation, native acceptance, or release',
      );
    }
  } catch (error) {
    console.error(
      `MOBILE UX BATCH1 REGISTRY FAILED: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
