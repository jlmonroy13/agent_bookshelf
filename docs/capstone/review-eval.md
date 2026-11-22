# /review-pr on planted bugs — evals/planted-v1

Branch `evals/planted-v1` (commit `c3fc088`, cut from `main`, **no SPEC.md** — same situation as the graders' branch).
Answer key: `ticket-to-merge/evals/planted-v1/answer-key.json` · patch: `planted.patch` · raw findings: `runs/run{1,2,3}.json`.
Scored with `node ticket-to-merge/evals/score.mjs <key> runs/run1.json runs/run2.json runs/run3.json`.

## The set (balanced: things to flag, things not to flag)

| Id | Kind | Where | What | Proof |
|----|------|-------|------|-------|
| B1 | bug | `src/models/book.ts:27` | LIKE escape skips `_` | `q=_` → all 50 books |
| B2 | bug | `src/models/book.ts:31` | author matched with case-sensitive `instr()` | `q=fowler` → `[]`, `q=Fowler` → Refactoring |
| B3 | bug | `src/routes/api.ts:18` | `String(req.query.q)` coerces `?q=a&q=b` | 200 instead of 400 |
| B4 | bug | `src/routes/api.ts:19` | `>=` off-by-one on the 100-char limit | 100 chars → 400 |
| C1 | decoy | `src/models/book.ts` | template-literal SQL, but only a constant is interpolated | must not be flagged as injection |
| C2 | decoy | `src/routes/api.ts` | empty query short-circuits to `getAllBooks()` | correct (AC4) |
| C3 | decoy | `src/routes/api.ts` | `/books/search` before `/books/:id` | correct (AC9) |
| C4 | decoy | `tests/routes/search.test.ts` | 4 correct, passing tests | — |

Branch tests are green: the bugs are invisible to the suite, as in a real PR.

## Results, 3 runs (orchestrator Opus 5.5, reviewers Sonnet 5.5)

| Run | Findings | Recall | Precision (strict) | Precision (test-gap counted real) | Missed |
|-----|----------|--------|--------------------|-----------------------------------|--------|
| 1 | 5 | 4/4 = 100% | 4/5 = 80% | 5/5 = 100% | – |
| 2 | 5 | 4/4 = 100% | 4/5 = 80% | 5/5 = 100% | – |
| 3 | 5 | 4/4 = 100% | 4/5 = 80% | 5/5 = 100% | – |
| **Mean** | 5 | **100%** | **80%** | **100%** | |

Brief points: recall 6.0/6 · precision 3.2/4 (strict) to 4.0/4.

- All three runs returned the same 5 findings: the 4 planted bugs plus one medium finding that `tests/routes/search.test.ts` does not cover AC2/AC3/AC6/AC8/AC9 (true, but not a planted bug).
- No decoy was flagged in any run, including the template-literal SQL (C1).
- Each run, both reviewers reported overlapping issues (9–10 raw findings); the orchestrator's verify-and-merge step collapsed them to 5 with no false drops.
- Earlier, on the clean BOOK-101 diff, /review-pr returned `[]` (no false positives).

## Issue found during the runs (fixed)

Run 2 hit a false alarm from the guardrail's post-Bash integrity check: a command that `cd`-ed into
`.ticket-to-merge/` made pre and post fingerprint different folders. Fixed by fingerprinting the git top
level saved at pre time and skipping the check without a `tool_use_id`; regression tests added.
