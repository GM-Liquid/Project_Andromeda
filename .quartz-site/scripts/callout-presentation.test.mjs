import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

test('generic info and note callouts indent their body content under the title text', async () => {
  const stylesheetPath = fileURLToPath(
    new URL('../quartz/styles/callouts.scss', import.meta.url)
  );
  const stylesheet = await readFile(stylesheetPath, 'utf8');

  assert.match(stylesheet, /\.callout\s*\{[\s\S]*--callout-icon-size:\s*18px;/);
  assert.match(stylesheet, /\.callout\s*\{[\s\S]*--callout-title-gap:\s*5px;/);
  assert.match(
    stylesheet,
    /&\[data-callout="info"\],\s*&\[data-callout="note"\]\s*\{[\s\S]*?&\s*>\s*\.callout-content\s*\{[\s\S]*padding:\s*0 0 1rem calc\(var\(--callout-icon-size\) \+ var\(--callout-title-gap\)\);/
  );
  assert.match(
    stylesheet,
    /&\[data-callout="info"\],\s*&\[data-callout="note"\]\s*\{[\s\S]*?&\s*>\s*\.callout-content\s*>\s*:last-child\s*\{[\s\S]*margin-bottom:\s*0;/
  );
});

test('reference note callouts keep zero left content padding when the icon is hidden', async () => {
  const stylesheetPath = fileURLToPath(
    new URL('../quartz/styles/custom.scss', import.meta.url)
  );
  const stylesheet = await readFile(stylesheetPath, 'utf8');

  assert.match(
    stylesheet,
    /\[data-page-type="reference"\]\s+\.callout\.is-collapsible\[data-callout="note"\]\s*\{[\s\S]*?&\s+\.callout-content\s*\{[\s\S]*padding-inline-start:\s*0;/
  );
});
