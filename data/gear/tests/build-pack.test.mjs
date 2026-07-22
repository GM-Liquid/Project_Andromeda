import assert from 'node:assert/strict';
import test from 'node:test';

import { CATALOG_FILES, buildPackRemoteDataFromCatalogs } from '../../../tools/build-pack.mjs';

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

  assert.equal(remote.sheets.abilities.length, 1);
  assert.equal(remote.sheets.abilities[0].syncId, 'gear:abilities:blackout');
  assert.equal(remote.sheets.weapons.length, 1);
  assert.equal(remote.sheets.weapons[0].syncId, 'gear:equipment:okhotnichiy-drobovik');
});
