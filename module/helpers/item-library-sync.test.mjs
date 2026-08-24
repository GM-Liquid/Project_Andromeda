import assert from 'node:assert/strict';
import test from 'node:test';

// Minimal foundry.utils.setProperty stub mirroring Foundry's behaviour, so the
// pure link helpers can be exercised outside the Foundry runtime.
globalThis.foundry ??= {};
globalThis.foundry.utils ??= {
  hasProperty(object, path) {
    let cursor = object;
    return String(path)
      .split('.')
      .every((part) => {
        if (cursor === null || cursor === undefined || !Object.hasOwn(cursor, part)) return false;
        cursor = cursor[part];
        return true;
      });
  },
  setProperty(object, path, value) {
    const parts = String(path).split('.');
    let cursor = object;
    for (let index = 0; index < parts.length - 1; index += 1) {
      cursor[parts[index]] ??= {};
      cursor = cursor[parts[index]];
    }
    cursor[parts[parts.length - 1]] = value;
    return true;
  }
};

const {
  buildActorItemUpdateDataFromLibrary,
  getLibraryItemUuid,
  isCompendiumLibraryUuid,
  refreshCompendiumLinkedActorItems,
  setLibraryItemLinkOnData
} = await import('./item-library-sync.mjs');

const MODULE_ID = 'project-andromeda';

function packDocument({ id, name, type = 'trait-source-ability', catalog = 'abilities' }) {
  return {
    uuid: `Compendium.project-andromeda.gear-library.Item.pack-${id}`,
    documentName: 'Item',
    name,
    type,
    img: `icons/${id}.webp`,
    system: {
      description: `Canonical ${name}`,
      details: { gearCatalog: { id, catalog } }
    },
    flags: { [MODULE_ID]: { sheetSyncId: `gear:${catalog}:${id}` } }
  };
}

test('isCompendiumLibraryUuid distinguishes pack links from world links', () => {
  assert.equal(
    isCompendiumLibraryUuid('Compendium.project-andromeda.gear-library.Item.abc123'),
    true
  );
  assert.equal(isCompendiumLibraryUuid('Item.abc123'), false);
  assert.equal(isCompendiumLibraryUuid(''), false);
  assert.equal(isCompendiumLibraryUuid(null), false);
});

test('drop link round-trip: what setLibraryItemLinkOnData stamps is what getLibraryItemUuid reads', () => {
  const uuid = 'Compendium.project-andromeda.gear-library.Item.abc123';
  const droppedData = { name: 'КД-2', type: 'armor', flags: {} };

  setLibraryItemLinkOnData(droppedData, uuid);

  // This is the contract the dupe fix relies on: the drop handler pre-stamps the
  // flag, and ensureActorItemLibraryLink reads it back to reuse the source.
  assert.equal(getLibraryItemUuid(droppedData), uuid);
});

test('compendium refresh syncs matching catalog ids and leaves everything else alone', async () => {
  const razryad = packDocument({ id: 'razryad', name: 'Разряд' });
  const relic = packDocument({
    id: 'relikt',
    name: 'Реликт',
    type: 'artifact',
    catalog: 'equipment'
  });
  const staleSystem = (id, catalog) => ({
    description: 'Stale',
    details: { gearCatalog: { id, catalog } }
  });

  const linked = {
    id: 'linked',
    name: 'Разряд (старая редакция)',
    type: 'trait-source-ability',
    img: 'icons/razryad.webp',
    system: staleSystem('razryad', 'abilities'),
    flags: { [MODULE_ID]: { libraryItemUuid: razryad.uuid } }
  };
  // Carries the catalog id but its link points at a world item that is long gone —
  // the refresh has to re-attach it to the pack entry instead of skipping it.
  const danglingLink = {
    id: 'dangling',
    name: 'Разряд',
    type: 'trait-source-ability',
    img: 'icons/razryad.webp',
    system: staleSystem('razryad', 'abilities'),
    flags: { [MODULE_ID]: { libraryItemUuid: 'Item.deleted-world-item' } }
  };
  const homebrew = {
    id: 'homebrew',
    name: 'Своя способность',
    type: 'trait-source-ability',
    img: 'icons/custom.webp',
    system: { description: 'Homebrew' },
    flags: {}
  };
  // A live world-item copy of a catalog entry: it may carry GM edits and follows the
  // world library lifecycle, so the pack refresh leaves it to that path.
  const worldLinked = {
    id: 'world-linked',
    name: 'Разряд (домашняя редакция)',
    type: 'trait-source-ability',
    img: 'icons/razryad.webp',
    system: staleSystem('razryad', 'abilities'),
    flags: { [MODULE_ID]: { libraryItemUuid: 'Item.world-razryad' } }
  };
  // A catalog id the shipped pack no longer carries. It stays on the sheet untouched.
  const retired = {
    id: 'retired',
    name: 'Виброклинок',
    type: 'artifact',
    img: 'icons/vibro.webp',
    system: staleSystem('vibroklinok', 'equipment'),
    flags: { [MODULE_ID]: { sheetSyncId: 'gear:equipment:vibroklinok' } }
  };
  // Same catalog id, different Foundry type: reclassification is the job of the
  // one-time type migrations, so the refresh must not copy content across types.
  const reclassified = {
    id: 'reclassified',
    name: 'Реликт',
    type: 'trait-source-ability',
    img: 'icons/relikt.webp',
    system: staleSystem('relikt', 'equipment'),
    flags: { [MODULE_ID]: { sheetSyncId: 'gear:equipment:relikt' } }
  };

  const updates = [];
  const actor = {
    id: 'actor',
    items: [linked, danglingLink, homebrew, worldLinked, retired, reclassified],
    async updateEmbeddedDocuments(_type, data) {
      updates.push(...data);
    }
  };

  const previousGame = globalThis.game;
  const previousFromUuid = globalThis.fromUuid;
  globalThis.game = {
    user: { isGM: true },
    actors: { contents: [actor] },
    items: new Map([['world-razryad', { id: 'world-razryad', type: 'trait-source-ability' }]]),
    packs: new Map([
      ['project-andromeda.gear-library', { getDocuments: async () => [razryad, relic] }]
    ])
  };
  globalThis.fromUuid = async (uuid) => [razryad, relic].find((doc) => doc.uuid === uuid) ?? null;

  try {
    const summary = await refreshCompendiumLinkedActorItems();

    assert.equal(summary.itemsUpdated, 2);
    assert.equal(summary.itemsRelinked, 1);
    assert.deepEqual(
      updates.map((update) => update._id),
      ['linked', 'dangling']
    );
    assert.equal(updates[0].name, 'Разряд');
    assert.equal(updates[1].system.description, 'Canonical Разряд');
    assert.equal(updates[1][`flags.${MODULE_ID}.libraryItemUuid`], razryad.uuid);
  } finally {
    globalThis.game = previousGame;
    globalThis.fromUuid = previousFromUuid;
  }
});

