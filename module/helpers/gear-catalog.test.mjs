import assert from 'node:assert/strict';
import test from 'node:test';

import { buildGearCatalogRemoteDataFromCatalogs } from './gear-catalog.mjs';

function getSystemData(row) {
  return JSON.parse(row.systemJson);
}

test('gear catalog transform maps activation metadata for abilities, equipment, and armor', () => {
  const remoteData = buildGearCatalogRemoteDataFromCatalogs({
    abilities: [
      {
        id: 'gravity-snare',
        name: 'Gravity Snare',
        type: 'ability',
        rank: 2,
        skill: 'mistika',
        description: 'Locks a target in place.',
        mechanics: {
          effects: [
            {
              activation: { type: 'action' },
              conditions: {
                frequency: 'oncePerScene',
                range: { type: 'meters', value: 30 },
                targets: 'single',
                defense: 'fortitude',
                duration: 'untilEndOfScene',
                check: 'required'
              }
            }
          ]
        }
      }
    ],
    equipment: [
      {
        id: 'shock-mine',
        name: 'Shock Mine',
        type: 'equipment',
        rank: 2,
        skill: 'inzheneriya',
        description: 'Shocks every target in the blast.',
        mechanics: {
          effects: [
            {
              activation: { type: 'maneuver' },
              conditions: {
                frequency: 'oncePerSession',
                range: { type: 'meters', value: 20 },
                targets: 'allInArea',
                area: { type: 'circle', value: 10 },
                defense: 'control',
                duration: 'untilStartOfYourNextTurn'
              },
              outcomes: [{ key: 'damage', value: 4 }]
            }
          ]
        }
      }
    ],
    armor: [
      {
        id: 'reactive-shell',
        name: 'Reactive Shell',
        type: 'armor',
        rank: 3,
        skill: null,
        description: 'A reactive shell that shrugs off incoming fire.',
        mechanics: {
          effects: [
            {
              activation: { type: 'reaction' },
              conditions: {
                frequency: 'oncePerScene',
                targets: 'self',
                duration: 'untilEndOfTurn'
              },
              outcomes: [{ key: 'fortitudeBonus', value: 2 }]
            }
          ]
        }
      }
    ]
  });

  const abilityData = getSystemData(remoteData.sheets.abilities[0]);
  assert.equal(abilityData.activationCost, 'action');
  assert.equal(abilityData.activationType, 'action');
  assert.equal(abilityData.usageFrequency, 'scene');
  assert.equal(abilityData.range, '30 m');
  assert.equal(abilityData.targets, 'single');
  assert.equal(abilityData.defense, 'fortitude');
  assert.equal(abilityData.duration, 'untilEndOfScene');

  const equipmentData = getSystemData(remoteData.sheets.equipment[0]);
  assert.equal(equipmentData.activationCost, 'maneuver');
  assert.equal(equipmentData.activationType, 'maneuver');
  assert.equal(equipmentData.usageFrequency, 'twoPerScene');
  assert.equal(equipmentData.range, '20 m');
  assert.equal(equipmentData.targets, 'allInArea');
  assert.equal(equipmentData.area, 'circle 10 m');
  assert.equal(equipmentData.defense, 'control');
  assert.equal(equipmentData.duration, 'untilStartOfYourNextTurn');

  const armorData = getSystemData(remoteData.sheets.armor[0]);
  assert.equal(armorData.activationCost, 'reaction');
  assert.equal(armorData.activationType, 'reaction');
  assert.equal(armorData.usageFrequency, 'scene');
  assert.equal(armorData.targets, 'self');
  assert.equal(armorData.duration, 'untilEndOfTurn');
  assert.equal(armorData.itemFortitude, 2);
  assert.equal(armorData.itemControl, 0);
  assert.equal(armorData.itemWill, 0);
});

test('gear catalog transform keeps archetype descriptions separate from signature abilities', () => {
  const remoteData = buildGearCatalogRemoteDataFromCatalogs({
    armor: [],
    equipment: [],
    abilities: [],
    archetypes: [
      {
        id: 'vanguard',
        name: 'Vanguard',
        type: 'archetype',
        skill: 'blizhniy_boy',
        description: 'First through the breach.',
        defenseProfile: { strong: 'fortitude', medium: 'will', weak: 'control' },
        ability: {
          id: 'breach',
          name: 'Breach',
          type: 'ability',
          rank: 1,
          skill: 'blizhniy_boy',
          description: 'Dash forward and attack.'
        }
      }
    ]
  });

  const archetypeData = getSystemData(remoteData.sheets.archetypes[0]);
  assert.equal(archetypeData.description, 'First through the breach.');
  assert.deepEqual(archetypeData.defenseProfile, {
    strong: 'fortitude',
    medium: 'will',
    weak: 'control'
  });
  assert.equal(archetypeData.abilityName, 'Breach');
  assert.equal(remoteData.sheets.abilities.length, 1);
});

test('gear catalog transform preserves freeAction abilities as freeAction activation cost', () => {
  const remoteData = buildGearCatalogRemoteDataFromCatalogs({
    armor: [],
    equipment: [],
    abilities: [
      {
        id: 'desh',
        name: 'Дэш',
        type: 'ability',
        rank: 1,
        skill: 'lovkost',
        description: 'Dash forward.',
        mechanics: {
          effects: [
            {
              activation: { type: 'freeAction' },
              conditions: {
                frequency: 'oncePerScene',
                range: { type: 'meters', value: 15 }
              },
              outcomes: [{ key: 'specialRule' }]
            }
          ]
        }
      }
    ]
  });

  const abilityData = getSystemData(remoteData.sheets.abilities[0]);
  assert.equal(abilityData.activationCost, 'freeAction');
  assert.equal(abilityData.activationType, 'freeAction');
  assert.equal(abilityData.usageFrequency, 'scene');
  assert.equal(abilityData.range, '15 m');
  assert.equal(abilityData.requiresRoll, false);
});

