import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.Actor = class {};

const { ProjectAndromedaActor } = await import('../documents/actor.mjs');

function createActorPrototype() {
  return Object.create(ProjectAndromedaActor.prototype);
}

test('uses 4 x rank stress for player, minion, and rank-and-file characters', () => {
  const actor = createActorPrototype();

  assert.equal(actor._calcStressMax({ currentRank: 1 }), 4);
  assert.equal(actor._calcGmStressMax({ currentRank: 2 }), 8);
  assert.equal(actor._calcGmStressMax({ currentRank: 4 }), 16);
});

test('uses 10 x rank stress for elite characters', () => {
  const actor = createActorPrototype();

  assert.equal(actor._calcEliteStressMax({ currentRank: 1 }), 10);
  assert.equal(actor._calcEliteStressMax({ currentRank: 3 }), 30);
});
