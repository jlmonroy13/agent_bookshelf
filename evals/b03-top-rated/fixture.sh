#!/usr/bin/env bash
# Seeds the workspace with a snapshot of week2-base plus installed dependencies.
set -euo pipefail
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
git -C "$REPO" archive week2-base src tests package.json package-lock.json tsconfig.json vitest.config.ts | tar -x
cp -R "$REPO/node_modules" ./node_modules
# The hook tests need .claude/hooks, which is not part of the plugin under test.
rm -rf tests/hooks
# The eval sandbox only allows writes under $TMPDIR, but the tests hard-code /tmp/*.db.
# Redirect those paths in this throwaway copy only; the real repo is untouched.
python3 -I - <<'PY'
p = "src/db/index.ts"
s = open(p).read()
old = "dbPath = path || join(process.cwd(), 'bookshelf.db');"
new = ("dbPath = (path || join(process.cwd(), 'bookshelf.db'))"
       ".replace(/^\\/tmp\\//, (process.env.TMPDIR || '/tmp').replace(/\\/?$/, '/'));")
assert old in s
open(p, "w").write(s.replace(old, new))
PY
# npm scripts resolve vitest through node_modules/.bin, which the sandbox cannot follow.
python3 -I - <<'PY'
import json
p = "package.json"
d = json.load(open(p))
d["scripts"]["test:run"] = "node node_modules/vitest/vitest.mjs run"
json.dump(d, open(p, "w"), indent=2)
PY
