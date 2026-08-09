import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const ROOT = path.resolve(import.meta.dirname, '..', '..');

function readFile(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

test('every character sheet renders the two basic attacks as rollable, non-item rows', () => {
  const template = readFile('templates/actor/partials/actor-sheet-content.hbs');
  const stylesheet = readFile('css/project-andromeda.css');
  const actorSheet = readFile('module/sheets/actor-sheet.mjs');

  // The block lives in the abilities tab and is not gated on the actor being a hero:
  // opponents have basic attacks too.
  assert.match(template, /\{\{#if tab\.isAbilities\}\}[\s\S]*andromeda-basic-attacks/);
  assert.match(template, /\{\{#each @root\.basicAttacks as \|attack\|\}\}/);
  // У дальней атаки навык выбирает игрок, поэтому кнопка броска своя на каждый навык.
  assert.match(template, /\{\{#each attack\.options as \|option\|\}\}/);
  assert.match(
    template,
    /basic-attack-roll[\s\S]*data-basic-attack='\{\{attack\.key\}\}'[\s\S]*data-basic-attack-skill='\{\{option\.skillKey\}\}'/
  );
  assert.match(template, /andromeda-basic-attack__damage/);
  // No create / edit / delete controls: basic attacks cannot be bought or removed.
  const block = /andromeda-basic-attacks[\s\S]*?<\/section>/.exec(template)?.[0] ?? '';
  assert.doesNotMatch(block, /item-create|item-edit|item-delete/);

  assert.match(actorSheet, /_onBasicAttackRoll/);
  assert.match(actorSheet, /'click', '\.basic-attack-roll'/);
  assert.match(actorSheet, /context\.basicAttacks = this\._buildBasicAttackDisplays\(\);/);

  assert.match(stylesheet, /\.project-andromeda \.andromeda-basic-attacks \{/);
  assert.match(
    stylesheet,
    /\.project-andromeda \.andromeda-basic-attack \{[\s\S]*display:\s*grid;/
  );
});

test('basic attack labels exist in both languages', () => {
  const english = JSON.parse(readFile('lang/en.json'));
  const russian = JSON.parse(readFile('lang/ru.json'));

  assert.deepEqual(
    Object.keys(english.MY_RPG.BasicAttacks).sort(),
    Object.keys(russian.MY_RPG.BasicAttacks).sort()
  );
  assert.equal(russian.MY_RPG.BasicAttacks.Melee, 'Ближняя базовая атака');
  assert.equal(russian.MY_RPG.BasicAttacks.Ranged, 'Дальняя базовая атака');
});
