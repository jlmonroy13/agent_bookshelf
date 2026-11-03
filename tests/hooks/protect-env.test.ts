import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import { join } from 'path';

const HOOK = join(process.cwd(), '.claude', 'hooks', 'protect-env.js');

function runHook(payload: unknown): number {
  const input = typeof payload === 'string' ? payload : JSON.stringify(payload);
  const result = spawnSync(process.execPath, [HOOK], { input, encoding: 'utf8' });
  return result.status ?? -1;
}

const bash = (command: string) => ({ tool_name: 'Bash', tool_input: { command } });
const write = (file_path: string) => ({ tool_name: 'Write', tool_input: { file_path } });
const edit = (file_path: string) => ({ tool_name: 'Edit', tool_input: { file_path } });

describe('protect-env hook', () => {
  describe('allows normal work (exit 0)', () => {
    it.each([
      ['Write to a source file', write('/repo/src/routes/api.ts')],
      ['Edit a file whose name only contains env', edit('/repo/src/environment.ts')],
      ['Run the tests', bash('npm run test:run')],
      ['Search for process.env usage', bash('grep -rn "process.env" src')],
      ['Read PORT from the environment', bash('echo $(printenv PORT)')],
      ['List environment variables', bash('env | grep PORT')],
    ])('%s', (_label, payload) => {
      expect(runHook(payload)).toBe(0);
    });
  });

  describe('blocks Edit/Write on .env files (exit 2)', () => {
    it.each([
      ['Write .env', write('/repo/.env')],
      ['Edit .env.local', edit('/repo/.env.local')],
      ['Write .ENV (case-insensitive file systems)', write('/repo/.ENV')],
      ['Write through ../', write('./config/../.env')],
      ['Windows path', write('C:\\repo\\.env')],
    ])('%s', (_label, payload) => {
      expect(runHook(payload)).toBe(2);
    });
  });

  describe('blocks Bash bypasses (exit 2)', () => {
    it.each([
      ['echo append', 'echo DEBUG=true >> .env'],
      ['sed in place', 'sed -i s/foo/bar/ .env'],
      ['cp over it', 'cp /tmp/x .env'],
      ['tee', 'tee -a .env <<< DEBUG=true'],
      ['printf into ./.env', "printf 'DEBUG=true' > ./.env"],
      ['node -e', `node -e "require('fs').appendFileSync('.env','DEBUG=true')"`],
      ['mv to .env.local', 'mv config.tmp .env.local'],
      ['cat to read it', 'cat .env'],
      ['python string concatenation', `python3 -c "open('.e'+'nv','a').write('DEBUG=true')"`],
      ['adjacent shell quotes', 'echo DEBUG=true >> ".e""nv"'],
      ['backslash escape', 'echo DEBUG=true >> .e\\nv'],
      ['shell variable', 'F=.e; echo DEBUG=true >> ${F}nv'],
      ['command substitution', "echo DEBUG=true >> $(printf '.%s' env)"],
    ])('%s', (_label, command) => {
      expect(runHook(bash(command))).toBe(2);
    });
  });

  describe('fails closed on bad input (exit 2, never 1)', () => {
    it('invalid JSON', () => {
      expect(runHook('not json')).toBe(2);
    });

    it('empty input', () => {
      expect(runHook('')).toBe(2);
    });
  });
});
