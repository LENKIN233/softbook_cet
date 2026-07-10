# Agent Run Record: mobile card_id leak scan

## Task summary

- Date: 2026-06-12
- Branch: `infra/mobile-card-id-leak-scan`
- PR: N/A
- Summary: Hardened the mobile metadata scanner so raw `card_id` / `cardId` metadata cannot be displayed in Text or visible/accessibility copy props.

## Referenced specs

- `spec/authority-map.json`
- `spec/workspace-boundary.json`
- `spec/harness-architecture.json`
- `spec/card-system.json`
- `spec/agent-harness.json`
- `spec/repo-delivery-contract.json`
- `spec/agent-run-record.json`
- `spec/evals.json`
- `spec/visual-language.json`

## Product truth used

- `spec/card-system.json` defines `card_id` as a required card identity field.
- `spec/visual-language.json` defines user-visible metadata leakage as a delivery blocker.
- `spec/agent-harness.json` and `spec/repo-delivery-contract.json` require harness/governance work to go through topic branch, validation, PR Agent review, and a committed run record.

## Implementation hypothesis changed

- The mobile scanner already rejected many raw metadata field names. It now also rejects `card_id` and `cardId` when they reach visible Text or visible/accessibility copy props.
- The multiline visible-copy pending rule now only carries across lines when the JSX/object expression or template literal is actually unclosed. This prevents non-visible event handlers such as `onPress={() => onToggleSleepState(card.cardId)}` after a closed `label={...}` prop from being reported as visible copy.

## Workspace boundary and read scope

- Active truth/source read: `spec/card-system.json`, `spec/agent-harness.json`, `spec/visual-language.json`, `apps/mobile/scripts/check-metadata-leaks.mjs`, `apps/mobile/src/learning/sourceContract.ts`, `apps/mobile/src/space/SpaceSurface.tsx`, `scripts/harness_validator/sections/design_governance.py`.
- Generated/dependency/cache/archive read: none.
- External workspace read: none.

## Files changed

- `apps/mobile/scripts/check-metadata-leaks.mjs`: added `card_id` and `cardId` to raw metadata field-name detection; narrowed multiline visible-copy pending detection to unclosed expressions.
- `scripts/harness_validator/sections/design_governance.py`: added negative fixtures and snippet assertions for `card_id` / `cardId` leaks, plus a no-leak fixture for `cardId` event handlers after closed label props.
- `docs/agent-runs/2026-06-12-mobile-card-id-leak-scan.md`: recorded this harness/governance run.

## Commands run

- `git fetch --prune origin` -> success.
- Temporary fixture probe before the fix for `card.card_id` in Text and `cardId` in accessibility copy -> scanner incorrectly passed.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` after adding `card_id` / `cardId` -> initially exposed a false positive on `SpaceSurface.tsx` event handler after a closed `label={...}` prop.
- Temporary fixture probe after the pending-rule fix -> scanner failed as expected for `CardIdTextLeak.tsx` and `CamelCardIdPropLeak.tsx`, and did not report `CardIdHandlerNoLeak.tsx`.
- `node apps/mobile/scripts/check-metadata-leaks.mjs` -> `PASS: No metadata leaks detected in visible text.`
- `python3 scripts/validate_harness.py` -> `HARNESS VALIDATION OK`

## Validation results

- Local mobile scanner validation: pass.
- Local negative fixture validation: pass, expected scanner rejection observed.
- Full harness validation: pass.
- CI validation: pending PR.

## Agent review status

- Reviewer: pending PR agent review.
- Status: pending.
- Blocking findings: none known locally.

## User-visible UI impact

- None. This changes scanner and harness fixtures only; no screen, runtime UI, copy, or design artifact output changed.

## Card make external workspace impact

- N/A.

## Risks and open questions

- No known blocking risk. The added field names are exact raw metadata keys, and the pending-rule change reduces false positives instead of broadening runtime scan scope.

## Follow-up

- Open a PR, run required gates, record passed Agent review, and merge after checks are green.
