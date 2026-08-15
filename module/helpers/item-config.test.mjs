import assert from 'node:assert/strict';
import test from 'node:test';

import { getAbilityHeatCost, getItemTypeConfig, normalizeHeatCost } from './item-config.mjs';

test('Heat cost stays at its recorded value for every character rank', () => {
  const ability = { system: { heatCost: 2, rank: 2 } };
  assert.equal(getAbilityHeatCost(ability), 2);
  assert.equal(getAbilityHeatCost({ system: { heatCost: 4, rank: 2 } }), 4);
  assert.equal(getAbilityHeatCost({ system: { heatCost: 1, rank: 4 } }), 1);
});

test('Heat cost is normalized to a nonnegative integer', () => {
  assert.equal(normalizeHeatCost('3'), 3);
  assert.equal(normalizeHeatCost(-2), 0);
  assert.equal(normalizeHeatCost('abc'), 0);
  assert.equal(getAbilityHeatCost({ system: { heatCost: '' } }), 0);
});

test('legacy modes remain readable until the one-time migration runs', () => {
  assert.equal(getAbilityHeatCost({ system: { mode: 'forced' } }), 2);
  assert.equal(getAbilityHeatCost({ system: { mode: 'standard' } }), 0);
});

test('ability editor exposes rank and arbitrary nonnegative Heat cost', () => {
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
