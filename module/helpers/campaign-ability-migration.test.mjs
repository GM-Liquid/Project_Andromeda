import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildCampaignCatalogMatchIndex,
  buildCampaignCatalogReplacementData,
  buildCampaignCatalogUpdateData,
  findCampaignCatalogMatch,
  migrateCampaignAbilitiesToCatalog,
  normalizeCatalogItemName
} from './campaign-ability-migration.mjs';

const MODULE_ID = 'project-andromeda';

function packItem({
  id,
  name,
  type = 'trait-source-ability',
  catalog = 'abilities',
  sourceItemIds = [],
  status = ''
}) {
  const syncId = `gear:${catalog}:${id}`;
  return {
    id: `pack-${id}`,
    uuid: `Compendium.project-andromeda.gear-library.Item.pack-${id}`,
    name,
    type,
    img: `icons/${id}.webp`,
    system: {
      description: `Canonical ${name}`,
      heatCost: 1,
      details: { gearCatalog: { id, catalog, sourceItemIds, status } }
    },
    flags: { [MODULE_ID]: { sheetSyncId: syncId } },
    toObject() {
      const { toObject: _toObject, ...data } = this;
      return structuredClone(data);
    }
  };
}

test('campaign catalog matching normalizes Russian names without flattening punctuation', () => {
  assert.equal(normalizeCatalogItemName('  БОЕВЫЕ   ФЕРОМОНЫ  '), 'боевые феромоны');
  assert.equal(normalizeCatalogItemName('Манёвр: Рывок'), 'маневр: рывок');
});

test('campaign catalog matching prefers catalog ids, then exported source ids, then unique names', () => {
  const bloodThirst = packItem({
    id: 'zhazhda-krovi',
    name: 'Жажда крови',
    sourceItemIds: ['legacy-blood-id']
  });
  const pheromones = packItem({
    id: 'boevye-feromony',
    name: 'Феромонная перегрузка',
    sourceItemIds: ['legacy-pheromone-id']
  });
  const shield = packItem({ id: 'boevoy-kupol', name: 'Боевой купол' });
  const index = buildCampaignCatalogMatchIndex([bloodThirst, pheromones, shield]);

  assert.equal(
    findCampaignCatalogMatch(
      {
        id: 'other',
        type: 'trait',
        system: { details: { gearCatalog: { id: 'zhazhda-krovi', catalog: 'traits' } } }
      },
      index
    ).matchedBy,
    'stableId'
  );
  assert.equal(
    findCampaignCatalogMatch(
      {
        id: 'embedded-pheromone-id',
        name: 'Боевые феромоны',
        type: 'trait-genome',
        flags: { [MODULE_ID]: { libraryItemUuid: 'Item.legacy-pheromone-id' } }
      },
      index
    ).source,
    pheromones
  );
  assert.equal(
    findCampaignCatalogMatch(
      { id: 'other', name: '  БОЕВОЙ  КУПОЛ ', type: 'trait-source-ability' },
      index
    ).matchedBy,
    'name'
  );
});

test('campaign catalog name matching skips ambiguous canonical names', () => {
  const first = packItem({ id: 'first', name: 'Двойник' });
  const second = packItem({ id: 'second', name: 'Двойник', type: 'trait', catalog: 'traits' });
  const index = buildCampaignCatalogMatchIndex([first, second]);

  assert.equal(
    findCampaignCatalogMatch(
      { id: 'legacy', name: 'Двойник', type: 'trait-source-ability' },
      index
    ),
    null
  );
  assert.ok(index.ambiguousNames.has('двойник'));
});

test('campaign catalog matching ignores legacy, draft, and deprecated pack entries', () => {
  const legacy = packItem({ id: 'legacy', name: 'Legacy', status: 'legacy' });
  const draft = packItem({ id: 'draft', name: 'Draft', status: 'draft' });
  const approved = packItem({ id: 'approved', name: 'Approved', status: 'approved' });
  const index = buildCampaignCatalogMatchIndex([legacy, draft, approved]);

  assert.equal(index.byCatalogKey.has('gear:abilities:legacy'), false);
  assert.equal(index.byCatalogKey.has('gear:abilities:draft'), false);
  assert.equal(index.byCatalogKey.get('gear:abilities:approved'), approved);
});

test('campaign catalog updates preserve actor-local state and custom flags', () => {
  const source = packItem({ id: 'biosensorika', name: 'Биосенсорика' });
  const legacy = {
    id: 'legacy',
    name: 'Old',
    type: source.type,
    img: 'icons/custom.webp',
    system: { description: 'Old', heatCost: 7, cooldown: { used: 1 } },
    flags: { custom: { note: 'keep' } }
  };

  const update = buildCampaignCatalogUpdateData(source, legacy);
  assert.equal(update._id, 'legacy');
  assert.equal(update.name, 'Биосенсорика');
  assert.equal(update.system.description, 'Canonical Биосенсорика');
  assert.equal(update.system.heatCost, 1);
  assert.deepEqual(update.system.cooldown, { used: 1 });
  assert.equal(update.flags.custom.note, 'keep');
  assert.equal(update.flags[MODULE_ID].libraryItemUuid, source.uuid);
});

