# Capstone cost log (from /usage, one fresh session per stage)

Cache hit = cache read ÷ (input + cache read + cache write).

## Baseline (orchestrator on Opus, agents on Sonnet)

| Stage | Cost | Cache hit | Models | Notes |
|-------|------|-----------|--------|-------|
| Build (`/ship-ticket SPEC.md`) | $0.83 | 87% (Opus 91%, Sonnet 63%) | Opus 5.5 orchestrator $0.65 · Sonnet 5.5 test-writer + implementer $0.18 · Haiku 5.5 (Claude Code internal) $0.0005 | 8m26s wall, 1m35s API · 159 lines added · 11 tests red → 115 green · RED 11d9480, GREEN b23d26f · one wasted done-gate firing (agent backgrounded; fixed in de96021) |
| Review (`/review-pr`, clean BOOK-101 diff) | $0.59 | 90% (Opus 94%, Sonnet 66%) | Opus 5.5 orchestrator $0.487 · Sonnet 5.5 review-security + review-correctness $0.10 · Haiku 5.5 $0.0003 | 10m27s wall, 55s API · 0 findings (correct: clean code) |
| Review (`/review-pr`, planted-v1, one run — run 3) | $0.60 | 91% (Opus 93%, Sonnet 69%) | Opus 5.5 orchestrator $0.54 · Sonnet 5.5 reviewers $0.055 · Haiku $0.0001 | 1m19s API · 5 findings, recall 4/4 · `/clear` resets /usage session totals, so this is one run |
| Review planted-v1, runs 4–6 (Notes change, still Opus orchestrator) | $0.67 / $0.55 / $0.54, mean $0.59 | 92–94% | Opus $0.59 / $0.49 / $0.48 · Sonnet $0.078 / $0.057 / $0.057 | `--model sonnet` on the CLI did not take effect; lever moved into the skill frontmatter (`model: sonnet`, commit 6210d49) |
| Review planted-v1, runs 7–9 — **lever attempt 1**: `model: sonnet` in review-pr frontmatter, Opus session | $0.68 / $0.58 / $0.65, mean **$0.64 (+8%)** | 87–88%, 1 cache miss per run ("model changed, ~26k tokens re-cached") | Opus $0.44 / $0.37 / $0.44 · Sonnet $0.24 / $0.21 / $0.21 | Quality held (recall/precision 100%), cost rose: the mid-session model switch throws away the prompt cache (per-model) and Opus still handles invocation and wrap-up. Reverted. |
| Review planted-v1, runs 10–12 — **lever attempt 2 (kept)**: whole session on Sonnet (`/model sonnet` before the run) | $0.2633 / $0.2609 / $0.2587, mean **$0.26 (−56%)** | 88% / 91% / 90%, no misses | Sonnet 5.5 only (orchestrator + reviewers) · Haiku $0.0003 | Quality held: recall 4/4 and precision 4/4 in all 3 runs; 34–37 s per run vs 53–83 s |
| Fix loop (`/ship-ticket fix`) | | | | |
| **Total, one ticket** | | | | |

Raw build usage: Opus 126 in / 4.1k out / 594.4k cache read / 56.1k cache write · Sonnet 14 in / 8.2k out / 61.7k cache read / 35.6k cache write · Haiku 2.2k in / 509 out.

Raw review usage: Opus 120 in / 3.4k out / 566.9k cache read / 38.2k cache write · Sonnet 14 in / 2.0k out / 57.3k cache read / 29.7k cache write · Haiku 1.2k in / 290 out.

Raw planted review (run 3): Opus 116 in / 7.2k out / 491.9k cache read / 37.6k cache write · Sonnet 8 in / 2.5k out / 24.7k cache read / 11.1k cache write · Haiku 1.2k in / 20 out.

Observation: the orchestrator is 78% of build cost, 83% of the clean review and 90% of the planted review, while writing no code → lever: orchestrator on Sonnet.

## After the lever

| Stage | Cost | Cache hit | Models | Quality re-check |
|-------|------|-----------|--------|------------------|
