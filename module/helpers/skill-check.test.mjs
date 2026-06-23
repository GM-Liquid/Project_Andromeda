import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getNextSkillAdvancement,
  getSkillAdvancementCost,
  getSkillCheckOutcomeKey,
  normalizeSkill
} from './skill-check.mjs';

test('skill advancement uses value costs 1/2/3 and rank-up cost 2', () => {
  assert.equal(getSkillAdvancementCost({ rank: 1, value: 0 }), 0);
  assert.equal(getSkillAdvancementCost({ rank: 1, value: 1 }), 1);
  assert.equal(getSkillAdvancementCost({ rank: 1, value: 2 }), 3);
  assert.equal(getSkillAdvancementCost({ rank: 1, value: 3 }), 6);
  assert.equal(getSkillAdvancementCost({ rank: 2, value: 0 }), 8);
  assert.equal(getSkillAdvancementCost({ rank: 2, value: 3 }), 14);
});

test('skill advancement rolls rank 1 value 3 into rank 2 value 0', () => {
  assert.deepEqual(getNextSkillAdvancement({ rank: 1, value: 2 }, 2), {
    rank: 1,
    value: 3,
    cost: 3
  });
  assert.deepEqual(getNextSkillAdvancement({ rank: 1, value: 3 }, 2), {
    rank: 2,
    value: 0,
    cost: 2
  });
  assert.equal(getNextSkillAdvancement({ rank: 2, value: 3 }, 2), null);
});

test('skill data is clamped to character rank and value range', () => {
  assert.deepEqual(normalizeSkill({ rank: 4, value: 9 }, 2), { rank: 2, value: 3 });
  assert.deepEqual(normalizeSkill({ rank: 0, value: -1 }, 4), { rank: 1, value: 0 });
});

test('2d6 totals map to the unshifted outcome table', () => {
  assert.equal(getSkillCheckOutcomeKey(6), 'Failure');
  assert.equal(getSkillCheckOutcomeKey(7), 'SuccessWithCost');
  assert.equal(getSkillCheckOutcomeKey(9), 'SuccessWithCost');
  assert.equal(getSkillCheckOutcomeKey(10), 'Success');
  assert.equal(getSkillCheckOutcomeKey(12), 'Success');
  assert.equal(getSkillCheckOutcomeKey(13), 'CriticalSuccess');
});
