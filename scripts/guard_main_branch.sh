#!/usr/bin/env bash

set -euo pipefail

ACTION="${1:-}"

if [[ -z "$ACTION" ]]; then
  echo "Usage: $0 <pre-commit|pre-merge-commit|pre-push|post-checkout>" >&2
  exit 1
fi

if git rev-parse --path-format=absolute --show-toplevel >/dev/null 2>&1; then
  ROOT_DIR="$(git rev-parse --path-format=absolute --show-toplevel)"
else
  ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

if [[ "${SOFTBOOK_ALLOW_MAIN_BYPASS:-0}" == "1" ]]; then
  exit 0
fi

current_branch() {
  if [[ -n "${SOFTBOOK_GIT_GUARD_BRANCH:-}" ]]; then
    printf '%s\n' "$SOFTBOOK_GIT_GUARD_BRANCH"
    return
  fi

  git -C "$ROOT_DIR" symbolic-ref --quiet --short HEAD 2>/dev/null || true
}

worktree_is_dirty() {
  if [[ -n "${SOFTBOOK_GIT_GUARD_DIRTY:-}" ]]; then
    [[ "$SOFTBOOK_GIT_GUARD_DIRTY" == "1" ]]
    return
  fi

  if ! git -C "$ROOT_DIR" diff --quiet --ignore-submodules --; then
    return 0
  fi

  if ! git -C "$ROOT_DIR" diff --cached --quiet --ignore-submodules --; then
    return 0
  fi

  return 1
}

print_main_block() {
  local action="$1"

  cat >&2 <<EOF
[softbook-guard] Blocked ${action} on main.
main is a read-only integration branch in this repository.
Create or switch to a topic branch first: infra/*, shell/*, module/*, cross/*, or fix/*.
If you truly need an emergency bypass, rerun with SOFTBOOK_ALLOW_MAIN_BYPASS=1.
EOF
}

print_main_dirty_warning() {
  cat >&2 <<'EOF'
[softbook-guard] Warning: you are on main with local modifications.
This is the exact dangerous state we want to avoid.
Move the work onto a topic branch immediately before editing further.
EOF
}

BRANCH="$(current_branch)"

if [[ "$BRANCH" != "main" ]]; then
  exit 0
fi

case "$ACTION" in
  pre-commit | pre-merge-commit)
    print_main_block "$ACTION"
    exit 1
    ;;
  pre-push)
    while IFS=' ' read -r local_ref _local_sha remote_ref _remote_sha; do
      if [[ "$local_ref" == "refs/heads/main" || "$remote_ref" == "refs/heads/main" ]]; then
        print_main_block "$ACTION"
        exit 1
      fi
    done
    exit 0
    ;;
  post-checkout)
    if worktree_is_dirty; then
      print_main_dirty_warning
      exit 1
    fi

    cat >&2 <<'EOF'
[softbook-guard] Reminder: main is read-only here.
Inspect from main if needed, but create a topic branch before making changes.
EOF
    exit 0
    ;;
  *)
    echo "Unsupported action: $ACTION" >&2
    exit 1
    ;;
esac
