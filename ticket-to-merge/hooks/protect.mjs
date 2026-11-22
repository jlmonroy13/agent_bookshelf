#!/usr/bin/env node
/**
 * ticket-to-merge guardrail. One script, three hook events:
 *
 *   node protect.mjs pre    PreToolUse  (Read|Edit|Write|NotebookEdit|Bash)  -> block before it happens
 *   node protect.mjs post   PostToolUse (Bash)                              -> detect what slipped through
 *
 * Protected:
 *   .env, .env.*                      never read or written (not even by Bash `cat`)
 *   bookshelf.db (+ -wal/-shm/-journal), seed.sql, schema.sql, package.json, package-lock.json
 *                                     never written; Read tool is fine, Bash may not name them at all
 *   tests/** while the implementer agent runs  (tests stay read-only during the green phase)
 *   `npm install <pkg>` and friends   no new dependencies
 *
 * Exit codes: 0 allow, 2 block (stderr goes to Claude). Every failure path exits 2: fail closed.
 *
 * Layers for Bash (pre):
 *   1. Literal names                  echo x >> src/db/seed.sql
 *   2. Shell variables                F=seed; echo x > src/db/$F.sql
 *   3. Quotes / escapes / '+' joins   ".e""nv", 'see'+'d.sql'
 *   4. Globs and parent directories   rm src/db/*.sql, rm -rf src/db, find . -name '*.db' -delete
 *   5. Obfuscated writes              \x2e\x65nv, fromCharCode, base64 -d, chr()
 *   6. Patch tools                    git apply / patch / git am (could carry protected paths)
 * Layer for Write/Edit:
 *   7. Script content                 a .js/.py/.sh file whose content writes to a protected name
 *   8. Symlinks                       real path is resolved before the name check
 * Layer after Bash (post):
 *   9. Integrity check                hashes of tracked protected files before vs after the command;
 *                                     a changed tracked file is restored from git and Claude is told.
 *
 * Known limit: a string filter cannot catch every encoding. Layer 9 is the backstop for tracked files.
 */
import { readFileSync, writeFileSync, existsSync, realpathSync, statSync, unlinkSync } from 'fs';
import { createHash } from 'crypto';
import { tmpdir, homedir } from 'os';
import { join, resolve, basename } from 'path';
import { execFileSync } from 'child_process';

const ENV_FILE = /^\.env(\..+)?$/i;
const WRITE_PROTECTED = [
  'bookshelf.db', 'bookshelf.db-wal', 'bookshelf.db-shm', 'bookshelf.db-journal',
  'seed.sql', 'schema.sql', 'package.json', 'package-lock.json',
];
// Paths whose ancestors must not be deleted or moved wholesale.
const PROTECTED_PATHS = ['.env', 'bookshelf.db', 'src/db/seed.sql', 'src/db/schema.sql', 'package.json', 'package-lock.json'];
// Tracked files checked by the post-Bash integrity layer.
const INTEGRITY_FILES = ['src/db/seed.sql', 'src/db/schema.sql', 'package.json', 'package-lock.json'];

// Whole-name matches, so "process.env.PORT" or "/tmp/test-bookshelf.db" do not trip them.
const NAME_PATTERNS = [
  /(?<![\w.-])\.env(?:\.[\w.-]+)?(?![\w])/i,
  /(?<![\w.-])bookshelf\.db(?:-wal|-shm|-journal)?(?![\w])/i,
  /(?<![\w.-])seed\.sql(?![\w])/i,
  /(?<![\w.-])schema\.sql(?![\w])/i,
  /(?<![\w.-])package(?:-lock)?\.json(?![\w])/i,
];

