import assert from 'node:assert/strict';
import test from 'node:test';

import { toRoman } from './roman.mjs';

test('toRoman converts ranks 1-5 to Roman numerals', () => {
  assert.equal(toRoman(1), 'I');
  assert.equal(toRoman(2), 'II');
  assert.equal(toRoman(3), 'III');
  assert.equal(toRoman(4), 'IV');
  assert.equal(toRoman(5), 'V');
});

test('toRoman accepts numeric strings', () => {
  assert.equal(toRoman('3'), 'III');
});

test('toRoman falls back to arabic for out-of-range values', () => {
  assert.equal(toRoman(0), '0');
  assert.equal(toRoman(11), '11');
});

test('toRoman returns an empty string for invalid input', () => {
  assert.equal(toRoman('abc'), '');
  assert.equal(toRoman(null), '');
  assert.equal(toRoman(undefined), '');
});