test('library refresh reapplies the actor-rank version of an archetype ability', () => {
  const ability = {
    name: 'Surge',
    versions: [
      { rank: 1, name: 'Surge', range: { type: 'meters', value: 30 }, damage: '1/2/3/5' },
      { rank: 3, name: 'Storm', range: { type: 'meters', value: 300 }, damage: '4/6/9/14' }
    ]
  };
  const source = {
    uuid: 'Compendium.project-andromeda.gear-library.Item.surge',
    name: 'Surge',
    type: 'trait-source-ability',
    img: 'icons/surge.webp',
    system: {
      details: { archetypeAbility: ability },
      rank: '1',
      range: '30 m',
      skillBonus: '1/2/3/5'
    }
  };
  const actorItem = {
    name: 'Surge',
    type: 'trait-source-ability',
    system: structuredClone(source.system),
    parent: { system: { currentRank: 3 } },
    getFlag: (_scope, key) => (key === 'grantedByArchetype' ? 'archetype-id' : '')
  };

  const update = buildActorItemUpdateDataFromLibrary(source, actorItem);

  assert.equal(update.name, 'Storm');
  assert.equal(update.system.rank, '3');
  assert.equal(update.system.range, '300 m');
  assert.equal(update.system.skillBonus, '4/6/9/14');
});

test('library refresh materializes current catalog scaling for the owning actor', () => {
  const source = {
    uuid: 'Compendium.project-andromeda.gear-library.Item.gravity-wave',
    name: 'Гравитационная волна',
    type: 'trait-source-ability',
    img: 'icons/gravity-wave.webp',
    system: {
      description: 'Область 15 м. Урон: 2/4/6/9.',
      rank: '',
      area: 'circle 15 m',
      skillBonus: '2/4/6/9',
      details: {
        gearCatalog: {
          id: 'gravity-wave',
          catalog: 'abilities',
          description: 'Область 15 м. Урон: 2/4/6/9.',
          mechanics: {
            effects: [
              {
                conditions: { area: { type: 'circle', value: 15, scale: 'area' } },
                outcomes: [{ key: 'damage', value: '2/4/6/9', scale: 'damage' }]
              }
            ]
          },
          scaling: {
            area: { parameter: 'Радиус области, м', values: [15, 30, 75, 150] },
            damage: {
              parameter: 'Урон',
              values: ['2/4/6/9', '3/6/8/12', '4/7/10/15', '5/8/12/18']
            }
          }
        }
      }
    }
  };
  const actorItem = {
    name: source.name,
    type: source.type,
    system: structuredClone(source.system),
    parent: { system: { currentRank: 4 } },
    getFlag: () => ''
  };

  const update = buildActorItemUpdateDataFromLibrary(source, actorItem);

  assert.equal(update.system.rank, '');
  assert.equal(update.system.area, 'circle 150 m');
  assert.equal(update.system.skillBonus, '5/8/12/18');
  assert.equal(update.system.details.gearCatalog.activeOwnerRank, 4);
  assert.match(update.system.description, /150 м/u);
});
