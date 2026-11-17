# Week 3 · Evals: did the cheaper orchestrator keep its quality?

Harness: `claude plugin eval` (Claude Code 2.1.325), 3 runs per case, judge `claude-haiku-5-5`.
Suite: 22 cases in `evals/`. The plugin manifest `.claude-plugin/plugin.json` points at the existing
`.claude/skills` and `.claude/agents`. Each run starts in an isolated workspace seeded from `week2-base`.

## 1. Eval set (22 cases)

**Group A, skill `add-endpoint` (12 cases, Sonnet, with and without the plugin).**
Should fire: a01 authors list, a02 books by year (400), a03 review count (404), a04 rename shelf (409),
a05 delete reviews (204), a06 ambiguous "Add an endpoint". Should not fire: a07 rename variable,
a08 explain only, a09 CSS, a10 EJS view, a11 needs a schema change, a12 needs a new dependency.
Graders are mostly code (regex over the produced files, `tool_used` on Edit/Write); four cases add an LLM judge.

**Group B, orchestrated flow (10 cases).** Same shape as week 2: coordinator, `api-builder` and `ui-builder`
in parallel, then `test-runner`. b01 is the week 2 book search; b02-b10 are other small features.

## 2. Group A results (Sonnet, 3 runs per arm, $6.83)

| Case | WITH | W/OUT | Δ |
|---|---|---|---|
| a01 authors, a02 by-year, a05 delete, a06 ambiguous | 1.00 | 1.00 | 0.00 |
| a03 review-count | 0.78 | 1.00 | -0.22 |
| a04 rename-shelf | 0.33 | 1.00 | -0.67 (a rerun scored 1.00, so this is run-to-run variance) |
| a07 rename, a08 explain, a10 EJS | 1.00 | 1.00 | 0.00 |
| a09 css | 0.75 | 0.75 | 0.00 |
| a11 schema change | 0.33 | 0.33 | 0.00 |
| a12 new dependency | 0.33 | 0.33 | 0.00 |

Mean Δ = -0.07. Without the skill, Sonnet already passes most of these tasks, so the cases are easy and the
skill is not why they pass. The real finding is a11/a12: the agent edits `schema.sql` / `package.json`
without asking, with or without the skill.

## 3. Week 2 re-run: orchestrator on Opus vs Sonnet (group B)

Valid comparison = cases complete in both models (b04-b06, 9 runs each), structural graders only
(routes exist, 400/404 handling, agents dispatched, report table). The two graders that read the test
result were removed because the agents' tests failed for environment reasons (shared test databases
between runs), not code reasons, which made them fail in nearly every run for both models.

| b04-b06 | Mean score | All graders pass | Cost per run |
|---|---|---|---|
| Sonnet orchestrator | 0.98 | 89% | $0.19 |
| Opus orchestrator | 0.97 | 78% | $0.29 |

With 9 runs per side the difference in quality is not distinguishable (the class table gives about ±18
points at 20 cases). Sonnet costs about 34% less per run. Decision: keep Sonnet as orchestrator; treat
this as a signal, not proof.

Side finding on b01 (search): Opus did not escape the `%` and `_` wildcards in `searchBooks` in 3 of 3 runs.
Sonnet's b01 runs timed out, so there is no comparison.

## 4. Promotion: a repeated mistake into a rule

Mistake seen twice (a11, a12): the agent edits `schema.sql` / `package.json` without asking.
The skill already had one sentence about it, buried under "When this applies". Promoted it to an explicit
"Step 0: approval check" in `.claude/skills/add-endpoint/SKILL.md` (see `git diff`).

| Case | Before | After (3 runs) |
|---|---|---|
| a11 schema change | 0.33, 0 full passes | 0.56, 1 of 3 full passes |
| a12 new dependency | 0.33 | 0.33 |

Not conclusive at n=3. Likely reason for a12: the skill is about JSON endpoints, so a rate-limiting request
may not load it at all (not verified). The layer that fits is `CLAUDE.md` rule 3 or a hook, because
"must hold every time" belongs to a hook. Eval runs do not load `CLAUDE.md`, so this suite cannot see that rule.

## 5. Limits

- Small samples: 3 runs per case, 3 complete group B cases per model.
- Sonnet group B: 5 cases ended in timeouts (b01-b03, b09, b10). Opus group B stopped at b07 (usage limit).
- Eval runs load only the plugin: no `CLAUDE.md`, no `.claude/settings.json`, no hooks from settings.
- The Bash sandbox was not fully hermetic: in one trace `test-runner` ran commands against the real repo path
  and deleted files in `/tmp`. Writes to the repo were denied and `git status` stayed clean.
- Judge was Haiku; I did not calibrate it against human verdicts.

## 6. Decision log and cost

Spend: about $46 at list price. About $25 went into batches I had to discard: I launched the full group B
before checking one case end to end with the final tool grants (test-runner was blocked), and I changed
a grader between batches. Next time: run one case with the final configuration, freeze the graders, then run
the suite with `--runs 1` and add repetitions only where the signal is unclear. Cut next time: the 5 group B
cases beyond the first 3, and the Opus re-runs.
