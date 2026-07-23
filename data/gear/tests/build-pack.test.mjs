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

  assert.equal(remote.sheets.artifacts.length, 2);
  assert.deepEqual(
    remote.sheets.artifacts.map((row) => [row.type, row.syncId]),
    [
      ['artifact', 'gear:abilities:blackout'],
      ['artifact', 'gear:equipment:okhotnichiy-drobovik']
    ]
  );
});
