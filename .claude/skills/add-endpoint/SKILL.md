---
name: add-endpoint
description: Add or change a JSON REST endpoint under /api in agent-bookshelf (Express api.ts + models + Vitest). Use when implementing API routes, request validation, or supertest coverage. Do NOT use for EJS views, HTMX, or CSS-only UI work.
---

# Add or change a JSON API endpoint

## When this applies

- New or modified handlers in `src/routes/api.ts`
- Supporting functions in `src/models/*.ts`
- Tests in `tests/routes/api.test.ts` or `tests/models/*.test.ts`

Stop and ask if the feature requires **schema.sql changes** or **new npm dependencies**.

## Procedure

### 1. Read existing patterns

- Open `src/routes/api.ts` for validation style and status codes.
- Open the relevant model file for SQL patterns (`get`, `all`, `run` from `src/db/index.js`).
- Confirm data already exists in `schema.sql` / seed before adding columns.

### 2. Model layer first

- Add typed functions in `src/models/` (export interfaces/results as needed).
- Keep SQL in the model; routes should stay thin (parse params, call model, map errors to JSON).

### 3. Register the route

- Add the route to **`src/routes/api.ts`** only (prefix `/api` is applied in `server.ts`).
- Validate input early:
  - Missing required body/query fields → **400** `{ error: "..." }`
  - Invalid numeric ids → **400**
  - Missing user/book/shelf → **404**
  - Conflicts (duplicate review, book already on shelf) → **409** where applicable
- Success: **200** / **201** with JSON body; deletions often **204**.

### 4. Error shape

Always use a single string field:

```json
{ "error": "Description" }
```

Match wording style of neighboring routes.

### 5. Vitest coverage

- Extend `tests/routes/api.test.ts` (supertest + `initDb('/tmp/test-....db')` in `beforeEach`).
- Cover at minimum: happy path, one validation **400**, one **404**, and idempotent/conflict behavior if relevant.
- Run **`npm run test:run`** before finishing.

### 6. Done checklist

- [ ] Route registered in `src/routes/api.ts`
- [ ] Logic in `src/models/`
- [ ] Tests added/updated
- [ ] `npm run test:run` passes
- [ ] No `.env`, schema, or dependency changes unless approved

## Example: mark book as read

- **POST** `/api/books/:id/read` with body `{ "userId": 1 }`
- Uses shelf named `read` (no new DB columns)
- Model: `Shelf.markBookAsRead(userId, bookId)`
