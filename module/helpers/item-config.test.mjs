import assert from 'node:assert/strict';
import test from 'node:test';

import { getAbilityBaseHeatCost, getAbilityHeatCost, getItemTypeConfig } from './item-config.mjs';

test('base Heat cost falls by each positive rank difference', () => {
  const ability = { system: { heatCost: 2, rank: 2 } };
  assert.equal(getAbilityHeatCost(ability, 2), 2);
  assert.equal(getAbilityHeatCost(ability, 3), 1);
  assert.equal(getAbilityHeatCost(ability, 4), 0);
  assert.equal(getAbilityHeatCost({ system: { heatCost: 4, rank: 2 } }, 4), 2);
});

test('an ability above character rank never costs more than its base Heat', () => {
  assert.equal(getAbilityHeatCost({ system: { heatCost: 1, rank: 4 } }, 1), 1);
});

test('legacy modes remain readable until the one-time migration runs', () => {
  assert.equal(getAbilityBaseHeatCost({ system: { mode: 'forced' } }), 2);
  assert.equal(getAbilityBaseHeatCost({ system: { mode: 'standard' } }), 0);
});

test('ability editor exposes rank and arbitrary nonnegative base Heat', () => {
  const ability = getItemTypeConfig('trait-source-ability');
  assert.ok(ability.fields.some((field) => field.path === 'rank' && field.type === 'rank'));
  assert.ok(
    ability.fields.some(
      (field) => field.path === 'heatCost' && field.type === 'number' && field.min === 0
    )
  );
  assert.equal(
    ability.fields.some((field) => field.path === 'mode'),
    false
  );
});

test('trait editor exposes its persisted rank as a select', () => {
  const trait = getItemTypeConfig('trait');
  assert.ok(trait.fields.some((field) => field.path === 'rank' && field.type === 'rank'));
  assert.equal(
    trait.fields.some((field) => field.path === 'heatCost'),
    false
  );
});

test('archetype editor exposes all player-facing 0.5 bonus fields', () => {
  const archetype = getItemTypeConfig('archetype');
  assert.ok(
    archetype.fields.some((field) => field.path === 'stressBonusPerRank' && field.type === 'number')
  );
  assert.ok(
    archetype.fields.some((field) => field.path === 'abilityName' && field.readonly === true)
  );
  assert.ok(
    archetype.fields.some((field) => field.path === 'traitName' && field.readonly === true)
  );
  assert.equal(
    archetype.fields.some((field) => field.path === 'trait.description'),
    false
  );
});
