# Agent run: mobile source nativeID leak scan

- Date: 2026-05-24
- Branch: `infra/mobile-source-nativeid-leak-scan`
- Scope: harden mobile metadata leak scanning for rendered element props.

## Referenced specs

- `spec/authority-map.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/evals.json`
- `spec/visual-language.json`

## product_truth

User-visible UI and user-reachable rendered props must not expose raw source or harness metadata. Source provenance such as `sourceLabel`, `sourceId`, `source_label`, `source_id`, `cardRecords`, and `card_records` remains implementation metadata, not product copy or UI identity.

## implementation_hypothesis

React Native rendered element identity props can leak through more than `testID`. `nativeID` is also rendered/reachable and should be scanned with the same source-metadata template guard.

## Changes

- Extended the mobile metadata leak scanner rendered-prop guard from `testID` to `testID` and `nativeID`.
- Added a harness fixture for `SourceNativeIdLeak.tsx` to keep this case mechanically covered by `validate_harness.py`.

## Validation

- 2026-05-28: `node apps/mobile/scripts/check-metadata-leaks.mjs` -> PASS: No metadata leaks detected in visible text.
- 2026-05-28: `python3 scripts/validate_harness.py` -> HARNESS VALIDATION OK

## Notes

- No user-visible UI implementation changed.
- No new design artifact is introduced; this is a guardrail-only scanner/harness update.