test('gear catalog transform splits weapon-skilled equipment into the weapon group', () => {
  const remoteData = buildGearCatalogRemoteDataFromCatalogs({
    armor: [],
    abilities: [],
    equipment: [
      {
        id: 'hunting-shotgun',
        name: 'Hunting Shotgun',
        type: 'equipment',
        rank: 2,
        skill: 'strelba',
        description: 'Damage: 2.',
        mechanics: {
          effects: [{ activation: { type: 'action' }, outcomes: [{ key: 'damage', value: 2 }] }]
        }
      },
      {
        id: 'combat-knife',
        name: 'Combat Knife',
        type: 'equipment',
        rank: 1,
        skill: 'blizhniy_boy',
        description: 'Damage: 1.',
        mechanics: {
          effects: [{ activation: { type: 'action' }, outcomes: [{ key: 'damage', value: 1 }] }]
        }
      },
      {
        id: 'medkit',
        name: 'Medkit',
        type: 'equipment',
        rank: 1,
        skill: 'medicina',
        description: 'Heal an ally.',
        mechanics: { effects: [{ activation: { type: 'action' } }] }
      }
    ]
  });

  // Weapon-skilled entries become real weapon items filed under "Оружие".
  assert.equal(remoteData.sheets.weapons.length, 2);
  assert.deepEqual(remoteData.sheets.weapons.map((row) => row.name).sort(), [
    'Combat Knife',
    'Hunting Shotgun'
  ]);
  for (const row of remoteData.sheets.weapons) {
    assert.equal(row.type, 'weapon');
    assert.ok(row.folderPath.startsWith('Оружие/'));
    const systemData = getSystemData(row);
    assert.equal(systemData.quantity, 1);
    assert.equal(systemData.requiresRoll, true);
  }
  const shotgunData = getSystemData(
    remoteData.sheets.weapons.find((row) => row.name === 'Hunting Shotgun')
  );
  assert.equal(shotgunData.skillBonus, '0/2/2/2');

  // Everything else stays a general equipment item filed under "Предметы".
  assert.equal(remoteData.sheets.equipment.length, 1);
  const itemRow = remoteData.sheets.equipment[0];
  assert.equal(itemRow.name, 'Medkit');
  assert.equal(itemRow.type, 'equipment');
  assert.ok(itemRow.folderPath.startsWith('Предметы/'));
});

test('gear catalog transform carries optional step effects through to system data', () => {
  const remoteData = buildGearCatalogRemoteDataFromCatalogs({
    armor: [],
    abilities: [],
    equipment: [
      {
        id: 'shock-baton',
        name: 'Shock Baton',
        type: 'equipment',
        rank: 1,
        skill: 'blizhniy_boy',
        description: 'Damage: 1.',
        mechanics: {
          effects: [{ activation: { type: 'action' }, outcomes: [{ key: 'damage', value: 1 }] }]
        },
        stepEffects: [
          { text: 'Stun', minOutcome: 'CriticalSuccess' },
          { text: '', minOutcome: 'Success' },
          { text: 'Knockback', minOutcome: 'bogus' }
        ]
      }
    ]
  });

  const systemData = getSystemData(remoteData.sheets.weapons[0]);
  // Blank entries are dropped; invalid thresholds fall back to Success.
  assert.deepEqual(systemData.stepEffects, [
    { text: 'Stun', minOutcome: 'CriticalSuccess' },
    { text: 'Knockback', minOutcome: 'Success' }
  ]);
});

test('gear catalog transform defaults step effects to an empty list', () => {
  const remoteData = buildGearCatalogRemoteDataFromCatalogs({
    armor: [],
    abilities: [],
    equipment: [
      {
        id: 'plain-knife',
        name: 'Plain Knife',
        type: 'equipment',
        rank: 1,
        skill: 'blizhniy_boy',
        description: 'Damage: 1.',
        mechanics: {
          effects: [{ activation: { type: 'action' }, outcomes: [{ key: 'damage', value: 1 }] }]
        }
      }
    ]
  });

  assert.deepEqual(getSystemData(remoteData.sheets.weapons[0]).stepEffects, []);
});

test('gear catalog transform emits passive traits into their own compendium folder', () => {
  const remoteData = buildGearCatalogRemoteDataFromCatalogs({
    traits: [
      {
        id: 'sixth-sense',
        name: 'Sixth Sense',
        type: 'trait',
        rank: 2,
        skill: 'nablyudatelnost',
        description: 'Notice hidden threats before they strike.'
      }
    ]
  });

  assert.equal(remoteData.sheets.traits.length, 1);
  const traitRow = remoteData.sheets.traits[0];
  assert.equal(traitRow.type, 'trait');
  assert.equal(traitRow.folderPath, 'Черты/Ранг 2');
  const traitData = getSystemData(traitRow);
  assert.equal(traitData.rank, '2');
  assert.equal(traitData.skill, 'nablyudatelnost');
  assert.equal(traitData.requiresRoll, false);
});
