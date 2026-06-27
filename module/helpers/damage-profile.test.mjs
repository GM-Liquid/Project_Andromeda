import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatDamageProfile,
  getDamageForOutcome,
  hasDamageProfileValue
} from './damage-profile.mjs';

test('damage profiles normalize legacy numeric values to four outcome slots', () => {
  assert.equal(formatDamageProfile(3), '0/3/3/3');
  assert.equal(formatDamageProfile('1/2'), '1/2/0/0');
  assert.equal(formatDamageProfile('0/1/2/4'), '0/1/2/4');
});

test('damage profiles resolve damage by skill-check outcome', () => {
  assert.equal(getDamageForOutcome('0/1/2/4', 'Failure'), 0);
  assert.equal(getDamageForOutcome('0/1/2/4', 'SuccessWithCost'), 1);
  assert.equal(getDamageForOutcome('0/1/2/4', 'Success'), 2);
  assert.equal(getDamageForOutcome('0/1/2/4', 'CriticalSuccess'), 4);
  assert.equal(getDamageForOutcome('0/1/2/4', 'Unknown'), 0);
});

test('damage profiles report whether any outcome deals damage', () => {
  assert.equal(hasDamageProfileValue('0/0/0/0'), false);
  assert.equal(hasDamageProfileValue('0/0/1/1'), true);
});
