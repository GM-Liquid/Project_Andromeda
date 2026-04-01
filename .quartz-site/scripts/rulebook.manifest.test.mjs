import assert from 'node:assert/strict';
import test from 'node:test';

import { getRulebookManifest } from './rulebook.manifest.mjs';

test('rulebook publication starts at the core rules chapter', () => {
  const manifest = getRulebookManifest();
  const entrySlugs = manifest.map((entry) => entry.slug);
  const firstEntry = manifest[0];

  assert.equal(entrySlugs.includes('index'), false);
  assert.equal(firstEntry.slug, 'rulebook/01-osnovnye-pravila');
  assert.deepEqual(firstEntry.aliases, ['index']);
});

test('rulebook header navigation exposes only the main four sections', () => {
  const manifest = getRulebookManifest();
  const headerEntries = manifest.filter((entry) => entry.showInHeaderNav);

  assert.deepEqual(
    headerEntries.map((entry) => ({
      slug: entry.slug,
      navTitle: entry.navTitle
    })),
    [
      {
        slug: 'rulebook/01-osnovnye-pravila',
        navTitle: 'Основы'
      },
      {
        slug: 'rulebook/02-sozdanie-personazha',
        navTitle: 'Персонаж'
      },
      {
        slug: 'rulebook/03-sposobnosti-i-snaryazhenie',
        navTitle: 'Снаряжение'
      },
      {
        slug: 'rulebook/04-boy',
        navTitle: 'Бой'
      }
    ]
  );
});
