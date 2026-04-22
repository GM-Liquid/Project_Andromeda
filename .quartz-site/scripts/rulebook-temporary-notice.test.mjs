import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const execFileAsync = promisify(execFile);

test('equipment chapter renders the generated catalog content when the temporary notice is disabled', async () => {
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
    new URL('../public/rulebook/04-sposobnosti-i-snaryazhenie.html', import.meta.url)
  );
  const html = await readFile(htmlPath, 'utf8');

  assert.doesNotMatch(html, /data-temporary-notice="true"/u);
  assert.match(html, /rulebook-ability-catalog__summary-row/u);
});
