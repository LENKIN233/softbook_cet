# Agent Run Record: CET4 Controlled Pilot Mobile Lifecycle

## Task summary

- Date: 2026-08-02
- Branch: `cross/controlled-pilot-mobile`
- PR: https://github.com/LENKIN233/softbook_cet/pull/475 (draft, stacked on `cross/controlled-pilot-design`; contains and depends on the exact runtime commits from PR #474)
- Summary: Wired the accepted CET4 controlled-pilot lifecycle into the shared iOS/Android React Native client, restored the authenticated product-entry boundary, and completed the real mobile account-deletion request lifecycle: signed-out/restoring users see only the dedicated phone/SMS entry, while an accepted deletion request removes the product shell and reports cleanup as pending rather than complete.

## Referenced specs

- `AGENTS.md`
- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
- `spec/platform-contract.json`
- `spec/membership.json`
- `spec/runtime-boundaries.json`
- `spec/visual-language.json`
- `spec/interactions.json`
- `spec/agent-run-record.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `infra/cloudbase/controlled-pilot-v1-runtime-contract.md`
- `infra/cloudbase/learning-events-v2-runtime-contract.md`
- `infra/cloudbase/learning-session-v1-runtime-contract.md`
- `docs/design/decisions/controlled-pilot-lifecycle-decision-v1.md`
- `docs/design/interaction-motion/controlled-pilot-lifecycle-v1.md`
- `docs/design/mapping/controlled-pilot-lifecycle-implementation-map-v1.md`
- `docs/design/single-card-ux-contract.md`

## Product truth used

- `product_truth`: The controlled pilot is fixed to CET4 on iOS and Android. It has no CET6 selector, payment path, or client-issued continuation eligibility.
- `product_truth`: Authentication, account browsing, failed content, and failed Learning Session reads do not start the trial. The first valid server-selected card atomically starts one 120-hour trial; the client displays but does not calculate the authority timeline.
- `product_truth`: Every positive multiple of five cumulative server-confirmed learning/review events creates one server receipt and blocks the next selection until explicit continue acknowledgement.
- `product_truth`: The round completion object exposes exactly review, Space, and continue. Pending-round review is read-only because the server has no active selection while continuation is pending.
- `product_truth`: Mine displays server timestamps, server-derived remaining seconds and the controlled-pilot identity. The free operational pilot has no fake purchase or self-service trial action.
- `product_truth`: Local tests and development cards are implementation evidence only; they are not approved 120-card content, receiver deployment, device evidence, beta evidence, or launch readiness.
- `product_truth`: The four-surface product shell is authenticated-only. Signed-out and unvalidated restoration states have a dedicated login entry and expose no Learning, Space, Statistics, Mine, or route navigation. Successful verification and account hydration enter Learning; login itself does not start the trial.
- `product_truth`: Account deletion is available only for a real remote account. A `202` response queues cleanup and revokes all sessions but does not prove worker completion; request failure must preserve the authenticated account and local data, while acceptance must immediately exit the shell and block any “删除完成” claim.

## Implementation hypothesis changed

- Extended the mobile Learning Session model and strict parser with `generated_at`, `trial_remaining_seconds`, and `round_completion`; a response cannot contain both a selection and a completion receipt.
- Added an exact authenticated continue request and strict acknowledgement parser. Content version, track, completed count, and receipt ID are sent exactly as received from the server.
- Persisted the pending server receipt and the first-card notice marker in `user-state.v3`; v1/v2 state migrates without inventing pilot state. A pending receipt is retained across restart/offline and cleared only by a successful continue acknowledgement or a later authoritative session without that receipt for the same content/track.
- Added a fixed CET4 pilot slip and non-blocking first-card notice to Learning, a three-action round completion surface, a read-only pending-round review surface, and a no-payment server-time entitlement card in Mine.
- Added `pilot_premium` presentation and access handling without treating it as a purchase or overwriting base membership.
- Replaced route-level login gates and the signed-out Mine embedding with one AppShell root boundary. Persistence restoration has a navigation-free holding state; login success and logout reset the route to Learning, while logout atomically returns to the dedicated entry.
- Split login recovery into verification, secure-session establishment, and account-hydration failure stages. A successfully verified SMS code can no longer be blamed when Keychain persistence or required account hydration fails; the shell remains closed and the retry copy names the actual unfinished step.
- Made every iOS Maestro flow that depends on a signed-out start clear both application state and Keychain state. This prevents a previously persisted authenticated session from bypassing the dedicated login boundary during later evidence runs.
- Added a remote-only Mine account-deletion action, one confirmation sheet, in-flight duplicate suppression, fixed safe failure/retry copy, strict `202` acceptance, account-bound local cleanup, and a neutral cleanup-pending notice on the dedicated login boundary.

## Workspace boundary and read scope

- Active truth/source read: only the referenced specs, accepted design authority/mapping, relevant mobile source/tests, and already-implemented controlled-pilot runtime response contracts.
- Generated/dependency/cache/archive read: the existing mobile `node_modules` was linked temporarily into this worktree only to execute the repository toolchain; it is not part of the commit.
- External workspace read: none. `/Users/lenkin/programing/card make` was not modified and no development fixture was counted as approved pilot content.

## Files changed

- `apps/mobile/App.tsx`: lifecycle orchestration, receipt persistence/continue, read-only review routing, pilot Space gate copy, fixed Mine identity and server-time entitlement display.
- `apps/mobile/App.tsx`: dedicated authentication/restoration entry, authenticated-only shell mounting, post-login Learning entry, and authenticated Mine logout action.
- `apps/mobile/App.tsx`: stage-owned login failure copy and recovery actions so verification, credential persistence, and account hydration are not collapsed into one false “验证码没通过” error.
- `apps/mobile/src/learning/ControlledPilotRoundCompletionSurface.tsx`: accepted three-action completion object and read-only pending-round review.
- `apps/mobile/src/learning/LearningSurface.tsx`: fixed pilot identity and non-blocking first-valid-card notice.
- `apps/mobile/src/learning/model.ts`, `sessionCore.ts`, `remoteLearningSession.ts`, `learningRepository.ts`, and `remoteCardSource.ts`: strict response/continue contracts and shared session mapping.
- `apps/mobile/src/membership/localMembership.ts` and `membershipRepository.ts`: server remaining-time field and pilot entitlement stage.
- `apps/mobile/src/persistence/userStateStore.ts` and `src/bootstrap/accountBootstrapHydration.ts`: restart-safe receipt/notice persistence and content-bound reconciliation.
- `apps/mobile/src/auth/authRepository.ts` and `authSessionCoordinator.ts`: authenticated `POST /v2/account/deletion`, exact `202` acceptance, and current-session coordination without clearing local state before server acceptance.
- `apps/mobile/App.tsx`: remote-only deletion entry, bounded confirmation/failure states, duplicate-submit lock, account cleanup, shell exit, and cleanup-pending entry notice.
- `apps/mobile/__tests__/*`: parser, persistence, bootstrap, membership, UI and exact-action regression coverage.
- `apps/mobile/e2e/maestro/ios-auth-space-gate-screenshot.yaml`, `ios-auth-statistics-gate-screenshot.yaml`, and the signed-out Mine auth-state flows: historical route-gate regressions now assert the dedicated entry and absence of all signed-out route tabs.
- `apps/mobile/e2e/maestro/ios-*.yaml`: signed-out setup now clears the iOS Keychain before application state so flows are isolated even though secure credentials survive reinstall/state clearing.
- `apps/web/src/App.tsx`: exhaustive internal-acceptance label mapping for the shared `pilot_premium` membership stage so the mobile type expansion cannot break Web typecheck/build.

## Commands run

- Exact Node 22.13.0 TypeScript check: `node typescript/bin/tsc --noEmit -p apps/mobile/tsconfig.json` -> passed.
- Exact Node 22.13.0 full Jest suite: `node jest/bin/jest.js --config apps/mobile/jest.config.js --runInBand` -> passed, 46 suites and 444 tests.
- Exact Node 22.13.0 `npm --prefix apps/mobile test -- --runInBand`, including metadata and dependency compatibility pretests -> passed, 46 suites and 444 tests.
- Exact Node 22.13.0 ESLint over App, source and tests -> passed with 0 errors and 14 existing inline-style warnings.
- Mobile and design metadata leak scans -> passed after narrowing the scanner to allow only the exact accepted `CET4 受控试点` identity and to distinguish parser/type declarations from rendered copy; raw CET labels and metadata expressions remain rejected by harness fixtures.
- `python3 scripts/validate_harness.py` -> passed, `HARNESS VALIDATION OK`.
- Prettier over changed mobile source/tests -> passed.
- `git diff --check` -> passed.
- Updated exact Node 22.13.0 full mobile test run -> passed, 46 suites and 445 tests, including dedicated-entry, restoration and signed-out route-absence coverage.
- `python3 scripts/validate_maestro_selectors.py` after rewriting the obsolete route-level auth flows -> passed.
- iPhone 17 Pro / iOS 26.5 simulator plus `ios-mine-signed-out-screenshot.yaml` -> passed: the dedicated entry/card, phone input and code action were visible; Learning, Space, Statistics and Mine route tabs were all absent.
- iPhone 17 Pro / iOS 26.5 simulator with a locally signed native build -> `ios-learning-home-screenshot.yaml` passed through phone/SMS login, Learning entry, two card interactions, navigation away and return; `ios-space-overview-screenshot.yaml` passed after explicit Keychain clearing.
- The first unsigned simulator build reproduced a secure-session failure with `errSecMissingEntitlement`; inspector evidence confirmed the SMS verification had succeeded and Keychain persistence failed. A normal “Sign to Run Locally” rebuild restored the login path. The unsigned run is retained only as diagnostic evidence and is not claimed as device or pilot evidence.
- Updated full mobile verification after failure-stage and Maestro isolation changes -> 46 suites / 445 tests, TypeScript, ESLint (0 errors; 14 existing inline-style warnings), metadata scans, Maestro selector validation, and `git diff --check` passed.
- 2026-08-03 full mobile verification after account-deletion wiring -> 46 suites / 450 tests, TypeScript, metadata scans, Maestro selector validation, and `git diff --check` passed; ESLint reported 0 errors and the same 14 existing inline-style warnings.
- 2026-08-03 exact Node 22.13.0 rerun -> 46 suites / 450 tests, TypeScript and ESLint passed; ESLint remained at 0 errors / 14 existing warnings.
- 2026-08-03 trigger-semantics evidence cleanup -> renamed the two local controlled-pilot tests to state the actual invariant, “first valid learning card is ready”, instead of the misleading “first authenticated entry”; targeted App verification passed 72/72 with metadata and dependency compatibility pretests.
- 2026-08-03 current-head simulator recheck -> after starting Metro for the installed debug build, cleared Keychain and application state, then reran `ios-mine-signed-out-screenshot.yaml` on iPhone 17 Pro / iOS 26.5. The dedicated login entry, phone input and request-code action were visible; Learning, Space, Statistics and Mine tabs were all absent. `/tmp/softbook-current-login-20260803.png` was visually inspected without a LogBox/debug warning overlay and remains local, non-formal evidence.
- 2026-08-03 iPhone 17 Pro / iOS 26.5 simulator destructive-path smoke -> passed against a temporary localhost auth receiver: real phone/SMS entry, authenticated Mine, visible irreversible-impact confirmation, authenticated `POST /v2/account/deletion`, shell removal after `202`, absent route tabs, and cleanup-pending entry notice. Screenshots were visually inspected at `/tmp/softbook-account-deletion-confirm.png` and `/tmp/softbook-account-deletion-pending.png`; the temporary receiver is not formal pilot evidence.
- Exact Node 22.13.0 PR-profile local gate run -> mobile lint/typecheck/Jest, Web lint/tests, backend 238 tests, full harness, dependency security, LFS and evidence checks passed. It surfaced the missing Web `pilot_premium` label mapping, which was fixed; targeted Web typecheck, 12 tests and production build then passed. The overall local report remains non-green because this stacked PR does not target `main`, while repository-health strict mode also reports the shared repository's 11 worktrees/20 topic branches plus the remotely configured `android-release` check. The report is not a GitHub required check or formal evidence.

## Validation results

- The first-card notice is attached to the current card, has no acknowledgement action, and appears only when the controlled-pilot client observes the first server response whose generation time equals the atomic trial start time.
- Learning Session parsing fails closed on undocumented fields, invalid trial timelines, selection/completion conflicts, malformed receipts and wrong access/stage combinations.
- Continue posts only the exact server receipt tuple and accepts only a matching acknowledged/duplicate server response.
- The completion surface has exactly the accepted review, Space and continue actions. Continue is the only primary action; failed continue retains the receipt for retry.
- Pending-round review performs no learning-event submission and returns to the same completion receipt.
- Mine and restricted Space expose no purchase or self-grant action in controlled-pilot mode and clearly state that the pilot is free and eligibility is operationally granted.
- `trial_remaining_seconds` is rendered from server data; the client does not subtract device time or independently determine expiry.
- `user-state.v3` round-trips the exact receipt and notice marker; legacy migration creates neither.
- The shared membership-stage union is now consumed exhaustively by the internal Web acceptance surface, preventing a future stage addition from silently rendering an undefined label.
- During persistence restoration, only the account-restoration state mounts. Once restoration resolves signed out, only the dedicated login surface mounts; the phone shell and tablet shell are outside that branch.
- Successful SMS verification hydrates the account before setting authenticated state and entering Learning. Failed verification remains on the same dedicated entry. Logout clears account runtime state and returns directly to the navigation-free entry.
- A post-verification credential persistence failure remains on the dedicated entry with “登录暂时未完成 / 验证码已通过” recovery copy and never exposes the product shell or native error metadata.
- iOS signed-out acceptance runs now explicitly clear secure session state; `clearState` alone is no longer treated as proof of a signed-out start.
- Account deletion is hidden in local-development auth, so a development reset cannot masquerade as service deletion. In remote auth it sends the active Bearer session and accepts only status `202`; status `200`, network failure, and other non-acceptance responses retain Mine and all local account state.
- The confirmation names Learning, Space, membership, and pilot-eligibility impact before mutation. While the request is pending both cancel and confirm are disabled. After acceptance the shell is absent and the entry says “账户删除已提交 / 数据清理完成前暂不能重新登录”, never “账户已删除”.

## Binary evidence

- Evidence manifest: N/A.
- Archive: N/A. Local iPhone 17 Pro simulator screenshots for Learning, Space, Statistics, Mine, and login recovery were visually inspected, but are not committed or claimed as formal pilot evidence.

## Agent review status

- Reviewer: Codex
- Status: Passed
- Blocking findings: none in the repository implementation.
- Review summary: Reviewed authority separation, authenticated-only shell mounting, restoration/login/logout transitions, first-session atomic trigger mapping, receipt retention/clearing, restart and offline behavior, read-only review safety, no-payment controlled-pilot branches, exhaustive `pilot_premium` handling across shared mobile/Web types, strict parser surfaces, account-bound persistence, and design implementation mapping. The old route-level and Mine-embedded login pattern is removed from both implementation and active Maestro assertions.

## User-visible UI impact

- Design source: `docs/design/decisions/controlled-pilot-lifecycle-decision-v1.md`, `docs/design/interaction-motion/controlled-pilot-lifecycle-v1.md`, and `docs/design/mapping/controlled-pilot-lifecycle-implementation-map-v1.md` from the separate design-only branch/PR.
- Implementation mapping: Learning identity/start slip -> `LearningSurface`; fifth-event receipt/read-only review -> `ControlledPilotRoundCompletionSurface`; Space continuity -> completion address plus existing Space route; entitlement ledger -> controlled branch of `MembershipHostCard`.
- Auth implementation mapping: accepted signed-out phone/code frames -> `AuthenticationEntrySurface`; account restoration -> `AuthenticationRestoringSurface`; entry-to-product transition -> the AppShell root branch; authenticated account exit -> the Mine logout action.
- Account-deletion mapping: authenticated Mine action -> `MineSurface`; confirmation/failure/pending state -> the bounded `Modal`; service acceptance -> `AuthRepository` + `AuthSessionCoordinator`; accepted-request shell exit and notice -> `AppShell` root boundary + `AuthenticationEntrySurface`.
- Internal Web compatibility mapping: the existing Mine membership row consumes the same semantic label, `受控试点资格`; no Web pilot route, selector, payment flow or external availability was added.
- Q1 / Law of One: Learning continues to use the current card library tone as the single strong accent. Pilot identity and entitlement chrome are restrained secondary layers and do not introduce another competing library identity.
- Q2 / focal path: Before authentication, the login card is the sole focal object and product navigation is absent. After authentication, the learning card remains focal, followed by the attached pilot slip and shell chrome. At the round boundary, the completion receipt is focal, the Space address is secondary, and continue is the sole primary action.
- Q3 / silhouette: Learning preserves the accepted single-card silhouette. The boundary uses the accepted compact receipt silhouette rather than pretending to be another learning interaction.
- Q4 / forbidden patterns: No signed-out tab bar, repeated route-level login, dashboard, fake payment, gradient text, gamification chrome, pure black/white token override, serif, four-level self-assess, or red “再回看” state was added.
- Q5 / containment: Compact branches cover 320-point/short-phone layouts; actions use contained cards and minimum 46/50-point controls. Automated component coverage and an iPhone 17 Pro simulator entry-flow check pass; real target-device small-screen/dynamic-type evidence remains an external acceptance gate.
- Q6 / Learning-specific: No module selector was added. Existing flip remains exactly “有把握 / 再回看”; the new pending review is read-only and does not create a third self-assess model.
- AP-22/VL-AP-07: satisfied through the separate accepted design authority, interaction/motion artifact, implementation mapping, and the six checklist answers above.

## Card make external workspace impact

- None. No candidate card, audio, approval, QC record or 120-card export was produced or approved in this run.

## Risks and open questions

- The design and contract PR stack still requires protected product-owner approval; this implementation must not bypass or replace it.
- Real receiver environment, SMS, signed private content/audio, deletion-worker completion/blocked re-login/clean re-registration drill, weak-network/offline device run, TestFlight and Android closed-testing evidence remain pending external gates. The localhost simulator smoke proves client behavior only.
- The approved 120-card payload and audio/QC remain external deliverables. The ten repository development cards and automated fixtures are not content-volume evidence.
- Dynamic type and target-device visual containment are not proven by Jest and must be captured on real iOS/Android builds after receiver deployment.

## Follow-up

- Commit and push the mobile branch, open a stacked draft PR, record this run in its description, and run required checks/Agent review without merging ahead of the contract/design/runtime dependencies.
- After dependencies merge, retarget to `main`, obtain required checks and protected approvals, then merge automatically only when governance permits.
- Continue with externally approved 120-card payload import/audit/runtime smoke and receiver deployment/device evidence; do not substitute local fixtures.
