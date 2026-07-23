import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.foundry ??= { utils: {} };
globalThis.foundry.utils.setProperty ??= () => true;

const { getV05ItemMigrationAction } = await import('./v05-migration.mjs');

const artifactSyncIds = new Set(['gear:equipment:relic-rifle', 'gear:abilities:blackout']);

test('v0.5 migration converts every catalog entry that moved to artifacts', () => {
  assert.equal(
    getV05ItemMigrationAction({
      itemType: 'weapon',
      syncId: 'gear:equipment:relic-rifle',
      artifactSyncIds
    }),
    'convert-to-artifact'
  );
  assert.equal(
    getV05ItemMigrationAction({
      itemType: 'trait-source-ability',
      syncId: 'gear:abilities:blackout',
      artifactSyncIds
    }),
    'convert-to-artifact'
  );
});

test('v0.5 migration deletes only catalog-backed obsolete inventory', () => {
  assert.equal(
    getV05ItemMigrationAction({
      itemType: 'armor',
      syncId: 'gear:armor:combat-suit',
      artifactSyncIds
    }),
    'delete-obsolete-catalog-item'
  );
  assert.equal(
    getV05ItemMigrationAction({ itemType: 'armor', syncId: '', artifactSyncIds }),
    'keep'
  );
  assert.equal(
    getV05ItemMigrationAction({
      itemType: 'trait-source-ability',
      syncId: 'gear:abilities:ordinary-ability',
      artifactSyncIds
    }),
    'keep'
  );
});
