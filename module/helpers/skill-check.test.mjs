import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getNextSkillAdvancement,
  getSkillAdvancementCost,
  getSkillCheckOutcomeKey,
  normalizeSkill
} from './skill-check.mjs';

test('skill advancement uses value costs 1/2/3/4 and rank-up cost 2', () => {
  assert.equal(getSkillAdvancementCost({ rank: 1, value: 0 }), 0);
  assert.equal(getSkillAdvancementCost({ rank: 1, value: 1 }), 1);
  assert.equal(getSkillAdvancementCost({ rank: 1, value: 2 }), 3);
  assert.equal(getSkillAdvancementCost({ rank: 1, value: 3 }), 6);
  assert.equal(getSkillAdvancementCost({ rank: 1, value: 4 }), 10);
  assert.equal(getSkillAdvancementCost({ rank: 2, value: 0 }), 12);
  assert.equal(getSkillAdvancementCost({ rank: 2, value: 4 }), 22);
});

test('skill advancement rolls rank 1 value 4 into rank 2 value 0', () => {
  assert.deepEqual(getNextSkillAdvancement({ rank: 1, value: 3 }, 2), {
    rank: 1,
    value: 4,
    cost: 4
  });
  assert.deepEqual(getNextSkillAdvancement({ rank: 1, value: 4 }, 2), {
    rank: 2,
    value: 0,
    cost: 2
  });
  assert.equal(getNextSkillAdvancement({ rank: 2, value: 4 }, 2), null);
});

test('skill data is clamped to character rank and value range', () => {
  assert.deepEqual(normalizeSkill({ rank: 4, value: 9 }, 2), { rank: 2, value: 4 });
  assert.deepEqual(normalizeSkill({ rank: 0, value: -1 }, 4), { rank: 1, value: 0 });
});

test('2d8 totals map to the unshifted outcome table', () => {
  assert.equal(getSkillCheckOutcomeKey(8), 'Failure');
  assert.equal(getSkillCheckOutcomeKey(9), 'SuccessWithCost');
  assert.equal(getSkillCheckOutcomeKey(12), 'SuccessWithCost');
  assert.equal(getSkillCheckOutcomeKey(13), 'Success');
  assert.equal(getSkillCheckOutcomeKey(16), 'Success');
  assert.equal(getSkillCheckOutcomeKey(17), 'CriticalSuccess');
});
