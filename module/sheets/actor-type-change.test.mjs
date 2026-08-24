import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.ActorSheet ??= class {};

const { updateActorDocumentType } = await import('./actor-sheet.mjs');

test('actor type changes resend system data with the non-recursive update required by v13', async () => {
  const updates = [];
  const source = { system: { biography: { name: 'Кай' }, attributes: { currentRank: 2 } } };
  const actor = {
    type: 'playerCharacter',
    toObject: () => structuredClone(source),
    update: async (...args) => updates.push(args)
  };

  globalThis.game = { model: { Actor: { elite: { attributes: { currentRank: 0, heat: 0 } } } } };

  try {
    assert.equal(await updateActorDocumentType(actor, 'elite'), true);
  } finally {
    delete globalThis.game;
  }

  assert.equal(updates.length, 1);
  const [changes, options] = updates[0];
  assert.deepEqual(options, { recursive: false });
  assert.equal(changes.type, 'elite');
  assert.deepEqual(changes.system, {
    biography: { name: 'Кай' },
    attributes: { currentRank: 2, heat: 0 }
  });
});

test('actor type changes ignore unsupported and unchanged types', async () => {
  const actor = {
    type: 'elite',
    update: async () => assert.fail('actor.update must not be called')
  };

  assert.equal(await updateActorDocumentType(actor, 'elite'), false);
  assert.equal(await updateActorDocumentType(actor, 'unsupported'), false);
});
