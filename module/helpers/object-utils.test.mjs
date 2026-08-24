import assert from 'node:assert/strict';
import test from 'node:test';

import {
  areJsonValuesEqual,
  deepClone,
  mergeDefaults,
  sortObjectKeys,
  stableStringify
} from './object-utils.mjs';

test('deepClone returns an independent copy outside Foundry', () => {
  const source = { nested: { value: 1 }, rows: [{ id: 'a' }] };
  const clone = deepClone(source);

  clone.nested.value = 2;
  clone.rows[0].id = 'b';

  assert.deepEqual(source, { nested: { value: 1 }, rows: [{ id: 'a' }] });
});

test('sortObjectKeys recursively canonicalizes objects without reordering arrays', () => {
  const source = { z: 1, a: { y: 2, b: 3 }, rows: [{ z: 4, a: 5 }, { c: 6 }] };

  assert.deepEqual(sortObjectKeys(source), {
    a: { b: 3, y: 2 },
    rows: [{ a: 5, z: 4 }, { c: 6 }],
    z: 1
  });
  assert.deepEqual(Object.keys(source), ['z', 'a', 'rows']);
});

test('stable JSON comparison ignores object key order but preserves array order', () => {
  assert.equal(areJsonValuesEqual({ b: 2, a: 1 }, { a: 1, b: 2 }), true);
  assert.equal(areJsonValuesEqual([1, 2], [2, 1]), false);
  assert.equal(stableStringify({ b: 2, a: 1 }, 2), '{\n  "a": 1,\n  "b": 2\n}');
});

test('mergeDefaults fills missing keys without overwriting stored values', () => {
  const target = { a: 1, nested: { kept: 'yes' }, scalar: 0 };
  const result = mergeDefaults(target, {
    a: 99,
    nested: { kept: 'no', added: 'default' },
    scalar: { unexpected: true },
    fresh: { deep: [1, 2] }
  });

  assert.equal(result, target);
  assert.deepEqual(result, {
    a: 1,
    nested: { kept: 'yes', added: 'default' },
    scalar: 0,
    fresh: { deep: [1, 2] }
  });
});
