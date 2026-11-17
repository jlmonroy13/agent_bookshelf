---
name: b10-read-list
description: "Orchestrated build of a user's read list."
tags: [flow, orchestration]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Agent]
---

Goal: ship a user's read list.

You are the coordinator. Do not edit files or run commands yourself; your job is to brief the agents and check their reports.

Facts every brief needs:
- JSON: GET /api/users/:id/read-books returns the books on that user's shelf named `read`. Unknown user is a 404. There is no `read` column on books; "read" means the shelf.
- Page: the shelf page for the `read` shelf gets a link or heading titled "Read" that lists the same books.
- The project root is the current working directory. Every brief must tell the agent to use relative paths such as src/routes/api.ts, never absolute paths and never the plugin directory.
- No changes to src/db/schema.sql or package.json.
- Tests run with `node node_modules/vitest/vitest.mjs run` (not npm).

Stage 1: start api-builder and ui-builder at the same time. They own different files.
Stage 2: when both have reported, give test-runner both reports and ask for at least 6 tests across the API and the page. test-runner must finish by writing the last lines of the vitest summary (the "Tests" line) to eval-result.txt in the project root.

Keep each brief under 120 words.

When test-runner reports back, reply with a table (agent | files changed | outcome) and one line listing any bug that is still open.
