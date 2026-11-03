#!/usr/bin/env node
/**
 * PreToolUse hook: block edits to .env files (Edit/Write) and Bash commands that touch them.
 *
 * Exit codes (PreToolUse):
 *   0 = allow
 *   2 = block; stderr is shown to Claude
 * Exit 1 does NOT block, so every failure path here exits 2 (fail closed).
 *
 * Layers for Bash:
 *   1. Literal references:          echo X >> .env, cp a .env.local, sed -i ... .env
 *   2. Concatenation/quoting:       open('.e'+'nv'), ".e""nv", .e\nv
 *   3. Shell variable expansion:    F=.e; echo X >> ${F}nv
 *   4. Dynamic name construction:   $(printf '.%s' env) used with a write
 *
 * Known limit: a string filter cannot catch every encoding (e.g. base64 of the name).
 * permissions.deny in .claude/settings.json is the absolute block for Read/Edit/Write.
 */
import { readFileSync } from 'fs';

const BLOCK_MESSAGE =
  'BLOCKED: .env files cannot be read or modified in this project. Do not create or change .env; use documented configuration instead.';

// ".env" or ".env.<suffix>" as a whole name, not part of e.g. "process.env.PORT".
const ENV_NAME = /(?<![A-Za-z0-9_])\.env(?:\.[A-Za-z0-9._-]+)?(?![A-Za-z0-9_])/i;

function block(reason) {
  console.error(reason ? `${BLOCK_MESSAGE} (${reason})` : BLOCK_MESSAGE);
  process.exit(2);
}

function isEnvFilePath(filePath) {
  if (!filePath) return false;
  const base = String(filePath).replace(/\\/g, '/').split('/').pop() ?? '';
  // Lowercase: macOS and Windows file systems are case-insensitive, so .ENV is .env.
  const lower = base.toLowerCase();
  return lower === '.env' || lower.startsWith('.env.');
}

function expandShellVars(command) {
  const vars = {};
  const assign = /(?:^|[\s;&|(])([A-Za-z_]\w*)=("[^"]*"|'[^']*'|[^\s;&|)]*)/g;
  for (const m of command.matchAll(assign)) {
    vars[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
  return command.replace(/\$\{(\w+)\}|\$(\w+)/g, (whole, a, b) => vars[a ?? b] ?? whole);
}

// Remove quotes, escapes, '+' concatenation and whitespace so split names join back up.
function squash(command) {
  return command.replace(/["'`\\+\s]/g, '');
}

const WRITES = /(>|\btee\b|\bwrite|\bappend|\bcp\b|\bmv\b|\bdd\b|\binstall\b|\btouch\b|\bln\b|\bopen\s*\()/i;
const DYNAMIC = /(\$\(|`|\beval\b|%s|\bchr\s*\(|fromCharCode|\.join\s*\(|\bconcat\b)/i;
const BARE_ENV_TOKEN = /(^|["'\s,(])env(["'\s,)]|$)/i;

function bashTouchesEnv(command) {
  if (!command || typeof command !== 'string') return null;

  if (ENV_NAME.test(command)) return 'literal path';

  const expanded = expandShellVars(command);
  if (ENV_NAME.test(expanded)) return 'shell variable';
  if (ENV_NAME.test(squash(expanded))) return 'split or quoted name';

  if (WRITES.test(command) && DYNAMIC.test(command) && BARE_ENV_TOKEN.test(command)) {
    return 'dynamically built file name';
  }

  return null;
}

function main() {
  let raw = '';
  try {
    raw = readFileSync(0, 'utf8');
  } catch {
    block('hook could not read its input');
  }

  if (!raw.trim()) block('hook received no input');

  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    block('hook received invalid JSON');
  }

  const toolName = input.tool_name;
  const toolInput = input.tool_input ?? {};

  if (toolName === 'Edit' || toolName === 'Write') {
    if (isEnvFilePath(toolInput.file_path)) block('file path');
  }

  if (toolName === 'Bash') {
    const reason = bashTouchesEnv(toolInput.command);
    if (reason) block(reason);
  }

  process.exit(0);
}

main();
