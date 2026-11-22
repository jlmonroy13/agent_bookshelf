# SPEC — BOOK-101 · Search books by title or author

## Goal

Let a client search the catalogue by a free-text query that matches a book's
**title or author**, through a JSON endpoint, with the query validated and the
SQL parameterised.

## Interface

```
GET /api/books/search?q=<text>
```

| Case | Status | Body |
|------|--------|------|
| Match(es) found | 200 | `Book[]` (same shape as `GET /api/books`), ordered by `title` |
| No match | 200 | `[]` |
| `q` missing, empty, or only whitespace | 200 | every book (same as `GET /api/books`) |
| `q` longer than 100 characters **after trim** | 400 | `{ "error": "Query must be 100 characters or fewer" }` |
| `q` sent more than once (`?q=a&q=b`) or not a string | 400 | `{ "error": "Query must be a single string" }` |

`Book` = `{ id, title, author, isbn, cover_url, description, published_year, created_at }`.

## Acceptance criteria

| ID | Criterion | Example (seed data) |
|----|-----------|---------------------|
| AC1 | Partial match on **title** | `q=code` → includes "Clean Code" |
| AC2 | Partial match on **author** | `q=fowler` → includes "Refactoring" |
| AC3 | Case-insensitive | `q=CLEAN`, `q=clean`, `q=cLeAn` return the same list |
| AC4 | Empty query returns all books | `q=`, `q=%20%20`, no `q` → same as `GET /api/books` |
| AC5 | Input is trimmed | `q=%20%20fowler%20` behaves like `q=fowler` |
| AC6 | Length limit | 100 chars after trim → 200; 101 chars → 400 with `{ error }` |
| AC7 | Parameterised SQL | the query text is never concatenated into SQL; `q=' OR 1=1 --` returns `[]`, not every book |
| AC8 | LIKE wildcards are literal | `q=%` and `q=_` return only books whose title/author really contain `%`/`_` (none in seed → `[]`) |
| AC9 | Route does not collide | `GET /api/books/search` is registered before `GET /api/books/:id`; `GET /api/books/1` still works |
| AC10 | Tests | Vitest + supertest cover AC1–AC9; `npm run test:run` is green |

## Where the code goes

- `src/models/book.ts` → `searchBooks(query: string): Book[]` (SQL lives here only).
  Escape `\`, `%` and `_` in the query, use `LIKE ? ESCAPE '\'` on both columns.
- `src/routes/api.ts` → the route: read `req.query.q`, validate, trim, call the model.
  Validation (type, length) lives in the route; the model assumes a trimmed string.
- `tests/routes/api.test.ts` (or a new `tests/routes/search.test.ts`) → one `it` per AC.
- Optional: `src/routes/books.ts` `/books/search` HTML stub may call the same model; it must not break existing UI routes.

## Constraints

- No schema changes (`src/db/schema.sql` untouched), no new dependencies, `package.json` untouched.
- Never touch `bookshelf.db`, `src/db/seed.sql` or any `.env` (enforced by the guardrail hook).
- Keep the interface exactly as above. Errors are `{ error: string }`.

## Verification path

1. `npm run test:run` → all green, search tests included.
2. Manual: `npm run dev`, then
   `curl 'localhost:3000/api/books/search?q=fowler'` → `[ { "title": "Refactoring", ... } ]`
   `curl "localhost:3000/api/books/search?q=$(printf 'a%.0s' {1..101})"` → 400.
3. `/ticket-to-merge:review-pr` on the diff returns no high-severity findings.

## Out of scope

Pagination, ranking/relevance, searching description or ISBN, Unicode case folding beyond SQLite's ASCII `LIKE`.
