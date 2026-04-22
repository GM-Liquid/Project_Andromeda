import assert from 'node:assert/strict';
import test from 'node:test';

import { getRulebookManifest } from './rulebook.manifest.mjs';

test('rulebook publication starts at the introduction chapter', () => {
  const manifest = getRulebookManifest();
  const entrySlugs = manifest.map((entry) => entry.slug);
  const firstEntry = manifest[0];

  assert.equal(entrySlugs.includes('index'), false);
  assert.equal(firstEntry.slug, 'rulebook/01-vvedenie');
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
        slug: 'rulebook/01-vvedenie',
        navTitle: 'Введение'
      },
      {
        slug: 'rulebook/02-sozdanie-personazha',
        navTitle: 'Персонаж'
      },
      {
        slug: 'rulebook/05-osnovnye-pravila',
        navTitle: 'Правила'
      },
      {
        slug: 'rulebook/06-boy',
        navTitle: 'Бой'
      }
    ]
  );
});

test('moved chapters keep the legacy public URLs as aliases', () => {
  const manifest = getRulebookManifest();
  const skillsChapter = manifest.find((entry) => entry.slug === 'rulebook/03-navyki');
  const equipmentChapter = manifest.find(
    (entry) => entry.slug === 'rulebook/04-sposobnosti-i-snaryazhenie'
  );
  const coreRulesChapter = manifest.find(
    (entry) => entry.slug === 'rulebook/05-osnovnye-pravila'
  );
  const combatChapter = manifest.find((entry) => entry.slug === 'rulebook/06-boy');
  const negotiationsChapter = manifest.find(
    (entry) => entry.slug === 'rulebook/07-peregovory'
  );

  assert.deepEqual(skillsChapter?.aliases, ['skills-reference']);
  assert.deepEqual(equipmentChapter?.aliases, ['03-sposobnosti-i-snaryazhenie']);
  assert.deepEqual(coreRulesChapter?.aliases, ['01-osnovnye-pravila']);
  assert.deepEqual(combatChapter?.aliases, ['04-boy']);
  assert.deepEqual(negotiationsChapter?.aliases, ['05-peregovory']);
});

test('equipment chapter keeps the temporary notice mechanism disabled by default', () => {
  const manifest = getRulebookManifest();
  const equipmentChapter = manifest.find(
    (entry) => entry.slug === 'rulebook/04-sposobnosti-i-snaryazhenie'
  );
  const combatChapter = manifest.find((entry) => entry.slug === 'rulebook/06-boy');

  assert.equal(equipmentChapter?.temporaryNotice ?? null, null);
  assert.equal(combatChapter?.temporaryNotice ?? null, null);
});
