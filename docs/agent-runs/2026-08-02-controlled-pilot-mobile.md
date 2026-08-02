# Agent Run Record: CET4 Controlled Pilot Mobile Lifecycle

## Task summary

- Date: 2026-08-02
- Branch: `cross/controlled-pilot-mobile`
- PR: pending
- Summary: Wired the accepted CET4 controlled-pilot lifecycle into the shared iOS/Android React Native client: server-triggered trial notice, exact five-card completion receipt and continuation, restart-safe pending receipt, read-only pending-round review, fixed pilot identity, server-time entitlement display, and removal of all controlled-pilot payment/self-grant actions.

## Referenced specs

- `AGENTS.md`
- `spec/requirement-memory.json`
- `spec/authority-map.json`
- `spec/product-core.json`
- `spec/account-sync-contract.json`
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

## Implementation hypothesis changed

- Extended the mobile Learning Session model and strict parser with `generated_at`, `trial_remaining_seconds`, and `round_completion`; a response cannot contain both a selection and a completion receipt.
- Added an exact authenticated continue request and strict acknowledgement parser. Content version, track, completed count, and receipt ID are sent exactly as received from the server.
- Persisted the pending server receipt and the first-card notice marker in `user-state.v3`; v1/v2 state migrates without inventing pilot state. A pending receipt is retained across restart/offline and cleared only by a successful continue acknowledgement or a later authoritative session without that receipt for the same content/track.
- Added a fixed CET4 pilot slip and non-blocking first-card notice to Learning, a three-action round completion surface, a read-only pending-round review surface, and a no-payment server-time entitlement card in Mine.
- Added `pilot_premium` presentation and access handling without treating it as a purchase or overwriting base membership.

## Workspace boundary and read scope

- Active truth/source read: only the referenced specs, accepted design authority/mapping, relevant mobile source/tests, and already-implemented controlled-pilot runtime response contracts.
- Generated/dependency/cache/archive read: the existing mobile `node_modules` was linked temporarily into this worktree only to execute the repository toolchain; it is not part of the commit.
- External workspace read: none. `/Users/lenkin/programing/card make` was not modified and no development fixture was counted as approved pilot content.

## Files changed

- `apps/mobile/App.tsx`: lifecycle orchestration, receipt persistence/continue, read-only review routing, pilot Space gate copy, fixed Mine identity and server-time entitlement display.
- `apps/mobile/src/learning/ControlledPilotRoundCompletionSurface.tsx`: accepted three-action completion object and read-only pending-round review.
- `apps/mobile/src/learning/LearningSurface.tsx`: fixed pilot identity and non-blocking first-valid-card notice.
- `apps/mobile/src/learning/model.ts`, `sessionCore.ts`, `remoteLearningSession.ts`, `learningRepository.ts`, and `remoteCardSource.ts`: strict response/continue contracts and shared session mapping.
- `apps/mobile/src/membership/localMembership.ts` and `membershipRepository.ts`: server remaining-time field and pilot entitlement stage.
- `apps/mobile/src/persistence/userStateStore.ts` and `src/bootstrap/accountBootstrapHydration.ts`: restart-safe receipt/notice persistence and content-bound reconciliation.
- `apps/mobile/__tests__/*`: parser, persistence, bootstrap, membership, UI and exact-action regression coverage.

## Commands run

- Exact Node 22.13.0 TypeScript check: `node typescript/bin/tsc --noEmit -p apps/mobile/tsconfig.json` -> passed.
- Exact Node 22.13.0 full Jest suite: `node jest/bin/jest.js --config apps/mobile/jest.config.js --runInBand` -> passed, 46 suites and 444 tests.
- Exact Node 22.13.0 `npm --prefix apps/mobile test -- --runInBand`, including metadata and dependency compatibility pretests -> passed, 46 suites and 444 tests.
- Exact Node 22.13.0 ESLint over App, source and tests -> passed with 0 errors and 14 existing inline-style warnings.
- Mobile and design metadata leak scans -> passed after narrowing the scanner to allow only the exact accepted `CET4 受控试点` identity and to distinguish parser/type declarations from rendered copy; raw CET labels and metadata expressions remain rejected by harness fixtures.
- `python3 scripts/validate_harness.py` -> passed, `HARNESS VALIDATION OK`.
- Prettier over changed mobile source/tests -> passed.
- `git diff --check` -> passed.

## Validation results

