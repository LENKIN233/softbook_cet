# Branching and Delivery

Referenced specs: `spec/machine-acceptance.json`,
`spec/repo-delivery-contract.json`, `spec/agent-harness.json`.

## Product and authority

- `main` is the read-only integration branch.
- The delivery target is `2026-09`.
- Product-internal decisions and acceptance belong to model+harness. No human,
  user, or product-owner click is a merge gate.
- Provider, credential, legal, deployment, device, and user-outcome facts must
  still be observed; automation must never invent them.

## Branches

Use one narrow topic branch from current `origin/main`:

- `infra/*` for infrastructure and CI;
- `shell/*` for application shell work;
- `module/*` for one product domain;
- `cross/*` for an explicitly cross-domain contract;
- `fix/*` for bounded repairs.

Do not develop, merge, or push directly on `main`. After creating a clone or
worktree, run `./scripts/install_git_hooks.sh`.

## Default delivery loop

1. Read the owning spec and task-relevant implementation.
2. Make the smallest coherent outcome change.
3. Run checks selected by risk and changed paths.
4. Review the exact diff with a model principal and record the concise result in
   the pull request.
5. Push, open or update the PR, enable auto-merge, and merge when required checks
   are green.

Do not create `docs/agent-runs` records for ordinary PRs. Real external actions
use their dedicated evidence schemas.

## Validation

- Product, runtime, content, security, and release validators remain owned by
  their domain specs.
- PR checks may skip an unrelated expensive build while retaining the required
  job name as a successful no-op. Pushes to `main`, schedules, and manual runs
  execute the full matrix.
- A new static guard requires a reproduced failure and a representative
  regression. State a policy once; do not mirror prose or eval answer lists in
  validators.
- Local reports are diagnostics, not substitutes for GitHub checks or actual
  external evidence.

## Merge blockers

Only these stop automatic merge:

- blocking exact-diff model findings;
- a failed required check;
- an objectively missing external capability needed by the change;
- permission or environment failure;
- an unrecoverable or destructive action outside the authorized product scope.

Stale local worktrees do not override GitHub merge state. Fast-forward a clean
local `main` mirror after the remote merge; never overwrite unrelated local work.
