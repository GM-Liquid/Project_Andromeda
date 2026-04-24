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

  assert.equal(
    groups.some((group) => group.key === 'genomes'),
    false
  );
  assert.equal(
    groups.some((group) => group.key === 'sourceAbilities'),
    false
  );
  assert.equal(
    groups.some((group) => group.key === 'traits'),
    false
  );
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
  assert.equal(
    ru.SheetLabels.AbilitiesAndMods,
    '\u0421\u043f\u043e\u0441\u043e\u0431\u043d\u043e\u0441\u0442\u0438'
  );
  assert.equal(en.ItemGroups.Abilities, 'Abilities');
  assert.equal(
    ru.ItemGroups.Abilities,
    '\u0421\u043f\u043e\u0441\u043e\u0431\u043d\u043e\u0441\u0442\u0438'
  );
  assert.equal(en.ItemGroups.CreateAbility, 'Add ability');
  assert.equal(
    ru.ItemGroups.CreateAbility,
    '\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u0441\u043f\u043e\u0441\u043e\u0431\u043d\u043e\u0441\u0442\u044c'
  );
});

test('key info layout uses two four-column rows and a centered advancement row', () => {
  const actorSheet = readText('templates/actor/partials/actor-sheet-content.hbs');
  const css = readText('css/project-andromeda.css');

  assert.match(actorSheet, /key-info-grid__row key-info-grid__row--four/);
  assert.match(actorSheet, /key-info-grid__row key-info-grid__row--two-centered/);
  assert.match(actorSheet, /name='system\.speed\.value'/);
  assert.match(actorSheet, /name='system\.defenses\.physical'/);
  assert.match(actorSheet, /name='system\.defenses\.azure'/);
  assert.match(actorSheet, /name='system\.defenses\.mental'/);
  assert.match(actorSheet, /name='system\.advancement\.totalSpent'/);
  assert.match(css, /\.key-info-grid__row--two-centered/);
});

test('temporary bonuses use a responsive grid instead of the old vertical table', () => {
  const actorSheet = readText('templates/actor/partials/actor-sheet-content.hbs');
  const css = readText('css/project-andromeda.css');

  assert.match(actorSheet, /class='temp-bonus-grid'/);
  assert.match(actorSheet, /class='temp-bonus-field'/);
  assert.doesNotMatch(actorSheet, /<h2>\{\{localize 'MY_RPG.TempBonus.Label'\}\}<\/h2>\s*<table>/);
  assert.match(css, /\.temp-bonus-grid/);
});

test('localization renames progress labels and shortens the speed label in both languages', () => {
  const en = readJson('lang/en.json').MY_RPG;
  const ru = readJson('lang/ru.json').MY_RPG;

  assert.equal(en.KeyInfo.ProgressPoints, 'Available Advancement Points');
  assert.equal(
    ru.KeyInfo.ProgressPoints,
    '\u0414\u043e\u0441\u0442\u0443\u043f\u043d\u044b\u0435 \u043e\u0447\u043a\u0438 \u0440\u0430\u0437\u0432\u0438\u0442\u0438\u044f'
  );
  assert.equal(en.KeyInfo.TotalAdvancementPoints, 'Total Advancement Points');
  assert.equal(
    ru.KeyInfo.TotalAdvancementPoints,
    '\u0412\u0441\u0435\u0433\u043e \u043e\u0447\u043a\u043e\u0432 \u0440\u0430\u0437\u0432\u0438\u0442\u0438\u044f'
  );
  assert.equal(en.Speed.Label, 'Speed');
  assert.equal(ru.Speed.Label, '\u0421\u043a\u043e\u0440\u043e\u0441\u0442\u044c');
});
