# Access profile proofs

Reviewer-only orientation. The learner documents in this directory are two physically separate grayscale UX-architecture proofs:

Status: `proof_only`, `browser_scenario`, `native_pending`. Sources: `spec/membership.json`, `spec/account-sync-contract.json`, `spec/knowledge-map.json`, `spec/box-catalog.json`, and the adjacent grayscale UX state contract.

- `access-standard.html` + `access-standard.js`: formal commerce subset. It renders contextual Learning/Space origin preservation, truthful access comparison, purchase pending → unavailable/retry, restore pending → nothing-to-restore, and cancel/return. Purchase success, entitlement success, restore success, and account mismatch remain transcript-only.
- `access-managed.html` + `access-managed.js`: receiver-controlled read-only access subset. It renders base membership separately from additional complete access, refresh pending, active, absent, error, and exact-origin return. It contains no commerce, self-grant, or self-revoke controls or code.

Both documents share only `access-proofs.css`. There is no query/profile switch and no learner-visible reviewer panel. Evidence is browser-scenario proof only; native lifecycle, native store, accessibility-service, and formal entitlement evidence remain `native_pending`. These files are not visual acceptance or implementation authority.

The managed refresh sequence advances deterministic learner-safe read outcomes only so each recovery branch can be inspected. It does not claim a receiver result or a live entitlement read.
