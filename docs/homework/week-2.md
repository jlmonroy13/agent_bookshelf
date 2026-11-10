# Week 2 · Experiment: does the orchestrator need Opus?

The subagents already run on cheaper models (Sonnet for the builders, Haiku for the
tester), so the main session that coordinates them is the likely biggest cost.
This experiment tests one lever: the orchestrator's own model.

## Setup

- Base: branch `week2-base` (book search not implemented yet).
- Subagents, identical in both runs: `api-builder` (sonnet), `ui-builder` (sonnet),
  `test-runner` (haiku). `test-runner` marks bugs with `it.fails` instead of
  asserting them.
- The only difference between runs: `"model"` in `.claude/settings.json`.
  - `week2-opus`: `"model": "opus"`
  - `week2-sonnet`: `"model": "sonnet"`

## Prompt (identical in both runs)

```
Goal: ship book search: a JSON endpoint and live search results on the home page.

You are the coordinator. Do not edit files or run commands yourself; your job is to brief the agents and check their reports.

Facts every brief needs:
- The query already exists: searchBooks(query) in src/models/book.ts.
- The book list is the home page "/". Its search box sends GET /books/search?q= with the HX-Request header and swaps the response into #search-results.
- No changes to src/db/schema.sql or package.json.

Stage 1: start api-builder and ui-builder at the same time. They own different files.
Stage 2: when both have reported, give test-runner both reports and ask for at least 8 tests across the API and the page.

Keep each brief under 120 words.

When test-runner reports back, reply with a table (agent | files changed | outcome) and one line listing any bug that is still open.
```

## How to run

1. `git checkout week2-opus`, then start a fresh `claude` session. Check `/status` shows Opus.
2. Paste the prompt. Approve permissions the same way in both runs.
3. Run `/usage`, screenshot it. Exit.
4. `git checkout week2-sonnet` (commit or stash run 1's changes first), fresh `claude`,
   check `/status` shows Sonnet, same prompt, `/usage`.
