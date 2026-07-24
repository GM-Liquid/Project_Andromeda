import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(testDir, '..', '..', '..');
const catalogRoot = resolve(repoRoot, 'data', 'gear', 'catalog');
const canonicalCatalogs = {
  abilities: 'ability',
  archetypes: 'archetype',
  artifacts: 'artifact',
  traits: 'trait'
};
const catalogNames = [...Object.keys(canonicalCatalogs), 'catalog-manifest', 'concept-abilities'];

test('gear catalogs use canonical two-space JSON formatting', async () => {
  const offenders = [];

  for (const catalogName of catalogNames) {
    const path = resolve(catalogRoot, `${catalogName}.json`);
    const source = await readFile(path, 'utf8');
    const normalized = `${JSON.stringify(JSON.parse(source), null, 2)}\n`;

    if (source !== normalized) {
      offenders.push(catalogName);
    }
  }

  assert.deepEqual(offenders, []);
});

test('canonical gear catalogs use the 0.5 types and stable unique ids', async () => {
  const ids = new Set();

  for (const [catalogName, expectedType] of Object.entries(canonicalCatalogs)) {
    const path = resolve(catalogRoot, `${catalogName}.json`);
    const entries = JSON.parse(await readFile(path, 'utf8'));

    assert.ok(Array.isArray(entries), `${catalogName}.json must contain an array`);
    for (const entry of entries) {
      assert.equal(entry.type, expectedType, `${catalogName}:${entry.id} has an unexpected type`);
      assert.equal(typeof entry.id, 'string', catalogName + ' has a non-string id');
      assert.ok(entry.id.length > 0, catalogName + ' has an empty id');
      assert.ok(!ids.has(entry.id), `duplicate stable catalog id: ${entry.id}`);
      ids.add(entry.id);

      if (catalogName === 'archetypes') {
        assert.equal(entry.trait?.type, 'trait', `${entry.id} must embed an archetype trait`);
        assert.equal(typeof entry.trait?.id, 'string', `${entry.id} has no stable trait id`);
        assert.ok(entry.trait.id.length > 0, `${entry.id} has an empty trait id`);
        assert.ok(!ids.has(entry.trait.id), `duplicate stable catalog id: ${entry.trait.id}`);
        ids.add(entry.trait.id);
        assert.equal(entry.trait.rank, undefined, `${entry.id} trait must not have a rank`);
        assert.equal(entry.trait.skill, undefined, `${entry.id} trait must not have a skill`);
        assert.equal(entry.trait.price, undefined, `${entry.id} trait must not have a price`);
        assert.ok(
          Array.isArray(entry.trait.mechanics?.effects),
          `${entry.id} trait must define mechanics.effects`
        );
        assert.equal(entry.ability.heatCost, 0, `${entry.id} signature ability must cost 0 Heat`);
        assert.equal(entry.ability.mode, undefined, `${entry.id} still uses legacy ability mode`);
      }

      if (catalogName === 'abilities') {
        assert.equal(
          Number.isInteger(entry.heatCost) && entry.heatCost >= 0,
          true,
          `${entry.id} must define a nonnegative integer base Heat cost`
        );
        assert.equal(entry.mode, undefined, `${entry.id} still uses legacy ability mode`);
      }
    }
  }
});

test('requested content entities are moved, removed, and rewritten by stable id', async () => {
  const load = async (name) =>
    JSON.parse(await readFile(resolve(catalogRoot, `${name}.json`), 'utf8'));
  const abilities = new Map((await load('abilities')).map((entry) => [entry.id, entry]));
  const traits = new Map((await load('traits')).map((entry) => [entry.id, entry]));
  const artifacts = new Map((await load('artifacts')).map((entry) => [entry.id, entry]));

  for (const id of [
    'vykidnoe-oruzhie-dalnego-boya',
    'takticheskiy-pritsel',
    'vibroklinok',
    'protokol-parirovaniya',
    'protokol-ubiytsa',
    'snayperskaya-vintovka-igla'
  ]) {
    assert.equal(artifacts.has(id), false, `${id} must not remain in artifacts`);
  }

  assert.equal(artifacts.get('vykidnoe-oruzhie-blizhnego-boya').name, 'Выкидное оружие');
  assert.equal(artifacts.get('vykidnoe-oruzhie-blizhnego-boya').skill, null);
  assert.equal(
    artifacts
      .get('mikro-optika')
      .mechanics.effects[0].outcomes.some(
        (outcome) => outcome.key === 'rangedDamageBonus' && outcome.value === 1
      ),
    true
  );
  assert.equal(traits.get('protokol-parirovaniya').price, 2);
  assert.equal(traits.get('protokol-ubiytsa').price, 4);

  const sniper = abilities.get('snayperskaya-vintovka-igla');
  assert.equal(sniper.name, 'Снайперский выстрел');
  assert.equal(sniper.rank, 2);
  assert.equal(sniper.heatCost, 1);
  assert.deepEqual(
    sniper.mechanics.effects[0].outcomes.map((outcome) => outcome.key),
    ['armorPiercing', 'stabilization', 'damage']
  );
});

test('amplifiers and the Diplomat Heat trigger use their revised passive effects', async () => {
  const load = async (name) =>
    JSON.parse(await readFile(resolve(catalogRoot, `${name}.json`), 'utf8'));
  const artifacts = new Map((await load('artifacts')).map((entry) => [entry.id, entry]));
  const archetypes = new Map((await load('archetypes')).map((entry) => [entry.id, entry]));
  const expectedAmplifiers = [
    ['ognemet-ifrit', 'Амплификатор «Ифрит»', 'rezonans'],
    ['amplifikator-shepot', 'Амплификатор «Шёпот»', 'dominirovanie'],
    ['bioinvertor-zimniy-son', 'Амплификатор «Зимний Сон»', 'mistika']
  ];

  for (const [id, name, skill] of expectedAmplifiers) {
    const artifact = artifacts.get(id);
    assert.equal(artifact.name, name);
    assert.equal(artifact.skill, skill);
    assert.equal(artifact.mechanics.effects[0].activation.type, 'passive');
    assert.deepEqual(artifact.mechanics.effects[0].outcomes, [
      { key: 'successDamageBonus', value: 2 }
    ]);
    assert.match(artifact.description, /при успехе и критическом успехе/u);
  }

  const pressure = archetypes.get('diplomat').trait;
  assert.equal(pressure.id, 'dozhim');
  assert.equal(
    pressure.mechanics.effects[0].conditions.trigger,
    'противник впервые за бой перемещается не по своей воле'
  );
  assert.match(pressure.description, /противник перемещается не по своей воле/u);
});
