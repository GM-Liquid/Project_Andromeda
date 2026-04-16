import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { getGeneratedRulebookEntries } from './rulebook.manifest.mjs';
import * as syncBookModule from './sync-book.mjs';

test('rewriteRulebookInternalLinks rewrites chapter-title wikilinks to generated slugs', () => {
  assert.equal(typeof syncBookModule.rewriteRulebookInternalLinks, 'function');

  const transformed = syncBookModule.rewriteRulebookInternalLinks(
    [
      'См. [[Глава 3. Навыки|здесь]].',
      'Также полезно [[Глава 5. Основные правила#Броски|вернуться к броскам]].'
    ].join('\n'),
    getGeneratedRulebookEntries()
  );

  assert.match(transformed, /\[\[03-navyki\|здесь\]\]/);
  assert.match(transformed, /\[\[05-osnovnye-pravila#Броски\|вернуться к броскам\]\]/);
});

test('rulebook custom styles keep nav flyouts above the hero and info callouts render full borders', async () => {
  const stylesheetPath = fileURLToPath(
    new URL('../quartz/styles/custom.scss', import.meta.url)
  );
  const stylesheet = await readFile(stylesheetPath, 'utf8');

  assert.match(
    stylesheet,
    /\.sidebar\.left\s*\{[\s\S]*?z-index:\s*4;/,
    'rulebook left sidebar should establish a higher stacking context than the hero'
  );
  assert.match(
    stylesheet,
    /\.callout\[data-callout="info"\]\s*\{[\s\S]*?box-shadow:\s*inset 0 0 0 1px var\(--border\);/,
    'rulebook info callouts should render their border with an inset shadow'
  );
});
