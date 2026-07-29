# Agent Run Record: Learning audio player

## Task summary

- Date: 2026-07-29
- Branch: `module/learning-audio-player`
- PR: N/A at record creation
- Summary: Implement the accepted attached Learning audio control on iOS and Android, backed by the signed content manifest, verified local cache, bounded playback state, lifecycle pause, and user-safe recovery copy.

## Referenced specs

- `spec/requirement-memory.json`
- `spec/product-core.json`
- `spec/platform-contract.json`
- `spec/card-system.json`
- `spec/interactions.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `infra/cloudbase/content-manifest-v1-runtime-contract.md`
- `docs/design/decisions/learning-audio-control-decision-v1.md`
- `docs/design/mocks/learning-audio-control-v1.html`
- `docs/design/interaction-motion/learning-audio-control-v1.md`
- `docs/design/mapping/learning-audio-control-implementation-map-v1.md`

## Product truth used

- Audio is a card resource, not a sixth interaction family or a new card type.
- Playback begins only after an explicit user action; cards and application lifecycle events never autoplay or auto-resume it.
- The audio control is attached to the current card. Front-side subtitles remain optional and the back may show the transcript through the card contract.
- Runtime audio bytes come only from the authenticated, signed `content-manifest.v1` path and must pass the existing SHA-256 cache verification before native playback.
- User-visible failures expose bounded Chinese recovery copy, not URLs, hashes, native module names, stack traces, or provider details.

## Implementation hypothesis changed

- `LearningAudioPlayer` is a compact attached chip with exactly five UI states: `idle`, `loading`, `playing`, `paused`, and `error`.
- A platform-neutral controller owns preparation ordering, one retry, stale-card protection, explicit pause/resume, and lifecycle behavior.
- iOS uses `AVAudioPlayer`; Android uses Media3 ExoPlayer. Both native modules consume only a verified local file path.
- Cache corruption or preparation failure is retried once. If both attempts fail, network state selects either offline or temporary recovery copy.
- A card switch or component disposal stops playback; backgrounding and audio interruption pause without automatic recovery.

## Workspace boundary and read scope

- Active truth/source read: only the task-relevant product, platform, interaction, runtime, delivery, and visual contracts listed above; accepted Learning audio design artifacts; current mobile audio/cache/Learning/native build files and their tests.
- Generated/dependency/cache read: CocoaPods, Gradle, node modules, and Xcode DerivedData were used only for local build verification and are not delivery artifacts.
- External workspace read: none. `/Users/lenkin/programing/card make` and its content/audio records were not changed by this run.
- Database impact: none. No CloudBase environment was written, provisioned, deployed, or used for this implementation validation.

## Files changed

- `apps/mobile/src/audio/LearningAudioPlayer.tsx`: attached accessible audio chip and bounded visible states.
- `apps/mobile/src/audio/learningAudioController.ts`: platform-neutral playback, retry, lifecycle, and stale-card state control.
- `apps/mobile/src/audio/nativeLearningAudioEngine.ts`: typed React Native bridge and native-event filtering.
- `apps/mobile/src/audio/contentManifestRepository.ts`: exposes the existing exact-match guard as a TypeScript assertion so the resolver preserves the validated non-null asset fact.
- `apps/mobile/src/learning/LearningSurface.tsx`: resolves the current card's exact signed-manifest audio and renders the attached resource slot.
- `apps/mobile/App.tsx`: passes the authenticated Learning session manifest to the surface.
- `apps/mobile/android/app/build.gradle`: adds the Media3 ExoPlayer runtime dependency.
- `apps/mobile/android/app/src/main/java/com/softbook/cet/MainApplication.kt`: registers the application-owned audio package.
- `apps/mobile/android/app/src/main/java/com/softbook/cet/audio/SoftbookAudioPlayerModule.kt`: Media3 native player, audio focus, lifecycle pause, and bounded events.
- `apps/mobile/android/app/src/main/java/com/softbook/cet/audio/SoftbookAudioPlayerPackage.kt`: React Native package registration.
- `apps/mobile/ios/SoftbookCET/SoftbookAudioPlayer.m`: AVAudioPlayer module, spoken-audio session, interruption/background pause, and bounded events.
- `apps/mobile/ios/SoftbookCET.xcodeproj/project.pbxproj`: includes the iOS module in the application target.
- `apps/mobile/jest.setup.js`: supplies the existing blob-cache dependency mock for component tests.
- `apps/mobile/__tests__/learningAudioController.test.ts`: covers state, retry, offline, stale-card, interruption, and error behavior.
- `apps/mobile/__tests__/LearningSurface.test.tsx`: covers manifest-to-card integration, accessibility, and metadata non-disclosure.
- `spec/runtime-boundaries.json`: records implemented local audio runtime boundaries and remaining remote/device evidence.
- `infra/cloudbase/content-manifest-v1-runtime-contract.md`: updates repository implementation status without claiming deployment or release readiness.
- `docs/agent-runs/2026-07-29-learning-audio-player.md`: this run record.

## Commands run

- `npm ci` in `apps/mobile` -> passed.
- Focused audio and Learning Jest -> passed, 2 suites and 15 tests after final controller changes.
- Full mobile Jest -> passed after final controller hardening, 44 suites and 410 tests.
- `npm run typecheck` in `apps/mobile` -> passed.
- `npm run lint` in `apps/mobile` -> passed with pre-existing inline-style warnings only and zero errors.
- `npm run design-metadata-leak-scan` in `apps/mobile` -> passed.
- Android `./gradlew :app:compileDebugKotlin` with the repository JDK/SDK -> passed after the final native event payload change and upgrade to the official current stable Media3 1.10.1. The first dependency fetch failed because Gradle did not inherit the local HTTP proxy; a command-scoped, non-secret proxy configuration completed the fetch and compile.
- `pod install` -> passed for local build materialization; CocoaPods checksum-only lockfile churn was discarded.
- `xcodebuild -workspace SoftbookCET.xcworkspace -scheme SoftbookCET -configuration Debug -sdk iphonesimulator -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build` -> passed.
- `npm ci` then `npm test` in `infra/cloudbase/functions/softbook-api` -> passed, 170 tests. The pre-install attempt failed only because that fresh worktree had no backend dependencies.
- `python3 scripts/validate_maestro_selectors.py` -> passed.
- `node scripts/validate_dependency_security.mjs` -> passed with zero vulnerabilities for mobile and CloudBase API targets.
- `python3 scripts/validate_harness.py --skip-remote-guard --format text` -> passed with local completeness partial.
- `scripts/run_local_gates --profile dev` -> passed with one safe exception, 19/20 passed plus the documented Node 25.9.0 versus expected 22.13.0 development-only toolchain drift; no gate failed.
- `python3 scripts/validate_harness.py --format text` -> failed only on the known governance transition: remote branch protection already requires `android-release`, while the local expected-context list will include it only after the separate Android Release gate PR lands.
- `jq empty spec/runtime-boundaries.json` -> passed.
- `git diff --check` -> passed.

## Validation results

- Controller/component focused tests: pass, 15/15.
- Mobile full suite: pass, 410/410 after final controller hardening.
- Mobile typecheck: pass.
- Mobile lint: pass with zero errors.
- Visible/design metadata scans: pass.
- Android native compilation: pass.
- iOS simulator native compilation and link: pass.
- CloudBase backend tests: pass, 170/170 after dependency installation.
- Maestro selector validation: pass.
- Dependency security validation: pass, zero reported vulnerabilities.
- Local harness without remote guard: pass.
- Local `dev` gate profile: pass with the documented development-only Node version exception and zero failed gates.
- Full remote-guard harness: expected-context mismatch only (`android-release` exists remotely but is not yet in this branch's local truth); no runtime or audio finding.
- Real signed private audio playback on simulator/physical devices: pending because this branch has no approved release bundle, receiver credentials, or releasable 301-item QC set.

## Design review checklist

- Q1 / Law of One: The card's active library accent is reused for the attached chip; error amber is semantic feedback only and no second library identity is introduced.
- Q2 / focal object: The CET card remains the focal object. The read path is prompt -> attached audio resource -> interaction tools -> shell chrome.
- Q3 / silhouette: The five canonical card silhouettes remain unchanged. Audio occupies the accepted attached resource slot and is not promoted into an interaction family or transport shelf.
- Q4 / forbidden patterns: No gradient text, gamification chrome, waveform animation, full-width tab bar, pure black/white surface, serif, four-state self-assess, or technical metadata is introduced.
- Q5 / containment: The accepted design artifact defines 320dp containment and the implementation enforces a single-line shrinking label, 44dp minimum target, bounded width, and no waveform. Real runtime screenshots remain pending until a signed private asset is available.
- Q6 / Learning: Learning stays system-sequenced and does not expose module selection. Flip remains exactly `有把握` and `再回看`; audio is orthogonal to scoring.
- AP-22: All six answers are recorded before PR delivery and map directly to the accepted design-only artifact.
- AP-23: This run does not alter self-assess semantics or colors.
- VL-AP-07: Checklist and remaining visual-evidence gap are explicit; native compile and component evidence are not represented as a completed real-device review.

## Agent review status

- Reviewer: Codex independent PR implementation review.
- Status: Passed.
- Blocking findings: None for the repository implementation scope.
- Review evidence: controller/player/cache/manifest tests (31 focused assertions), TypeScript typecheck, ESLint, diff checks, native Release builds, backend tests, selector validation, and the recorded remote required checks were rechecked on 2026-07-29.
- Merge remains fail-closed until the full harness can be re-run after the Android Release gate lands and every required check passes. Real signed-asset and device evidence remains a beta-release gap, not a completed claim.

## User-visible UI impact

- Yes. Cards with a valid manifest-bound audio reference gain an attached chip for play, preparation, pause, resume, offline retry, and temporary retry.
- The control never displays a download URL, asset hash, provider, native module, or raw error.
- Cards without a valid exact manifest binding remain unchanged and do not render an unverified audio control.

## Design source and implementation mapping

- Accepted decision: `docs/design/decisions/learning-audio-control-decision-v1.md`.
- Accepted mock: `docs/design/mocks/learning-audio-control-v1.html`.
- Interaction/motion source: `docs/design/interaction-motion/learning-audio-control-v1.md`.
- Implementation map: `docs/design/mapping/learning-audio-control-implementation-map-v1.md`.
- Attached chip -> `LearningAudioPlayer`; five-state behavior -> `LearningAudioController`; verified bytes -> `reactNativeContentAssetCache`; iOS native path -> `SoftbookAudioPlayer.m`; Android native path -> `SoftbookAudioPlayerModule.kt`.
- Physical-space source: N/A; Space is unchanged.
- Unimplemented gaps: real signed asset playback, 320dp and standard-size runtime screenshots on both platforms, physical-device speaker/headphone and interruption checks, release signing/key injection, and the 301/301 human listening/QC evidence.

## Card make external workspace impact

- None. This run neither produced nor approved candidate cards or audio, and it did not modify `/Users/lenkin/programing/card make`.
- Existing technical hash/decoder results are not converted into listening approval by this implementation.

## Risks and open questions

- Native source compiles on both platforms, but actual playback requires an authenticated signed manifest and private asset bytes; that evidence is deliberately still open.
- The accepted 320dp design containment has component-level constraints but needs real runtime screenshot proof once a releasable audio asset is available.
- Android release signing remains governed by the separate Release-build gate work and receiver-owned secrets.
- CET4 audio corpus launch readiness remains false until all 301 references have QC records and human listening acceptance.

## Follow-up

- Obtain or produce the approved 301-item audio QC set in `card make`, then build a signed release bundle.
- Run iOS and Android simulator plus physical-device playback checks for cache hit/miss, expired URL, corruption retry, offline, card switch, app background, interruption, speaker, and headphones.
- Capture current-real-app small/standard phone evidence only after the signed manifest/private-asset path is executable.
- Keep CloudBase publish and blank-environment rehearsal blocked until content approval and audio QC evidence are complete.
