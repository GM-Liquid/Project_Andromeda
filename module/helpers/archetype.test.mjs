import assert from 'node:assert/strict';
import test from 'node:test';

import {
  applyArchetypeAbilityVersionToItemData,
  buildArchetypeAbilityVersionSystemData,
  buildArchetypeTraitGrantData,
  getArchetypeAbilityDisplayName,
  selectArchetypeAbilityVersion,
  syncArchetypeAbilityToRank
} from './archetype.mjs';

const ability = {
  id: 'surge',
  name: 'Surge',
  skill: 'rezonans',
  defense: 'fortitude',
  activation: 'action',
  check: 'required',
  heatCost: 0,
  versions: [
    { rank: 1, name: 'Surge', range: { type: 'meters', value: 30 }, damage: '1/2/3/5' },
    { rank: 2, name: 'Wave', range: { type: 'meters', value: 100 }, damage: '2/4/6/9' },
    { rank: 3, name: 'Storm', range: { type: 'meters', value: 300 }, damage: '4/6/9/14' },
    { rank: 4, name: 'Cataclysm', range: { type: 'meters', value: 1000 }, damage: '5/8/12/18' }
  ]
};

test('archetype signature ability selects the character-rank version', () => {
  assert.equal(selectArchetypeAbilityVersion(ability.versions, 1).name, 'Surge');
  assert.equal(selectArchetypeAbilityVersion(ability.versions, 3).name, 'Storm');
  assert.equal(selectArchetypeAbilityVersion(ability.versions, 9).name, 'Cataclysm');
});

test('archetype display uses the name of its granted rank-synced ability', () => {
  const archetype = {
    id: 'shadow-archetype',
    system: { abilityName: 'Shadow Strike' }
  };
  const actor = {
    items: [
      {
        name: 'Dissolution',
        system: { details: { archetypeAbility: ability } },
        getFlag: () => 'shadow-archetype'
      },
      {
        name: 'Unrelated trait',
        system: { details: {} },
        getFlag: () => 'shadow-archetype'
      }
    ]
  };

  assert.equal(getArchetypeAbilityDisplayName(actor, archetype), 'Dissolution');
  assert.equal(getArchetypeAbilityDisplayName({ items: [] }, archetype), 'Shadow Strike');
});

test('archetype signature version updates all player-facing combat fields', () => {
  const version = buildArchetypeAbilityVersionSystemData(ability, 2);
  assert.equal(version.name, 'Wave');
  assert.equal(version.system.rank, '2');
  assert.equal(version.system.range, '100 m');
  assert.equal(version.system.skillBonus, '2/4/6/9');
  assert.equal(version.system.heatCost, 0);
  assert.equal(version.system.mode, undefined);

  const itemData = {
    name: 'Surge',
    system: { details: { archetypeAbility: ability } }
  };
  applyArchetypeAbilityVersionToItemData(itemData, 4);
  assert.equal(itemData.name, 'Cataclysm');
  assert.equal(itemData.system.range, '1000 m');
  assert.equal(itemData.system.skillBonus, '5/8/12/18');
  assert.equal(itemData.system.details.archetypeAbility.versions.length, 4);
});

test('archetype trigger grant is a linked trait, not an ability', () => {
  const data = buildArchetypeTraitGrantData(
    {
      uuid: 'Compendium.project-andromeda.gear-library.Item.trigger',
      toObject: () => ({
        _id: 'source-id',
        name: 'Breach Heat',
        type: 'trait',
        system: { description: 'Gain Heat.' },
        flags: {}
      })
    },
    'archetype-id'
  );

  assert.equal(data._id, undefined);
  assert.equal(data.type, 'trait');
  assert.equal(data.flags['project-andromeda'].grantedByArchetype, 'archetype-id');
  assert.equal(
    data.flags['project-andromeda'].libraryItemUuid,
    'Compendium.project-andromeda.gear-library.Item.trigger'
  );
});

test('archetype rank sync repairs stale rank-one data and then becomes a no-op', async () => {
  const itemData = {
    _id: 'ability-id',
    name: 'Surge',
    system: {
      details: { archetypeAbility: ability },
      rank: '1',
      range: '30 m',
      skillBonus: '1/2/3/5'
    }
  };
  const item = {
    id: 'ability-id',
    system: itemData.system,
    getFlag: () => 'archetype-id',
    toObject: () => structuredClone(itemData)
  };
  const updates = [];
  const actor = {
    system: { currentRank: 3 },
    items: [item],
    async updateEmbeddedDocuments(_documentName, pendingUpdates) {
      updates.push(...pendingUpdates);
      const update = pendingUpdates[0];
      itemData.name = update.name;
      itemData.system = structuredClone(update.system);
      item.system = itemData.system;
    }
  };

  assert.equal(await syncArchetypeAbilityToRank(actor), 1);
  assert.equal(updates[0].name, 'Storm');
  assert.equal(updates[0].system.rank, '3');
  assert.equal(updates[0].system.skillBonus, '4/6/9/14');

  assert.equal(await syncArchetypeAbilityToRank(actor), 0);
  assert.equal(updates.length, 1);
});
