# Capstone cost log (from /usage, one fresh session per stage)

Cache hit = cache read ÷ (input + cache read + cache write).

## Baseline (orchestrator on Opus, agents on Sonnet)

| Stage | Cost | Cache hit | Models | Notes |
|-------|------|-----------|--------|-------|
| Build (`/ship-ticket SPEC.md`) | $0.83 | 87% (Opus 91%, Sonnet 63%) | Opus 5.5 orchestrator $0.65 · Sonnet 5.5 test-writer + implementer $0.18 · Haiku 5.5 (Claude Code internal) $0.0005 | 8m26s wall, 1m35s API · 159 lines added · 11 tests red → 115 green · RED 11d9480, GREEN b23d26f · one wasted done-gate firing (agent backgrounded; fixed in de96021) |
| Review (`/review-pr`, clean BOOK-101 diff) | $0.59 | 90% (Opus 94%, Sonnet 66%) | Opus 5.5 orchestrator $0.487 · Sonnet 5.5 review-security + review-correctness $0.10 · Haiku 5.5 $0.0003 | 10m27s wall, 55s API · 0 findings (correct: clean code) |
| Fix loop (`/ship-ticket fix`) | | | | |
| **Total, one ticket** | | | | |

Raw build usage: Opus 126 in / 4.1k out / 594.4k cache read / 56.1k cache write · Sonnet 14 in / 8.2k out / 61.7k cache read / 35.6k cache write · Haiku 2.2k in / 509 out.

Raw review usage: Opus 120 in / 3.4k out / 566.9k cache read / 38.2k cache write · Sonnet 14 in / 2.0k out / 57.3k cache read / 29.7k cache write · Haiku 1.2k in / 290 out.

Observation: the orchestrator is 78% of build cost and 83% of review cost while writing no code → lever: orchestrator on Sonnet.

## After the lever

| Stage | Cost | Cache hit | Models | Quality re-check |
|-------|------|-----------|--------|------------------|
