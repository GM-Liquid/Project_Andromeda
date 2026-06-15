import assert from 'node:assert/strict';
import test from 'node:test';

// Minimal foundry.utils.setProperty stub mirroring Foundry's behaviour, so the
// pure link helpers can be exercised outside the Foundry runtime.
globalThis.foundry ??= {};
globalThis.foundry.utils ??= {
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

const { isCompendiumLibraryUuid, setLibraryItemLinkOnData, getLibraryItemUuid } =
  await import('./item-library-sync.mjs');

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
