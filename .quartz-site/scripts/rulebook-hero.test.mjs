import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { buildQuartzForTest } from './test-build-helper.mjs';

test('character creation page hero does not render the reference CTA', async () => {
  const cwd = fileURLToPath(new URL('..', import.meta.url));
  await buildQuartzForTest(cwd);

  const htmlPath = fileURLToPath(
    new URL('../public/rulebook/02-sozdanie-personazha.html', import.meta.url)
  );
  const html = await readFile(htmlPath, 'utf8');

  assert.doesNotMatch(html, /Открыть справочник/);
});
