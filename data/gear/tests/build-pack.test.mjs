import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { CATALOG_FILES, buildPackRemoteDataFromCatalogs } from '../../../tools/build-pack.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

async function readCatalog(name) {
  const source = await readFile(path.join(ROOT, 'data', 'gear', 'catalog', `${name}.json`), 'utf8');
  return JSON.parse(source);
}

function parseRowSystem(row) {
  return JSON.parse(row.systemJson);
}

test('pack build reads only the canonical 0.5 catalogs', () => {
  assert.deepEqual(CATALOG_FILES, {
    abilities: 'abilities.json',
    archetypes: 'archetypes.json',
    artifacts: 'artifacts.json',
    traits: 'traits.json'
  });
});

test('pack build includes artifacts while preserving migrated sync ids', () => {
  const artifact = (id, skill = null) => ({
    id,
    name: id,
    type: 'artifact',
    rank: 1,
    skill,
    description: id,
    mechanics: { effects: [] }
  });
  const remote = buildPackRemoteDataFromCatalogs({
    abilities: [],
    archetypes: [],
    artifacts: [artifact('blackout'), artifact('okhotnichiy-drobovik', 'strelba')],
    traits: []
  });

  assert.equal(remote.sheets.artifacts.length, 2);
  assert.deepEqual(
    remote.sheets.artifacts.map((row) => [row.type, row.syncId]),
    [
      ['artifact', 'gear:abilities:blackout'],
      ['artifact', 'gear:equipment:okhotnichiy-drobovik']
    ]
  );
});

test('canonical pack build emits every signature ability and every scaling table', async () => {
  const catalogs = {
    abilities: await readCatalog('abilities'),
    archetypes: await readCatalog('archetypes'),
    artifacts: await readCatalog('artifacts'),
    traits: await readCatalog('traits')
  };
  const remote = buildPackRemoteDataFromCatalogs(catalogs);
  const abilityRows = new Map(remote.sheets.abilities.map((row) => [row.syncId, row]));

  assert.equal(
    abilityRows.size,
    catalogs.abilities.length + catalogs.archetypes.length,
    'pack must contain purchased and archetype signature abilities'
  );

  for (const archetype of catalogs.archetypes) {
    const syncId = `gear:abilities:${archetype.ability.id}`;
    const row = abilityRows.get(syncId);
    assert.ok(row, `${archetype.id} signature ${syncId} is missing from the pack build`);
    assert.deepEqual(
      parseRowSystem(row).details.gearCatalog.scaling,
      archetype.ability.scaling,
      `${syncId} lost its owner-rank scaling tables`
    );
  }

  for (const ability of catalogs.abilities) {
    const syncId = `gear:abilities:${ability.id}`;
    const row = abilityRows.get(syncId);
    assert.ok(row, `${syncId} is missing from the pack build`);
    assert.deepEqual(
      parseRowSystem(row).details.gearCatalog.scaling,
      ability.scaling,
      `${syncId} lost its owner-rank scaling tables`
    );
  }
});
