#!/usr/bin/env node
/**
 * PreToolUse hook: block edits to .env files (Edit/Write) and common Bash bypasses.
 * Exit 0 = allow, 1 = non-blocking error, 2 = block tool call.
 */
import { readFileSync } from 'fs';

const BLOCK_MESSAGE =
  'BLOCKED: .env files cannot be modified in this project. Do not create or change .env; use documented configuration instead.';

function normalizePath(filePath) {
  return String(filePath).replace(/\\/g, '/');
}

function isEnvFilePath(filePath) {
  if (!filePath) return false;
  const normalized = normalizePath(filePath);
  const base = normalized.split('/').pop() ?? '';
  return base === '.env' || base.startsWith('.env.');
}

function commandReferencesEnv(command) {
  if (!command || typeof command !== 'string') return false;
  const c = command;

  // Literal .env or .env.local paths
  if (/(\/|^|\s|["'`=])\.env(?:\.[A-Za-z0-9._-]+)?(?:\s|$|["'`])/.test(c)) {
    return true;
  }

  // Redirection / append to .env
  if (/(?:>>?|\|)\s*["']?\.env/.test(c)) {
    return true;
  }

  // cp, mv, install, touch targeting .env
  if (/\b(cp|mv|copy|move|install|touch)\b[^\n;|&]*\.env/.test(c)) {
    return true;
  }

  // sed/awk in-place on .env
  if (/\b(sed|awk|perl|python3?|node)\b[^\n;|&]*\.env/.test(c)) {
    return true;
  }

  // echo/printf/tee writing .env
  if (/\b(echo|printf|tee)\b[^\n;|&]*\.env/.test(c)) {
    return true;
  }

  // env var assignment files
  if (/\bexport\b[^\n]*=\s*[^\n]*\.env/.test(c)) {
    return true;
  }

  return false;
}

function main() {
  let raw = '';
  try {
    raw = readFileSync(0, 'utf8');
  } catch {
    process.exit(0);
  }

  if (!raw.trim()) {
    process.exit(0);
  }

  let input;
  try {
    input = JSON.parse(raw);
  } catch {
    console.error('Hook error: invalid JSON on stdin');
    process.exit(1);
  }

  const toolName = input.tool_name;
  const toolInput = input.tool_input ?? {};

  if (toolName === 'Edit' || toolName === 'Write') {
    if (isEnvFilePath(toolInput.file_path)) {
      console.error(BLOCK_MESSAGE);
      process.exit(2);
    }
  }

  if (toolName === 'Bash') {
    if (commandReferencesEnv(toolInput.command)) {
      console.error(BLOCK_MESSAGE);
      process.exit(2);
    }
  }

  process.exit(0);
}

main();
