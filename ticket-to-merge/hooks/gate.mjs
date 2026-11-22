#!/usr/bin/env node
/**
 * Done-gate: a Stop hook declared in skills/ship-ticket/SKILL.md, so it only exists while /ship-ticket runs.
 * Claude may not finish the ticket while `npm run test:run` is red.
 *
 * On failure it exits 2 and sends Claude only the failing lines (not the full Vitest log): this trims
 * the tokens each fix iteration costs. After MAX_BLOCKS consecutive blocks in one session it lets Claude
 * stop and tells the user, so a broken environment cannot loop forever.
 */
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'fs';
import { spawnSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';

const MAX_BLOCKS = 5;
const MAX_LINES = 40;

let input = {};
try {
  input = JSON.parse(readFileSync(0, 'utf8') || '{}');
} catch {
  // No input: still run the gate.
}
const cwd = input.cwd || process.cwd();
const counterFile = join(tmpdir(), `ticket-to-merge-gate-${String(input.session_id || 'default').replace(/[^\w-]/g, '')}`);

const run = spawnSync('npm', ['run', 'test:run'], { cwd, encoding: 'utf8', env: { ...process.env, CI: '1', FORCE_COLOR: '0' } });

if (run.status === 0) {
  if (existsSync(counterFile)) unlinkSync(counterFile);
  process.exit(0);
}

const blocks = (existsSync(counterFile) ? Number(readFileSync(counterFile, 'utf8')) || 0 : 0) + 1;
writeFileSync(counterFile, String(blocks));
if (blocks > MAX_BLOCKS) {
  unlinkSync(counterFile);
  console.log(JSON.stringify({ systemMessage: `ticket-to-merge gate: suite still red after ${MAX_BLOCKS} attempts; stopping so a human can look.` }));
  process.exit(0);
}

const output = `${run.stdout ?? ''}\n${run.stderr ?? ''}`;
const interesting = output
  .split('\n')
  .filter((l) => /FAIL|✗|×|AssertionError|Error:|Expected|Received|expected|Tests\s+\d|Test Files/.test(l))
  .slice(0, MAX_LINES);

console.error(
  `DONE-GATE (${blocks}/${MAX_BLOCKS}): npm run test:run is failing, the ticket is not done.\n` +
    (interesting.length ? interesting.join('\n') : output.slice(-2000)) +
    '\nFix the implementation (not the tests), then finish.'
);
process.exit(2);
