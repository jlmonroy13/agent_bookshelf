import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawnSync, execFileSync } from 'child_process';
import { join } from 'path';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, rmSync } from 'fs';
import { tmpdir } from 'os';

const HOOK = join(process.cwd(), 'ticket-to-merge', 'hooks', 'protect.mjs');

function runHook(payload: Record<string, unknown>, mode = 'pre') {
  const input = JSON.stringify({ cwd: '/repo', ...payload });
  const result = spawnSync(process.execPath, [HOOK, mode], { input, encoding: 'utf8' });
  return { status: result.status ?? -1, stderr: result.stderr };
}

const bash = (command: string, extra: Record<string, unknown> = {}) => ({ tool_name: 'Bash', tool_input: { command }, ...extra });
const write = (file_path: string, extra: Record<string, unknown> = {}, content = 'x') => ({
  tool_name: 'Write',
  tool_input: { file_path, content },
  ...extra,
});
const edit = (file_path: string, extra: Record<string, unknown> = {}) => ({ tool_name: 'Edit', tool_input: { file_path, new_string: 'x' }, ...extra });
const read = (file_path: string) => ({ tool_name: 'Read', tool_input: { file_path } });
const implementer = { agent_type: 'ticket-to-merge:implementer' };
const testWriter = { agent_type: 'ticket-to-merge:test-writer' };

