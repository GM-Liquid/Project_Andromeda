import assert from 'node:assert/strict';
import test from 'node:test';

import { calcMovementSpeed, getBaseMovementSpeedByRank } from '../helpers/movement-speed.mjs';

test('maps character rank to the new base movement speed', () => {
  assert.equal(getBaseMovementSpeedByRank(0), 0);
  assert.equal(getBaseMovementSpeedByRank(1), 15);
  assert.equal(getBaseMovementSpeedByRank(2), 45);
  assert.equal(getBaseMovementSpeedByRank(3), 150);
  assert.equal(getBaseMovementSpeedByRank(4), 450);
  assert.equal(getBaseMovementSpeedByRank(99), 450);
});

test('keeps armor and temporary speed additive on top of the rank base', () => {
  assert.equal(calcMovementSpeed({ currentRank: 1, tempspeed: 4 }, { armor: { speed: 6 } }), 25);
  assert.equal(
    calcMovementSpeed({ currentRank: 4, tempspeed: 10 }, { armor: { speed: -20 } }),
    440
  );
});