const WRITES = /(>|\btee\b|\bwrite|\bappend|\bcp\b|\bmv\b|\brm\b|\bdd\b|\binstall\b|\btouch\b|\bln\b|\btruncate\b|\bshred\b|\bunlink|-delete\b|\bsed\b|\bperl\b|\bopen\s*\(|\bsqlite3\b)/i;
const DYNAMIC = /(\$\(|`|\beval\b|%s|\.join\s*\(|\bconcat\b)/i;
const BARE_FRAGMENT = /(^|["'\s,(+])(env|seed|schema|sql|bookshelf|db|package)(["'\s,)+]|$)/i;
const OBFUSCATED = /(fromCharCode|\bchr\s*\(|\bbase64\b|\batob\b|Buffer\.from|\\x[0-9a-f]{2}|\\u00[0-9a-f]{2}|\\[0-7]{3}|\bxxd\b|\brot13\b|\brev\b|\[::-1\])/i;
const PATCH_TOOLS = /\b(git\s+apply|git\s+am|patch)\b/i;
const ADD_DEPENDENCY = /\b(npm\s+(i|install|add)\s+(?:-\S+\s+)*[^\s;&|-]|npm\s+(uninstall|remove|rm|update|up)\b|yarn\s+add\b|pnpm\s+(add|install\s+[^\s-])|bun\s+add\b|npx\s+[^\s]+\s+.*--save)/i;
const SCRIPT_EXT = /\.(m?js|cjs|ts|py|sh|bash|zsh|rb|pl)$/i;

const MESSAGE =
  'BLOCKED by ticket-to-merge guardrail. Never touch .env, bookshelf.db, seed.sql, schema.sql or package*.json, and do not add dependencies. Use the Read tool to look at seed.sql/schema.sql.';

function block(reason) {
  console.error(`${MESSAGE} (${reason})`);
  process.exit(2);
}

const lastSegment = (p) => String(p).replace(/\\/g, '/').split('/').pop() ?? '';

function protectedBasename(name, { forRead = false } = {}) {
  const lower = name.toLowerCase();
  if (ENV_FILE.test(lower)) return '.env file';
  if (!forRead && WRITE_PROTECTED.includes(lower)) return lower;
  return null;
}

function checkPath(filePath, cwd, opts) {
  if (!filePath) return null;
  const hit = protectedBasename(lastSegment(filePath), opts);
  if (hit) return `path ${hit}`;
  try {
    const real = realpathSync(resolve(cwd, String(filePath)));
    const realHit = protectedBasename(basename(real), opts);
    if (realHit) return `symlink to ${realHit}`;
  } catch {
    // File does not exist yet: nothing to resolve.
  }
  return null;
}

function mentionsProtected(text) {
  return NAME_PATTERNS.some((re) => re.test(text));
}

function expandShellVars(command) {
  const vars = {};
  const assign = /(?:^|[\s;&|(])([A-Za-z_]\w*)=("[^"]*"|'[^']*'|[^\s;&|)]*)/g;
  for (const m of command.matchAll(assign)) vars[m[1]] = m[2].replace(/^["']|["']$/g, '');
  return command.replace(/\$\{(\w+)\}|\$(\w+)/g, (whole, a, b) => vars[a ?? b] ?? whole);
}

const squash = (s) => s.replace(/["'`\\+\s]/g, '');

function globToRegex(glob) {
  const body = glob.replace(/[.+^${}()|\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.');
  return new RegExp(`^${body}$`, 'i');
}

function globOrParentHit(command, cwd) {
  const tokens = command.split(/[\s;&|()]+/).map((t) => t.replace(/^["']|["']$/g, '')).filter(Boolean);
  const destructive = /\b(rm|mv|cp|truncate|shred|find|ln|dd|tee)\b|>/.test(command);
  if (!destructive) return null;
  const basenames = ['.env', ...WRITE_PROTECTED];
  for (const token of tokens) {
    if (/[*?[]/.test(token)) {
      const re = globToRegex(lastSegment(token));
      const match = basenames.find((b) => re.test(b));
      if (match) return `glob ${token} matches ${match}`;
    }
  }
  if (/\b(rm|mv)\b/.test(command)) {
    const protectedAbs = PROTECTED_PATHS.map((p) => resolve(cwd, p));
    for (const token of tokens) {
      if (token.startsWith('-') || token === 'rm' || token === 'mv') continue;
      const abs = resolve(cwd, token.replace(/^~(?=\/|$)/, homedir()));
      const prefix = abs.endsWith('/') ? abs : `${abs}/`;
      if (protectedAbs.some((p) => p.startsWith(prefix))) return `removes or moves ${token}, which contains protected files`;
    }
  }
  return null;
}

function bashReason(command, cwd) {
  if (!command || typeof command !== 'string') return null;
  if (ADD_DEPENDENCY.test(command)) return 'adds or changes dependencies';
  if (mentionsProtected(command)) return 'names a protected file';
  const expanded = expandShellVars(command);
  if (mentionsProtected(expanded)) return 'shell variable builds a protected name';
  if (mentionsProtected(squash(expanded))) return 'split or quoted protected name';
  const glob = globOrParentHit(expanded, cwd);
  if (glob) return glob;
  if (WRITES.test(command) && DYNAMIC.test(command) && BARE_FRAGMENT.test(command)) return 'dynamically built file name';
  if (WRITES.test(command) && OBFUSCATED.test(command)) return 'obfuscated write';
  if (PATCH_TOOLS.test(command)) return 'patch tools are disabled; edit files with Edit/Write';
  return null;
}

const agentIs = (input, name) => new RegExp(`(^|:)${name}$`).test(String(input.agent_type ?? ''));
const isImplementer = (input) => agentIs(input, 'implementer');
const isTestWriter = (input) => agentIs(input, 'test-writer');

function isTestPath(filePath, cwd) {
  const rel = resolve(cwd, String(filePath)).replace(/\\/g, '/');
  return /\/tests?\//.test(rel) || /\.(test|spec)\.[cm]?[jt]s$/.test(rel);
}

function pre(input) {
  const tool = input.tool_name;
  const ti = input.tool_input ?? {};
  const cwd = input.cwd || process.cwd();

  if (tool === 'Read') {
    const reason = checkPath(ti.file_path, cwd, { forRead: true });
    if (reason) block(reason);
    return;
  }

  if (tool === 'Edit' || tool === 'Write' || tool === 'NotebookEdit') {
    const filePath = ti.file_path ?? ti.notebook_path;
    const reason = checkPath(filePath, cwd);
    if (reason) block(reason);
    if (isImplementer(input) && filePath && isTestPath(filePath, cwd)) {
      block('tests are read-only for the implementer; report the problem instead of editing tests');
    }
    if (isTestWriter(input) && filePath && !isTestPath(filePath, cwd)) {
      block('the test-writer may only create or edit files under tests/');
    }
    const content = String(ti.content ?? ti.new_string ?? '');
    if (filePath && SCRIPT_EXT.test(filePath) && !isTestPath(filePath, cwd) && WRITES.test(content) && mentionsProtected(content)) {
      block('script content writes to a protected file');
    }
    return;
  }

  if (tool === 'Bash') {
    const command = String(ti.command ?? '');
    const reason = bashReason(command, cwd);
    if (reason) block(reason);
    if (isImplementer(input) && WRITES.test(command) && /(^|[\s"'/])tests?\//.test(command)) {
      block('tests are read-only for the implementer');
    }
    snapshot(input, cwd);
  }
}

// ---- Layer 9: integrity check around each Bash call --------------------------------------------

function fingerprint(cwd) {
  const out = {};
  for (const rel of INTEGRITY_FILES) {
    const p = join(cwd, rel);
    out[rel] = existsSync(p) ? createHash('sha256').update(readFileSync(p)).digest('hex') : null;
  }
  // .env is never read, not even here: existence, size and mtime only.
  const env = join(cwd, '.env');
  out['.env'] = existsSync(env) ? `${statSync(env).size}:${statSync(env).mtimeMs}` : null;
  return out;
}

function snapshotFile(input) {
  const key = String(input.tool_use_id || input.session_id || 'default').replace(/[^\w-]/g, '');
  return join(tmpdir(), `ticket-to-merge-${key}.json`);
}

function snapshot(input, cwd) {
  try {
    writeFileSync(snapshotFile(input), JSON.stringify(fingerprint(cwd)));
  } catch {
    // A missing snapshot only disables layer 9 for this call; layers 1-8 already ran.
  }
}

function post(input) {
  if (input.tool_name !== 'Bash') return;
  const cwd = input.cwd || process.cwd();
  const file = snapshotFile(input);
  if (!existsSync(file)) return;
  let before;
  try {
    before = JSON.parse(readFileSync(file, 'utf8'));
    unlinkSync(file);
  } catch {
    return;
  }
  const after = fingerprint(cwd);
  const changed = Object.keys(before).filter((k) => before[k] !== after[k]);
  if (changed.length === 0) return;

  const restored = [];
  for (const rel of changed) {
    if (rel === '.env') continue;
    try {
      execFileSync('git', ['checkout', '--', rel], { cwd, stdio: 'ignore' });
      restored.push(rel);
    } catch {
      // Not a git repo or file untracked: report only.
    }
  }
  console.error(
    `GUARDRAIL: the last Bash command changed protected file(s): ${changed.join(', ')}. ` +
      (restored.length ? `Restored from git: ${restored.join(', ')}. ` : '') +
      'Do not modify these files. Tell the user what happened.'
  );
  process.exit(2);
}

function main() {
  const mode = process.argv[2] === 'post' ? 'post' : 'pre';
  let input;
  try {
    const raw = readFileSync(0, 'utf8');
    if (!raw.trim()) block('hook received no input');
    input = JSON.parse(raw);
  } catch {
    block('hook received invalid input');
  }
  if (mode === 'post') post(input);
  else pre(input);
  process.exit(0);
}

main();
