import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

function readText(relativePath) {
  return readFileSync(path.resolve(repoRoot, relativePath), 'utf8');
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

test('Foundry skill keys match the canonical gear catalog vocabulary', () => {
  const config = readText('module/helpers/config.mjs');
  const actorSheet = readText('module/sheets/actor-sheet.mjs');
  const template = readJson('template.json');
  const en = readJson('lang/en.json').MY_RPG.Skill;
  const ru = readJson('lang/ru.json').MY_RPG.Skill;

  assert.match(config, /khakerstvo:\s*'MY_RPG\.Skill\.Khakerstvo'/);
  assert.match(config, /mistika:\s*'MY_RPG\.Skill\.Mistika'/);
  assert.doesNotMatch(config, /\bprogrammirovanie\b/);
  assert.doesNotMatch(config, /\bbionika\b/);

  assert.ok(template.Actor.templates.base.skills.khakerstvo);
  assert.ok(template.Actor.templates.base.skills.mistika);
  assert.equal(template.Actor.templates.base.skills.khakerstvo.ability, 'int');
  assert.equal(template.Actor.templates.base.skills.mistika.ability, 'spi');
  assert.equal('programmirovanie' in template.Actor.templates.base.skills, false);
  assert.equal('bionika' in template.Actor.templates.base.skills, false);

  assert.match(actorSheet, /'khakerstvo'/);
  assert.match(actorSheet, /'mistika'/);
  assert.doesNotMatch(actorSheet, /\bprogrammirovanie\b/);
  assert.doesNotMatch(actorSheet, /\bbionika\b/);

  assert.equal(en.Khakerstvo, 'Hacking');
  assert.equal(en.Mistika, 'Mysticism');
  assert.equal(ru.Khakerstvo, 'Хакерство');
  assert.equal(ru.Mistika, 'Мистика');
});
