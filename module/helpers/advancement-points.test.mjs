import assert from 'node:assert/strict';
import test from 'node:test';

import { getTotalAdvancementSpent } from './advancement-points.mjs';

test('advancement total ignores obsolete hidden skill keys', () => {
  const system = {
    abilities: {
      con: { value: 8 },
      int: { value: 6 },
      spi: { value: 6 }
    },
    skills: {
      moshch: { value: 0 },
      lovkost: { value: 3 },
      sokrytie: { value: 3 },
      strelba: { value: 0 },
      blizhniy_boy: { value: 2 },
      nablyudatelnost: { value: 1 },
      analiz: { value: 1 },
      khakerstvo: { value: 0 },
      inzheneriya: { value: 0 },
      dominirovanie: { value: 0 },
      rezonans: { value: 0 },
      mistika: { value: 3 },
      obayanie: { value: 0 },
      skrytie: { value: 3 }
    }
  };

  assert.equal(getTotalAdvancementSpent(system), 40);
});