- The first-card notice is attached to the current card, has no acknowledgement action, and appears only when the controlled-pilot client observes the first server response whose generation time equals the atomic trial start time.
- Learning Session parsing fails closed on undocumented fields, invalid trial timelines, selection/completion conflicts, malformed receipts and wrong access/stage combinations.
- Continue posts only the exact server receipt tuple and accepts only a matching acknowledged/duplicate server response.
- The completion surface has exactly the accepted review, Space and continue actions. Continue is the only primary action; failed continue retains the receipt for retry.
- Pending-round review performs no learning-event submission and returns to the same completion receipt.
- Mine and restricted Space expose no purchase or self-grant action in controlled-pilot mode and clearly state that the pilot is free and eligibility is operationally granted.
- `trial_remaining_seconds` is rendered from server data; the client does not subtract device time or independently determine expiry.
- `user-state.v3` round-trips the exact receipt and notice marker; legacy migration creates neither.

## Binary evidence

- Evidence manifest: N/A.
- Archive: N/A. No simulator/device screenshot is claimed as formal or pilot evidence in this run.

## Agent review status

- Reviewer: Codex
- Status: Passed
- Blocking findings: none in the repository implementation.
- Review summary: Reviewed authority separation, first-session atomic trigger mapping, receipt retention/clearing, restart and offline behavior, read-only review safety, no-payment controlled-pilot branches, `pilot_premium` handling, strict parser surfaces, account-bound persistence, and design implementation mapping. The review found and prevented one unsafe approach: normal review event submission cannot run while the server is gating the next selection, so pending-round review is explicitly read-only.

## User-visible UI impact

- Design source: `docs/design/decisions/controlled-pilot-lifecycle-decision-v1.md`, `docs/design/interaction-motion/controlled-pilot-lifecycle-v1.md`, and `docs/design/mapping/controlled-pilot-lifecycle-implementation-map-v1.md` from the separate design-only branch/PR.
- Implementation mapping: Learning identity/start slip -> `LearningSurface`; fifth-event receipt/read-only review -> `ControlledPilotRoundCompletionSurface`; Space continuity -> completion address plus existing Space route; entitlement ledger -> controlled branch of `MembershipHostCard`.
- Q1 / Law of One: Learning continues to use the current card library tone as the single strong accent. Pilot identity and entitlement chrome are restrained secondary layers and do not introduce another competing library identity.
- Q2 / focal path: The learning card remains focal, followed by the attached pilot slip and then shell chrome. At the boundary, the completion receipt is focal, the Space address is secondary, and continue is the sole primary action.
- Q3 / silhouette: Learning preserves the accepted single-card silhouette. The boundary uses the accepted compact receipt silhouette rather than pretending to be another learning interaction.
- Q4 / forbidden patterns: No gradient text, gamification chrome, full-width tab bar, pure black/white token override, serif, four-level self-assess, or red “再回看” state was added.
- Q5 / containment: Compact branches cover 320-point/short-phone layouts; actions use contained cards and minimum 46/50-point controls. Automated component coverage passes; real small-screen/dynamic-type device evidence remains an external acceptance gate.
- Q6 / Learning-specific: No module selector was added. Existing flip remains exactly “有把握 / 再回看”; the new pending review is read-only and does not create a third self-assess model.
- AP-22/VL-AP-07: satisfied through the separate accepted design authority, interaction/motion artifact, implementation mapping, and the six checklist answers above.

## Card make external workspace impact

- None. No candidate card, audio, approval, QC record or 120-card export was produced or approved in this run.

## Risks and open questions

- The design and contract PR stack still requires protected product-owner approval; this implementation must not bypass or replace it.
- Real receiver environment, SMS, signed private content/audio, account deletion drill, weak-network/offline device run, TestFlight and Android closed-testing evidence remain pending external gates.
- The approved 120-card payload and audio/QC remain external deliverables. The ten repository development cards and automated fixtures are not content-volume evidence.
- Dynamic type and target-device visual containment are not proven by Jest and must be captured on real iOS/Android builds after receiver deployment.

## Follow-up

- Commit and push the mobile branch, open a stacked draft PR, record this run in its description, and run required checks/Agent review without merging ahead of the contract/design/runtime dependencies.
- After dependencies merge, retarget to `main`, obtain required checks and protected approvals, then merge automatically only when governance permits.
- Continue with externally approved 120-card payload import/audit/runtime smoke and receiver deployment/device evidence; do not substitute local fixtures.
