import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildActorDeltaSnapshot,
  getSceneActorTokens,
  getTokenIsolationPlan
} from './token-isolation.mjs';

function createActor() {
  return {
    id: 'actor-1',
    toObject: () => ({
      _id: 'actor-1',
      name: 'Ирис',
      type: 'playerCharacter',
      img: 'iris.webp',
      system: { stress: { value: 3, max: 10 }, biography: { weakness: 'Дом' } },
      items: [{ _id: 'ability-1', name: 'Рывок', system: { cooldown: { used: 1 } }}],
      effects: [{ _id: 'effect-1', disabled: false }],
      ownership: { default: 0, player: 3 },
      flags: { test: { value: true } },
      prototypeToken: { actorLink: true }
    })
  };
}

function createToken(id, actorId, actorLink = false) {
  return { id, actorId, actorLink };
}

test('actor delta snapshot contains every ActorDelta field and excludes unrelated actor data', () => {
  const snapshot = buildActorDeltaSnapshot(createActor());

  assert.deepEqual(snapshot.system.stress, { value: 3, max: 10 });
  assert.equal(snapshot.items[0]._id, 'ability-1');
  assert.equal(snapshot.items[0].system.cooldown.used, 1);
  assert.deepEqual(snapshot.effects, [{ _id: 'effect-1', disabled: false }]);
  assert.deepEqual(snapshot.ownership, { default: 0, player: 3 });
  assert.equal('prototypeToken' in snapshot, false);
});

test('scene actor lookup only returns tokens for the requested actor', () => {
  const scene = {
    tokens: [
      createToken('token-1', 'actor-1'),
      createToken('token-2', 'actor-2'),
      createToken('token-3', 'actor-1')
    ]
  };

  assert.deepEqual(
    getSceneActorTokens(scene, 'actor-1').map((token) => token.id),
    ['token-1', 'token-3']
  );
});

test('the first token is linked to the world actor', () => {
  const actor = createActor();
  const token = createToken('token-1', actor.id, false);
  const plan = getTokenIsolationPlan({ scene: { tokens: [token] }, actor, createdToken: token });

  assert.deepEqual(plan.map(({ update }) => update), [{ actorLink: true, delta: {} }]);
});

test('creating a second token snapshots the actor into both token deltas', () => {
  const actor = createActor();
  const first = createToken('token-1', actor.id, true);
  const second = createToken('token-2', actor.id, false);
  const plan = getTokenIsolationPlan({
    scene: { tokens: [first, second] },
    actor,
    createdToken: second
  });

  assert.deepEqual(
    plan.map(({ token }) => token.id),
    ['token-1', 'token-2']
  );
  assert.equal(plan.every(({ update }) => update.actorLink === false), true);
  assert.equal(plan[0].update.delta.system.stress.value, 3);
  assert.equal(plan[1].update.delta.items[0].system.cooldown.used, 1);
  assert.notStrictEqual(plan[0].update.delta, plan[1].update.delta);
});

test('existing isolated tokens are left untouched when another token is created', () => {
  const actor = createActor();
  const first = createToken('token-1', actor.id, false);
  const second = createToken('token-2', actor.id, false);
  const third = createToken('token-3', actor.id, false);
  const plan = getTokenIsolationPlan({
    scene: { tokens: [first, second, third] },
    actor,
    createdToken: third
  });

  assert.deepEqual(
    plan.map(({ token }) => token.id),
    ['token-3']
  );
});