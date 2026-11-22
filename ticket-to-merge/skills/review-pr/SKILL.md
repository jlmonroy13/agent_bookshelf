---
name: review-pr
description: Adversarial review of the current branch's diff by read-only specialist agents (review-security, review-correctness) run in parallel; findings are verified, de-duplicated and returned as JSON {file, line, severity, issue, evidence}. `/review-pr [base]` (default base main). Use when the user asks to review a PR, branch or diff.
argument-hint: "[base branch, default main]"
disable-model-invocation: true
# Cost lever: the orchestrator only collects the diff, dispatches, verifies and merges. On Opus it was
# 90% of review cost. Sonnet runs this turn; the session model resumes on the next prompt.
model: sonnet
---

# /review-pr

You orchestrate the review. The reviewers are read-only; you never edit source files in this skill.
Precision matters as much as recall: every finding you return must be real.

## 1. Collect the diff

1. Base = `$ARGUMENTS` if given, else `main` (fall back to `origin/main`). `BASE=$(git merge-base <base> HEAD)`.
2. `git diff $BASE...HEAD --stat` and `git diff $BASE...HEAD -U5` (plus uncommitted changes: `git diff -U5`).
   Skip lockfiles, `dist/`, and binary files.
3. Spec, first that exists:
   - `SPEC.md` in the repo root;
   - a spec in the `specs/` folder next to this SKILL.md whose interface matches the diff
     (e.g. `specs/BOOK-101.md` when the diff adds `/books/search`);
   - otherwise `CLAUDE.md`, using the repo conventions as the spec.
   Always also read `CLAUDE.md` for conventions (status codes, error shape, where code lives).
4. If the diff is empty, print `[]` and stop.

## 2. Dispatch reviewers in parallel (one message, two Agent calls)

Send **review-security** and **review-correctness** the same package:
- the full diff text,
- the spec text,
- the list of changed files (they may Read them, and Grep for callers),
- the instruction: "Return only a JSON array of findings."

## 3. Verify every finding yourself (this is where precision is won)

For each finding:
1. Read the cited `file` around `line`. If the quoted code is not there, or the line is not in or reached from the diff, **drop it**.
2. Re-check the claim against the code: trace the input named in `evidence`. If the claim is speculative, about style, or contradicted by the code, **drop it**.
3. Merge duplicates: same root cause reported twice (by both reviewers, or in route and model) → keep one, the one at the line where the fix belongs, highest severity.

4. Move out of the findings anything whose only claim is missing test coverage (`NOTE test gap:` or
   "no test for ..."): collect those as **Notes**. Findings are defects in behaviour, each with an input
   that triggers it; a coverage gap has no such input, and counting it would lower precision.

Do not add findings of your own that no reviewer reported unless you can verify them the same way.

## 4. Output

1. Write the verified array to `.ticket-to-merge/findings.json` (create the folder) so `/ship-ticket fix`
   can use it, and a copy to `.ticket-to-merge/findings-<YYYYMMDD-HHMMSS>.json` so repeated runs can be scored.
2. Print the JSON array in a ```json block, ordered high → low:

```json
[{"file": "src/models/book.ts", "line": 24, "severity": "high", "issue": "...", "evidence": "..."}]
```

3. Then one line: `<n> findings (<h> high, <m> medium, <l> low); <d> dropped in verification`.
   If there are none, print `[]` and `0 findings`.
4. If you collected Notes, print them after that line under `Notes (not findings):`, one line each.
