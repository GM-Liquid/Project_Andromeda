import assert from 'node:assert/strict';
import test from 'node:test';

import { getItemsAdvancementSpent, getTotalAdvancementSpent } from './advancement-points.mjs';

test('advancement total uses skill ranks and values and ignores obsolete skill keys', () => {
  const system = {
    skills: {
      moshch: { rank: 2, value: 0 },
      lovkost: { rank: 1, value: 3 },
      sokrytie: { rank: 1, value: 2 },
      strelba: { rank: 1, value: 0 },
      blizhniy_boy: { rank: 1, value: 1 },
      nablyudatelnost: { rank: 1, value: 0 },
      analiz: { rank: 1, value: 0 },
      khakerstvo: { rank: 1, value: 0 },
      inzheneriya: { rank: 1, value: 0 },
      dominirovanie: { rank: 1, value: 0 },
      rezonans: { rank: 1, value: 0 },
      mistika: { rank: 1, value: 0 },
      obayanie: { rank: 1, value: 0 },
      skrytie: { rank: 4, value: 3 }
    }
  };

  assert.equal(getTotalAdvancementSpent(system), 10);
});

test('archetype skill is measured from its free rank-2 baseline', () => {
  const system = {
    skills: {
      strelba: { rank: 2, value: 0 }
    }
  };

  assert.equal(getTotalAdvancementSpent(system), 4);
  assert.equal(getTotalAdvancementSpent(system, { archetypeSkillKey: 'strelba' }), 0);
});

test('owned traits and abilities spend progression points based on rank', () => {
  const items = [
    { type: 'trait', system: { rank: 2 } },
    { type: 'trait-source-ability', system: { rank: 3 } }
  ];

  assert.equal(getItemsAdvancementSpent(items), 13);
  assert.equal(getTotalAdvancementSpent({}, { items }), 13);
});

test('free and non-purchasable items do not spend progression points', () => {
  const items = [
    {
      type: 'trait',
      system: { rank: 4, details: { personalityRole: 'value' } }
    },
    {
      type: 'trait-source-ability',
      system: { rank: 4 },
      flags: { 'project-andromeda': { grantedByArchetype: true } }
    },
    { type: 'trait-genome', system: { rank: 4 } },
    { type: 'weapon', system: { rank: 4 } }
  ];

  assert.equal(getItemsAdvancementSpent(items), 0);
});
