import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getAbilityAdvancementCost,
  getSkillAdvancementCost,
  getTotalAdvancementSpent
} from '../helpers/advancement-points.mjs';

test('uses the character-creation step costs for skills', () => {
  assert.equal(getSkillAdvancementCost(0), 0);
  assert.equal(getSkillAdvancementCost(1), 1);
  assert.equal(getSkillAdvancementCost(3), 5);
  assert.equal(getSkillAdvancementCost(6), 14);
  assert.equal(getSkillAdvancementCost(10), 30);
});

test('uses the character-creation step costs for abilities and stops increasing past d12', () => {
  assert.equal(getAbilityAdvancementCost(4), 0);
  assert.equal(getAbilityAdvancementCost(6), 4);
  assert.equal(getAbilityAdvancementCost(8), 12);
  assert.equal(getAbilityAdvancementCost(10), 24);
  assert.equal(getAbilityAdvancementCost(12), 40);
  assert.equal(getAbilityAdvancementCost('2d8'), 40);
  assert.equal(getAbilityAdvancementCost(20), 40);
});

test('sums spent advancement points from all abilities and skills', () => {
  const system = {
    abilities: {
      con: { value: 8 },
      int: { value: 6 },
      spi: { value: 6 }
    },
    skills: {
      lovkost: { value: 3 },
      strelba: { value: 3 },
      nablyudatelnost: { value: 3 },
      analiz: { value: 3 },
      dominirovanie: { value: 2 },
      obayanie: { value: 1 }
    }
  };

  assert.equal(getTotalAdvancementSpent(system), 44);
});
