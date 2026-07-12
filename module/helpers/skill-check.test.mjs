import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getNextSkillAdvancement,
  getSkillAdvancementCost,
  getSkillCheckOutcomeKey,
  getSkillRankCap,
  normalizeSkill
} from './skill-check.mjs';

test('value steps cost the current rank and a full rank costs 4 * rank', () => {
  assert.equal(getSkillAdvancementCost({ rank: 1, value: 0 }), 0);
  assert.equal(getSkillAdvancementCost({ rank: 1, value: 1 }), 1);
  assert.equal(getSkillAdvancementCost({ rank: 1, value: 2 }), 2);
  assert.equal(getSkillAdvancementCost({ rank: 1, value: 3 }), 3);
  assert.equal(getSkillAdvancementCost({ rank: 1, value: 4 }), 4);
  // Rolling rank 1 (value 4 -> 0) is free, so rank 2 value 0 only paid for rank 1's values.
  assert.equal(getSkillAdvancementCost({ rank: 2, value: 0 }), 4);
  assert.equal(getSkillAdvancementCost({ rank: 2, value: 4 }), 12);
  assert.equal(getSkillAdvancementCost({ rank: 3, value: 0 }), 12);
  assert.equal(getSkillAdvancementCost({ rank: 4, value: 4 }), 40);
});

test('archetype baseline (rank 2 free) lowers the spent cost of its skill', () => {
  assert.equal(getSkillAdvancementCost({ rank: 2, value: 0 }, { baselineRank: 2 }), 0);
  assert.equal(getSkillAdvancementCost({ rank: 2, value: 3 }, { baselineRank: 2 }), 6);
  assert.equal(getSkillAdvancementCost({ rank: 3, value: 0 }, { baselineRank: 2 }), 8);
});

test('value steps cost the current rank, rank-up at value 4 is free', () => {
  assert.deepEqual(getNextSkillAdvancement({ rank: 1, value: 3 }, 2), {
    rank: 1,
    value: 4,
    cost: 1
  });
  assert.deepEqual(getNextSkillAdvancement({ rank: 1, value: 4 }, 2), {
    rank: 2,
    value: 0,
    cost: 0
  });
  assert.deepEqual(getNextSkillAdvancement({ rank: 2, value: 3 }, 2), {
    rank: 2,
    value: 4,
    cost: 2
  });
  assert.equal(getNextSkillAdvancement({ rank: 2, value: 4 }, 2), null);
});

test('archetype skill cap is one above the character rank', () => {
  assert.equal(getSkillRankCap(2), 2);
  assert.equal(getSkillRankCap(2, 1), 3);
  // At character rank 2 an archetype skill can advance past the normal cap.
  assert.deepEqual(getNextSkillAdvancement({ rank: 2, value: 4 }, 2, { rankBonus: 1 }), {
    rank: 3,
    value: 0,
    cost: 0
  });
  assert.equal(getNextSkillAdvancement({ rank: 3, value: 4 }, 2, { rankBonus: 1 }), null);
});

test('skill data is clamped to character rank and value range', () => {
  assert.deepEqual(normalizeSkill({ rank: 4, value: 9 }, 2), { rank: 2, value: 4 });
  assert.deepEqual(normalizeSkill({ rank: 0, value: -1 }, 4), { rank: 1, value: 0 });
  // Archetype skill may sit one rank above the character rank.
  assert.deepEqual(normalizeSkill({ rank: 4, value: 2 }, 2, 1), { rank: 3, value: 2 });
});

test('2d8 totals map to the unshifted outcome table', () => {
  assert.equal(getSkillCheckOutcomeKey(7), 'Failure');
  assert.equal(getSkillCheckOutcomeKey(8), 'SuccessWithCost');
  assert.equal(getSkillCheckOutcomeKey(11), 'SuccessWithCost');
  assert.equal(getSkillCheckOutcomeKey(12), 'Success');
  assert.equal(getSkillCheckOutcomeKey(15), 'Success');
  assert.equal(getSkillCheckOutcomeKey(16), 'CriticalSuccess');
});
