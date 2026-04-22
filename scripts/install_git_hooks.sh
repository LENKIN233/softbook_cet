#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOKS_DIR="$ROOT_DIR/.githooks"

if ! git -C "$ROOT_DIR" rev-parse --git-dir >/dev/null 2>&1; then
  echo "Repository root is not a git repository: $ROOT_DIR" >&2
  exit 1
fi

for path in \
  "$ROOT_DIR/scripts/guard_main_branch.sh" \
  "$HOOKS_DIR/pre-commit" \
  "$HOOKS_DIR/pre-merge-commit" \
  "$HOOKS_DIR/pre-push" \
  "$HOOKS_DIR/post-checkout"; do
  if [[ ! -f "$path" ]]; then
    echo "Missing hook asset: $path" >&2
    exit 1
  fi
done

chmod +x \
  "$ROOT_DIR/scripts/guard_main_branch.sh" \
  "$HOOKS_DIR/pre-commit" \
  "$HOOKS_DIR/pre-merge-commit" \
  "$HOOKS_DIR/pre-push" \
  "$HOOKS_DIR/post-checkout"

git -C "$ROOT_DIR" config core.hooksPath "$HOOKS_DIR"

echo "Installed repository hooks from $HOOKS_DIR"
