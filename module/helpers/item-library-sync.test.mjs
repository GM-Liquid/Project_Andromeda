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
  setLibraryItemLinkOnData
} = await import('./item-library-sync.mjs');

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
