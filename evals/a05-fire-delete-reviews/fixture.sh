#!/usr/bin/env bash
# Seeds the run's empty workspace with a snapshot of the week2-base branch.
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
git -C "$REPO" archive week2-base src tests package.json tsconfig.json | tar -x
