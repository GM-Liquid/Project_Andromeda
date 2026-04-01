import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const execFileAsync = promisify(execFile);

test('character creation page hero does not render the reference CTA', async () => {
  const cwd = fileURLToPath(new URL('..', import.meta.url));
  if (process.platform === 'win32') {
    await execFileAsync('cmd.exe', ['/d', '/s', '/c', 'npm run build'], {
      cwd,
      windowsHide: true
    });
  } else {
    await execFileAsync('npm', ['run', 'build'], {
      cwd,
      windowsHide: true
    });
  }

  const htmlPath = fileURLToPath(
    new URL('../public/rulebook/02-sozdanie-personazha.html', import.meta.url)
  );
  const html = await readFile(htmlPath, 'utf8');

  assert.doesNotMatch(html, /Открыть справочник/);
});
