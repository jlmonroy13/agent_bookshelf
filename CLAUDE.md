# Agent Bookshelf — Claude Code guide

Goodreads-lite teaching app: Express + TypeScript, SQLite via **sql.js**, EJS + HTMX UI, Vitest tests.

## Stack and layout

| Area | Location |
|------|----------|
| Express app & middleware | `src/server.ts` |
| JSON REST API | `src/routes/api.ts` (mounted at `/api`) |
| HTML routes | `src/routes/books.ts`, `shelves.ts`, `reviews.ts` |
| Data access | `src/models/*.ts` (use `../db/index.js` helpers) |
| Schema & seed | `src/db/schema.sql`, `src/db/seed.sql` |
| Views / static | `src/views/`, `src/public/` |
| Tests | `tests/` (Vitest + supertest) |

## Checkable rules (follow before claiming “done”)

1. **Tests must pass.** Run `npm run test:run` from the repo root and fix failures before you finish. Do not skip or disable tests to green the run.

2. **API changes live in the model + `api.ts`.** Put SQL in `src/models/`, register JSON routes only in `src/routes/api.ts`, return errors as `{ error: string }` with the same status patterns as existing handlers (400 validation, 404 missing, 409 conflicts, 201 created).

3. **No schema or dependency changes without explicit approval.** Do not edit `src/db/schema.sql`, add npm packages, or change `package.json` unless the user or instructor asked. Prefer existing tables (e.g. shelves named `read`, `want-to-read`, `currently-reading`).

4. **Never read or write `.env` files.** Configuration is optional (`PORT` only). Do not create, edit, or commit `.env`; secrets do not belong in this repo.

5. **Keep HTML and API separate.** JSON endpoints belong in `api.ts`; EJS/HTMX UI changes belong in `routes/*.ts`, `views/`, and `public/css/`. Do not break existing UI routes when adding API features.

## Commands

```bash
npm run dev          # tsx watch server
npm run build        # tsc + copy assets
npm run test:run     # one-shot Vitest (required before done)
npm start            # run compiled dist/server.js
```

## Feature note: “mark as read”

There is no `books.read` column. “Read” means the book is on the user’s shelf named **`read`** (see seed data). Implement via `Shelf.markBookAsRead` and `POST /api/books/:id/read` with body `{ "userId": number }`.

## Error shape (JSON API)

```json
{ "error": "Human-readable message" }
```

Success responses return the resource or a small object with `message` where appropriate.

## What not to do

- Commit `bookshelf.db`, `node_modules`, or any `.env` file.
- Change licensing or remove deliberate homework gaps without instruction.
- Use Bun or other runtimes — this repo uses **Node 20+** and npm scripts only.
