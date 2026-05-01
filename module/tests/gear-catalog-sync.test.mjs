import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const syncModule = await import('../helpers/gear-catalog-sync.mjs');
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..', '..');

function readText(relativePath) {
  return readFileSync(path.resolve(repoRoot, relativePath), 'utf8');
}

const catalogs = {
  armor: [
    {
      id: 'test-armor',
      name: 'Test Armor',
      type: 'armor',
      rank: 2,
      skill: null,
      mechanics: {
        effects: [
          {
            activation: { type: 'passive' },
            conditions: {},
            outcomes: [
              { key: 'fortitudeBonus', value: 2 },
              { key: 'controlBonus', value: 1 },
              { key: 'speedBonus', value: 5 },
              { key: 'grantTempStress', amount: 3 }
            ]
          }
        ]
      },
      description: 'Armor description.',
      shortDescription: 'Armor short.',
      price: 3
    }
  ],
  equipment: [
    {
      id: 'test-device',
      name: 'Test Device',
      type: 'equipment',
      rank: 1,
      skill: 'khakerstvo',
      mechanics: {
        effects: [
          {
            activation: { type: 'action' },
            conditions: {},
            outcomes: [{ key: 'damage', value: 2 }]
          }
        ]
      },
      description: 'Equipment description.',
      shortDescription: 'Equipment short.',
      price: 1
    }
  ],
  abilities: [
    {
      id: 'test-magic',
      name: 'Test Magic',
      type: 'ability',
      rank: 3,
      skill: 'mistika',
      mechanics: {
        effects: [
          {
            activation: { type: 'reaction' },
            conditions: {
              range: { type: 'meters', value: 30 }
            },
            outcomes: [{ key: 'utility', value: 2 }]
          }
        ]
      },
      description: 'Ability description.',
      shortDescription: 'Ability short.',
      price: 5
    }
  ],
  'concept-abilities': [
    {
      id: 'draft-concept',
      name: 'Draft Concept',
      type: 'ability',
      rank: 1,
      skill: 'mistika',
      description: 'Should not import.'
    }
  ]
};

test('gear catalog import builds Foundry rows only from the three primary catalogs', () => {
  assert.equal(typeof syncModule.buildGearCatalogRemoteDataFromCatalogs, 'function');

  const remoteData = syncModule.buildGearCatalogRemoteDataFromCatalogs(catalogs);

  assert.deepEqual(Object.keys(remoteData.sheets).sort(), ['abilities', 'armor', 'equipment']);
  assert.deepEqual(
    Object.values(remoteData.sheets)
      .flat()
      .map((row) => row.name)
      .sort(),
    ['Test Armor', 'Test Device', 'Test Magic']
  );
});

test('gear catalog import maps catalog entries to canonical Foundry item data', () => {
  const remoteData = syncModule.buildGearCatalogRemoteDataFromCatalogs(catalogs);
  const [armorRow] = remoteData.sheets.armor;
  const [equipmentRow] = remoteData.sheets.equipment;
  const [abilityRow] = remoteData.sheets.abilities;

  assert.equal(armorRow.syncId, 'gear:armor:test-armor');
  assert.equal(armorRow.type, 'armor');
  assert.equal(armorRow['system.itemPhys'], 2);
  assert.equal(armorRow['system.itemAzure'], 1);
  assert.equal(armorRow['system.itemMental'], 0);
  assert.equal(armorRow['system.itemShield'], 3);
  assert.equal(armorRow['system.itemSpeed'], 5);

  assert.equal(equipmentRow.syncId, 'gear:equipment:test-device');
  assert.equal(equipmentRow.type, 'equipment');
  assert.equal(equipmentRow['system.skill'], 'khakerstvo');
  assert.equal(equipmentRow['system.skillBonus'], 2);
  assert.equal(equipmentRow['system.requiresRoll'], true);

  assert.equal(abilityRow.syncId, 'gear:abilities:test-magic');
  assert.equal(abilityRow.type, 'trait-source-ability');
  assert.equal(abilityRow['system.skill'], 'mistika');
  assert.equal(abilityRow['system.requiresRoll'], true);
  assert.equal(abilityRow['system.activationType'], 'reaction');
  assert.equal(abilityRow['system.range'], '30 m');

  for (const row of [armorRow, equipmentRow, abilityRow]) {
    const system = JSON.parse(row.systemJson);
    assert.equal(system.details.gearCatalog.id, row.syncId.split(':').at(-1));
    assert.equal(system.description, row['system.description']);
  }
});

test('gear catalog import groups rows by type and rank folders', () => {
  const remoteData = syncModule.buildGearCatalogRemoteDataFromCatalogs(catalogs);

  assert.equal(remoteData.sheets.armor[0].folderPath, 'Броня/Ранг 2');
  assert.equal(remoteData.sheets.equipment[0].folderPath, 'Снаряжение/Ранг 1');
  assert.equal(remoteData.sheets.abilities[0].folderPath, 'Способности/Ранг 3');
});

test('import planner resolves existing folder paths before diffing folder changes', () => {
  const helper = readText('module/helpers/gear-catalog-sync.mjs');

  assert.match(helper, /function resolveCandidateFolderId/);
  assert.match(helper, /const candidateFolderId = resolveCandidateFolderId\(importData\.folderSpec\)/);
  assert.match(helper, /folderSpec\.folderPath\?\.length && !candidateFolderId/);
});

test('sync application no longer exposes gear catalog transport controls', () => {
  const template = readText('templates/apps/gear-catalog-sync.hbs');
  const app = readText('module/apps/gear-catalog-sync-app.mjs');

  assert.doesNotMatch(template, /endpointUrl|token|timeoutMs|data-action='export'/);
  assert.doesNotMatch(app, /exportWorldItemsToGearCatalog|getGearCatalogSyncSettings/);
  assert.match(app, /previewGearCatalogImport/);
  assert.match(app, /applyGearCatalogImport/);
});
