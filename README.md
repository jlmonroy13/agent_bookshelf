```
╔═════════════════════════════════════════════╗
║│▓│▒│░│█│▓│░│▒│█│▓│▒│░│█│▓│░│▒│█│▓│▒│░│█│▓│░│║
╠═════════════════════════════════════════════╣
║                                             ║
║     ▄▀█ █▀▀ █▀▀ █▄░█ ▀█▀                    ║
║     █▀█ █▄█ █▄▄ █░▀█ ░█░                    ║
║                                             ║
║     █▄▄ █▀█ █▀█ █▄▀ █▀ █░█ █▀▀ █░░ █▀▀      ║
║     █▄█ █▄█ █▄█ █░█ ▄█ █▀█ █▄▄ █▄▄ █▀░      ║
║                                             ║
║  a goodreads-lite playground for AI agents  ║
║                                             ║
╠═════════════════════════════════════════════╣
║│█│▓│░│▒│█│▓│▒│░│█│▓│░│▒│█│▓│▒│░│█│▓│░│▒│█│▓│║
╚═════════════════════════════════════════════╝
```

# Capstone · Ticket to Merge (BOOK-101)

One ticket, built and reviewed by agents, packaged as the `ticket-to-merge` plugin.

| Checklist item | Where |
|---|---|
| Repo link | https://github.com/jlmonroy13/agent_bookshelf · branch **`capstone/book-101`** |
| SPEC.md and CLAUDE.md | [`SPEC.md`](SPEC.md) (interface `GET /api/books/search?q=`, AC1–AC10, verification path) · [`CLAUDE.md`](CLAUDE.md) (62 lines) |
| Test run, green | `npm run test:run` → **6 files, 122 tests passed** (11 BOOK-101 tests in `tests/routes/search.test.ts`, 66 guardrail tests in `tests/hooks/ticket-to-merge-protect.test.ts`) |
| How to run `/ship-ticket` and `/review-pr` | [below](#how-to-run) |
| Plugin passes `claude plugin validate` | `claude plugin validate ./ticket-to-merge` → ✔ Validation passed |
| Planted bugs: recall and precision over 3 runs | [below](#review-planted-bugs) · full log [`docs/capstone/review-eval.md`](docs/capstone/review-eval.md) |
| Cost report with one lever | [below](#cost-report) · full log [`docs/capstone/cost-log.md`](docs/capstone/cost-log.md) |
| Design: split, models, what I'd cut | [below](#design) |

## How to run

```bash
git checkout capstone/book-101 && npm install
claude --plugin-dir ./ticket-to-merge          # loads the plugin for this session only
```

| Command | What it does |
|---|---|
| `/ticket-to-merge:ship-ticket [SPEC.md]` | test-writer writes one failing test per acceptance criterion → RED commit → implementer makes them pass (tests frozen) → verified GREEN commit. A Stop-hook gate refuses to finish while `npm run test:run` is red. |
| `/ticket-to-merge:review-pr [base]` | review-security + review-correctness audit `git diff <base>...HEAD` in parallel; the orchestrator verifies each finding at its line, merges duplicates and prints JSON `{file, line, severity, issue, evidence}` (also saved to `.ticket-to-merge/findings.json`). Coverage gaps are printed as Notes, not findings. Uses `SPEC.md`, or the bundled `skills/review-pr/specs/BOOK-101.md` when the branch has none. |
| `/ticket-to-merge:ship-ticket fix` | Fix loop: a regression test per finding (red), then the implementer fixes them, max 2 rounds. |

Recommended: start the session on Sonnet (`/model sonnet`); see the cost lever below.

### Plugin layout

```
ticket-to-merge/
├── .claude-plugin/plugin.json
├── skills/ship-ticket/SKILL.md     # orchestrator + skill-scoped Stop hook (done-gate)
├── skills/review-pr/SKILL.md       # orchestrator, verify + merge, specs/BOOK-101.md fallback
├── agents/test-writer.md           # sonnet · may only write under tests/
├── agents/implementer.md           # sonnet · tests/ blocked by the hook
├── agents/review-security.md       # sonnet · tools: Read, Grep, Glob
├── agents/review-correctness.md    # sonnet · tools: Read, Grep, Glob
├── hooks/hooks.json                # PreToolUse guardrail + PostToolUse integrity check
├── hooks/protect.mjs  hooks/gate.mjs
└── evals/                          # planted-v1: patch, answer key, raw runs, score.mjs
```

## Build

Run once with `/ship-ticket SPEC.md` in a fresh session: 11 tests red at `11d9480`, implementer green at `b23d26f`
(`src/models/book.ts` escapes `\ % _` with `LIKE ? ESCAPE '\'` on both columns; `src/routes/api.ts` validates type
and trimmed length and is registered before `/books/:id`). `git diff 11d9480 -- tests/` is empty.

## Guardrails

`hooks/protect.mjs` (PreToolUse on Read/Edit/Write/NotebookEdit/Bash, exit 2 to block, fails closed on bad input
or its own errors) protects `.env` (no read, no write), `bookshelf.db*`, `seed.sql`, `schema.sql`, `package*.json`
and blocks `npm install <pkg>`. Bash layers: literal names, shell variables, split quotes/escapes/`+` joins, globs
(`rm src/db/*.sql`, `find -name '*.db' -delete`), deleting a parent folder, obfuscated writes (hex, base64,
`fromCharCode`), patch tools; plus symlink resolution and script content for Write. Backstop: a **PostToolUse
integrity check** hashes the tracked protected files before and after every Bash call and restores them from git
if anything slipped through. Role rules use `agent_type`: the implementer cannot write tests, the test-writer can
only write tests. Reviewers are read-only through `tools: Read, Grep, Glob` (plugin agents ignore hooks and
`permissionMode`). 66 tests in `tests/hooks/ticket-to-merge-protect.test.ts`, including regressions found in real runs.

## Review: planted bugs

Branch `evals/planted-v1`, cut from `main` with **no SPEC.md** (like the graders' branch): the search feature with
4 planted bugs (B1 `_` not escaped · B2 case-sensitive `instr()` on author · B3 `?q=a&q=b` coerced instead of 400 ·
B4 `>=` rejects exactly 100 chars) and 4 decoys (template-literal SQL with a constant, empty-query shortcut,
correct route order, passing tests). Its own tests are green. Scored with `ticket-to-merge/evals/score.mjs`.

| Runs | Setup | Recall | Precision | Cost / run |
|---|---|---|---|---|
| 1–3 | first version, Opus session | 4/4 · 100% | 4/5 · **80%** (coverage gap reported as a finding) | ~$0.60 |
| 4–6 | coverage gaps → Notes | 100% | **100%** | $0.59 |
| 7–9 | lever attempt 1 (skill `model: sonnet`) | 100% | 100% | $0.64 |
| **10–12** | **lever kept: Sonnet session** | **100%** | **100%** | **$0.26** |

No decoy was flagged in any of the 12 runs; on the clean BOOK-101 diff `/review-pr` returned `[]`.

## Cost report

From `/usage`, one fresh session per stage. Cache hit = cache read ÷ (input + cache read + cache write).

| Stage | Cost | Cache hit | Models |
|---|---|---|---|
| Build (`/ship-ticket`) | $0.83 | 87% | Opus 5.5 orchestrator $0.65 · Sonnet 5.5 test-writer + implementer $0.18 |
| Review (`/review-pr`, planted bugs, after lever) | $0.26 | 90% | Sonnet 5.5 orchestrator + 2 reviewers |
| Fix loop (`/ship-ticket fix`, 4 findings) | $0.35 | 92% | Sonnet 5.5 orchestrator + test-writer + implementer |
| **Total, one ticket** | **$1.44** | | ($1.77 with the review before the lever) |

**One lever: the orchestrator model.** The orchestrator writes no code, yet on Opus it was 78% of build cost and
90% of review cost. Attempt 1 put `model: sonnet` in the review-pr frontmatter: cost went **up 8%** ($0.59 → $0.64),
because the mid-session switch throws away the per-model prompt cache (`/usage`: "model changed, ~26k tokens
re-cached") and Opus still handles invocation and wrap-up. Reverted. Attempt 2 runs the whole session on Sonnet:
**$0.59 → $0.26 per review (−56%)**, 34–37 s instead of 53–83 s.
**Did quality hold?** Yes: recall 4/4 and precision 4/4 in all 3 runs, same findings, same Notes.

## Design

- **Split by TDD role, not by layer.** The ticket touches two files (model + route) that must agree on one
  contract; splitting by layer would need two agents coordinating on the same interface. Splitting by role gives a
  real check: test-writer turns the spec into tests, they are committed (RED), and the implementer cannot change
  them (hook on `agent_type` + `git diff RED_SHA -- tests/` must be empty). Sequential, so no worktrees needed.
- **Two reviewers by angle** (security / correctness) with adversarial prompts ("assume there is a bug, name the
  input that breaks it") and precision rules (quote the line, no style, `[]` is a valid answer). The orchestrator
  verifies each finding at its line before returning it.
- **Models.** All agents on Sonnet: tests, a 20-line change and a diff review do not need the biggest model.
  The orchestrator should also be Sonnet (measured above).
- **Done-gate scoped to `/ship-ticket`** (skill frontmatter hook), so `/review-pr` on a red branch is not blocked.
  It returns only failing test names to keep fix iterations cheap.
- **What I'd cut next:** one of the two reviewers. In all 12 runs both reported the same 4 bugs and the orchestrator
  merged 8–10 raw findings into 4–5. A single reviewer with both checklists is the next lever to measure.
- **Known limits.** Claude Code sometimes backgrounds the agents despite the instruction, so the done-gate fired
  once mid-run in build and fix (cheap: failing names only). A string filter cannot catch every encoding; the
  post-Bash integrity check is the backstop for tracked files, not for `.env`, which is never read.

---

# Agent Bookshelf

A Goodreads-lite application designed as a teaching playground for AI agents courses. Students install it locally and use AI agents (Claude Code, etc.) to complete homework assignments.

## Prerequisites

**Node.js 24 LTS** is required.

| OS | Install |
|---|---|
| **macOS** | Download `.pkg` from [nodejs.org](https://nodejs.org) — Universal binary (Intel + Apple Silicon) |
| **Windows** | Download `.msi` from [nodejs.org](https://nodejs.org) — tick "Tools for Native Modules" during install |
| **Linux** | `curl -fsSL https://deb.nodesource.com/setup_24.x \| sudo -E bash - && sudo apt-get install -y nodejs` |

Verify:

```bash
node -v   # should print v24.x.x
npm -v    # should print 11.x.x
```

## Quick Start

### Using npx

```bash
corepack enable
npm install
npm run build
npx agent-bookshelf
```

That's it! The app will start at http://localhost:3000 with pre-seeded data.

## What is this?

Agent Bookshelf is a deliberately structured teaching codebase where:

- **Students** get an easy-to-install app that works immediately
- **AI agents** get a familiar, well-structured codebase to work with
- **Homework gaps** are built in for agents to fill

### Features

- Browse 50 pre-seeded books (tech and sci-fi)
- View book details with reviews and ratings
- Manage user shelves (want-to-read, currently-reading, read)
- Add reviews and ratings
- REST API for agent interaction
- HTMX-powered dynamic UI

### Pre-seeded Data

The app comes with:
- 50 books across tech and sci-fi genres
- 3 users: Alice Chen, Bob Martinez, Carol Okafor
- Sample shelves and reviews
- SQLite database (zero configuration)

## For Students

### Installation

**Prerequisites:** Node.js 20 or higher

**macOS / Linux:**
```bash
npx agent-bookshelf
```

**Windows:**
```bash
npx agent-bookshelf
```

The app will start automatically at http://localhost:3000

### Using the App

1. Browse books at http://localhost:3000
2. Click a book to see details and reviews
3. Visit /shelves to see user bookshelves
4. Add reviews and manage shelves through the UI

### For AI Agents

The app provides a REST API at `/api/*`:

```bash
# Get all books
curl http://localhost:3000/api/books

# Get a specific book
curl http://localhost:3000/api/books/1

# Add a review
curl -X POST http://localhost:3000/api/reviews \
  -H "Content-Type: application/json" \
  -d '{"userId": 1, "bookId": 5, "rating": 5, "reviewText": "Excellent!"}'

# Get user shelves
curl http://localhost:3000/api/shelves/user/1
```

See the API routes in `src/routes/api.ts` for full documentation.

## For Instructors

### Homework Gaps

The codebase includes deliberate gaps for homework assignments:

1. **Search functionality** - UI exists but backend is a TODO
   - Location: `src/routes/books.ts` line 14
   - Students can implement the search backend

2. **Missing tests** - Models have no test coverage
   - Location: `tests/` directory
   - QA homework: write test suites for models

3. **Input validation** - API endpoints lack validation
   - Location: `src/routes/api.ts`
   - Students can add validation middleware

4. **UI improvements** - Functional but minimal design
   - Location: `src/public/css/style.css`
   - PM homework: redesign specific components

### Architecture

- **Backend:** Express + TypeScript
- **Database:** SQLite via sql.js (WebAssembly, zero native dependencies)
- **Frontend:** EJS templates + HTMX
- **Testing:** Vitest (setup included, tests are homework)

### Project Structure

```
agent_bookshelf/
├── src/
│   ├── server.ts          # Express app + server
│   ├── db/
│   │   ├── schema.sql     # Database schema
│   │   ├── seed.sql       # Pre-seeded data
│   │   └── index.ts       # DB connection
│   ├── models/            # Data models (no tests - homework gap)
│   ├── routes/
│   │   ├── books.ts       # HTML routes
│   │   ├── shelves.ts
│   │   ├── reviews.ts
│   │   └── api.ts         # JSON API
│   ├── views/             # EJS templates
│   └── public/            # Static assets
├── tests/                 # Vitest setup (tests are homework)
├── bin/                   # CLI entry point
└── docs/adr/              # Architecture decisions
```

### Running Tests

```bash
npm test          # Run tests in watch mode
npm run test:run  # Run tests once
```

Note: The test setup is included, but actual tests are intentionally missing (homework gap).

## License

GPL-3.0

## Contributing

This is a teaching project. Contributions should maintain the deliberate gaps that make homework assignments possible.
