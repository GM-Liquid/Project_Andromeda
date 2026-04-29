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

test('actor sheet uses an integrated sci-fi shell with internal tab navigation', () => {
  const actorSheet = readText('templates/actor/partials/actor-sheet-content.hbs');
  const css = readText('css/project-andromeda.css');
  const actorSheetClass = readText('module/sheets/actor-sheet.mjs');

  assert.match(actorSheet, /class='andromeda-sheet-shell'/);
  assert.match(actorSheet, /class='[^']*andromeda-sheet-tabs[^']*'/);
  assert.match(actorSheet, /class='[^']*andromeda-tab[^']*'/);
  assert.ok(
    actorSheet.indexOf("class='andromeda-identity'") < actorSheet.indexOf('andromeda-sheet-tabs')
  );
  assert.ok(
    actorSheet.indexOf('andromeda-sheet-tabs') < actorSheet.indexOf("class='sheet-scrollable'")
  );
  assert.doesNotMatch(actorSheet, /sheet-tabs-hex-container/);
  assert.doesNotMatch(actorSheet, /hex-button/);

  assert.match(css, /\.andromeda-sheet-shell/);
  assert.match(css, /\.andromeda-sheet-tabs/);
  assert.match(css, /--andromeda-bg:/);
  assert.match(css, /--andromeda-accent:/);

  assert.doesNotMatch(actorSheetClass, /project-andromeda-hex-tabs/);
  assert.match(actorSheetClass, /navSelector: '\.andromeda-sheet-tabs'/);
  assert.match(actorSheetClass, /controlSelector: 'a\.andromeda-tab'/);
});

