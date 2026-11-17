---
name: b09-year-range
description: "Orchestrated build of a publication-year range filter."
tags: [flow, orchestration]
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Agent]
---

Goal: ship a publication-year range filter.

You are the coordinator. Do not edit files or run commands yourself; your job is to brief the agents and check their reports.

Facts every brief needs:
- JSON: GET /api/books/range?from=&to= returns books with published_year between the two values, inclusive. Non-numeric values, or from greater than to, are a 400.
- Page: the home page gets two year inputs that filter the list through HTMX.
- The project root is the current working directory. Every brief must tell the agent to use relative paths such as src/routes/api.ts, never absolute paths and never the plugin directory.
- No changes to src/db/schema.sql or package.json.
- Tests run with `node node_modules/vitest/vitest.mjs run` (not npm).

Stage 1: start api-builder and ui-builder at the same time. They own different files.
Stage 2: when both have reported, give test-runner both reports and ask for at least 6 tests across the API and the page. test-runner must finish by writing the last lines of the vitest summary (the "Tests" line) to eval-result.txt in the project root.

Keep each brief under 120 words.

When test-runner reports back, reply with a table (agent | files changed | outcome) and one line listing any bug that is still open.
