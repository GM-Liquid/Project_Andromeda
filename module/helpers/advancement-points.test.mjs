import assert from 'node:assert/strict';
import test from 'node:test';

import { getTotalAdvancementSpent } from './advancement-points.mjs';

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

  assert.equal(getTotalAdvancementSpent(system), 22);
});