test('actor sheet overrides Foundry chrome and keeps internal tabs compact', () => {
  const css = readText('css/project-andromeda.css');
  const actorSheetClass = readText('module/sheets/actor-sheet.mjs');

  assert.match(css, /\.window-app\.project-andromeda\.sheet\.actor \.window-header/);
  assert.match(
    css,
    /background:\s*linear-gradient\([^;]+var\(--andromeda-chrome\)[^;]*!important;/
  );
  assert.match(css, /\.project-andromeda \.andromeda-tab\s*\{[^}]*flex:\s*0 0 auto;/s);
  assert.match(css, /\.project-andromeda \.andromeda-sheet-tabs \.andromeda-tab\s*\{/);
  assert.match(
    css,
    /\.project-andromeda \.andromeda-sheet-tabs \.andromeda-tab\s*\{[^}]*display:\s*inline-flex\s*!important;/s
  );
  assert.match(actorSheetClass, /width: 1180/);
  assert.match(actorSheetClass, /height: 860/);
});

test('ability cards match the mockup structure instead of looking like dice inputs', () => {
  const actorSheet = readText('templates/actor/partials/actor-sheet-content.hbs');
  const actorSheetClass = readText('module/sheets/actor-sheet.mjs');
  const css = readText('css/project-andromeda.css');

  assert.match(actorSheet, /class='andromeda-ability-title'/);
  assert.match(actorSheet, /class='andromeda-ability-code'/);
  assert.match(actorSheet, /class='andromeda-ability-summary'/);
  assert.match(actorSheet, /{{ability\.code}}/);
  assert.match(actorSheet, /{{ability\.skillSummary}}/);
  assert.match(actorSheetClass, /code: abilityCodes\[abilityKey\]/);
  assert.match(actorSheetClass, /skillSummary:/);
  assert.match(css, /\.project-andromeda \.ability-die-value\s*\{[^}]*background:\s*transparent/s);
  assert.match(css, /\.project-andromeda \.ability-die-value\s*\{[^}]*border:\s*0/s);
});

test('main sheet presents identity, resources, abilities, and skills as overview panels', () => {
  const actorSheet = readText('templates/actor/partials/actor-sheet-content.hbs');

  assert.match(actorSheet, /class='andromeda-identity'/);
  assert.match(actorSheet, /class='andromeda-resource-stack'/);
  assert.match(actorSheet, /class='andromeda-overview-grid'/);
  assert.match(actorSheet, /class='andromeda-ability-card/);
  assert.match(actorSheet, /class='andromeda-skills-panel/);
  assert.match(actorSheet, /class='andromeda-temp-panel/);
  assert.match(actorSheet, /name='system\.speed\.value'/);
  assert.match(actorSheet, /name='system\.defenses\.physical'/);
  assert.match(actorSheet, /name='system\.defenses\.azure'/);
  assert.match(actorSheet, /name='system\.defenses\.mental'/);
  assert.match(actorSheet, /name='system\.progressPoints'/);
  assert.match(actorSheet, /data-field='system\.advancement\.totalSpent'/);
  assert.doesNotMatch(actorSheet, /MY_RPG\.KeyInfo\.ActorType/);
  assert.doesNotMatch(actorSheet, /actorTypeCode/);
  assert.doesNotMatch(actorSheet, /actorTypeLabel/);
  assert.match(actorSheet, /shared-hero-pool-input/);
  assert.doesNotMatch(actorSheet, /rank-hint-table/);
  assert.doesNotMatch(actorSheet, /key-info-grid__row/);
});

test('skill rank numbers keep readable dark text on colored badges', () => {
  const css = readText('css/project-andromeda.css');

  assert.match(
    css,
    /\.project-andromeda \.andromeda-skill-row \.skill-value input\s*\{[^}]*color:\s*#061018 !important;/s
  );
  assert.match(css, /\.project-andromeda \.andromeda-skill-row \.skill-value input\.rank1/s);
  assert.match(css, /background:\s*#7bd88f !important;/);
});

test('actor sheet scrollbars stay subtle and never create horizontal chrome', () => {
  const css = readText('css/project-andromeda.css');

  assert.match(
    css,
    /\.project-andromeda \.andromeda-sheet-shell \.sheet-scrollable\s*\{[^}]*overflow-x:\s*hidden;/s
  );
  assert.match(
    css,
    /\.project-andromeda \.andromeda-sheet-shell \.sheet-scrollable\s*\{[^}]*scrollbar-color:\s*rgba\(73,\s*212,\s*232,\s*0\.36\)\s*transparent;/s
  );
  assert.doesNotMatch(
    css,
    /\.project-andromeda \.andromeda-sheet-shell \.sheet-scrollable\s*\{[^}]*scrollbar-color:\s*var\(--andromeda-accent\)/s
  );
});

test('incremental sheet refresh updates new overview card state without full rerender', () => {
  const actorSheetClass = readText('module/sheets/actor-sheet.mjs');

  assert.match(actorSheetClass, /\.andromeda-ability-card/);
  assert.match(actorSheetClass, /andromeda-track-card\.health-resource--stress strong/);
  assert.match(actorSheetClass, /andromeda-track-card\.health-resource--shield strong/);
});

test('item tabs carry their own groups so actor sheet stays formatter-compatible', () => {
  const actorSheet = readText('templates/actor/partials/actor-sheet-content.hbs');
  const actorSheetClass = readText('module/sheets/actor-sheet.mjs');

  assert.doesNotMatch(actorSheet, /lookup \.\.\/itemGroups/);
  assert.match(actorSheet, /{{#each tab\.groups as \|group\|}}/);
  assert.match(actorSheetClass, /groups: itemGroupsByTab\[tab\.key\] \?\? \[\]/);
});

test('temporary bonuses use a responsive grid instead of the old vertical table', () => {
  const actorSheet = readText('templates/actor/partials/actor-sheet-content.hbs');
  const css = readText('css/project-andromeda.css');

  assert.match(actorSheet, /class='temp-bonus-grid'/);
  assert.match(actorSheet, /class='temp-bonus-field'/);
  assert.match(actorSheet, /MY_RPG\.SheetLabels\.Defenses/);
  assert.doesNotMatch(
    actorSheet,
    /MY_RPG\.Defenses\.FortitudeLabel[^<]+\/[^<]+MY_RPG\.Defenses\.ControlLabel/
  );
  assert.doesNotMatch(actorSheet, /<h2>\{\{localize 'MY_RPG.TempBonus.Label'\}\}<\/h2>\s*<table>/);
  assert.match(css, /\.temp-bonus-grid/);
  assert.match(
    css,
    /\.project-andromeda \.andromeda-temp-panel \.temp-bonus-grid\s*\{[^}]*grid-template-columns:\s*1fr;/s
  );
});

test('overview helper labels are localized instead of hard-coded English', () => {
  const actorSheet = readText('templates/actor/partials/actor-sheet-content.hbs');
  const en = readJson('lang/en.json').MY_RPG;
  const ru = readJson('lang/ru.json').MY_RPG;

  assert.doesNotMatch(actorSheet, />click to roll</);
  assert.doesNotMatch(actorSheet, />read-only</);
  assert.doesNotMatch(actorSheet, />editable</);
  assert.match(actorSheet, /MY_RPG\.SheetHints\.ClickToRoll/);
  assert.match(actorSheet, /MY_RPG\.SheetHints\.ReadOnly/);
  assert.match(actorSheet, /MY_RPG\.SheetHints\.Editable/);

  assert.deepEqual(Object.keys(en.SheetHints).sort(), Object.keys(ru.SheetHints).sort());
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
