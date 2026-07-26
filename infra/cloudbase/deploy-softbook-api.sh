#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

exec node "${ROOT}/infra/cloudbase/manage-softbook-api.mjs" deploy "$@"
