import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildReplacementData,
  buildLegacyHeatCostUpdate,
  deleteExistingDocuments,
  filterExistingDocumentIds,
  getCatalogContentMigrationAction
} from './content-heat-migration.mjs';

function catalogItem(id, type = 'artifact', catalog = 'artifacts') {
  return {
    id: `item-${id}`,
    type,
    system: { details: { gearCatalog: { id, catalog } } },
    flags: {}
  };
}

test('content migration deletes only the requested stable catalog ids', () => {
  assert.equal(getCatalogContentMigrationAction(catalogItem('vibroklinok')).action, 'delete');
  assert.equal(
    getCatalogContentMigrationAction(catalogItem('takticheskiy-pritsel')).action,
    'delete'
  );
  assert.equal(getCatalogContentMigrationAction(catalogItem('unrelated-artifact')).action, 'keep');
});

test('content migration replaces moved entries with their new Foundry types', () => {
  assert.deepEqual(getCatalogContentMigrationAction(catalogItem('protokol-parirovaniya')), {
    action: 'replace',
    id: 'protokol-parirovaniya',
    target: { syncId: 'gear:traits:protokol-parirovaniya', type: 'trait' }
  });
  assert.equal(
    getCatalogContentMigrationAction(catalogItem('snayperskaya-vintovka-igla')).target.type,
    'trait-source-ability'
  );
});

test('content migration refreshes revised same-type entries without changing their stable ids', () => {
  assert.deepEqual(getCatalogContentMigrationAction(catalogItem('ognemet-ifrit')), {
    action: 'refresh',
    id: 'ognemet-ifrit',
    target: { syncId: 'gear:equipment:ognemet-ifrit', type: 'artifact' }
  });
  assert.equal(
    getCatalogContentMigrationAction(catalogItem('dozhim', 'trait', 'traits')).action,
    'refresh'
  );
});

test('legacy ability modes migrate to numeric base Heat without overwriting an existing cost', () => {
  assert.deepEqual(buildLegacyHeatCostUpdate({ id: 'forced', system: { mode: 'forced' } }), {
    _id: 'forced',
    'system.heatCost': 2,
    'system.-=mode': null
  });
  assert.equal(
    buildLegacyHeatCostUpdate({
      id: 'custom',
      system: { mode: 'forced', heatCost: 5 }
    })['system.heatCost'],
    5
  );
});

test('replacement preserves actor-local state while relinking to the target compendium item', () => {
  const source = {
    uuid: 'Compendium.project-andromeda.gear-library.Item.target',
    toObject: () => ({
      _id: 'pack-id',
      name: 'Target',
      type: 'trait',
      system: { description: 'Canonical', quantity: 1, equipped: false },
      flags: {
        'project-andromeda': { sheetSyncId: 'gear:traits:protokol-parirovaniya' }
      }
    })
  };
  const legacy = {
    sort: 420,
    img: 'icons/custom/local.webp',
    system: { quantity: 3, equipped: true, cooldown: { used: 1 } },
    flags: { custom: { note: 'keep' } },
    toObject() {
      return this;
    }
  };
  const data = buildReplacementData(source, legacy, {
    syncId: 'gear:traits:protokol-parirovaniya',
    type: 'trait'
  });

  assert.equal(data._id, undefined);
  assert.equal(data.sort, 420);
  assert.equal(data.img, 'icons/custom/local.webp');
  assert.equal(data.system.quantity, 3);
  assert.equal(data.system.equipped, true);
  assert.deepEqual(data.system.cooldown, { used: 1 });
  assert.equal(data.flags.custom.note, 'keep');
  assert.equal(
    data.flags['project-andromeda'].libraryItemUuid,
    'Compendium.project-andromeda.gear-library.Item.target'
  );
});

test('content migration ignores duplicate and already removed document ids', async () => {
  const documents = new Map([
    ['keep-a', { id: 'keep-a' }],
    ['vanishes', { id: 'vanishes' }],
    ['keep-b', { id: 'keep-b' }]
  ]);
  assert.deepEqual(
    filterExistingDocumentIds(documents, ['keep-a', 'missing', 'keep-a', 'keep-b']),
    ['keep-a', 'keep-b']
  );

  const attempts = [];
  await deleteExistingDocuments(documents, ['keep-a', 'vanishes', 'keep-b'], async (ids) => {
    attempts.push([...ids]);
    if (attempts.length === 1) {
      documents.delete('vanishes');
      throw new Error('undefined id [vanishes] does not exist in the collection');
    }
    for (const id of ids) documents.delete(id);
  });

  assert.deepEqual(attempts, [
    ['keep-a', 'vanishes', 'keep-b'],
    ['keep-a', 'keep-b']
  ]);
  assert.equal(documents.size, 0);
});