test('campaign catalog replacement changes a reclassified item type and keeps its sort order', () => {
  const source = packItem({ id: 'zhazhda-krovi', name: 'Жажда крови' });
  const legacy = {
    id: 'legacy',
    name: 'Жажда крови',
    type: 'trait',
    sort: 640,
    system: { cooldown: { used: 2 } },
    flags: {}
  };

  const replacement = buildCampaignCatalogReplacementData(source, legacy);
  assert.equal(replacement._id, undefined);
  assert.equal(replacement.type, 'trait-source-ability');
  assert.equal(replacement.sort, 640);
  assert.deepEqual(replacement.system.cooldown, { used: 2 });
});

test('campaign migration refreshes same-type items and replaces reclassified ones', async () => {
  const biosensor = packItem({
    id: 'biosensorika',
    name: 'Биосенсорика',
    sourceItemIds: ['legacy-biosensor']
  });
  const bloodThirst = packItem({
    id: 'zhazhda-krovi',
    name: 'Жажда крови',
    sourceItemIds: ['legacy-blood']
  });
  const calls = { create: [], update: [], delete: [] };
  const actor = {
    id: 'actor',
    items: [
      {
        id: 'legacy-biosensor',
        name: 'Биосенсорика',
        type: 'trait-source-ability',
        system: {},
        flags: {}
      },
      {
        id: 'legacy-blood',
        name: 'Жажда крови',
        type: 'trait-genome',
        system: {},
        flags: {}
      }
    ],
    async createEmbeddedDocuments(_type, data) {
      calls.create.push(...data);
    },
    async updateEmbeddedDocuments(_type, data) {
      calls.update.push(...data);
    },
    async deleteEmbeddedDocuments(_type, ids) {
      calls.delete.push(...ids);
    }
  };
  const previousGame = globalThis.game;
  globalThis.game = {
    user: { isGM: true },
    actors: { contents: [actor] },
    items: { contents: [] },
    packs: new Map([
      [
        'project-andromeda.gear-library',
        { getDocuments: async () => [biosensor, bloodThirst] }
      ]
    ])
  };

  try {
    const summary = await migrateCampaignAbilitiesToCatalog();
    assert.equal(summary.packAvailable, true);
    assert.equal(summary.actorsUpdated, 1);
    assert.equal(summary.itemsUpdated, 1);
    assert.equal(summary.itemsReplaced, 1);
    assert.equal(summary.matchedBySourceItemId, 2);
    assert.equal(calls.update[0].name, 'Биосенсорика');
    assert.equal(calls.create[0].type, 'trait-source-ability');
    assert.deepEqual(calls.delete, ['legacy-blood']);
  } finally {
    globalThis.game = previousGame;
  }
});

test('campaign migration uses world library metadata to repair an already wrong catalog link', async () => {
  const lorenzoPheromones = packItem({
    id: 'boevye-feromony',
    name: 'Феромонная перегрузка',
    sourceItemIds: ['world-lorenzo-pheromones']
  });
  const beastPheromones = packItem({
    id: 'boevye-feromony-zver',
    name: 'Боевые феромоны',
    sourceItemIds: ['world-beast-pheromones']
  });
  const calls = { update: [] };
  const actor = {
    id: 'actor-lorenzo',
    items: [
      {
        id: 'embedded-pheromones',
        name: 'Боевые феромоны',
        type: 'trait-source-ability',
        system: {
          details: {
            gearCatalog: { id: 'boevye-feromony-zver', catalog: 'abilities' }
          }
        },
        flags: {
          [MODULE_ID]: {
            sheetSyncId: 'gear:abilities:boevye-feromony-zver',
            libraryItemUuid: beastPheromones.uuid
          }
        }
      }
    ],
    async createEmbeddedDocuments() {},
    async updateEmbeddedDocuments(_type, data) {
      calls.update.push(...data);
    },
    async deleteEmbeddedDocuments() {}
  };
  const previousGame = globalThis.game;
  globalThis.game = {
    user: { isGM: true },
    actors: { contents: [actor] },
    items: {
      contents: [
        {
          id: 'world-lorenzo-pheromones',
          flags: {
            [MODULE_ID]: {
              libraryActorId: actor.id,
              libraryActorItemId: 'embedded-pheromones'
            }
          }
        }
      ]
    },
    packs: new Map([
      [
        'project-andromeda.gear-library',
        { getDocuments: async () => [lorenzoPheromones, beastPheromones] }
      ]
    ])
  };

  try {
    const summary = await migrateCampaignAbilitiesToCatalog();
    assert.equal(summary.itemsUpdated, 1);
    assert.equal(summary.matchedByWorldMetadata, 1);
    assert.equal(calls.update[0].name, 'Феромонная перегрузка');
    assert.equal(
      calls.update[0].flags[MODULE_ID].libraryItemUuid,
      lorenzoPheromones.uuid
    );
  } finally {
    globalThis.game = previousGame;
  }
});
