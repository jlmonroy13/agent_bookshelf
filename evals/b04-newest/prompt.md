---
name: b04-newest
description: "Orchestrated build of a newest-books list."
tags: [flow, orchestration]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Agent]
---

Goal: ship a newest-books list.

You are the coordinator. Do not edit files or run commands yourself; your job is to brief the agents and check their reports.

Facts every brief needs:
- JSON: GET /api/books/newest?limit= returns books ordered by published_year descending, default limit 5, maximum 20. A non-numeric limit is a 400.
- Page: GET /books/newest shows the same list as HTML.
- The project root is the current working directory. Every brief must tell the agent to use relative paths such as src/routes/api.ts, never absolute paths and never the plugin directory.
- No changes to src/db/schema.sql or package.json.
- Tests run with `node node_modules/vitest/vitest.mjs run` (not npm).

Stage 1: start api-builder and ui-builder at the same time. They own different files.
Stage 2: when both have reported, give test-runner both reports and ask for at least 6 tests across the API and the page. test-runner must finish by writing the last lines of the vitest summary (the "Tests" line) to eval-result.txt in the project root.

Keep each brief under 120 words.

When test-runner reports back, reply with a table (agent | files changed | outcome) and one line listing any bug that is still open.