describe('ticket-to-merge protect hook', () => {
  describe('allows normal work (exit 0)', () => {
    it.each([
      ['run the tests', bash('npm run test:run')],
      ['clean install from lockfile', bash('npm ci')],
      ['git diff', bash('git diff main...HEAD -U5')],
      ['grep for process.env', bash('grep -rn "process.env.PORT" src')],
      ['test DB under /tmp', bash('rm -f /tmp/test-bookshelf.db')],
      ['remove dist', bash('rm -rf dist')],
      ['write a route', write('/repo/src/routes/api.ts')],
      ['edit the model', edit('/repo/src/models/book.ts')],
      ['read seed.sql with the Read tool', read('/repo/src/db/seed.sql')],
      ['read the schema with the Read tool', read('/repo/src/db/schema.sql')],
      ['implementer edits src', edit('/repo/src/models/book.ts', implementer)],
      ['implementer runs tests', bash('npm run test:run', implementer)],
      ['test-writer writes a test', write('/repo/tests/routes/search.test.ts', testWriter)],
      ['orchestrator restores tests', bash('git checkout abc123 -- tests/')],
    ])('%s', (_label, payload) => {
      expect(runHook(payload).status).toBe(0);
    });
  });

  describe('blocks Read/Edit/Write on protected files (exit 2)', () => {
    it.each([
      ['read .env', read('/repo/.env')],
      ['write .env.local', write('/repo/.env.local')],
      ['write bookshelf.db', write('/repo/bookshelf.db')],
      ['edit seed.sql', edit('/repo/src/db/seed.sql')],
      ['edit schema.sql', edit('/repo/src/db/schema.sql')],
      ['edit package.json', edit('/repo/package.json')],
      ['write the WAL file', write('/repo/bookshelf.db-wal')],
      ['case-insensitive', write('/repo/src/db/SEED.SQL')],
      ['Windows path', write('C:\\repo\\.env')],
    ])('%s', (_label, payload) => {
      expect(runHook(payload).status).toBe(2);
    });
  });

  describe('blocks Bash bypasses (exit 2)', () => {
    it.each([
      ['append to .env', 'echo DEBUG=1 >> .env'],
      ['cat .env', 'cat .env'],
      ['sed seed.sql', "sed -i '' 's/Clean/Dirty/' src/db/seed.sql"],
      ['delete the database', 'rm bookshelf.db'],
      ['sqlite3 on the database', 'sqlite3 bookshelf.db "DELETE FROM books"'],
      ['add a dependency', 'npm install lodash'],
      ['npm i short form', 'npm i -D lodash'],
      ['yarn add', 'yarn add lodash'],
      ['shell variable', 'F=seed; echo x >> src/db/$F.sql'],
      ['braced variable', 'D=bookshelf; rm ${D}.db'],
      ['split quotes', 'echo x >> src/db/"see""d.sql"'],
      ['backslash', 'echo x >> src/db/se\\ed.sql'],
      ['python concatenation', `python3 -c "open('src/db/'+'see'+'d.sql','a').write('x')"`],
      ['node concatenation', `node -e "require('fs').writeFileSync('.e'+'nv','x')"`],
      ['glob delete', 'rm src/db/*.sql'],
      ['glob with ?', 'rm bookshelf.d?'],
      ['find -delete', "find . -name '*.db' -delete"],
      ['delete parent dir', 'rm -rf src/db'],
      ['delete parent dir, absolute', 'rm -rf /repo/src'],
      ['move parent dir', 'mv src /tmp/src-backup'],
      ['printf command substitution', "echo x >> src/db/$(printf '%s.%s' seed sql)"],
      ['hex escape', "echo x >> $'\\x2e\\x65nv'"],
      ['fromCharCode', `node -e "require('fs').writeFileSync(String.fromCharCode(46,101,110,118),'x')"`],
      ['base64 name', 'echo x > $(echo LmVudg== | base64 -d)'],
      ['git apply', 'git apply /tmp/evil.patch'],
      ['npm install with flags first', 'npm install --save-dev --no-audit lodash'],
    ])('%s', (_label, command) => {
      expect(runHook(bash(command)).status).toBe(2);
    });

    it('implementer cannot redirect into tests/', () => {
      expect(runHook(bash('sed -i "" "s/400/200/" tests/routes/search.test.ts', implementer)).status).toBe(2);
    });
  });

  describe('agent role rules (exit 2)', () => {
    it('implementer cannot edit a test file', () => {
      expect(runHook(edit('/repo/tests/routes/search.test.ts', implementer)).status).toBe(2);
    });
    it('implementer cannot write a *.test.ts outside tests/', () => {
      expect(runHook(write('/repo/src/search.test.ts', implementer)).status).toBe(2);
    });
    it('test-writer cannot edit implementation', () => {
      expect(runHook(edit('/repo/src/models/book.ts', testWriter)).status).toBe(2);
    });
  });

  describe('script content and symlinks', () => {
    it('blocks writing a script that writes seed.sql', () => {
      const payload = write('/repo/scripts/fix.js', {}, "require('fs').writeFileSync('src/db/seed.sql', '')");
      expect(runHook(payload).status).toBe(2);
    });

    it('blocks a Write through a symlink to seed.sql', () => {
      const dir = mkdtempSync(join(tmpdir(), 't2m-'));
      writeFileSync(join(dir, 'seed.sql'), 'x');
      symlinkSync(join(dir, 'seed.sql'), join(dir, 'innocent.txt'));
      expect(runHook({ ...write(join(dir, 'innocent.txt')), cwd: dir }).status).toBe(2);
      rmSync(dir, { recursive: true, force: true });
    });
  });

  describe('fails closed', () => {
    it('blocks on invalid JSON', () => {
      const r = spawnSync(process.execPath, [HOOK, 'pre'], { input: 'not json', encoding: 'utf8' });
      expect(r.status).toBe(2);
    });
    it('blocks on empty input', () => {
      const r = spawnSync(process.execPath, [HOOK, 'pre'], { input: '', encoding: 'utf8' });
      expect(r.status).toBe(2);
    });
  });

  describe('post-Bash integrity check', () => {
    let repo: string;

    beforeAll(() => {
      repo = mkdtempSync(join(tmpdir(), 't2m-repo-'));
      mkdirSync(join(repo, 'src', 'db'), { recursive: true });
      writeFileSync(join(repo, 'src', 'db', 'seed.sql'), 'ORIGINAL');
      const git = (...args: string[]) => execFileSync('git', args, { cwd: repo, stdio: 'ignore' });
      git('init', '-q');
      git('-c', 'user.email=t@t', '-c', 'user.name=t', 'add', '.');
      git('-c', 'user.email=t@t', '-c', 'user.name=t', 'commit', '-qm', 'init');
    });

    afterAll(() => rmSync(repo, { recursive: true, force: true }));

    it('detects a change that slipped past the pre hook and restores it from git', () => {
      const ids = { cwd: repo, session_id: 's1', tool_use_id: 'toolu_integrity' };
      expect(runHook({ ...bash('node scripts/innocent.js'), ...ids }, 'pre').status).toBe(0);
      writeFileSync(join(repo, 'src', 'db', 'seed.sql'), 'TAMPERED'); // simulate the command's effect
      const post = runHook({ ...bash('node scripts/innocent.js'), ...ids }, 'post');
      expect(post.status).toBe(2);
      expect(post.stderr).toContain('src/db/seed.sql');
      expect(readFileSync(join(repo, 'src', 'db', 'seed.sql'), 'utf8')).toBe('ORIGINAL');
    });

    it('stays quiet when nothing protected changed', () => {
      const ids = { cwd: repo, session_id: 's1', tool_use_id: 'toolu_clean' };
      runHook({ ...bash('ls'), ...ids }, 'pre');
      expect(runHook({ ...bash('ls'), ...ids }, 'post').status).toBe(0);
    });
  });
});
