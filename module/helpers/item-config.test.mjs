import assert from 'node:assert/strict';
import test from 'node:test';

import { getAbilityHeatCost, getItemTypeConfig } from './item-config.mjs';

test('forced ability Heat cost falls from 2 to 1 to 0 by rank difference', () => {
  const ability = { system: { mode: 'forced', rank: 2 } };
  assert.equal(getAbilityHeatCost(ability, 2), 2);
  assert.equal(getAbilityHeatCost(ability, 3), 1);
  assert.equal(getAbilityHeatCost(ability, 4), 0);
});

test('standard abilities never spend Heat', () => {
  assert.equal(getAbilityHeatCost({ system: { mode: 'standard', rank: 4 } }, 1), 0);
});

test('ability editor exposes rank without adding it to the actor table configuration', () => {
  const ability = getItemTypeConfig('trait-source-ability');
  assert.ok(ability.fields.some((field) => field.path === 'rank' && field.type === 'rank'));
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
  assert.equal(archetype.fields.some((field) => field.path === 'trait.description'), false);
});
