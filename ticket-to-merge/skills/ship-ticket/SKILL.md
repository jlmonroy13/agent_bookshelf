---
name: ship-ticket
description: Ship a ticket test-first with builder agents - test-writer writes failing tests from the spec, implementer makes them pass, a Stop-hook gate refuses to finish while the suite is red. `/ship-ticket [spec path]` builds; `/ship-ticket fix` applies the findings from the last /review-pr. Use when the user asks to build or ship a ticket.
argument-hint: "[SPEC.md path] | fix"
disable-model-invocation: true
hooks:
  Stop:
    - hooks:
        - type: command
          command: node
          args: ["${CLAUDE_PLUGIN_ROOT}/hooks/gate.mjs"]
---

# /ship-ticket

You are the orchestrator. You do not write tests or implementation yourself: you dispatch the
`test-writer` and `implementer` agents, check their work with git and the test suite, and commit
checkpoints. Keep your own messages short; every token you spend here is build cost.

**Run every agent in the foreground** (`run_in_background: false`) and wait for its result before the next
step. The steps are sequential, and if you end your turn while an agent works, the Stop gate runs the
suite on half-finished code.

Arguments: `$ARGUMENTS`. If it is `fix`, go to **Fix mode**. Otherwise it is the spec path (default `SPEC.md`).

## Build mode

### 0. Preflight
1. Read the spec and `CLAUDE.md`. If the spec has no acceptance criteria or no interface, stop and ask the user.
2. `git status --porcelain` must be clean (commit or stash first, ask the user). Note the current branch; refuse to work on `main`.
3. Run `npm run test:run`. It must be green before you start; if not, stop and report.

### 1. RED: tests first
1. Dispatch **test-writer** with the full spec text. Ask for one test per acceptance criterion.
2. Run `npm run test:run` yourself. Check:
   - the new tests fail, on assertions (not import/syntax errors);
   - every pre-existing test still passes;
   - every acceptance criterion id appears in a test name (`grep -n "AC" tests/...`).
   If a check fails, send test-writer back once with the exact problem.
3. Commit only the tests: `git add tests && git commit -m "test(<ticket>): failing tests for acceptance criteria (red)"`.
   Record that commit as `RED_SHA` (`git rev-parse HEAD`).

### 2. GREEN: implement
1. Dispatch **implementer** with the spec text, the test file paths, and the failing-test summary.
   The tests are frozen: a hook blocks the implementer from editing `tests/`.
2. Verify, do not trust the report:
   - `git diff RED_SHA -- tests/` must be empty. If not, restore with `git checkout RED_SHA -- tests/` and send implementer back.
   - `npm run test:run` must be green.
   - `git diff --stat RED_SHA` must not touch `src/db/schema.sql`, `src/db/seed.sql`, `package*.json`.
3. Commit: `git add -A src && git commit -m "feat(<ticket>): <summary>"`.

### 3. Hand off
Print:

```
BUILD DONE  <branch>  red=<RED_SHA short>  green=<HEAD short>
tests: <summary line>
next: run /usage (build cost), then /ticket-to-merge:review-pr in a fresh session
```

The Stop gate runs the suite again when you finish; if it is red you will be sent back.

## Fix mode (`/ship-ticket fix`)

1. Read `.ticket-to-merge/findings.json` (written by /review-pr). If missing or `[]`, say so and stop.
2. Triage each finding (do not fix anything yourself):
   - behaviour bug with no test that catches it → dispatch **test-writer** to add a failing regression test for it, run the suite to see it red, commit `test(<ticket>): regression for <issue>`;
   - then dispatch **implementer** with the findings (as JSON) to fix them.
   - a finding you judge false: keep it in the report as rejected, with the reason.
3. Verify like step 2 above (tests not edited by the implementer since the last test commit, suite green), commit `fix(<ticket>): address review findings`.
4. At most **2** fix rounds. Then print a table `finding → fixed / rejected (why) / open`, and:
   `next: run /usage (fix-loop cost), then /ticket-to-merge:review-pr again to confirm`.
