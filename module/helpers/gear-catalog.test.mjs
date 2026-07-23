import assert from 'node:assert/strict';
import test from 'node:test';

import { buildGearCatalogRemoteDataFromCatalogs } from './gear-catalog.mjs';

function getSystemData(row) {
  return JSON.parse(row.systemJson);
}

test('gear catalog transform maps ability modes and artifact activation metadata', () => {
  const remoteData = buildGearCatalogRemoteDataFromCatalogs({
    abilities: [
      {
        id: 'gravity-snare',
        name: 'Gravity Snare',
        type: 'ability',
        rank: 2,
        skill: 'mistika',
        mode: 'forced',
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
    artifacts: [
      {
        id: 'shock-mine',
        name: 'Shock Mine',
        type: 'artifact',
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
  assert.equal(abilityData.mode, 'forced');

  const artifactRow = remoteData.sheets.artifacts[0];
  const artifactData = getSystemData(artifactRow);
  assert.equal(artifactRow.type, 'artifact');
  assert.equal(artifactRow.syncId, 'gear:equipment:shock-mine');
  assert.equal(artifactData.activationCost, 'maneuver');
  assert.equal(artifactData.activationType, 'maneuver');
  assert.equal(artifactData.usageFrequency, 'twoPerScene');
  assert.equal(artifactData.range, '20 m');
  assert.equal(artifactData.targets, 'allInArea');
  assert.equal(artifactData.area, 'circle 10 m');
  assert.equal(artifactData.defense, 'control');
  assert.equal(artifactData.duration, 'untilStartOfYourNextTurn');
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
        stressBonusPerRank: 3,
        trait: { id: 'breach-heat', name: 'Breach Heat', description: 'Gain Heat.' },
        ability: {
          id: 'breach',
          name: 'Breach',
          type: 'ability',
          skill: 'blizhniy_boy',
          defense: 'fortitude',
          activation: 'action',
          check: 'required',
          mode: 'standard',
          versions: [
            {
              rank: 1,
              name: 'Breach',
              range: { type: 'melee' },
              damage: '1/2/3/5',
              description: 'Dash forward and attack.'
            }
          ]
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
  assert.equal(archetypeData.traitName, 'Breach Heat');
  assert.equal(archetypeData.traitSyncId, 'gear:traits:breach-heat');
  assert.equal(archetypeData.stressBonusPerRank, 3);
  assert.equal(archetypeData.trait.id, 'breach-heat');
  assert.equal(remoteData.sheets.abilities.length, 1);
  assert.equal(remoteData.sheets.traits.length, 1);
  assert.equal(remoteData.sheets.traits[0].type, 'trait');
  assert.equal(remoteData.sheets.traits[0].syncId, 'gear:traits:breach-heat');
  const abilityData = getSystemData(remoteData.sheets.abilities[0]);
  assert.equal(abilityData.description, 'Dash forward and attack.');
  assert.equal(abilityData.skillBonus, '1/2/3/5');
  assert.equal(abilityData.details.archetypeAbility.versions.length, 1);
  const traitData = getSystemData(remoteData.sheets.traits[0]);
  assert.equal(traitData.description, 'Gain Heat.');
  assert.equal(traitData.requiresRoll, false);
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

test('gear catalog transform keeps all migrated equipment in the artifact group', () => {
  const remoteData = buildGearCatalogRemoteDataFromCatalogs({
    abilities: [],
    artifacts: [
      {
        id: 'hunting-shotgun',
        name: 'Hunting Shotgun',
        type: 'artifact',
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
        type: 'artifact',
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
        type: 'artifact',
        rank: 1,
        skill: 'medicina',
        description: 'Heal an ally.',
        mechanics: { effects: [{ activation: { type: 'action' } }] }
      }
    ]
  });

  assert.equal(remoteData.sheets.artifacts.length, 3);
  for (const row of remoteData.sheets.artifacts) {
    assert.equal(row.type, 'artifact');
    assert.ok(row.folderPath.startsWith('Артефакты/'));
  }
  const shotgunData = getSystemData(
    remoteData.sheets.artifacts.find((row) => row.name === 'Hunting Shotgun')
  );
  assert.equal(shotgunData.skillBonus, '0/2/2/2');
});

test('gear catalog transform carries optional step effects through to system data', () => {
  const remoteData = buildGearCatalogRemoteDataFromCatalogs({
    armor: [],
    abilities: [],
    artifacts: [
      {
        id: 'shock-baton',
        name: 'Shock Baton',
        type: 'artifact',
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

  const systemData = getSystemData(remoteData.sheets.artifacts[0]);
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
    artifacts: [
      {
        id: 'plain-knife',
        name: 'Plain Knife',
        type: 'artifact',
        rank: 1,
        skill: 'blizhniy_boy',
        description: 'Damage: 1.',
        mechanics: {
          effects: [{ activation: { type: 'action' }, outcomes: [{ key: 'damage', value: 1 }] }]
        }
      }
    ]
  });

  assert.deepEqual(getSystemData(remoteData.sheets.artifacts[0]).stepEffects, []);
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
