#!/usr/bin/env node
/**
 * Score /review-pr runs against a planted-bug answer key.
 *
 *   node ticket-to-merge/evals/score.mjs <answer-key.json> <findings-run1.json> [run2.json run3.json ...]
 *
 * A finding counts as a hit for a planted bug when it is in the same file, its line falls inside the
 * bug's line range, and its issue/evidence text matches the bug's pattern. Each bug is counted once
 * per run. Findings that match no bug are listed as UNMATCHED: read them and decide by hand whether
 * they are real defects (then pass --real=<run>:<index> so they count toward precision).
 *
 * Recall = bugs found / bugs planted.  Precision = real findings / all findings.
 * Brief scoring: recall points = 6 x recall, precision points = 4 x precision.
 */
import { readFileSync } from 'fs';

const args = process.argv.slice(2);
const realOverrides = new Set(args.filter((a) => a.startsWith('--real=')).map((a) => a.slice(7)));
const [keyPath, ...runPaths] = args.filter((a) => !a.startsWith('--'));
if (!keyPath || runPaths.length === 0) {
  console.error('usage: node score.mjs <answer-key.json> <findings.json> [...] [--real=<run>:<index>]');
  process.exit(1);
}

const key = JSON.parse(readFileSync(keyPath, 'utf8'));
const norm = (f) => String(f ?? '').replace(/\\/g, '/').replace(/^\.\//, '');
const rows = [];

runPaths.forEach((path, r) => {
  const run = r + 1;
  const findings = JSON.parse(readFileSync(path, 'utf8'));
  const found = new Set();
  let real = 0;
  console.log(`\n=== Run ${run}: ${path} (${findings.length} findings)`);
  findings.forEach((f, i) => {
    const text = `${f.issue ?? ''} ${f.evidence ?? ''}`;
    const bug = key.bugs.find(
      (b) =>
        !found.has(b.id) &&
        norm(f.file).endsWith(b.file) &&
        Number(f.line) >= b.lines[0] &&
        Number(f.line) <= b.lines[1] &&
        new RegExp(b.match, 'i').test(text)
    );
    const override = realOverrides.has(`${run}:${i}`);
    if (bug) {
      found.add(bug.id);
      real += 1;
      console.log(`  [${i}] HIT ${bug.id}  ${f.file}:${f.line}  ${f.issue}`);
    } else {
      if (override) real += 1;
      console.log(`  [${i}] ${override ? 'REAL (manual)' : 'UNMATCHED'}  ${f.file}:${f.line} [${f.severity}]  ${f.issue}`);
    }
  });
  const recall = found.size / key.bugs.length;
  const precision = findings.length ? real / findings.length : 1;
  const missed = key.bugs.filter((b) => !found.has(b.id)).map((b) => b.id);
  console.log(`  recall ${found.size}/${key.bugs.length} = ${(recall * 100).toFixed(0)}%   precision ${real}/${findings.length} = ${(precision * 100).toFixed(0)}%   missed: ${missed.join(', ') || 'none'}`);
  rows.push({ run, recall, precision, findings: findings.length, missed });
});

const mean = (k) => rows.reduce((s, r) => s + r[k], 0) / rows.length;
console.log('\n| Run | Findings | Recall | Precision | Missed |');
console.log('|-----|----------|--------|-----------|--------|');
for (const r of rows) {
  console.log(`| ${r.run} | ${r.findings} | ${(r.recall * 100).toFixed(0)}% | ${(r.precision * 100).toFixed(0)}% | ${r.missed.join(', ') || '-'} |`);
}
console.log(`| **Mean** | | **${(mean('recall') * 100).toFixed(0)}%** | **${(mean('precision') * 100).toFixed(0)}%** | |`);
console.log(`\nBrief points (mean): recall ${(6 * mean('recall')).toFixed(1)}/6, precision ${(4 * mean('precision')).toFixed(1)}/4`);
