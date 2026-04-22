import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { getItemGroupConfigs } from '../helpers/item-config.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..', '..');

function readText(relativePath) {
  return readFileSync(path.join(rootDir, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

test('abilities tab uses one unified abilities group and creates new entries as traits', () => {
  const groups = getItemGroupConfigs();
  const abilitiesGroup = groups.find((group) => group.key === 'abilities');

  assert.ok(abilitiesGroup);
  assert.equal(abilitiesGroup.tab, 'abilities');
  assert.deepEqual(abilitiesGroup.types, [
    'trait-source-ability',
    'trait-genome',
    'trait',
    'trait-flaw',
    'trait-general',
    'trait-backstory',
    'trait-social',
    'trait-combat',
    'trait-magical',
    'trait-professional',
    'trait-technological'
  ]);
  assert.deepEqual(abilitiesGroup.createTypes, ['trait']);
  assert.equal(abilitiesGroup.labelKey, 'MY_RPG.ItemGroups.Abilities');
  assert.equal(abilitiesGroup.emptyKey, 'MY_RPG.ItemGroups.EmptyAbilities');
  assert.equal(abilitiesGroup.createKey, 'MY_RPG.ItemGroups.CreateAbility');
  assert.equal(abilitiesGroup.newNameKey, 'MY_RPG.ItemGroups.NewAbility');
  assert.equal(abilitiesGroup.showKindBadge, false);

  assert.equal(groups.some((group) => group.key === 'genomes'), false);
  assert.equal(groups.some((group) => group.key === 'sourceAbilities'), false);
  assert.equal(groups.some((group) => group.key === 'traits'), false);
});

test('trait usage frequency relabels the two-per-scene option to one-per-session in both languages', () => {
  const en = readJson('lang/en.json').MY_RPG;
  const ru = readJson('lang/ru.json').MY_RPG;

  assert.equal(en.UsageFrequency.TwoPerScene, '1/Session');
  assert.equal(ru.UsageFrequency.TwoPerScene, '1/\u0421\u0435\u0441\u0441\u0438\u044e');
});

test('personality tab removes feature and backstory fields while keeping archetype and appearance', () => {
  const actorSheet = readText('templates/actor/partials/actor-sheet-content.hbs');

  assert.doesNotMatch(actorSheet, /system\.biography\.feature/);
  assert.doesNotMatch(actorSheet, /system\.biography\.backstory/);
  assert.match(actorSheet, /system\.biography\.archetype/);
  assert.match(actorSheet, /system\.biography\.appearance/);
});

test('localization renames the abilities tab and unified group in both languages', () => {
  const en = readJson('lang/en.json').MY_RPG;
  const ru = readJson('lang/ru.json').MY_RPG;

  assert.equal(en.SheetLabels.AbilitiesAndMods, 'Abilities');
  assert.equal(ru.SheetLabels.AbilitiesAndMods, '\u0421\u043f\u043e\u0441\u043e\u0431\u043d\u043e\u0441\u0442\u0438');
  assert.equal(en.ItemGroups.Abilities, 'Abilities');
  assert.equal(ru.ItemGroups.Abilities, '\u0421\u043f\u043e\u0441\u043e\u0431\u043d\u043e\u0441\u0442\u0438');
  assert.equal(en.ItemGroups.CreateAbility, 'Add ability');
  assert.equal(
    ru.ItemGroups.CreateAbility,
    '\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0441\u043f\u043e\u0441\u043e\u0431\u043d\u043e\u0441\u0442\u044c'
  );
});
