import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { buildQuartzForTest } from './test-build-helper.mjs';

test('equipment chapter renders the generated catalog content when the temporary notice is disabled', async () => {
  const cwd = fileURLToPath(new URL('..', import.meta.url));
  await buildQuartzForTest(cwd);

  const htmlPath = fileURLToPath(
    new URL('../public/rulebook/04-sposobnosti-i-snaryazhenie.html', import.meta.url)
  );
  const html = await readFile(htmlPath, 'utf8');

  assert.doesNotMatch(html, /data-temporary-notice="true"/u);
  assert.match(html, /rulebook-ability-catalog__summary-row/u);
});
